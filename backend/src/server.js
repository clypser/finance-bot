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

// === МЕНЮ ВАЛЮТ ===
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
    'Прочее': '📝'
  };
  for (const key in map) {
    if (category && category.toLowerCase().includes(key.toLowerCase())) return map[key];
  }
  if (category === 'Еда') return '🍔';
  return '✨';
};

// --- AI HELPERS ---
const analyzeText = async (text, userCurrency = 'UZS') => {
  try {
    if (!apiKey) throw new Error("API Key missing");

    const prompt = `
      Analyze transaction: "${text}".
      User Default Currency: ${userCurrency}.
      
      GOAL: Extract Amount, Type, Category, and Currency.
      RULES:
      1. Extract Amount (number).
      2. Extract Currency (string, default to ${userCurrency}).
      3. Extract Category (string, Russian).
      4. Determine Type ("income" or "expense").

      Categories: [Еда, Продукты, Такси, Транспорт, Зарплата, Стипендия, Дивиденды, Вклады, Здоровье, Развлечения, Кафе, Связь, Дом, Одежда, Техника, Табак, Прочее]

      Output JSON ONLY. No markdown.
      Example: {"amount": 200000, "currency": "UZS", "category": "Еда", "type": "expense"}
    `;

    const completion = await openai.chat.completions.create({
      messages: [{ role: "user", content: prompt }],
      model: "gpt-4o", 
      response_format: { type: "json_object" },
      temperature: 0.1 
    });

    const content = completion.choices[0].message.content;
    return JSON.parse(content);
  } catch (e) {
    console.error("AI Error:", e);
    throw e;
  }
};

// --- BOT ---
bot.start(async (ctx) => {
  const { id, first_name, username } = ctx.from;
  try {
    const user = await prisma.user.upsert({
      where: { telegramId: BigInt(id) },
      update: { firstName: first_name, username },
      create: { telegramId: BigInt(id), firstName: first_name, username, currency: 'UZS' }
    });
    
    await ctx.reply(`Привет! Твоя валюта: <b>${user.currency}</b>.`, {
        parse_mode: 'HTML',
        ...getCurrencyMenu()
    });

    await ctx.reply('Открыть графики 👇', 
      Markup.keyboard([[Markup.button.webApp('📊 Статистика', process.env.WEBAPP_URL)]]).resize()
    );
  } catch (e) { console.error(e); }
});

bot.command('currency', async (ctx) => {
    await ctx.reply('Выберите валюту:', getCurrencyMenu());
});

// === ОБРАБОТЧИК СМЕНЫ ВАЛЮТЫ ===
bot.action(/^curr_(.+)$/, async (ctx) => {
    const newCurrency = ctx.match[1];
    const userId = ctx.from.id;
    
    // ЛОГ: Смена валюты
    console.log(`🔄 [Currency Change] User ${userId} selected: ${newCurrency}`);
    
    try {
        const updatedUser = await prisma.user.update({
            where: { telegramId: BigInt(userId) },
            data: { currency: newCurrency }
        });
        
        console.log(`✅ [DB Update] User ${userId} currency updated to: ${updatedUser.currency}`);
        
        await ctx.answerCbQuery(`OK: ${newCurrency}`);
        await ctx.editMessageText(`✅ Валюта обновлена: <b>${newCurrency}</b>`, { parse_mode: 'HTML' });
    } catch (e) {
        console.error("❌ [Error] Update currency failed:", e);
        await ctx.answerCbQuery("Ошибка.");
    }
});

// === ОБРАБОТЧИК ТЕКСТА ===
bot.on('text', async (ctx) => {
  try {
    const userId = BigInt(ctx.from.id);
    const user = await prisma.user.findUnique({ where: { telegramId: userId } });
    if (!user) return ctx.reply('Нажми /start');
    
    const currentCurrency = user.currency || 'UZS';
    
    // ЛОГ: Обработка текста
    console.log(`📝 [New Text] User ${userId} wrote: "${ctx.message.text}". User Currency in DB: ${currentCurrency}`);

    const result = await analyzeText(ctx.message.text, currentCurrency);
    
    if (!result || !result.amount) {
        return ctx.reply('⚠️ Не вижу сумму.');
    }

    const finalCurrency = result.currency || currentCurrency;
    
    // ЛОГ: Результат AI
    console.log(`🤖 [AI Result] Amount: ${result.amount}, Currency: ${finalCurrency} (AI decided)`);

    await prisma.transaction.create({
      data: {
        amount: result.amount,
        currency: finalCurrency,
        category: result.category || 'Прочее',
        type: result.type || 'expense',
        description: result.description || ctx.message.text,
        userId: user.id
      }
    });

    const emoji = getCategoryEmoji(result.category);
    const sign = result.type === 'expense' ? '-' : '+';
    ctx.reply(`✅ ${sign}${result.amount.toLocaleString()} ${finalCurrency} | ${emoji} ${result.category}`);
  } catch (e) {
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

    const user = await prisma.user.findUnique({ where: { id: userId } });
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
    
    res.json({ transactions, chartData, total: transactions.length, currency: user?.currency || 'UZS' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/transaction/:id', async (req, res) => {
  try {
    const userId = await getUserId(req);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const { id } = req.params;
    await prisma.transaction.delete({ where: { id: parseInt(id) } });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/transaction/add', async (req, res) => {
  try {
    const userId = await getUserId(req);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const { amount, category, type, description } = req.body;
    const user = await prisma.user.findUnique({ where: { id: userId } });
    
    const newTransaction = await prisma.transaction.create({
        data: {
            amount: parseFloat(amount),
            category,
            type,
            description,
            currency: user.currency || 'UZS',
            userId
        }
    });
    res.json(newTransaction);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => console.log(`Server running on ${PORT}`));
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));