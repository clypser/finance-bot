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

// === ЛОГ ЗАПУСКА ===
console.log("🚀 Server restarting... Loomy AI 3.2 (Fix GREETINGS)");

// === НАСТРОЙКИ ===
const apiKey = process.env.OPENAI_API_KEY;
const geminiKey = process.env.GEMINI_API_KEY; // Ключ для советов
const proxyUrl = process.env.PROXY_URL; 
const baseURL = process.env.OPENAI_BASE_URL;

let openai;

const openaiConfig = {
  apiKey: apiKey || "",
  baseURL: baseURL || undefined
};

if (proxyUrl) {
  console.log(`🌐 Using Proxy: ${proxyUrl}`);
  const agent = new HttpsProxyAgent(proxyUrl);
  openaiConfig.httpAgent = agent;
}

openai = new OpenAI(openaiConfig);

app.use(cors());
app.use(express.json());

// === ТАРИФЫ ===
const SUBSCRIPTION_PLANS = {
    '1_month': { title: 'Loomy Pro (1 месяц)', price: 100, months: 1 },
    '3_months': { title: 'Loomy Pro (3 месяца)', price: 270, months: 3 },
    '12_months': { title: 'Loomy Pro (1 год)', price: 1000, months: 12 },
};

// === КОНСТАНТЫ ДЛЯ ОБРАБОТКИ ТЕКСТА (ИСПРАВЛЕНО) ===
const GREETINGS = ['привет', 'здравствуйте', 'ку', 'хай', 'hello', 'hi', 'салам', 'добрый день', 'добрый вечер', 'доброе утро', 'start', '/start'];


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
  if (category === 'Еда') return '🍔';
  return '✨';
};

// --- AI HELPERS (OpenAI для парсинга) ---
const analyzeText = async (text, userCurrency = 'UZS') => {
  try {
    if (!apiKey) throw new Error("API Key missing");

    let cleanText = text.replace(/(\d+)\s*[kк]/gi, (match, p1) => p1 + '000');
    cleanText = cleanText.replace(/(\d+)\s*(m|м|млн)/gi, (match, p1) => p1 + '000000');

    const prompt = `
      Analyze transaction: "${cleanText}".
      User Default Currency: ${userCurrency}.
      RULES: Extract Amount (number), Currency (string), Category (Russian), Type ("income"|"expense"|"debt_lent"|"debt_borrowed"). If Debt, category is Name.
      Categories: [Еда, Продукты, Такси, Транспорт, Зарплата, Стипендия, Дивиденды, Вклады, Здоровье, Развлечения, Кафе, Связь, Дом, Одежда, Техника, Табак, Прочее]
      Return JSON only.
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

// --- GEMINI HELPER (Для советов) ---
const getGeminiAdvice = async (transactions, currency) => {
    if (!geminiKey) return "Пожалуйста, добавьте GEMINI_API_KEY в настройки сервера, чтобы получать советы.";

    // Готовим данные для AI
    const totalIncome = transactions.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);
    const totalExpense = transactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);
    
    // Топ 3 категории расходов
    const categories = {};
    transactions.filter(t => t.type === 'expense').forEach(t => {
        categories[t.category] = (categories[t.category] || 0) + t.amount;
    });
    const topCats = Object.entries(categories)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 3)
        .map(([name, amount]) => `${name}: ${amount}`)
        .join(', ');

    const prompt = `
      Ты — финансовый помощник Loomy.
      Данные пользователя за месяц (${currency}):
      Доходы: ${totalIncome}
      Расходы: ${totalExpense}
      Топ траты: ${topCats}.
      
      Дай ОДИН короткий, полезный и немного дерзкий совет (максимум 2 предложения).
      Используй эмодзи. Не будь занудой.
      Если трат мало, просто похвали или пошути.
      Отвечай на русском языке.
    `;

    try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiKey}`;
        
        const response = await axios.post(url, {
            contents: [{ parts: [{ text: prompt }] }]
        }, { timeout: 10000 });

        return response.data?.candidates?.[0]?.content?.parts?.[0]?.text || "Звезды сегодня молчат ✨";
    } catch (e) {
        console.error("Gemini Advice Error:", e.message);
        return "Не удалось получить совет. Проверьте ключ Gemini.";
    }
};


