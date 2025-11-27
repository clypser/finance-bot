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

// === ПРОВЕРКА ПОДПИСКИ ===
const checkSubscription = async (userId) => {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return { isPro: false, canAdd: false, remaining: 0 };

  // Проверяем срок действия
  let isPro = user.isPro;
  if (isPro && user.proExpiresAt && new Date() > user.proExpiresAt) {
      await prisma.user.update({
          where: { id: userId },
          data: { isPro: false, proExpiresAt: null }
      });
      isPro = false;
  }

  if (isPro) {
      return { isPro: true, canAdd: true, remaining: 9999 }; // Бесконечность
  }

  // Считаем транзакции за 7 дней
  const weekAgo = subDays(new Date(), 7);
  const count = await prisma.transaction.count({
      where: {
          userId: userId,
          date: { gte: weekAgo }
      }
  });

  const LIMIT = 50;
  const remaining = Math.max(0, LIMIT - count);
  
  return { 
      isPro: false, 
      canAdd: count < LIMIT, 
      remaining: remaining
  };
};

// === AI HELPERS ===
const analyzeText = async (text, userCurrency = 'UZS') => {
  try {
    if (!apiKey) throw new Error("API Key missing");

    const prompt = `
      Analyze transaction: "${text}". Default: ${userCurrency}.
      RULES: "25k"=25000. Type: income/expense. Category from list. Currency from text or default.
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

// --- BOT LOGIC ---
bot.start(async (ctx) => {
  const { id, first_name, username } = ctx.from;
  await prisma.user.upsert({
      where: { telegramId: BigInt(id) },
      update: { firstName: first_name, username },
      create: { telegramId: BigInt(id), firstName: first_name, username, currency: 'UZS' }
  });
  ctx.reply(`Привет, ${first_name}! 👋\nЛимит: 50 записей/неделю.\nБезлимит за 100 звезд: /pro`, 
    Markup.keyboard([[Markup.button.webApp('📊 Открыть', process.env.WEBAPP_URL)]]).resize()
  );
});

bot.command('pro', async (ctx) => {
    return ctx.sendInvoice({
        title: 'Theo AI Pro (1 месяц)',
        description: 'Безлимит + Приоритет',
        payload: 'pro_sub',
        provider_token: "", // Пусто для Stars
        currency: 'XTR',
        prices: [{ label: 'Pro 1 Month', amount: 100 }],
    });
});

bot.on('pre_checkout_query', (ctx) => ctx.answerPreCheckoutQuery(true));

bot.on('successful_payment', async (ctx) => {
    const userId = ctx.from.id;
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);

    await prisma.user.update({
        where: { telegramId: BigInt(userId) },
        data: { isPro: true, proExpiresAt: expiresAt }
    });
    await ctx.reply('🎉 Подписка активирована на 30 дней!');
});

bot.on('text', async (ctx) => {
  try {
    const userId = BigInt(ctx.from.id);
    const user = await prisma.user.findUnique({ where: { telegramId: userId } });
    if (!user) return ctx.reply('/start');
    
    const subStatus = await checkSubscription(user.id);
    if (!subStatus.canAdd) return ctx.reply(`⛔ Лимит исчерпан. Купите Pro: /pro`);

    const result = await analyzeText(ctx.message.text, user.currency || 'UZS');
    if (!result || !result.amount) return ctx.reply('⚠️ Не нашел сумму.');

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
    ctx.reply(`✅ Записано: ${result.amount}`);
  } catch (e) { ctx.reply('❌ Ошибка'); }
});

bot.launch();

// --- API ---
const getUserId = async (req) => {
  const tid = req.headers['x-telegram-id'];
  if (!tid) return null;
  const telegramId = BigInt(tid);
  let user = await prisma.user.findUnique({ where: { telegramId } });
  if (!user && tid === '123456789') user = await prisma.user.create({ data: { telegramId, firstName: "Demo", username: "demo" } });
  return user ? user.id : null;
};

// Получение статистики и лимитов
app.get('/stats/:period', async (req, res) => {
  try {
    const userId = await getUserId(req);
    if (!userId) return res.status(401).json({ error: 'Auth' });

    const user = await prisma.user.findUnique({ where: { id: userId } });
    const subStatus = await checkSubscription(userId);

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
        currency: user.currency || 'UZS',
        isPro: subStatus.isPro,
        limitRemaining: subStatus.remaining // Вот это поле нужно фронтенду
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Создание счета на оплату
app.post('/payment/invoice', async (req, res) => {
    try {
        const userId = await getUserId(req);
        if (!userId) return res.status(401).json({ error: 'Auth' });
        
        const user = await prisma.user.findUnique({ where: { id: userId } });
        
        // Отправляем счет пользователю в чат
        await bot.telegram.sendInvoice(Number(user.telegramId), {
            title: 'Theo AI Pro',
            description: 'Безлимитные транзакции на 1 месяц',
            payload: 'pro_sub_webapp',
            provider_token: "", 
            currency: 'XTR',
            prices: [{ label: 'Pro 1 Month', amount: 100 }]
        });
        
        res.json({ success: true });
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: 'Failed to send invoice' });
    }
});

// Добавление и удаление (оставляем как было)
app.delete('/transaction/:id', async (req, res) => {
    const userId = await getUserId(req);
    if (!userId) return res.status(401).json({ error: 'Auth' });
    await prisma.transaction.delete({ where: { id: parseInt(req.params.id) } });
    res.json({ success: true });
});

app.post('/transaction/add', async (req, res) => {
    const userId = await getUserId(req);
    if (!userId) return res.status(401).json({ error: 'Auth' });
    
    // Проверка лимита
    const subStatus = await checkSubscription(userId);
    if (!subStatus.canAdd) return res.status(403).json({ error: 'Limit' });

    const { amount, category, type, description } = req.body;
    const user = await prisma.user.findUnique({ where: { id: userId } });
    
    await prisma.transaction.create({
        data: {
            amount: parseFloat(amount),
            category, type, description,
            currency: user.currency || 'UZS',
            userId
        }
    });
    res.json({ success: true });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => console.log(`Server running on ${PORT}`));
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));