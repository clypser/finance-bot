const express = require('express');
const { Telegraf, Markup } = require('telegraf');
const { OpenAI } = require('openai');
const { PrismaClient } = require('@prisma/client');
const cors = require('cors');
const { HttpsProxyAgent } = require('https-proxy-agent');
const axios = require('axios');
const { startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, subDays, addMonths } = require('date-fns');

const app = express();
const prisma = new PrismaClient();
const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN || '');

console.log("🚀 Server starting... Loomy AI (clean rewrite)");

const apiKey = process.env.OPENAI_API_KEY || '';
const geminiKey = process.env.GEMINI_API_KEY || '';
const proxyUrl = process.env.PROXY_URL || '';
const baseURL = process.env.OPENAI_BASE_URL || undefined;

let openai;
const openaiConfig = { apiKey: apiKey || "", baseURL: baseURL || undefined };
if (proxyUrl) {
  openaiConfig.httpAgent = new HttpsProxyAgent(proxyUrl);
}
openai = new OpenAI(openaiConfig);

app.use(cors());
app.use(express.json());

// --- Helpers and constants (оставлены имена функций, чтобы не ломать остальную логику) ---
const SUBSCRIPTION_PLANS = {
  '1_month': { title: 'Loomy Pro (1 месяц)', price: 100, months: 1 },
  '3_months': { title: 'Loomy Pro (3 месяца)', price: 270, months: 3 },
  '12_months': { title: 'Loomy Pro (1 год)', price: 1000, months: 12 },
};

const GREETINGS = ['привет', 'здравствуйте', 'ку', 'хай', 'hello', 'hi', 'салам', 'добрый день', 'добрый вечер', 'доброе утро', 'start', '/start'];

const getCurrencyMenu = () => Markup.inlineKeyboard([
  [Markup.button.callback('🇺🇿 UZS', 'curr_UZS'), Markup.button.callback('🇺🇸 USD', 'curr_USD')],
  [Markup.button.callback('🇷🇺 RUB', 'curr_RUB'), Markup.button.callback('🇰🇿 KZT', 'curr_KZT')],
  [Markup.button.callback('🇪🇺 EUR', 'curr_EUR')]
]);

// Упрощённая и безопасная функция analyzeText — использует OpenAI если есть ключ, иначе простой регекс-парсер
async function analyzeText(text, userCurrency = 'UZS') {
  try {
    // Быстрая очистка
    let cleanText = (text || '').toString().trim();
    cleanText = cleanText.replace(/(\d+)\s*[kк]/gi, (m, p1) => p1 + '000');
    cleanText = cleanText.replace(/(\d+)\s*(m|м|млн)/gi, (m, p1) => p1 + '000000');

    // Попробуем вызвать OpenAI если ключ есть
    if (apiKey) {
      const prompt = `Analyze transaction: "${cleanText}".\nUser Default Currency: ${userCurrency}.\nReturn JSON: { amount, currency, category, type } where type one of [income, expense, debt_lent, debt_borrowed].`;
      const completion = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.0,
        response_format: { type: 'json_object' }
      });
      const textResponse = completion.choices?.[0]?.message?.content;
      if (textResponse) {
        // Если модель вернула строку JSON — парсим
        try { return JSON.parse(textResponse); } catch (e) { /* пропускаем к локальному парсеру */ }
      }
    }

    // fallback: локальный простой парсер
    const amountMatch = cleanText.match(/(\d+[\.,]?\d*)/);
    const amount = amountMatch ? parseFloat(amountMatch[1].replace(',', '.')) : null;
    // простой детект долга по ключевым словам
    let lowered = cleanText.toLowerCase();
    let type = 'expense';
    if (lowered.includes('задолж') || lowered.includes('долг') || lowered.includes('одолж')) type = 'debt_borrowed';
    if (lowered.includes('дал ') || lowered.includes('отдал') || lowered.includes('отдал в долг') || lowered.includes('я занял')) type = 'debt_lent';
    if (lowered.includes('зарп') || lowered.includes('доход') || lowered.includes('прем')) type = 'income';

    // категория — первое слово до числа или слово перед числом
    let category = 'Прочее';
    const beforeNumber = cleanText.split(amountMatch ? amountMatch[0] : '')[0].trim();
    if (beforeNumber) category = beforeNumber.split(' ').slice(-2).join(' ').trim() || 'Прочее';

    return { amount, currency: userCurrency, category, type };
  } catch (e) {
    console.error('analyzeText error', e);
    return {};
  }
}

