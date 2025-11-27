const express = require('express');
const { Telegraf, Markup } = require('telegraf');
const { OpenAI } = require('openai');
const { PrismaClient } = require('@prisma/client');
const cors = require('cors');
const { HttpsProxyAgent } = require('https-proxy-agent');
const { startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, subDays } = require('date-fns');

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

// === ПРОВЕРКА ЛИМИТОВ И ПОДПИСКИ ===
const checkSubscription = async (userId) => {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return { isPro: false, canAdd: false };

  // Проверяем, не истекла ли подписка
  let isPro = user.isPro;
  if (isPro && user.proExpiresAt && new Date() > user.proExpiresAt) {
      // Подписка истекла
      await prisma.user.update({
          where: { id: userId },
          data: { isPro: false, proExpiresAt: null }
      });
      isPro = false;
  }

  if (isPro) {
      return { isPro: true, canAdd: true, limit: 'Unlimited' };
  }

  // Если не PRO, считаем транзакции за последние 7 дней
  const weekAgo = subDays(new Date(), 7);
  const count = await prisma.transaction.count({
      where: {
          userId: userId,
          date: { gte: weekAgo }
      }
  });

  const LIMIT = 50;
  return { 
      isPro: false, 
      canAdd: count < LIMIT, 
      count, 
      limit: LIMIT,
      remaining: LIMIT - count
  };
};

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
      Analyze transaction: "${text}". User Default: ${userCurrency}.
      RULES: 1. "25k"=25000. 2. Type: income/expense. 3. Category from list. 4. Currency: detect or default.
      List: [Еда, Продукты, Такси, Транспорт, Зарплата, Стипендия, Дивиденды, Вклады, Здоровье, Развлечения, Кафе, Связь, Дом, Одежда, Техника, Табак, Прочее]
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

// --- BOT COMMANDS ---

bot.start(async (ctx) => {
  const { id, first_name, username } = ctx.from;
  try {
    const user = await prisma.user.upsert({
      where: { telegramId: BigInt(id) },
      update: { firstName: first_name, username },
      create: { telegramId: BigInt(id), firstName: first_name, username, currency: 'UZS' }
    });
    
    await ctx.reply(`Привет! Я Theo AI.\nВалюта: <b>${user.currency}</b>.\n\nБесплатный лимит: 50 записей в неделю.\nКупить безлимит за 100 звезд: /pro`, {
        parse_mode: 'HTML',
        ...getCurrencyMenu()
    });
  } catch (e) { console.error(e); }
});

bot.command('currency', async (ctx) => {
    await ctx.reply('Выберите валюту:', getCurrencyMenu());
});

// === ОПЛАТА ЗВЕЗДАМИ ===
bot.command('pro', async (ctx) => {
    return ctx.sendInvoice({
        title: 'Theo AI Pro (1 месяц)',
        description: 'Безлимитные транзакции и приоритетная поддержка',
        payload: 'pro_subscription_1_month',
        provider_token: "", // Для Stars оставляем пустым!
        currency: 'XTR', // Код валюты Telegram Stars
        prices: [{ label: 'Pro 1 Month', amount: 100 }], // 100 звезд
    });
});

// Подтверждение перед оплатой
bot.on('pre_checkout_query', (ctx) => ctx.answerPreCheckoutQuery(true));

// Успешная оплата
bot.on('successful_payment', async (ctx) => {
    const userId = ctx.from.id;
    // Продлеваем на 30 дней
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);

    await prisma.user.update({
        where: { telegramId: BigInt(userId) },
        data: { isPro: true, proExpiresAt: expiresAt }
    });

    await ctx.reply('🎉 Оплата прошла успешно! Вам доступен безлимит на 30 дней. Спасибо за поддержку!');
});

bot.action(/^curr_(.+)$/, async (ctx) => {
    const newCurrency = ctx.match[1];
    const userId = ctx.from.id;
    try {
        await prisma.user.update({ where: { telegramId: BigInt(userId) }, data: { currency: newCurrency } });
        await ctx.answerCbQuery(`OK: ${newCurrency}`);
        await ctx.editMessageText(`✅ Валюта: <b>${newCurrency}</b>`, { parse_mode: 'HTML' });
    } catch (e) { console.error(e); }
});

// Обработчик текста (С ПРОВЕРКОЙ ЛИМИТА)
bot.on('text', async (ctx) => {
  try {
    const userId = BigInt(ctx.from.id);
    const user = await prisma.user.findUnique({ where: { telegramId: userId } });
    if (!user) return ctx.reply('Нажми /start');
    
    // ПРОВЕРКА ЛИМИТА
    const subStatus = await checkSubscription(user.id);
    if (!subStatus.canAdd) {
        return ctx.reply(`⛔ Лимит исчерпан (50 записей за неделю).\nУ вас осталось: ${subStatus.remaining}.\n\nПерейдите на Pro за 100 звезд: /pro`);
    }

    ctx.sendChatAction('typing');
    const result = await analyzeText(ctx.message.text, user.currency || 'UZS');
    
    if (!result || !result.amount) {
        return ctx.reply('⚠️ Не вижу сумму.');
    }

    await prisma.transaction.create({
      data: {
        amount: result.amount,
        currency: result.currency || user.currency || 'UZS',
        category: result.category || 'Прочее',
        type: result.type || 'expense',
        description: result.description || ctx.message.text,
        userId: user.id
      }
    });

    const emoji = getCategoryEmoji(result.category);
    const sign = result.type === 'expense' ? '-' : '+';
    ctx.reply(`✅ ${sign}${result.amount.toLocaleString()} ${result.currency} | ${emoji} ${result.category}`);
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
    const subStatus = await checkSubscription(userId); // Получаем статус подписки

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
    
    res.json({ 
        transactions, 
        chartData, 
        total: transactions.length, 
        currency: user?.currency || 'UZS',
        isPro: subStatus.isPro, // Отправляем статус на фронт
        limitRemaining: subStatus.remaining 
    });
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
    
    // ПРОВЕРКА ЛИМИТА ПРИ РУЧНОМ ДОБАВЛЕНИИ
    const subStatus = await checkSubscription(userId);
    if (!subStatus.canAdd) {
        return res.status(403).json({ error: 'Limit reached' });
    }

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