// --- BOT LOGIC ---
const checkSubscription = async (userId) => {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return { isPro: false, canAdd: false, remaining: 0 };

  let isPro = user.isPro;
  if (isPro && user.proExpiresAt && new Date() > user.proExpiresAt) {
      await prisma.user.update({
          where: { id: userId },
          data: { isPro: false, proExpiresAt: null }
      });
      isPro = false;
  }

  if (isPro) return { isPro: true, canAdd: true, remaining: 9999, expiresAt: user.proExpiresAt };

  const weekAgo = subDays(new Date(), 7);
  const count = await prisma.transaction.count({
      where: { userId: userId, date: { gte: weekAgo } }
  });

  const LIMIT = 50;
  return { isPro: false, canAdd: count < LIMIT, remaining: Math.max(0, LIMIT - count), expiresAt: null };
};

bot.start(async (ctx) => {
  const { id, first_name, username } = ctx.from;
  try {
    const user = await prisma.user.upsert({
      where: { telegramId: BigInt(id) },
      update: { firstName: first_name, username },
      create: { telegramId: BigInt(id), firstName: first_name, username, currency: 'UZS' }
    });
    
    await ctx.reply(`👋 <b>Привет, ${first_name}!</b>\n\nЯ <b>Loomy AI</b> — твой умный финансовый помощник.\n\n💰 Твоя валюта: <b>${user.currency}</b>\n\nПиши расходы просто так: <i>"Такси 20к"</i> или <i>"Обед 50000"</i>`, {
        parse_mode: 'HTML',
        ...getCurrencyMenu()
    });

    await ctx.reply('👇 Нажми кнопку, чтобы открыть приложение', 
      Markup.keyboard([[Markup.button.webApp('📱 Открыть Loomy AI', process.env.WEBAPP_URL)]]).resize()
    );
  } catch (e) { console.error(e); }
});

bot.command('currency', async (ctx) => {
    await ctx.reply('Выберите валюту для учета:', getCurrencyMenu());
});

bot.action(/^curr_(.+)$/, async (ctx) => {
    const newCurrency = ctx.match[1];
    const userId = ctx.from.id;
    try {
        await prisma.user.update({ where: { telegramId: BigInt(userId) }, data: { currency: newCurrency } });
        await ctx.answerCbQuery(`Валюта: ${newCurrency}`);
        await ctx.editMessageText(`✅ Валюта изменена на <b>${newCurrency}</b>`, { parse_mode: 'HTML' });
    } catch (e) { console.error(e); }
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
    const userId = BigInt(ctx.from.id);
    const user = await prisma.user.findUnique({ where: { telegramId: userId } });
    if (!user) return ctx.reply('Нажми /start');
    
    const subStatus = await checkSubscription(user.id);
    if (!subStatus.canAdd) {
        return ctx.reply(`⛔ <b>Лимит исчерпан</b>\nПерейдите в приложение, чтобы купить Pro.`, { parse_mode: 'HTML' });
    }

    const textLower = ctx.message.text.toLowerCase().replace(/[!.]/g, '').trim();
    if (GREETINGS.some(g => textLower === g)) {
        return ctx.reply(`Привет! 👋 Я готов записывать расходы.`);
    }

    if (!/\d/.test(ctx.message.text) && !/(тысяч|миллион|к|k|m|м)/i.test(ctx.message.text)) {
         return ctx.reply('⚠️ Не вижу сумму. Напиши, например: "Такси 20к"');
    }

    const result = await analyzeText(ctx.message.text, user.currency || 'UZS');
    
    if (!result || !result.amount) return ctx.reply('⚠️ Не понял сумму.');

    if (result.type === 'debt_lent' || result.type === 'debt_borrowed') {
        const typeMap = { 'debt_lent': 'lent', 'debt_borrowed': 'borrowed' };
        await prisma.debt.create({
            data: { amount: result.amount, currency: result.currency || user.currency, personName: result.category || 'Кто-то', type: typeMap[result.type], userId: user.id }
        });
        return ctx.reply(`📒 <b>Долг записан!</b>\n💰 ${result.amount.toLocaleString()}`, { parse_mode: 'HTML' });
    }

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

    const emoji = getCategoryEmoji(result.category);
    const formattedAmount = result.amount.toLocaleString(); 
    const currency = result.currency || user.currency;
    
    if (result.type === 'expense') {
        await ctx.reply(`💸 <b>Расход:</b> ${formattedAmount} ${currency}\n${emoji} <b>Категория:</b> ${result.category}`, { parse_mode: 'HTML' });
    } else {
        await ctx.reply(`💰 <b>Доход:</b> ${formattedAmount} ${currency}\n${emoji} <b>Категория:</b> ${result.category}`, { parse_mode: 'HTML' });
    }

  } catch (e) {
    console.error(e);
    ctx.reply(`❌ Ошибка: ${e.message}`);
  }
});

