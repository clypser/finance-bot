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

// === ЛОГ ЗАПУСКА ===
console.log("🚀 Server restarting... Rich Answers + Subscription Fix");

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

// === ПРОВЕРКА ПОДПИСКИ ===
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

  if (isPro) {
      return { isPro: true, canAdd: true, remaining: 9999 };
  }

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

    // Предобработка k/к
    let cleanText = text.replace(/(\d+)\s*[kк]/gi, (match, p1) => p1 + '000');

    const prompt = `
      Analyze transaction: "${cleanText}". Default: ${userCurrency}.
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

// Красивое приветствие + Меню
bot.start(async (ctx) => {
  const { id, first_name, username } = ctx.from;
  try {
    const user = await prisma.user.upsert({
      where: { telegramId: BigInt(id) },
      update: { firstName: first_name, username },
      create: { telegramId: BigInt(id), firstName: first_name, username, currency: 'UZS' }
    });
    
    const subStatus = await checkSubscription(user.id);
    const statusText = subStatus.isPro ? "🌟 PRO (Безлимит)" : `Осталось записей: ${subStatus.remaining} (из 50)`;

    await ctx.reply(`👋 <b>Привет, ${first_name}!</b>\n\nЯ Theo AI — твой умный финансовый помощник.\n\n💰 Твоя валюта: <b>${user.currency}</b>\n📊 Твой статус: <b>${statusText}</b>\n\nПиши расходы просто так: <i>"Такси 20к"</i> или <i>"Обед 50000"</i>.`, {
        parse_mode: 'HTML',
        ...getCurrencyMenu()
    });

    // Отдельно кнопка WebApp
    await ctx.reply('👇 Нажми кнопку, чтобы открыть графики', 
      Markup.keyboard([[Markup.button.webApp('📊 Моя статистика', process.env.WEBAPP_URL)]]).resize()
    );
  } catch (e) { console.error(e); }
});

bot.command('currency', async (ctx) => {
    await ctx.reply('Выберите валюту для учета:', getCurrencyMenu());
});

// Оплата
bot.command('pro', async (ctx) => {
    return ctx.sendInvoice({
        title: 'Theo AI Pro (1 месяц)',
        description: 'Снимает все лимиты на количество транзакций',
        payload: 'pro_sub_1month',
        provider_token: "", 
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
    await ctx.reply('🎉 <b>Спасибо за покупку!</b>\nТеперь у вас безлимитный доступ к Theo AI Pro на 30 дней. 🌟', { parse_mode: 'HTML' });
});

// Смена валюты
bot.action(/^curr_(.+)$/, async (ctx) => {
    const newCurrency = ctx.match[1];
    const userId = ctx.from.id;
    try {
        await prisma.user.update({ where: { telegramId: BigInt(userId) }, data: { currency: newCurrency } });
        await ctx.answerCbQuery(`Валюта: ${newCurrency}`);
        await ctx.editMessageText(`✅ Валюта изменена на <b>${newCurrency}</b>`, { parse_mode: 'HTML' });
    } catch (e) { console.error(e); }
});

// Обработка текста (Транзакции)
bot.on('text', async (ctx) => {
  try {
    const userId = BigInt(ctx.from.id);
    const user = await prisma.user.findUnique({ where: { telegramId: userId } });
    if (!user) return ctx.reply('Нажми /start');
    
    // Проверка лимита
    const subStatus = await checkSubscription(user.id);
    if (!subStatus.canAdd) {
        return ctx.reply(`⛔ <b>Лимит исчерпан</b>\n\nВы достигли лимита в 50 записей за неделю.\nОформите подписку за 100 звезд, чтобы снять ограничения: /pro`, { parse_mode: 'HTML' });
    }

    ctx.sendChatAction('typing');
    const result = await analyzeText(ctx.message.text, user.currency || 'UZS');
    
    if (!result || !result.amount) {
        // Если это просто приветствие - не ругаемся
        const text = ctx.message.text.toLowerCase();
        if (['привет', 'ку', 'start'].some(w => text.includes(w))) return;
        return ctx.reply('⚠️ Не нашел сумму. Напиши, например: "Такси 20к"');
    }

    const finalCurrency = result.currency || user.currency || 'UZS';

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

    // === ВОЗВРАЩАЕМ КРАСИВЫЙ ОТВЕТ С ЭМОДЗИ ===
    const emoji = getCategoryEmoji(result.category);
    // Форматируем число с пробелами (10 000 вместо 10000)
    const formattedAmount = result.amount.toLocaleString(); 
    const sign = result.type === 'expense' ? '-' : '+';
    
    await ctx.reply(`✅ ${sign}${formattedAmount} ${finalCurrency} | ${emoji} ${result.category}`);

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
    const subStatus = await checkSubscription(userId);

    const { period } = req.params;
    let dateFilter = {};
    const now = new Date();
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
        isPro: subStatus.isPro,
        limitRemaining: subStatus.remaining 
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/transaction/:id', async (req, res) => {
  try {
    const userId = await getUserId(req);
    if (!userId) return res.status(401).json({ error: 'Auth' });
    await prisma.transaction.delete({ where: { id: parseInt(req.params.id) } });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/transaction/add', async (req, res) => {
  try {
    const userId = await getUserId(req);
    if (!userId) return res.status(401).json({ error: 'Auth' });
    
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
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Добавляем endpoint для инвойса, чтобы кнопка в Mini App работала
app.post('/payment/invoice', async (req, res) => {
    try {
        const userId = await getUserId(req);
        if (!userId) return res.status(401).json({ error: 'Auth' });
        const user = await prisma.user.findUnique({ where: { id: userId } });
        
        await bot.telegram.sendInvoice(Number(user.telegramId), {
            title: 'Theo AI Pro',
            description: 'Безлимитный доступ на 1 месяц',
            payload: 'pro_sub_webapp',
            provider_token: "", 
            currency: 'XTR',
            prices: [{ label: 'Pro 1 Month', amount: 100 }]
        });
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: 'Error' }); }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => console.log(`Server running on ${PORT}`));
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));