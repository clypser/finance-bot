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
    'Подарки': '🎁', 'Техника': '💻', 'Табак': '🚬', 'Прочее': '📦'
  };
  for (const key in map) {
    if (category && category.toLowerCase().includes(key.toLowerCase())) return map[key];
  }
  return '✨';
};

// --- AI HELPERS (С РУЧНОЙ КОРРЕКЦИЕЙ) ---
const analyzeText = async (text, currency = 'UZS') => {
  try {
    if (!apiKey) throw new Error("API Key missing");

    // 1. Сначала пробуем AI
    const prompt = `
      Act as a strict financial parser. Analyze text: "${text}". Currency: ${currency}.
      
      RULES:
      1. Extract Amount (e.g. "25k" -> 25000).
      2. Determine Category based on KEYWORDS:
         - "зп", "зарплата", "аванс" -> "Зарплата" (Income)
         - "вклад", "депозит" -> "Вклады" (Expense or Income depending on context, usually Expense if putting money in)
         - "дивиденды", "проценты" -> "Дивиденды" (Income)
         - "такси", "яндекс" -> "Такси" (Expense)
         - "продукты", "магазин" -> "Продукты" (Expense)
         - "сигареты", "табак" -> "Табак" (Expense)
         - "обед", "ужин", "кафе" -> "Еда" (Expense)
      
      3. If no keyword matches, use "Прочее". DO NOT DEFAULT TO FOOD unless it is food.

      Return JSON: {"amount": 100, "category": "CategoryName", "type": "expense", "currency": "UZS"}
    `;

    const completion = await openai.chat.completions.create({
      messages: [
        { role: "system", content: "You are a JSON generator. Output only JSON." },
        { role: "user", content: prompt }
      ],
      model: "gpt-3.5-turbo",
      response_format: { type: "json_object" },
      temperature: 0.0 // Максимальная строгость, ноль фантазии
    });

    const content = completion.choices[0].message.content;
    let result = JSON.parse(content);

    // 2. РУЧНАЯ СТРАХОВКА (Если AI все равно тупит)
    // Мы принудительно исправляем категорию, если видим ключевые слова
    const lowerText = text.toLowerCase();
    
    if (lowerText.includes('зп') || lowerText.includes('зарплата') || lowerText.includes('аванс')) {
        result.category = 'Зарплата';
        result.type = 'income';
    } else if (lowerText.includes('вклад') || lowerText.includes('депозит') || lowerText.includes('копилка')) {
        result.category = 'Вклады';
        // Обычно пополнение вклада - это расход из кошелька, но накопление. 
        // Если хотите считать это просто переводом - можно настроить иначе.
        // Пока оставим как решил AI, или форсируем expense если это пополнение
        if (result.type === 'income') result.type = 'expense'; // Пополнение вклада
    } else if (lowerText.includes('дивиденд') || lowerText.includes('процент')) {
        result.category = 'Дивиденды';
        result.type = 'income';
    } else if (lowerText.includes('сигарет') || lowerText.includes('табак')) {
        result.category = 'Табак';
        result.type = 'expense';
    }

    return result;

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
    
    ctx.reply('Логика исправлена! Теперь "ЗП" и "Вклады" работают точно. Проверяй!', 
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
        description: result.description || result.category, // Fallback if description empty
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