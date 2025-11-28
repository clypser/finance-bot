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
const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);

console.log("🚀 Server restarting... Loomy AI 4.4 (FINAL DEBT FIX)");

const apiKey = process.env.OPENAI_API_KEY;
const geminiKey = process.env.GEMINI_API_KEY; 
const proxyUrl = process.env.PROXY_URL; 
const baseURL = process.env.OPENAI_BASE_URL;

let openai;
const openaiConfig = { apiKey: apiKey || "", baseURL: baseURL || undefined };
if (proxyUrl) {
  const agent = new HttpsProxyAgent(proxyUrl);
  openaiConfig.httpAgent = agent;
}
openai = new OpenAI(openaiConfig);

app.use(cors());
app.use(express.json());

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
  if (category === 'Еда') return '🍔';
  return '✨';
};

const analyzeText = async (text, userCurrency = 'UZS') => {
  try {
    if (!apiKey) throw new Error("API Key missing");

    let cleanText = text.replace(/(\d+)\s*[kк]/gi, (match, p1) => p1 + '000');
    cleanText = cleanText.replace(/(\d+)\s*(m|м|млн)/gi, (match, p1) => p1 + '000000');

    const prompt = `
      Analyze transaction: "${cleanText}".
      User Default Currency: ${userCurrency}.
      RULES: Extract Amount (number), Currency (string), Category (Russian), Type ("income"|"expense"|"debt_lent"|"debt_borrowed"). If Debt, category is Name.
      Categories: [Еда, Продукты, Такси, Транспорт, Зарплата, Стипендия, Дивиденды, Вклады, Здоровье, Развлечения, Кафе, Связь, Дом, Одежда, Техника, Табак, Прочее, Долг]
      Return JSON only.
    `;

    const completion = await openai.chat.completions.create({
      messages: [{ role: "user", content: prompt }],
      model: "gpt-4o", 
      response_format: { type: "json_object" },
      temperature: 0.1 
    });

    return JSON.parse(completion.choices[0].message.content);
  } catch (e) { console.error(e); return {}; }
};

