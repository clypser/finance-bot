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

// --- EMOJI MAP (БОЛЬШОЙ СЛОВАРЬ) ---
const getCategoryEmoji = (category) => {
  const map = {
    // --- РАСХОДЫ ---
    'Продукты': '🛒',
    'Еда вне дома': '🍔',
    'Кофе': '☕',
    'Алкоголь': '🍺',
    'Табак': '🚬',
    
    'Транспорт': '🚌',
    'Такси': '🚕',
    'Авто': '🚘',
    'Бензин': '⛽',
    'Каршеринг': '🚗',

    'Дом': '🏠',
    'ЖКУ': '💡',
    'Ремонт': '🛠️',
    'Связь': '📱',
    'Интернет': '🌐',

    'Здоровье': '💊',
    'Красота': '💅',
    'Спорт': '💪',

    'Одежда': '👕',
    'Обувь': '👟',
    'Техника': '💻',
    
    'Развлечения': '🍿',
    'Подписки': '🔄',
    'Хобби': '🎨',
    'Путешествия': '✈️',

    'Образование': '📚',
    'Дети': '🧸',
    'Животные': '🐶',
    'Подарки': '🎁',
    'Благотворительность': '❤️',

    'Кредиты': '💳',
    'Налоги': '🏛️',
    'Комиссии': '💸',

    // --- ДОХОДЫ ---
    'Зарплата': '💰',
    'Аванс': '💸',
    'Премия': '🏆',
    'Стипендия': '🎓',
    'Фриланс': '💻',
    'Бизнес': '💼',
    'Дивиденды': '📈',
    'Вклады': '🏦',
    'Кэшбэк': '🤑',
    'Подарки (полученные)': '🎁',
    'Продажа вещей': '📦',
    'Возврат долга': '🤝',

    'Прочее': '📝'
  };

  for (const key in map) {
    if (category && category.toLowerCase().includes(key.toLowerCase())) return map[key];
  }
  if (category === 'Еда') return '🍔';
  
  return '✨';
};

// --- AI HELPERS (СУПЕР-ПРОМПТ v2) ---
const analyzeText = async (text, currency = 'UZS') => {
  try {
    if (!apiKey) throw new Error("API Key missing");

    const prompt = `
      Analyze transaction: "${text}". Currency: ${currency}.
      
      GOAL: Extract Amount, Type, and the MOST SPECIFIC Category.

      RULES:
      1. "25k" = 25000.
      2. Type: 
         - "income" (Доход): зарплата, аванс, стипендия, получил, пришло, на карту, дивиденды, кэшбэк.
         - "expense" (Расход): купил, оплатил, потратил, такси, еда, продукты.
      3. Category: Choose STRICTLY from the list below.

      CATEGORY LIST:
      [
        EXPENSES: 
        Продукты, Еда вне дома, Кофе, Алкоголь, Табак, 
        Транспорт, Такси, Авто, Бензин, Каршеринг,
        Дом, ЖКУ, Ремонт, Связь, Интернет,
        Здоровье, Красота, Спорт,
        Одежда, Обувь, Техника,
        Развлечения, Подписки, Хобби, Путешествия,
        Образование, Дети, Животные, Подарки, Благотворительность,
        Кредиты, Налоги, Комиссии, Прочее
      ]
      [
        INCOME:
        Зарплата, Аванс, Премия, Стипендия, Фриланс, Бизнес,
        Дивиденды, Вклады, Кэшбэк, Подарки (полученные), Продажа вещей, Возврат долга
      ]

      EXAMPLES:
      - "стипендия 300к" -> {"amount": 300000, "category": "Стипендия", "type": "income"}
      - "получил стипендию 500000" -> {"amount": 500000, "category": "Стипендия", "type": "income"}
      - "зп 10млн" -> {"amount": 10000000, "category": "Зарплата", "type": "income"}
      - "обед 50к" -> {"amount": 50000, "category": "Еда вне дома", "type": "expense"}
      - "свет 100000" -> {"amount": 100000, "category": "ЖКУ", "type": "expense"}
      - "аптека 50к" -> {"amount": 50000, "category": "Здоровье", "type": "expense"}
      
      Return JSON only.
    `;

    const completion = await openai.chat.completions.create({
      messages: [
        { role: "system", content: "You are a smart financial assistant. Output JSON only." },
        { role: "user", content: prompt }
      ],
      model: "gpt-4o", 
      response_format: { type: "json_object" },
      temperature: 0.1 
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
    
    ctx.reply('Мозг обновлен (GPT-4o)! Я выучил, что такое стипендия. Проверяй!', 
      Markup.keyboard([[Markup.button.webApp('📊 Открыть', process.env.WEBAPP_URL)]]).resize()
    );
  } catch (e) { console.error(e); }
});

bot.on('text', async (ctx) => {
  try {
    const userId = BigInt(ctx.from.id);
    const user = await prisma.user.findUnique({ where: { telegramId: userId } });
    if (!user) return ctx.reply('Нажми /start');
    
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