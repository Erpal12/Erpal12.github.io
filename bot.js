const TelegramBot = require('node-telegram-bot-api');
const crypto = require('crypto');
require('dotenv').config();

const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, { polling: true });

bot.on('message', async (msg) => {
  const chatId = msg.chat.id;

  if (msg.text === '/start') {
    const webAppUrl = `https://your-webapp-url.com?user=${chatId}`;
    bot.sendMessage(chatId, 'Welcome! Click the button below to open the WebApp:', {
      reply_markup: {
        inline_keyboard: [[{ text: 'Open WebApp', web_app: { url: webAppUrl } }]]
      }
    });
  }
});

bot.on('web_app_data', async (msg) => {
  const data = JSON.parse(msg.web_app_data.data);
  if (data.action === 'share_referral') {
    bot.sendMessage(msg.chat.id, `Your referral code is: ${data.code}`);
  }
});

module.exports = bot;