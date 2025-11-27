const express = require('express');
const { Telegraf, Markup } = require('telegraf');
const { OpenAI } = require('openai');
const { PrismaClient } = require('@prisma/client');
const cors = require('cors');
const { HttpsProxyAgent } = require('https-proxy-agent');
const { startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth } = require('date-fns');

const app = express();
const prisma = new PrismaClient();
const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);

// === НАСТРОЙКИ ===
const apiKey = process.env.OPENAI_API_KEY;
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

// --- EMOJI MAP ---
const getCategoryEmoji = (category) => {
  const map = {
    'Еда': '🍔', 'Продукты': '🛒', 'Такси': '🚕', 'Транспорт': '🚌',
    'Зарплата': '💰', 'Доход': '💸', 'Дивиденды': '📈', 'Вклады': '🏦',
    'Здоровье': '💊', 'Аптека': '🏥', 'Развлечения': '🍿', 'Кафе': '☕',
    'Ресторан': '🍝', 'Связь': '📱', 'Интернет': '🌐', 'Дом': '🏠',
    'Аренда': '🔑', 'Одежда': '👕', 'Красота': '💇', 'Спорт': '⚽',
    'Подарки': '🎁', 'Техника': '💻', 'Прочее': '📦'
  };
  // Ищем частичное совпадение (например, "Кафе и рестораны" -> "Кафе")
  for (const key in map) {
    if (category && category.toLowerCase().includes(key.toLowerCase())) return map[key];
  }
  return '✨';
};

// --- AI HELPERS (УЛУЧШЕННЫЙ ПРОМПТ) ---
const analyzeText = async (text, currency = 'UZS') => {
  try {
    if (!apiKey) throw new Error("API Key missing");

    const prompt = `
      Analyze financial text: "${text}". User currency: ${currency}.
      
      STRICT RULES:
      1. "25k" = 25000.
      2. Detect TYPE: "expense" (spending) or "income" (earning).
         - Keywords for INCOME: "зп", "зарплата", "аванс", "дивиденды", "пришло", "получил".
      
      3. Detect CATEGORY from list: 
         - Еда (food, lunch, dinner)
         - Такси (taxi, uber)
         - Продукты (groceries, market)
         - Зарплата (salary, wage, zp)
         - Дивиденды (dividends, investment)
         - Дом (rent, utilities)
         - Развлечения (cinema, games)
         - Здоровье (pharmacy, doctor)
         - Прочее (if unsure)
      
      4. IF text is just "зп 1000", assume category "Зарплата" and type "income".
      5. IF text is just "50000", assume category "Прочее" and type "expense".

      Return JSON: {"amount": 100, "category": "CategoryName", "type": "expense", "currency": "UZS", "description": "original text"}
    `;

    const completion = await openai.chat.completions.create({
      messages: [
        { role: "system", content: "You are a strict financial parser. Output JSON only." },
        { role: "user", content: prompt }
      ],
      model: "gpt-3.5-turbo",
      response_format: { type: "json_object" }
    });

    const content = completion.choices[0].message.content;
    return JSON.parse(content);
  } catch (e) {
    console.error("AI Error:", e);
    throw new Error(`AI Error: ${e.message}`);
  }
};

// --- BOT LOGIC ---
bot.start(async (ctx) => {
  const { id, first_name, username } = ctx.from;
  try {
    await prisma.user.upsert({
      where: { telegramId: BigInt(id) },
      update: { firstName: first_name, username },
      create: { telegramId: BigInt(id), firstName: first_name, username, currency: 'UZS' }
    });
    
    ctx.reply('Я обновил логику! Теперь я понимаю, что "ЗП" — это доход. Попробуй: "зп 5млн"', 
      Markup.keyboard([[Markup.button.webApp('📊 Открыть', process.env.WEBAPP_URL)]]).resize()
    );
  } catch (e) { console.error(e); }
});

bot.on('text', async (ctx) => {
  try {
    const userId = BigInt(ctx.from.id);
    const user = await prisma.user.findUnique({ where: { telegramId: userId } });
    if (!user) return ctx.reply('Нажми /start');
    
    const result = await analyzeText(ctx.message.text, user.currency);
    
    await prisma.transaction.create({
      data: {
        amount: result.amount,
        currency: result.currency,
        category: result.category,
        type: result.type,
        description: result.description,
        userId: user.id
      }
    });

    const emoji = getCategoryEmoji(result.category);
    const sign = result.type === 'expense' ? '-' : '+';
    
    ctx.reply(`✅ ${sign}${result.amount.toLocaleString()} ${result.currency} | ${emoji} ${result.category}`);

  } catch (e) {
    ctx.reply(`❌ Ошибка: ${e.message}`);
  }
});

bot.launch();

// --- API ---
const getUserId = async (req) => {
  const tid = req.headers['x-telegram-id'];
  if (!tid) return null;
  try {
    const telegramId = BigInt(tid);
    let user = await prisma.user.findUnique({ where: { telegramId } });
    if (!user && tid === '123456789') {
        user = await prisma.user.create({ data: { telegramId, firstName: "Demo", username: "demo", currency: "UZS" }});
    }
    return user ? user.id : null;
  } catch (e) { return null; }
};

app.get('/stats/:period', async (req, res) => {
  try {
    const userId = await getUserId(req);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const { period } = req.params;
    const now = new Date();
    let dateFilter = {};
    if (period === 'day') dateFilter = { gte: startOfDay(now), lte: endOfDay(now) };
    if (period === 'week') dateFilter = { gte: startOfWeek(now), lte: endOfWeek(now) };
    if (period === 'month') dateFilter = { gte: startOfMonth(now), lte: endOfMonth(now) };

    const transactions = await prisma.transaction.findMany({ where: { userId, date: dateFilter }, orderBy: { date: 'desc' } });
    const stats = transactions.reduce((acc, curr) => {
      if (curr.type === 'expense') acc[curr.category] = (acc[curr.category] || 0) + curr.amount;
      return acc;
    }, {});
    const chartData = Object.keys(stats).map(key => ({ name: key, value: stats[key] }));
    res.json({ transactions, chartData, total: transactions.length });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => console.log(`Server running on ${PORT}`));
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));