async function getGeminiAdvice(transactions, currency) {
  if (!geminiKey) return "Добавьте GEMINI_API_KEY для советов.";
  try {
    const totalIncome = transactions.filter(t => t.type === 'income').reduce((s, t) => s + (t.amount || 0), 0);
    const totalExpense = transactions.filter(t => t.type === 'expense').reduce((s, t) => s + (t.amount || 0), 0);
    const categories = {};
    transactions.filter(t => t.type === 'expense').forEach(t => categories[t.category] = (categories[t.category] || 0) + (t.amount || 0));
    const topCats = Object.entries(categories).sort((a,b) => b[1]-a[1]).slice(0,3).map(([k,v]) => `${k} (${v})`).join(', ');

    const prompt = `Ты фин. помощник. Доходы: ${totalIncome}, Расходы: ${totalExpense}, Топ: ${topCats}.`; 

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiKey}`;
    const axiosConfig = { timeout: 15000 };
    if (proxyUrl) {
      axiosConfig.httpsAgent = new HttpsProxyAgent(proxyUrl); axiosConfig.proxy = false;
    }
    const response = await axios.post(url, { contents: [{ parts: [{ text: prompt }] }] }, axiosConfig);
    return response.data?.candidates?.[0]?.content?.parts?.[0]?.text || 'Нет совета.';
  } catch (e) { console.error('getGeminiAdvice', e); return 'Ошибка при получении совета.'; }
}

async function checkSubscription(userId) {
  try {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return { isPro: false, canAdd: false, remaining: 0 };
    let isPro = user.isPro;
    if (isPro && user.proExpiresAt && new Date() > new Date(user.proExpiresAt)) {
      await prisma.user.update({ where: { id: userId }, data: { isPro: false, proExpiresAt: null } });
      isPro = false;
    }
    if (isPro) return { isPro: true, canAdd: true, remaining: 9999 };
    const weekAgo = subDays(new Date(), 7);
    const count = await prisma.transaction.count({ where: { userId: userId, date: { gte: weekAgo } } });
    return { isPro: false, canAdd: count < 50, remaining: Math.max(0, 50 - count) };
  } catch (e) { console.error('checkSubscription', e); return { isPro: false, canAdd: false, remaining: 0 }; }
}

// --- Telegram bot handlers (сохранил имена и поведение, добавил надежность) ---
bot.start(async (ctx) => {
  try {
    const { id, first_name, username } = ctx.from;
    const user = await prisma.user.upsert({ where: { telegramId: BigInt(id) }, update: { firstName: first_name, username }, create: { telegramId: BigInt(id), firstName: first_name, username, currency: 'UZS' } });
    await ctx.replyWithHTML(`👋 <b>Привет, ${first_name}!</b>\n\nЯ <b>Loomy AI</b> — твой умный финансовый помощник.\n\n💰 Твоя валюта: <b>${user.currency}</b>`);
    await ctx.reply('👇 Нажми кнопку, чтобы открыть приложение', Markup.keyboard([[Markup.button.webApp('📱 Открыть Loomy AI', process.env.WEBAPP_URL || 'https://example.com')]]).resize());
  } catch (e) { console.error('bot.start error', e); }
});

bot.on('text', async (ctx) => {
  try {
    const user = await prisma.user.findUnique({ where: { telegramId: BigInt(ctx.from.id) } });
    if (!user) return ctx.reply('/start');
    const subStatus = await checkSubscription(user.id);
    if (!subStatus.canAdd) return ctx.reply('⛔ Лимит исчерпан.');

    const textLower = ctx.message.text.toLowerCase().replace(/[!.]/g, '').trim();
    if (GREETINGS.some(g => textLower.includes(g))) return ctx.reply('Привет! 👋');

    const reserveMatch = ctx.message.text.match(/(\d+)\s*[kк]?/i);
    const result = await analyzeText(ctx.message.text, user.currency || 'UZS');

    // Фолбэки: если AI не дал amount, используем резерв
    if ((!result || !result.amount) && reserveMatch) {
      let reserveAmount = parseFloat(reserveMatch[1]);
      if (ctx.message.text.toLowerCase().includes('к') || ctx.message.text.toLowerCase().includes('k')) reserveAmount *= 1000;
      result.amount = reserveAmount;
      // пробуем заполнить category/type простым парсером
      const basic = await analyzeText(ctx.message.text.replace(reserveMatch[0], ''), user.currency || 'UZS');
      result.category = result.category || basic.category || 'Прочее';
      result.type = result.type || basic.type || 'expense';
    }

    if (!result || !result.amount) return ctx.reply('⚠️ AI не нашел сумму в сообщении. Попробуйте написать цифрами.');

    // 🔥 Надёжные фолбэки
    if (!result.type) result.type = 'expense';
    if (!result.category) result.category = 'Прочее';

    const currency = result.currency || user.currency;

    if (result.type === 'debt_lent' || result.type === 'debt_borrowed') {
      const typeMap = { 'debt_lent': 'lent', 'debt_borrowed': 'borrowed' };
      await prisma.debt.create({ data: { amount: parseFloat(result.amount), currency, personName: result.category || 'Кто-то', type: typeMap[result.type], userId: user.id, isPaid: false } });
      const arrow = result.type === 'debt_lent' ? '↗️' : '↙️';
      const text = result.type === 'debt_lent' ? `Вы дали в долг: ${result.category}` : `Вы заняли у: ${result.category}`;
      return ctx.replyWithHTML(`📒 <b>Долг записан!</b>\n${arrow} ${text}\n💰 ${parseFloat(result.amount).toLocaleString()} ${currency}`);
    }

    await prisma.transaction.create({ data: { amount: parseFloat(result.amount), currency, category: result.category || 'Прочее', type: result.type || 'expense', description: ctx.message.text, userId: user.id } });
    return ctx.replyWithHTML(`✅ <b>${result.type === 'expense' ? '-' : '+'}${parseFloat(result.amount).toLocaleString()} ${currency}</b>\n<b>Категория:</b> ${result.category}`);

  } catch (e) { console.error('bot.on.text error', e); ctx.reply(`❌ Ошибка: ${e.message}`); }
});

bot.launch().then(() => console.log('Bot launched')).catch(e => console.error('bot launch', e));

// --- API ROUTES (сохранены имена) ---
const getUserId = async (req) => {
  const tid = req.headers['x-telegram-id']; if (!tid) return null;
  const user = await prisma.user.findUnique({ where: { telegramId: BigInt(tid) } });
  return user ? user.id : null;
};

app.get('/user/me', async (req, res) => {
  try {
    const uid = await getUserId(req); if (!uid) return res.status(401).send();
    const user = await prisma.user.findUnique({ where: { id: uid } });
    const sub = await checkSubscription(uid);
    res.json({ ...user, telegramId: user.telegramId.toString(), isPro: sub.isPro, proExpiresAt: user.proExpiresAt });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/user/currency', async (req, res) => {
  try {
    const uid = await getUserId(req); if (!uid) return res.status(401).send();
    await prisma.user.update({ where: { id: uid }, data: { currency: req.body.currency } });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/stats/:period', async (req, res) => {
  try {
    const userId = await getUserId(req); if (!userId) return res.status(401).json({});
    const user = await prisma.user.findUnique({ where: { id: userId } });
    const subStatus = await checkSubscription(userId);
    const { period } = req.params;

    const now = new Date();
    let dateFilter = {};
    if (period === 'day') dateFilter = { gte: startOfDay(now), lte: endOfDay(now) };
    else if (period === 'week') dateFilter = { gte: startOfWeek(now), lte: endOfWeek(now) };
    else dateFilter = { gte: startOfMonth(now), lte: endOfMonth(now) };

    const transactions = await prisma.transaction.findMany({ where: { userId, date: dateFilter } });
    const debts = await prisma.debt.findMany({ where: { userId, date: dateFilter } });

    const formattedDebts = debts.map(d => ({
      id: d.id,
      amount: d.amount,
      currency: d.currency,
      // НЕ преобразуем в debt_lent/debt_borrowed — фронтенд ожидает 'lent'/'borrowed'
      type: d.type,
      category: d.personName,
      description: 'Долг: ' + d.personName,
      date: d.date,
      isDebt: true
    }));

    const allItems = [...transactions, ...formattedDebts].sort((a,b) => new Date(b.date) - new Date(a.date));

    const stats = transactions.reduce((acc, curr) => { if (curr.type === 'expense') acc[curr.category] = (acc[curr.category] || 0) + curr.amount; return acc; }, {});
    const chartData = Object.keys(stats).map(k => ({ name: k, value: stats[k] }));

    res.json({ transactions: allItems, chartData, total: transactions.length, currency: user?.currency || 'UZS', isPro: subStatus.isPro, limitRemaining: subStatus.remaining });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/transaction/add', async (req, res) => {
  try {
    const uid = await getUserId(req); if (!uid) return res.status(401).send();
    const s = await checkSubscription(uid); if (!s.canAdd) return res.status(403).send();
    const u = await prisma.user.findUnique({ where: { id: uid } });
    await prisma.transaction.create({ data: { ...req.body, amount: parseFloat(req.body.amount), currency: u.currency, userId: uid } });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/transaction/:id', async (req, res) => {
  try {
    const uid = await getUserId(req); if (!uid) return res.status(401).send();
    const { amount, category, type, description } = req.body;
    await prisma.transaction.update({ where: { id: parseInt(req.params.id) }, data: { amount: parseFloat(amount), category, type, description } });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/transaction/:id', async (req, res) => {
  try {
    const uid = await getUserId(req); if (!uid) return res.status(401).send();
    await prisma.transaction.delete({ where: { id: parseInt(req.params.id) } });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/debts', async (req, res) => {
  try {
    const userId = await getUserId(req); if (!userId) return res.status(401).json({ error: 'Auth' });
    const u = await prisma.user.findUnique({ where: { id: userId } });
    const { amount, personName, type } = req.body;
    await prisma.debt.create({ data: { amount: parseFloat(amount), personName: personName || 'Кто-то', type: type, currency: u.currency, userId: userId, isPaid: false } });
    res.json({ success: true });
  } catch (e) { console.error('POST /debts', e); res.status(500).json({ error: e.message }); }
});

app.put('/debts/:id', async (req, res) => {
  try {
    const userId = await getUserId(req); if (!userId) return res.status(401).json({ error: 'Auth' });
    const { amount, personName, type, isPaid } = req.body;
    await prisma.debt.update({ where: { id: parseInt(req.params.id) }, data: { amount: parseFloat(amount), personName, type, isPaid } });
    res.json({ success: true });
  } catch (e) { console.error('PUT /debts/:id', e); res.status(500).json({ error: e.message }); }
});

app.get('/debts', async (req, res) => {
  try {
    const uid = await getUserId(req); if (!uid) return res.status(401).send();
    const debts = await prisma.debt.findMany({ where: { userId: uid }, orderBy: { date: 'desc' } });
    res.json(debts);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/debts/:id', async (req, res) => {
  try {
    const uid = await getUserId(req); if (!uid) return res.status(401).send();
    await prisma.debt.delete({ where: { id: parseInt(req.params.id) } });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/ai/advice', async (req, res) => {
  try {
    const uid = await getUserId(req); if (!uid) return res.status(401).send();
    const u = await prisma.user.findUnique({ where: { id: uid } });
    const now = new Date();
    const txs = await prisma.transaction.findMany({ where: { userId: uid, date: { gte: startOfMonth(now) } } });
    const advice = await getGeminiAdvice(txs, u.currency);
    res.json({ advice });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/transactions/clear', async (req, res) => {
  try {
    const uid = await getUserId(req); if (!uid) return res.status(401).send();
    await prisma.transaction.deleteMany({ where: { userId: uid } });
    await prisma.budget.deleteMany({ where: { userId: uid } });
    await prisma.debt.deleteMany({ where: { userId: uid } });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/user/delete', async (req, res) => {
  try {
    const uid = await getUserId(req); if (!uid) return res.status(401).send();
    await prisma.transaction.deleteMany({ where: { userId: uid } });
    await prisma.budget.deleteMany({ where: { userId: uid } });
    await prisma.debt.deleteMany({ where: { userId: uid } });
    await prisma.user.delete({ where: { id: uid } });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => console.log(`Server running on ${PORT}`));
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));