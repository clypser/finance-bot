const express = require('express');
const { Telegraf, Markup } = require('telegraf');
const { OpenAI } = require('openai');
const { PrismaClient } = require('@prisma/client');
const cors = require('cors');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth } = require('date-fns');

// Config
const app = express();
const prisma = new PrismaClient();
const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

app.use(cors());
app.use(express.json());

// --- AI HELPERS ---

const analyzeText = async (text, currency = 'UZS') => {
  const prompt = `
    Analyze this financial text: "${text}".
    Default currency is ${currency}.
    If user says "25k", it means 25000.
    Return ONLY valid JSON:
    {
      "amount": number,
      "currency": "UZS" | "USD" | "RUB" | "KZT",
      "category": string (One word, capitalized, e.g. "Food", "Taxi", "Salary"),
      "type": "expense" | "income",
      "description": string
    }
  `;
  
  const completion = await openai.chat.completions.create({
    messages: [{ role: "system", content: "You are a JSON parser for financial data." }, { role: "user", content: prompt }],
    model: "gpt-4-turbo", // or gpt-3.5-turbo-0125
    response_format: { type: "json_object" }
  });

  return JSON.parse(completion.choices[0].message.content);
};

// --- BOT LOGIC ---

bot.start(async (ctx) => {
  const { id, first_name, username } = ctx.from;
  await prisma.user.upsert({
    where: { telegramId: id },
    update: { firstName: first_name, username },
    create: { telegramId: id, firstName: first_name, username, currency: 'UZS' }
  });
  
  ctx.reply('Привет! Я твой AI-бухгалтер. Пиши расходы (напр. "Обед 50к") или отправляй фото чеков.', 
    Markup.keyboard([
      [Markup.button.webApp('📊 Открыть Mini App', process.env.WEBAPP_URL)]
    ]).resize()
  );
});

bot.on('text', async (ctx) => {
  try {
    const userId = ctx.from.id;
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

    ctx.reply(`✅ Записано:\n${result.category}: ${result.amount} ${result.currency}\nТип: ${result.type === 'expense' ? 'Расход' : 'Доход'}`);
  } catch (e) {
    console.error(e);
    ctx.reply('Не смог распознать запись. Попробуй: "Такси 20000"');
  }
});

bot.on('voice', async (ctx) => {
  try {
    const fileLink = await ctx.telegram.getFileLink(ctx.message.voice.file_id);
    // Note: For production, download file -> openai.audio.transcriptions.create
    // For this demo, we assume the transcription logic or mock it due to stream complexity
    ctx.reply('Голосовой ввод в разработке (нужен ffmpeg в докере для конвертации OGG->MP3). Пиши текстом.');
  } catch (e) {
    ctx.reply('Ошибка обработки голоса.');
  }
});

bot.on('photo', async (ctx) => {
  try {
    const photo = ctx.message.photo[ctx.message.photo.length - 1];
    const fileLink = await ctx.telegram.getFileLink(photo.file_id);
    
    const completion = await openai.chat.completions.create({
      model: "gpt-4-vision-preview",
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: "Extract total amount, probable category, and currency from this receipt. Return JSON only: { amount, currency, category, type: 'expense' }" },
            { type: "image_url", image_url: { url: fileLink.href } },
          ],
        },
      ],
      max_tokens: 300,
    });
    
    // Parse JSON from text response (GPT Vision returns text, not JSON object mode usually)
    const text = completion.choices[0].message.content;
    const jsonStr = text.match(/\{[\s\S]*\}/)[0];
    const result = JSON.parse(jsonStr);
    
    const user = await prisma.user.findUnique({ where: { telegramId: ctx.from.id } });
    
    await prisma.transaction.create({
      data: { ...result, userId: user.id, description: "Scan from receipt" }
    });

    ctx.reply(`📸 Чек распознан:\n${result.category}: ${result.amount} ${result.currency}`);
  } catch (e) {
    console.error(e);
    ctx.reply('Не удалось прочитать чек.');
  }
});

bot.launch();

// --- API ROUTES FOR MINI APP ---

// Middleware to mock auth for demo (In prod, verify telegram initData)
const getUserId = async (req) => {
  // Pass telegram_id in header for simplicity in this demo
  const tid = req.headers['x-telegram-id'];
  if (!tid) throw new Error("No Auth");
  const user = await prisma.user.findUnique({ where: { telegramId: BigInt(tid) } });
  return user ? user.id : null;
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

    // Simple aggregation by category
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

app.get('/budgets', async (req, res) => {
  const userId = await getUserId(req);
  const budgets = await prisma.budget.findMany({ where: { userId } });
  res.json(budgets);
});

app.post('/budgets', async (req, res) => {
  const userId = await getUserId(req);
  const { category, limit, currency } = req.body;
  const budget = await prisma.budget.create({
    data: { category, limit, currency, userId }
  });
  res.json(budget);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on ${PORT}`));

// Graceful stop
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));