const express = require('express');
const { Telegraf, Markup } = require('telegraf');
const { OpenAI } = require('openai');
const { PrismaClient } = require('@prisma/client');
const cors = require('cors');
const { HttpsProxyAgent } = require('https-proxy-agent');
const { startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, subDays, addMonths } = require('date-fns');

const app = express();
const prisma = new PrismaClient();
const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);

console.log("🚀 Server restarting... Loomy AI 4.0 (Debts & Editing)");

// === НАСТРОЙКИ ===
const apiKey = process.env.OPENAI_API_KEY;
const proxyUrl = process.env.PROXY_URL; 
const baseURL = process.env.OPENAI_BASE_URL;

let openai;
const openaiConfig = { apiKey: apiKey || "", baseURL: baseURL || undefined };

if (proxyUrl) {
  console.log(`🌐 Using Proxy: ${proxyUrl}`);
  const agent = new HttpsProxyAgent(proxyUrl);
  openaiConfig.httpAgent = agent;
}
openai = new OpenAI(openaiConfig);

app.use(cors());
app.use(express.json());

// === КЛАВИАТУРА ВАЛЮТ ===
const getCurrencyMenu = () => Markup.inlineKeyboard([
  [Markup.button.callback('🇺🇿 UZS', 'curr_UZS'), Markup.button.callback('🇺🇸 USD', 'curr_USD')],
  [Markup.button.callback('🇷🇺 RUB', 'curr_RUB'), Markup.button.callback('🇰🇿 KZT', 'curr_KZT')],
  [Markup.button.callback('🇪🇺 EUR', 'curr_EUR')]
]);

// --- EMOJI MAP ---
const getCategoryEmoji = (category) => {
  const map = {
    'Продукты': '🛒', 'Еда вне дома': '🍔', 'Кофе': '☕', 'Алкоголь': '🍺', 'Табак': '🚬',
    'Транспорт': '🚌', 'Такси': '🚕', 'Авто': '🚘', 'Бензин': '⛽', 'Каршеринг': '🚗',
    'Дом': '🏠', 'ЖКУ': '💡', 'Ремонт': '🛠️', 'Связь': '📱', 'Интернет': '🌐',
    'Здоровье': '💊', 'Красота': '💅', 'Спорт': '💪', 'Одежда': '👕', 'Обувь': '👟',
    'Техника': '💻', 'Развлечения': '🍿', 'Подписки': '🔄', 'Хобби': '🎨', 'Путешествия': '✈️',
    'Образование': '📚', 'Дети': '🧸', 'Животные': '🐶', 'Подарки': '🎁', 'Благотворительность': '❤️',
    'Кредиты': '💳', 'Налоги': '🏛️', 'Комиссии': '💸',
    'Зарплата': '💰', 'Аванс': '💸', 'Премия': '🏆', 'Стипендия': '🎓', 'Фриланс': '💻',
    'Бизнес': '💼', 'Дивиденды': '📈', 'Вклады': '🏦', 'Кэшбэк': '🤑',
    'Подарки (полученные)': '🎁', 'Продажа вещей': '📦', 'Возврат долга': '🤝',
    'Прочее': '📝', 'Долг': '📒'
  };
  for (const key in map) {
    if (category && category.toLowerCase().includes(key.toLowerCase())) return map[key];
  }
  return '✨';
};

// --- AI HELPERS ---
const analyzeText = async (text, userCurrency = 'UZS') => {
  try {
    if (!apiKey) throw new Error("API Key missing");

    let cleanText = text.replace(/(\d+)\s*[kк]/gi, (match, p1) => p1 + '000');
    cleanText = cleanText.replace(/(\d+)\s*(m|м|млн)/gi, (match, p1) => p1 + '000000');

    const prompt = `
      Analyze transaction: "${cleanText}". Default Currency: ${userCurrency}.
      
      RULES:
      1. Extract Amount (number).
      2. Extract Currency (string).
      3. Extract Category (Russian).
      4. Determine Type:
         - "income": Earnings, salary.
         - "expense": Spending.
         - "debt_lent": I gave money to someone (Я дал в долг, одолжил).
         - "debt_borrowed": I took money from someone (Я взял в долг, занял).
      5. If Debt, "category" is the Person Name (e.g. "Антон").

      Output JSON ONLY. Example: {"amount": 100, "currency": "UZS", "type": "debt_lent", "category": "Антон"}
    `;

    const completion = await openai.chat.completions.create({
      messages: [{ role: "user", content: prompt }],
      model: "gpt-4o", 
      response_format: { type: "json_object" },
      temperature: 0.1 
    });

    return JSON.parse(completion.choices[0].message.content);
  } catch (e) { return {}; }
};

