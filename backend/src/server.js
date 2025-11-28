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

console.log("🚀 Server restarting... FIX: WebApp Crash & Robust Parsing");

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

const SUBSCRIPTION_PLANS = {
    '1_month': { title: 'Loomy Pro (1 месяц)', price: 100, months: 1 },
    '3_months': { title: 'Loomy Pro (3 месяца)', price: 270, months: 3 },
    '12_months': { title: 'Loomy Pro (1 год)', price: 1000, months: 12 },
};

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
    'Прочее': '📝'
  };
  for (const key in map) {
    if (category && category.toLowerCase().includes(key.toLowerCase())) return map[key];
  }
  if (category === 'Еда') return '🍔';
  return '✨';
};

const analyzeText = async (text, userCurrency = 'UZS') => {
  // 1. Чистим текст (200к -> 200000)
  let cleanText = text.toLowerCase();
  cleanText = cleanText.replace(/(\d+)\s*[kк]/g, (match, p1) => p1 + '000');
  cleanText = cleanText.replace(/(\d+)\s*(m|м|млн)/g, (match, p1) => p1 + '000000');
  cleanText = cleanText.replace(/(\d)\s+(\d)/g, '$1$2');

  try {
    if (!apiKey) throw new Error("API Key missing");
    
    const prompt = `
      Analyze: "${cleanText}". Currency: ${userCurrency}.
      RULES: Extract Amount (number), Currency (string), Category (Russian), Type ("income"|"expense").
      Output JSON ONLY.
    `;

    const completion = await openai.chat.completions.create({
      messages: [{ role: "user", content: prompt }],
      model: "gpt-4o", 
      response_format: { type: "json_object" },
      temperature: 0.1 
    });

    const result = JSON.parse(completion.choices[0].message.content);
    
    // Если AI не вернул сумму, пробуем найти её сами (ЗАПАСНОЙ ВАРИАНТ)
    if (!result.amount) {
        const match = cleanText.match(/(\d+([.,]\d+)?)/);
        if (match) {
            result.amount = parseFloat(match[0].replace(',', '.'));
            if (!result.category) result.category = "Прочее";
            if (!result.type) result.type = "expense";
        }
    }
    
    return result;
  } catch (e) { 
    // Если AI вообще упал, пробуем хотя бы сумму вытащить
    const match = cleanText.match(/(\d+([.,]\d+)?)/);
    if (match) {
        return {
            amount: parseFloat(match[0].replace(',', '.')),
            currency: userCurrency,
            category: "Прочее",
            type: "expense"
        };
    }
    return {}; 
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
  if (isPro) return { isPro: true, canAdd: true, remaining: 9999, expiresAt: user.proExpiresAt };

  const weekAgo = subDays(new Date(), 7);
  const count = await prisma.transaction.count({ where: { userId: userId, date: { gte: weekAgo } } });
  return { isPro: false, canAdd: count < 50, remaining: Math.max(0, 50 - count), expiresAt: null };
};

const GREETINGS = ['привет', 'здравствуйте', 'ку', 'хай', 'hello', 'hi', 'салам', 'добрый день', 'добрый вечер', 'доброе утро', 'start', '/start'];

bot.start(async (ctx) => {
  const { id, first_name, username } = ctx.from;
  try {
    const user = await prisma.user.upsert({
      where: { telegramId: BigInt(id) },
      update: { firstName: first_name, username },
      create: { telegramId: BigInt(id), firstName: first_name, username, currency: 'UZS' }
    });
    await ctx.reply(`👋 <b>Привет, ${first_name}!</b>\n\nЯ <b>Loomy AI</b>.\n💰 Валюта: <b>${user.currency}</b>\n\nПиши: <i>"Обед 50к"</i>.`, { parse_mode: 'HTML', ...getCurrencyMenu() });
    await ctx.reply('👇 Открыть приложение', Markup.keyboard([[Markup.button.webApp('📱 Открыть Loomy AI', process.env.WEBAPP_URL)]]).resize());
  } catch (e) { console.error(e); }
});

bot.command('currency', async (ctx) => { await ctx.reply('Выберите валюту:', getCurrencyMenu()); });

bot.action(/^curr_(.+)$/, async (ctx) => {
    try {
        await prisma.user.update({ where: { telegramId: BigInt(ctx.from.id) }, data: { currency: ctx.match[1] } });
        await ctx.answerCbQuery(`Валюта: ${ctx.match[1]}`);
        await ctx.editMessageText(`✅ Валюта: <b>${ctx.match[1]}</b>`, { parse_mode: 'HTML' });
    } catch (e) { console.error(e); }
});

bot.on('pre_checkout_query', (ctx) => ctx.answerPreCheckoutQuery(true));
bot.on('successful_payment', async (ctx) => {
    const userId = ctx.from.id;
    const payload = ctx.message.successful_payment.invoice_payload;
    let months = payload.includes('3_months') ? 3 : payload.includes('12_months') ? 12 : 1;
    const user = await prisma.user.findUnique({ where: { telegramId: BigInt(userId) } });
    let expiresAt = user.proExpiresAt && new Date(user.proExpiresAt) > new Date() ? new Date(user.proExpiresAt) : new Date();
    expiresAt = addMonths(expiresAt, months);
    await prisma.user.update({ where: { telegramId: BigInt(userId) }, data: { isPro: true, proExpiresAt: expiresAt } });
    await ctx.reply(`🎉 <b>Pro активирован!</b> до ${expiresAt.toLocaleDateString()}`, { parse_mode: 'HTML' });
});

bot.on('text', async (ctx) => {
  try {
    const user = await prisma.user.findUnique({ where: { telegramId: BigInt(ctx.from.id) } });
    if (!user) return ctx.reply('Нажми /start');
    const sub = await checkSubscription(user.id);
    if (!sub.canAdd) return ctx.reply(`⛔ Лимит исчерпан. Купите Pro.`);

    if (GREETINGS.some(g => ctx.message.text.toLowerCase().includes(g))) return ctx.reply(`Привет! 👋 Пиши расходы.`);
    if (!/\d/.test(ctx.message.text) && !/(тысяч|миллион|к|k|m|м)/i.test(ctx.message.text)) return ctx.reply('⚠️ Не вижу сумму.');

    const result = await analyzeText(ctx.message.text, user.currency || 'UZS');
    if (!result.amount) return ctx.reply('⚠️ Не понял сумму.');

    await prisma.transaction.create({
      data: {
        amount: result.amount,
        currency: result.currency || user.currency || 'UZS',
        category: result.category || 'Прочее',
        type: result.type || 'expense',
        description: ctx.message.text,
        userId: user.id
      }
    });
    const sign = result.type === 'expense' ? '-' : '+';
    await ctx.reply(`✅ ${sign}${result.amount.toLocaleString()} ${result.currency || user.currency} | ${getCategoryEmoji(result.category)} ${result.category}`);
  } catch (e) { console.error(e); ctx.reply(`❌ Ошибка: ${e.message}`); }
});

bot.launch();

// API
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
app.get('/stats/:period', async (req, res) => {
    const uid = await getUserId(req); if(!uid) return res.status(401).send();
    const u = await prisma.user.findUnique({ where: { id: uid } });
    const s = await checkSubscription(uid);
    const { period } = req.params;
    const now = new Date();
    let d = {};
    if (period === 'day') d = { gte: startOfDay(now), lte: endOfDay(now) };
    if (period === 'week') d = { gte: startOfWeek(now), lte: endOfWeek(now) };
    if (period === 'month') d = { gte: startOfMonth(now), lte: endOfMonth(now) };
    const txs = await prisma.transaction.findMany({ where: { userId: uid, date: d }, orderBy: { date: 'desc' } });
    const chart = Object.entries(txs.reduce((a, c) => { if(c.type==='expense') a[c.category]=(a[c.category]||0)+c.amount; return a;}, {})).map(([name, value]) => ({name, value}));
    res.json({ transactions: txs, chartData: chart, total: txs.length, currency: u.currency, isPro: s.isPro, limitRemaining: s.remaining });
});
app.delete('/transaction/:id', async (req, res) => {
    const uid = await getUserId(req); if(!uid) return res.status(401).send();
    await prisma.transaction.delete({ where: { id: parseInt(req.params.id) } });
    res.json({ success: true });
});
app.delete('/transactions/clear', async (req, res) => {
    const uid = await getUserId(req); if(!uid) return res.status(401).send();
    await prisma.transaction.deleteMany({ where: { userId: uid } });
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
app.post('/transaction/add', async (req, res) => {
    const uid = await getUserId(req); if(!uid) return res.status(401).send();
    const s = await checkSubscription(uid); if(!s.canAdd) return res.status(403).send();
    const u = await prisma.user.findUnique({ where: { id: uid } });
    await prisma.transaction.create({ data: { ...req.body, amount: parseFloat(req.body.amount), currency: u.currency, userId: uid } });
    res.json({ success: true });
});
app.post('/payment/invoice', async (req, res) => {
    const uid = await getUserId(req); if(!uid) return res.status(401).send();
    const plan = SUBSCRIPTION_PLANS[req.body.plan || '1_month'];
    const u = await prisma.user.findUnique({ where: { id: uid } });
    await bot.telegram.sendInvoice(Number(u.telegramId), {
        title: plan.title, description: 'Pro access', payload: `sub_${req.body.plan}`, provider_token: "", currency: 'XTR', prices: [{ label: 'Pro', amount: plan.price }]
    });
    res.json({ success: true });
});

app.listen(3000, '0.0.0.0', () => console.log(`Server running on 3000`));
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));