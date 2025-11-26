const express = require('express');
const { Telegraf, Markup } = require('telegraf');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { PrismaClient } = require('@prisma/client');
const cors = require('cors');
const { startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth } = require('date-fns');

const app = express();
const prisma = new PrismaClient();
const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);

// Проверка ключа при старте (для логов)
const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  console.error("⚠️ WARNING: GEMINI_API_KEY is missing!");
} else {
  console.log(`✅ Gemini API Key found (starts with ${apiKey.substring(0, 4)}...)`);
}

// Инициализация Gemini
const genAI = new GoogleGenerativeAI(apiKey || "");

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
  for (const key in map) {
    if (category && category.includes(key)) return map[key];
  }
  return '✨';
};

// --- AI HELPERS ---
const analyzeText = async (text, currency = 'UZS') => {
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    const prompt = `
      Analyze this financial text: "${text}".
      User's default currency: ${currency}.
      Rules:
      1. "25k", "25к" = 25000.
      2. Category in RUSSIAN (e.g., "Еда", "Такси").
      3. Type: "expense" or "income".
      
      Return ONLY raw JSON without markdown formatting. Example: {"amount": 100, "category": "Еда", "type": "expense", "currency": "UZS", "description": "text"}
    `;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    let textResponse = response.text();
    
    // Очистка от лишних символов markdown, если Gemini их добавит
    textResponse = textResponse.replace(/```json/g, '').replace(/```/g, '').trim();
    
    return JSON.parse(textResponse);
  } catch (e) {
    console.error("Gemini Error Details:", e);
    // Пробрасываем реальный текст ошибки для вывода пользователю
    throw new Error(`Gemini Error: ${e.message || e.toString()}`);
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
    
    ctx.reply('Привет! Я перешел на Gemini AI. Напиши трату: "Такси 20к".', 
      Markup.keyboard([
        [Markup.button.webApp('📊 Открыть Статистику', process.env.WEBAPP_URL)]
      ]).resize()
    );
  } catch (e) {
    console.error("Start Error:", e);
  }
});

bot.on('text', async (ctx) => {
  try {
    const userId = BigInt(ctx.from.id);
    const user = await prisma.user.findUnique({ where: { telegramId: userId } });
    
    if (!user) return ctx.reply('Нажми /start');
    
    // Убрали typing, чтобы не зависало
    // ctx.sendChatAction('typing');

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
    console.error("Transaction Error Full:", e);
    // Выводим реальную ошибку пользователю, чтобы понять причину
    ctx.reply(`❌ Ошибка: ${e.message}`);
  }
});

bot.launch().catch(err => console.error("Bot launch error:", err));

// --- API ROUTES ---
const getUserId = async (req) => {
  const tid = req.headers['x-telegram-id'];
  if (!tid) return null;
  try {
    const telegramId = BigInt(tid);
    let user = await prisma.user.findUnique({ where: { telegramId } });
    if (!user && tid === '123456789') {
        user = await prisma.user.create({
            data: { telegramId, firstName: "Demo", username: "demo", currency: "UZS" }
        });
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

    const transactions = await prisma.transaction.findMany({
      where: { userId, date: dateFilter },
      orderBy: { date: 'desc' }
    });

    const stats = transactions.reduce((acc, curr) => {
      if (curr.type === 'expense') {
        acc[curr.category] = (acc[curr.category] || 0) + curr.amount;
      }
      return acc;
    }, {});

    const chartData = Object.keys(stats).map(key => ({ name: key, value: stats[key] }));
    res.json({ transactions, chartData, total: transactions.length });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => console.log(`Server running on ${PORT}`));

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));