const getGeminiAdvice = async (transactions, currency) => {
    if (!geminiKey) return "Пожалуйста, добавьте GEMINI_API_KEY на сервер для получения советов.";

    const totalIncome = transactions.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);
    const totalExpense = transactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);
    
    const categories = {};
    transactions.filter(t => t.type === 'expense').forEach(t => { categories[t.category] = (categories[t.category] || 0) + t.amount; });
    const topCats = Object.entries(categories).sort(([,a], [,b]) => b - a).slice(0, 3).map(([name, val]) => `${name} (${val})`).join(', ');

    const prompt = `Ты — финансовый помощник Loomy. Дай краткий, полезный и мотивирующий совет. Данные (${currency}): Доходы: ${totalIncome}, Расходы: ${totalExpense}, Топ траты: ${topCats}.`;

    try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiKey}`;
        const axiosConfig = { timeout: 15000 };
        if (proxyUrl) {
             const agent = new HttpsProxyAgent(proxyUrl);
             axiosConfig.httpsAgent = agent;
             axiosConfig.proxy = false; 
        }

        const response = await axios.post(url, { contents: [{ parts: [{ text: prompt }] }] }, axiosConfig);
        return response.data?.candidates?.[0]?.content?.parts?.[0]?.text || "Звезды сегодня молчат ✨";
    } catch (e) {
        console.error("Gemini Advice Error:", e.message);
        return "Не удалось получить совет. Проверьте ключ Gemini.";
    }
};

const checkSubscription = async (userId) => {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return { isPro: false, canAdd: false, remaining: 0 };

  let isPro = user.isPro;
  if (isPro && user.proExpiresAt && new Date() > user.proExpiresAt) {
      await prisma.user.update({ where: { id: userId }, data: { isPro: false, proExpiresAt: null } });
      isPro = false;
  }

  if (isPro) return { isPro: true, canAdd: true, remaining: 9999 };

  const weekAgo = subDays(new Date(), 7);
  const count = await prisma.transaction.count({ where: { userId: userId, date: { gte: weekAgo } } });
  return { isPro: false, canAdd: count < 50, remaining: Math.max(0, 50 - count) };
};

const GREETINGS = ['привет', 'здравствуйте', 'ку', 'хай', 'hello', 'hi', 'салам', 'добрый день', 'добрый вечер', 'доброе утро', 'start', '/start'];

bot.start(async (ctx) => {
  const { id, first_name, username } = ctx.from;
  const user = await prisma.user.upsert({ where: { telegramId: BigInt(id) }, update: { firstName: first_name, username }, create: { telegramId: BigInt(id), firstName: first_name, username, currency: 'UZS' } });
  ctx.reply(`👋 <b>Привет, ${first_name}!</b>\n\nЯ <b>Loomy AI</b> — твой умный финансовый помощник.\n\n💰 Твоя валюта: <b>${user.currency}</b>\n\nПросто напиши мне свои расходы:\n<i>"Такси 20к"</i> или <i>"Обед 50000"</i>`, { parse_mode: 'HTML', ...getCurrencyMenu() });
  ctx.reply('👇 Нажми кнопку, чтобы открыть приложение', Markup.keyboard([[Markup.button.webApp('📱 Открыть Loomy AI', process.env.WEBAPP_URL)]]).resize());
});

bot.command('currency', async (ctx) => ctx.reply('Выберите валюту для учета:', getCurrencyMenu()));

bot.action(/^curr_(.+)$/, async (ctx) => {
    await prisma.user.update({ where: { telegramId: BigInt(ctx.from.id) }, data: { currency: ctx.match[1] } });
    await ctx.answerCbQuery(`Валюта: ${ctx.match[1]}`);
    await ctx.editMessageText(`✅ Валюта изменена на <b>${ctx.match[1]}</b>`, { parse_mode: 'HTML' });
});

bot.on('pre_checkout_query', (ctx) => ctx.answerPreCheckoutQuery(true));

bot.on('successful_payment', async (ctx) => {
    const userId = ctx.from.id;
    const payload = ctx.message.successful_payment.invoice_payload; 
    let monthsToAdd = 1;
    if (payload.includes('3_months')) monthsToAdd = 3;
    if (payload.includes('12_months')) monthsToAdd = 12;

    const user = await prisma.user.findUnique({ where: { telegramId: BigInt(userId) } });
    let expiresAt = user.proExpiresAt && new Date(user.proExpiresAt) > new Date() ? new Date(user.proExpiresAt) : new Date();
    expiresAt = addMonths(expiresAt, monthsToAdd);

    await prisma.user.update({ where: { telegramId: BigInt(userId) }, data: { isPro: true, proExpiresAt: expiresAt } });
    await ctx.reply(`🎉 <b>Loomy Pro активирован!</b>\nДействует до: ${expiresAt.toLocaleDateString('ru-RU')}`, { parse_mode: 'HTML' });
});

bot.on('text', async (ctx) => {
  try {
    const user = await prisma.user.findUnique({ where: { telegramId: BigInt(ctx.from.id) } });
    if (!user) return ctx.reply('/start');
    const subStatus = await checkSubscription(user.id);
    if (!subStatus.canAdd) return ctx.reply(`⛔ <b>Лимит исчерпан</b>.`, { parse_mode: 'HTML' });

    const textLower = ctx.message.text.toLowerCase().replace(/[!.]/g, '').trim();
    if (GREETINGS.some(g => textLower.includes(g))) return ctx.reply(`Привет! 👋`);

    // РЕЗЕРВНЫЙ ПОИСК СУММЫ (если AI не справится)
    const reserveMatch = ctx.message.text.match(/(\d+)\s*[kк]?/i);

    const result = await analyzeText(ctx.message.text, user.currency || 'UZS');
    
    // ПРОВЕРКА: Если AI не нашел сумму, но есть запасное число - используем запасное число
    if (!result.amount && reserveMatch) {
        let reserveAmount = parseFloat(reserveMatch[1]);
        if (ctx.message.text.toLowerCase().includes('к') || ctx.message.text.toLowerCase().includes('k')) reserveAmount *= 1000;
        result.amount = reserveAmount;
        // Повторно парсим текст, но уже только для категории/типа, без риска потери суммы
        if (!result.category) {
            const basicResult = await analyzeText(ctx.message.text.replace(reserveMatch[0], ''), user.currency || 'UZS');
            result.category = basicResult.category || 'Прочее';
            result.type = basicResult.type || 'expense';
        }
    }
    
    if (!result.amount) return ctx.reply('⚠️ AI не нашел сумму в сообщении. Попробуйте написать цифрами.');
    
    const currency = result.currency || user.currency;

    if (result.type === 'debt_lent' || result.type === 'debt_borrowed') {
        const typeMap = { 'debt_lent': 'lent', 'debt_borrowed': 'borrowed' };
        await prisma.debt.create({
            data: { amount: result.amount, currency, personName: result.category || 'Кто-то', type: typeMap[result.type], userId: user.id }
        });
        const arrow = result.type === 'debt_lent' ? '↗️' : '↙️';
        const text = result.type === 'debt_lent' ? `Вы дали в долг: ${result.category}` : `Вы заняли у: ${result.category}`;
        return ctx.reply(`📒 <b>Долг записан!</b>\n${arrow} ${text}\n💰 ${result.amount.toLocaleString()} ${currency}`, { parse_mode: 'HTML' });
    }

    await prisma.transaction.create({
      data: { amount: result.amount, currency, category: result.category || 'Прочее', type: result.type || 'expense', description: ctx.message.text, userId: user.id }
    });
    const emoji = getCategoryEmoji(result.category);
    const sign = result.type === 'expense' ? '-' : '+';
    await ctx.reply(`✅ <b>${sign}${result.amount.toLocaleString()} ${currency}</b>\n${emoji} <b>Категория:</b> ${result.category}`, { parse_mode: 'HTML' });

  } catch (e) { console.error(e); ctx.reply(`❌ Ошибка: ${e.message}`); }
});

bot.launch();

// --- API ROUTES ---
const getUserId = async (req) => {
  const tid = req.headers['x-telegram-id']; if (!tid) return null;
  const user = await prisma.user.findUnique({ where: { telegramId: BigInt(tid) } });
  return user ? user.id : null;
};

app.get('/user/me', async (req, res) => {
  const uid = await getUserId(req); if (!uid) return res.status(401).send();
  const user = await prisma.user.findUnique({ where: { id: uid } });
  const sub = await checkSubscription(uid);
  res.json({ ...user, telegramId: user.telegramId.toString(), isPro: sub.isPro, proExpiresAt: user.proExpiresAt });
});

app.post('/user/currency', async (req, res) => {
    const uid = await getUserId(req); if (!uid) return res.status(401).send();
    await prisma.user.update({ where: { id: uid }, data: { currency: req.body.currency } });
    res.json({ success: true });
});

app.get('/stats/:period', async (req, res) => {
  try {
    const userId = await getUserId(req); if (!userId) return res.status(401).json({});
    const user = await prisma.user.findUnique({ where: { id: userId } });
    const subStatus = await checkSubscription(userId);
    const { period } = req.params;
    
    let dateFilter = {};
    const now = new Date();
    if (period === 'day') dateFilter = { gte: startOfDay(now), lte: endOfDay(now) };
    if (period === 'week') dateFilter = { gte: startOfWeek(now), lte: endOfWeek(now) };
    if (period === 'month') dateFilter = { gte: startOfMonth(now), lte: endOfMonth(now) };

    const transactions = await prisma.transaction.findMany({ where: { userId, date: dateFilter } });
    const debts = await prisma.debt.findMany({ where: { userId, date: dateFilter } });

    // Объединяем транзакции и долги для общей ленты
    const formattedDebts = debts.map(d => ({
        id: d.id,
        amount: d.amount,
        currency: d.currency,
        category: d.personName,
        type: d.type === 'lent' ? 'debt_lent' : 'debt_borrowed',
        description: 'Долг: ' + d.personName,
        date: d.date,
        isDebt: true // Флаг, чтобы фронтенд знал, что это долг
    }));

    const allItems = [...transactions, ...formattedDebts].sort((a, b) => new Date(b.date) - new Date(a.date));

    // Статистика и ChartData считаются только по обычным транзакциям (как и требовалось)
    const stats = transactions.reduce((acc, curr) => { 
        if (curr.type === 'expense') acc[curr.category] = (acc[curr.category] || 0) + curr.amount; 
        return acc; 
    }, {});
    const chartData = Object.keys(stats).map(key => ({ name: key, value: stats[key] }));
    
    res.json({ 
        transactions: allItems, 
        chartData, 
        total: transactions.length, 
        currency: user?.currency || 'UZS', 
        isPro: subStatus.isPro, 
        limitRemaining: subStatus.remaining 
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/transaction/add', async (req, res) => {
    const uid = await getUserId(req); if (!uid) return res.status(401).send();
    const s = await checkSubscription(uid); if(!s.canAdd) return res.status(403).send();
    const u = await prisma.user.findUnique({ where: { id: uid } });
    await prisma.transaction.create({ data: { ...req.body, amount: parseFloat(req.body.amount), currency: u.currency, userId: uid } });
    res.json({ success: true });
});

app.put('/transaction/:id', async (req, res) => {
    const uid = await getUserId(req); if (!uid) return res.status(401).send();
    const { amount, category, type, description } = req.body;
    await prisma.transaction.update({ where: { id: parseInt(req.params.id) }, data: { amount: parseFloat(amount), category, type, description } });
    res.json({ success: true });
});

app.delete('/transaction/:id', async (req, res) => {
    const uid = await getUserId(req); if (!uid) return res.status(401).send();
    await prisma.transaction.delete({ where: { id: parseInt(req.params.id) } });
    res.json({ success: true });
});

app.post('/debts', async (req, res) => {
    const userId = await getUserId(req); 
    if(!userId) return res.status(401).json({ error: 'Auth' });
    
    const u = await prisma.user.findUnique({ where: { id: userId } });
    const { amount, personName, type } = req.body; 
    
    try {
        await prisma.debt.create({
            data: {
                amount: parseFloat(amount),
                personName: personName, 
                type: type,
                currency: u.currency,
                userId: userId,
                isPaid: false
            }
        });
        res.json({ success: true });
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: e.message });
    }
});

app.put('/debts/:id', async (req, res) => {
    const userId = await getUserId(req); if(!userId) return res.status(401).json({ error: 'Auth' });
    
    const { amount, personName, type, isPaid } = req.body;

    try {
        await prisma.debt.update({
            where: { id: parseInt(req.params.id) },
            data: { 
                amount: parseFloat(amount), 
                personName: personName, 
                type: type, 
                isPaid: isPaid 
            }
        });
        res.json({ success: true });
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: e.message });
    }
});

app.get('/debts', async (req, res) => {
    const uid = await getUserId(req); if(!uid) return res.status(401).send();
    const debts = await prisma.debt.findMany({ where: { userId: uid }, orderBy: { date: 'desc' } });
    res.json(debts);
});
app.delete('/debts/:id', async (req, res) => {
    const uid = await getUserId(req); if(!uid) return res.status(401).send();
    await prisma.debt.delete({ where: { id: parseInt(req.params.id) } });
    res.json({ success: true });
});

// ... (остальные маршруты) ...

app.get('/ai/advice', async (req, res) => {
    const uid = await getUserId(req); if (!uid) return res.status(401).send();
    const u = await prisma.user.findUnique({ where: { id: uid } });
    const now = new Date();
    const txs = await prisma.transaction.findMany({ where: { userId: uid, date: { gte: startOfMonth(now) } } });
    const advice = await getGeminiAdvice(txs, u.currency);
    res.json({ advice });
});
app.delete('/transactions/clear', async (req, res) => {
  const uid = await getUserId(req); if(!uid) return res.status(401).send();
  await prisma.transaction.deleteMany({ where: { userId: uid } });
  await prisma.budget.deleteMany({ where: { userId: uid } });
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

const PORT = 3000;
app.listen(PORT, '0.0.0.0', () => console.log(`Server running on ${PORT}`));
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));