// --- BOT LOGIC ---
const checkSubscription = async (userId) => {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return { isPro: false, canAdd: false, remaining: 0 };
  if (user.isPro && (!user.proExpiresAt || new Date() < user.proExpiresAt)) {
      return { isPro: true, canAdd: true, remaining: 9999, expiresAt: user.proExpiresAt };
  }
  const weekAgo = subDays(new Date(), 7);
  const count = await prisma.transaction.count({ where: { userId: userId, date: { gte: weekAgo } } });
  return { isPro: false, canAdd: count < 50, remaining: Math.max(0, 50 - count), expiresAt: null };
};

bot.start(async (ctx) => {
  const { id, first_name, username } = ctx.from;
  await prisma.user.upsert({
      where: { telegramId: BigInt(id) },
      update: { firstName: first_name, username },
      create: { telegramId: BigInt(id), firstName: first_name, username, currency: 'UZS' }
  });
  ctx.reply(`👋 <b>Привет, ${first_name}!</b>\nЯ Loomy AI.\n\nДолги пиши так:\n<i>"Дал Антону 100к"</i> или <i>"Занял у мамы 500к"</i>`, { parse_mode: 'HTML', ...getCurrencyMenu() });
});

bot.command('currency', async (ctx) => ctx.reply('Валюта:', getCurrencyMenu()));
bot.action(/^curr_(.+)$/, async (ctx) => {
    await prisma.user.update({ where: { telegramId: BigInt(ctx.from.id) }, data: { currency: ctx.match[1] } });
    await ctx.editMessageText(`✅ Валюта: <b>${ctx.match[1]}</b>`, { parse_mode: 'HTML' });
});

bot.on('text', async (ctx) => {
  try {
    const userId = BigInt(ctx.from.id);
    const user = await prisma.user.findUnique({ where: { telegramId: userId } });
    if (!user) return ctx.reply('/start');
    
    const sub = await checkSubscription(user.id);
    if (!sub.canAdd) return ctx.reply(`⛔ Лимит исчерпан.`);

    if (!/\d/.test(ctx.message.text) && !/(тысяч|миллион|к|k|m|м)/i.test(ctx.message.text)) return ctx.reply('⚠️ Не вижу сумму.');

    const result = await analyzeText(ctx.message.text, user.currency || 'UZS');
    if (!result || !result.amount) return ctx.reply('⚠️ Не понял.');

    const currency = result.currency || user.currency || 'UZS';

    // === ОБРАБОТКА ДОЛГОВ ===
    if (result.type === 'debt_lent' || result.type === 'debt_borrowed') {
        const typeMap = { 'debt_lent': 'lent', 'debt_borrowed': 'borrowed' };
        await prisma.debt.create({
            data: {
                amount: result.amount,
                currency: currency,
                personName: result.category || 'Кто-то', // Для долгов category это Имя
                type: typeMap[result.type],
                userId: user.id
            }
        });
        const arrow = result.type === 'debt_lent' ? '↗️' : '↙️';
        const text = result.type === 'debt_lent' ? `Вы дали в долг: ${result.category}` : `Вы заняли у: ${result.category}`;
        return ctx.reply(`📒 <b>Долг записан!</b>\n${arrow} ${text}\n💰 ${result.amount.toLocaleString()} ${currency}`, { parse_mode: 'HTML' });
    }

    // === ОБЫЧНЫЕ ТРАНЗАКЦИИ ===
    await prisma.transaction.create({
      data: {
        amount: result.amount,
        currency: currency,
        category: result.category || 'Прочее',
        type: result.type || 'expense',
        description: ctx.message.text,
        userId: user.id
      }
    });

    const emoji = getCategoryEmoji(result.category);
    const sign = result.type === 'expense' ? '-' : '+';
    await ctx.reply(`✅ <b>${sign}${result.amount.toLocaleString()} ${currency}</b>\n${emoji} ${result.category}`, { parse_mode: 'HTML' });

  } catch (e) { console.error(e); ctx.reply(`❌ Ошибка: ${e.message}`); }
});

bot.launch();

// --- API ROUTES ---
const getUserId = async (req) => {
  const tid = req.headers['x-telegram-id'];
  if (!tid) return null;
  const user = await prisma.user.findUnique({ where: { telegramId: BigInt(tid) } });
  return user ? user.id : null;
};

app.get('/user/me', async (req, res) => {
  const uid = await getUserId(req); if(!uid) return res.status(401).send();
  const u = await prisma.user.findUnique({ where: { id: uid } });
  const s = await checkSubscription(uid);
  res.json({ ...u, telegramId: u.telegramId.toString(), isPro: s.isPro, proExpiresAt: u.proExpiresAt });
});

app.post('/user/currency', async (req, res) => {
    const uid = await getUserId(req); if(!uid) return res.status(401).send();
    await prisma.user.update({ where: { id: uid }, data: { currency: req.body.currency } });
    res.json({ success: true });
});

