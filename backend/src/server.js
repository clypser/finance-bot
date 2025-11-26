const express = require('express');
const { Telegraf, Markup } = require('telegraf');
const { OpenAI } = require('openai');
const { PrismaClient } = require('@prisma/client');
const cors = require('cors');
const { startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth } = require('date-fns');

// Config
const app = express();
const prisma = new PrismaClient();
const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

app.use(cors());
app.use(express.json());

// --- EMOJI MAP ---
// Словарь иконок для категорий
const getCategoryEmoji = (category) => {
  const map = {
    'Еда': '🍔',
    'Продукты': '🛒',
    'Такси': '🚕',
    'Транспорт': '🚌',
    'Зарплата': '💰',
    'Доход': '💸',
    'Дивиденды': '📈',
    'Вклады': '🏦',
    'Здоровье': '💊',
    'Аптека': '🏥',
    'Развлечения': '🍿',
    'Кафе': '☕',
    'Ресторан': '🍝',
    'Связь': '📱',
    'Интернет': '🌐',
    'Дом': '🏠',
    'Аренда': '🔑',
    'Одежда': '👕',
    'Красота': '💇',
    'Спорт': '⚽',
    'Подарки': '🎁',
    'Техника': '💻',
    'Прочее': '📦'
  };
  // Если точного совпадения нет, ищем частичное или возвращаем звездочку
  for (const key in map) {
    if (category.includes(key)) return map[key];
  }
  return '✨';
};

// --- AI HELPERS ---

const analyzeText = async (text, currency = 'UZS') => {
  try {
    const prompt = `
      Analyze this financial text: "${text}".
      User's default currency: ${currency}.
      
      Rules:
      1. If user says "25k", "25к", it means 25000.
      2. Determine the Category in RUSSIAN (one or two words, e.g., "Еда", "Такси", "Зарплата", "Дивиденды / Вклады").
      3. Determine type: "expense" (spending) or "income" (earning).
      
      Return ONLY valid JSON:
      {
        "amount": number,
        "currency": "UZS" | "USD" | "RUB" | "KZT",
        "category": string,
        "type": "expense" | "income",
        "description": string (original text or short summary)
      }
    `;
    
    const completion = await openai.chat.completions.create({
      messages: [
        { role: "system", content: "You are a financial assistant. You output only JSON." }, 
        { role: "user", content: prompt }
      ],
      model: "gpt-4-turbo", // Можно поменять на "gpt-3.5-turbo", если gpt-4 дорого или недоступен
      response_format: { type: "json_object" }
    });

    const content = completion.choices[0].message.content;
    if (!content) throw new Error("Empty response from AI");
    
    return JSON.parse(content);
  } catch (e) {
    console.error("AI Analysis Error:", e);
    throw e; // Пробрасываем ошибку дальше, чтобы бот мог ответить пользователю
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
    
    ctx.reply('Привет! Я твой финансовый помощник. Напиши трату, например: "Такси 20к" или "Зарплата 5млн".', 
      Markup.keyboard([
        [Markup.button.webApp('📊 Открыть Статистику', process.env.WEBAPP_URL)]
      ]).resize()
    );
  } catch (e) {
    console.error("Start Error:", e);
    ctx.reply("Ошибка при регистрации. Попробуйте позже.");
  }
});

bot.on('text', async (ctx) => {
  try {
    const userId = BigInt(ctx.from.id);
    const user = await prisma.user.findUnique({ where: { telegramId: userId } });
    
    if (!user) return ctx.reply('Нажми /start для начала работы');

    // Отправляем статус "печатает", пока AI думает
    ctx.sendChatAction('typing');

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
    
    // Формируем красивый ответ
    if (result.type === 'expense') {
        ctx.reply(`✅ Расход: ${result.amount.toLocaleString()} ${result.currency} в категории «${emoji} ${result.category}» добавлен!`);
    } else {
        ctx.reply(`✅ Доход: ${result.amount.toLocaleString()} ${result.currency} в категории «${emoji} ${result.category}» добавлен!`);
    }

  } catch (e) {
    console.error("Transaction Error:", e);
    // Более понятная ошибка для пользователя
    if (e.message && e.message.includes("401")) {
        ctx.reply("⚠️ Ошибка ключа OpenAI. Проверьте баланс или правильность ключа API.");
    } else {
        ctx.reply('❌ Не удалось распознать. Попробуйте проще: "Еда 50000"');
    }
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
    // Auto-create demo user for local testing
    if (!user && tid === '123456789') {
        user = await prisma.user.create({
            data: { telegramId, firstName: "Demo", username: "demo", currency: "UZS" }
        });
    }
    return user ? user.id : null;
  } catch (e) {
    console.error("Auth Error:", e);
    return null;
  }
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
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => console.log(`Server running on ${PORT}`));

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));