bot.launch();

// --- API ROUTES ---
const getUserId = async (req) => {
  const tid = req.headers['x-telegram-id'];
  if (!tid) return null;
  try {
    const telegramId = BigInt(tid);
    let user = await prisma.user.findUnique({ where: { telegramId } });
    if (!user && tid === '123456789') user = await prisma.user.create({ data: { telegramId, firstName: "Demo", username: "demo" } });
    return user ? user.id : null;
  } catch (e) { return null; }
};

app.get('/user/me', async (req, res) => {
  try {
    const userId = await getUserId(req);
    if (!userId) return res.status(401).json({ error: 'Auth' });
    const user = await prisma.user.findUnique({ where: { id: userId } });
    const sub = await checkSubscription(userId);
    
    const safeUser = {
        ...user,
        telegramId: user.telegramId.toString(),
        proExpiresAt: user.proExpiresAt,
        isPro: sub.isPro
    };
    res.json(safeUser);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/user/currency', async (req, res) => {
    try {
        const userId = await getUserId(req);
        if (!userId) return res.status(401).json({ error: 'Auth' });
        await prisma.user.update({ where: { id: userId }, data: { currency: req.body.currency } });
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/stats/:period', async (req, res) => {
  try {
    const userId = await getUserId(req);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const user = await prisma.user.findUnique({ where: { id: userId } });
    const subStatus = await checkSubscription(userId);
    const { period } = req.params;
    let dateFilter = {};
    const now = new Date();
    if (period === 'day') dateFilter = { gte: startOfDay(now), lte: endOfDay(now) };
    if (period === 'week') dateFilter = { gte: startOfWeek(now), lte: endOfWeek(now) };
    if (period === 'month') dateFilter = { gte: startOfMonth(now), lte: endOfMonth(now) };
    const transactions = await prisma.transaction.findMany({ where: { userId, date: dateFilter }, orderBy: { date: 'desc' } });
    const stats = transactions.reduce((acc, curr) => { if (curr.type === 'expense') acc[curr.category] = (acc[curr.category] || 0) + curr.amount; return acc; }, {});
    const chartData = Object.keys(stats).map(key => ({ name: key, value: stats[key] }));
    res.json({ transactions, chartData, total: transactions.length, currency: user?.currency || 'UZS', isPro: subStatus.isPro, limitRemaining: subStatus.remaining });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// --- НОВЫЙ МАРШРУТ: СОВЕТ ОТ AI ---
app.get('/ai/advice', async (req, res) => {
    try {
        const userId = await getUserId(req);
        if (!userId) return res.status(401).json({ error: 'Unauthorized' });

        const user = await prisma.user.findUnique({ where: { id: userId } });
        
        // Берем транзакции за текущий месяц
        const now = new Date();
        const transactions = await prisma.transaction.findMany({
            where: { 
                userId: userId, 
                date: { gte: startOfMonth(now), lte: endOfMonth(now) } 
            }
        });

        const advice = await getGeminiAdvice(transactions, user.currency);
        res.json({ advice });
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: 'Failed to generate advice' });
    }
});

app.delete('/transaction/:id', async (req, res) => {
  try {
    const userId = await getUserId(req);
    if (!userId) return res.status(401).json({ error: 'Auth' });
    await prisma.transaction.delete({ where: { id: parseInt(req.params.id) } });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/transaction/:id', async (req, res) => {
    try {
        const userId = await getUserId(req);
        if (!userId) return res.status(401).json({ error: 'Auth' });
        const { amount, category, type, description } = req.body;
        await prisma.transaction.update({ where: { id: parseInt(req.params.id) }, data: { amount: parseFloat(amount), category, type, description } });
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/transactions/clear', async (req, res) => {
  try {
    const userId = await getUserId(req);
    if (!userId) return res.status(401).json({ error: 'Auth' });
    await prisma.transaction.deleteMany({ where: { userId } });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/user/delete', async (req, res) => {
  try {
    const userId = await getUserId(req);
    if (!userId) return res.status(401).json({ error: 'Auth' });
    await prisma.transaction.deleteMany({ where: { userId } });
    await prisma.budget.deleteMany({ where: { userId } });
    await prisma.debt.deleteMany({ where: { userId } });
    await prisma.user.delete({ where: { id: userId } });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/transaction/add', async (req, res) => {
    const userId = await getUserId(req);
    if (!userId) return res.status(401).json({ error: 'Auth' });
    const subStatus = await checkSubscription(userId);
    if (!subStatus.canAdd) return res.status(403).json({ error: 'Limit' });
    const { amount, category, type, description } = req.body;
    const user = await prisma.user.findUnique({ where: { id: userId } });
    await prisma.transaction.create({ data: { amount: parseFloat(amount), category, type, description, currency: user.currency || 'UZS', userId } });
    res.json({ success: true });
});

app.get('/debts', async (req, res) => {
    const userId = await getUserId(req); if(!userId) return res.status(401).json({ error: 'Auth' });
    const debts = await prisma.debt.findMany({ where: { userId }, orderBy: { id: 'desc' } });
    res.json(debts);
});

app.post('/debts', async (req, res) => {
    const userId = await getUserId(req); if(!userId) return res.status(401).json({ error: 'Auth' });
    const u = await prisma.user.findUnique({ where: { id: userId } });
    await prisma.debt.create({ data: { ...req.body, amount: parseFloat(req.body.amount), currency: u.currency, userId, isPaid: false } });
    res.json({ success: true });
});

app.delete('/debts/:id', async (req, res) => {
    const userId = await getUserId(req); if(!userId) return res.status(401).json({ error: 'Auth' });
    await prisma.debt.delete({ where: { id: parseInt(req.params.id) } });
    res.json({ success: true });
});

app.put('/debts/:id', async (req, res) => {
    const userId = await getUserId(req); if(!userId) return res.status(401).json({ error: 'Auth' });
    const { amount, personName, type, isPaid } = req.body;
    await prisma.debt.update({
        where: { id: parseInt(req.params.id) },
        data: { amount: parseFloat(amount), personName, type, isPaid }
    });
    res.json({ success: true });
});

app.post('/payment/invoice', async (req, res) => {
    try {
        const userId = await getUserId(req);
        if (!userId) return res.status(401).json({ error: 'Auth' });
        const { plan } = req.body; 
        const selectedPlan = SUBSCRIPTION_PLANS[plan || '1_month'];
        const user = await prisma.user.findUnique({ where: { id: userId } });
        await bot.telegram.sendInvoice(Number(user.telegramId), {
            title: selectedPlan.title,
            description: 'Безлимитный доступ и премиум функции',
            payload: `sub_${plan}`, 
            provider_token: "", 
            currency: 'XTR',
            prices: [{ label: 'Pro', amount: selectedPlan.price }]
        });
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: 'Error' }); }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => console.log(`Server running on ${PORT}`));
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));