// ТРАНЗАКЦИИ
app.get('/stats/:period', async (req, res) => {
    const uid = await getUserId(req); if(!uid) return res.status(401).send();
    const u = await prisma.user.findUnique({ where: { id: uid } });
    const { period } = req.params;
    const now = new Date();
    let d = {};
    if (period === 'day') d = { gte: startOfDay(now), lte: endOfDay(now) };
    if (period === 'week') d = { gte: startOfWeek(now), lte: endOfWeek(now) };
    if (period === 'month') d = { gte: startOfMonth(now), lte: endOfMonth(now) };
    const txs = await prisma.transaction.findMany({ where: { userId: uid, date: d }, orderBy: { date: 'desc' } });
    const chart = Object.entries(txs.reduce((a, c) => { if(c.type==='expense') a[c.category]=(a[c.category]||0)+c.amount; return a;}, {})).map(([name, value]) => ({name, value}));
    res.json({ transactions: txs, chartData: chart, currency: u.currency });
});

app.delete('/transaction/:id', async (req, res) => {
    const uid = await getUserId(req); if(!uid) return res.status(401).send();
    await prisma.transaction.delete({ where: { id: parseInt(req.params.id) } });
    res.json({ success: true });
});

// РЕДАКТИРОВАНИЕ ТРАНЗАКЦИИ
app.put('/transaction/:id', async (req, res) => {
    const uid = await getUserId(req); if(!uid) return res.status(401).send();
    const { amount, category, type, description } = req.body;
    await prisma.transaction.update({
        where: { id: parseInt(req.params.id) },
        data: { amount: parseFloat(amount), category, type, description }
    });
    res.json({ success: true });
});

app.post('/transaction/add', async (req, res) => {
    const uid = await getUserId(req); if(!uid) return res.status(401).send();
    const s = await checkSubscription(uid); if(!s.canAdd) return res.status(403).send();
    const u = await prisma.user.findUnique({ where: { id: uid } });
    await prisma.transaction.create({ data: { ...req.body, amount: parseFloat(req.body.amount), currency: u.currency, userId: uid } });
    res.json({ success: true });
});

// --- ДОЛГИ ---
app.get('/debts', async (req, res) => {
    const uid = await getUserId(req); if(!uid) return res.status(401).send();
    const debts = await prisma.debt.findMany({ where: { userId: uid }, orderBy: { id: 'desc' } });
    res.json(debts);
});

app.post('/debts', async (req, res) => {
    const uid = await getUserId(req); if(!uid) return res.status(401).send();
    const u = await prisma.user.findUnique({ where: { id: uid } });
    await prisma.debt.create({
        data: {
            ...req.body,
            amount: parseFloat(req.body.amount),
            currency: u.currency,
            userId: uid,
            isPaid: false
        }
    });
    res.json({ success: true });
});

app.delete('/debts/:id', async (req, res) => {
    const uid = await getUserId(req); if(!uid) return res.status(401).send();
    await prisma.debt.delete({ where: { id: parseInt(req.params.id) } });
    res.json({ success: true });
});

app.put('/debts/:id', async (req, res) => {
    const uid = await getUserId(req); if(!uid) return res.status(401).send();
    const { amount, personName, type, isPaid } = req.body;
    await prisma.debt.update({
        where: { id: parseInt(req.params.id) },
        data: { amount: parseFloat(amount), personName, type, isPaid }
    });
    res.json({ success: true });
});

// ОЧИСТКА
app.delete('/transactions/clear', async (req, res) => {
  const uid = await getUserId(req); if(!uid) return res.status(401).send();
  await prisma.transaction.deleteMany({ where: { userId: uid } });
  await prisma.debt.deleteMany({ where: { userId: uid } });
  res.json({ success: true });
});
app.delete('/user/delete', async (req, res) => {
  const uid = await getUserId(req); if(!uid) return res.status(401).send();
  await prisma.transaction.deleteMany({ where: { userId: uid } });
  await prisma.budget.deleteMany({ where: { userId: uid } });
  await prisma.debt.deleteMany({ where: { userId: uid } });
  await prisma.user.delete({ where: { id: uid } });
  res.json({ success: true });
});

// ОПЛАТА
app.post('/payment/invoice', async (req, res) => {
    const uid = await getUserId(req); if(!uid) return res.status(401).send();
    const plan = SUBSCRIPTION_PLANS[req.body.plan || '1_month'];
    const u = await prisma.user.findUnique({ where: { id: uid } });
    await bot.telegram.sendInvoice(Number(u.telegramId), {
        title: plan.title, description: 'Pro access', payload: `sub_${req.body.plan}`, provider_token: "", currency: 'XTR', prices: [{ label: 'Pro', amount: plan.price }]
    });
    res.json({ success: true });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => console.log(`Server running on ${PORT}`));
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));