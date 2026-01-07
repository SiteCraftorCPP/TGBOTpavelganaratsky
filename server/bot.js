const express = require('express');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const app = express();
app.use(express.json());

// Configuration
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ADMIN_TELEGRAM_ID = 783321437;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// Telegram API functions
async function sendMessage(chatId, text, replyMarkup) {
  const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
  const body = {
    chat_id: chatId,
    text,
    parse_mode: 'HTML',
  };
  if (replyMarkup) {
    body.reply_markup = replyMarkup;
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  return response.json();
}

async function sendPhoto(chatId, photoUrl, caption, replyMarkup) {
  const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendPhoto`;
  const body = {
    chat_id: chatId,
    photo: photoUrl,
    caption,
    parse_mode: 'HTML',
  };
  if (replyMarkup) {
    body.reply_markup = replyMarkup;
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  return response.json();
}

async function answerCallbackQuery(callbackQueryId, text) {
  const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/answerCallbackQuery`;
  await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      callback_query_id: callbackQueryId,
      text,
    }),
  });
}

function formatDate(dateStr) {
  const date = new Date(dateStr);
  return date.toLocaleDateString('ru-RU', { 
    weekday: 'short', 
    day: 'numeric', 
    month: 'long' 
  });
}

function formatTime(timeStr) {
  return timeStr.slice(0, 5);
}

function getMainMenuKeyboard(telegramId) {
  const keyboard = [
    [{ text: '🗓 Записаться на консультацию', callback_data: 'book_session' }],
    [
      { text: '📁 Свободные даты', callback_data: 'free_slots' },
      { text: '🗓 Моя запись', callback_data: 'my_bookings' },
    ],
    [
      { text: '📒 Дневник терапии', callback_data: 'diary' },
      { text: '💳 Оплата', callback_data: 'payment' },
    ],
    [{ text: '🆘 SOS', callback_data: 'sos' }],
  ];

  if (telegramId === ADMIN_TELEGRAM_ID) {
    keyboard.push([{ text: '📋 Управление расписанием', url: process.env.PROJECT_URL || 'https://liftme.by' }]);
  }

  return { inline_keyboard: keyboard };
}

async function getOrCreateClient(telegramUser) {
  const { data: existingClient } = await supabase
    .from('clients')
    .select('*')
    .eq('telegram_id', telegramUser.id)
    .maybeSingle();

  if (existingClient) {
    return existingClient;
  }

  const { data: newClient, error } = await supabase
    .from('clients')
    .insert({
      telegram_id: telegramUser.id,
      first_name: telegramUser.first_name ?? null,
      last_name: telegramUser.last_name ?? null,
      username: telegramUser.username ?? null,
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating client:', error);
    throw error;
  }

  return newClient;
}

// Main webhook handler
app.post('/webhook', async (req, res) => {
  try {
    const update = req.body;

    if (update.message) {
      const client = await getOrCreateClient(update.message.from);
      
      if (update.message.text === '/start' || update.message.text === '/menu') {
        const projectUrl = process.env.PROJECT_URL || 'https://liftme.by';
        const menuImageUrl = `${projectUrl}/menu-image.jpg`;
        await sendPhoto(update.message.chat.id, menuImageUrl, 'Вы в главном меню:', getMainMenuKeyboard(update.message.from.id));
      } else {
        await sendMessage(update.message.chat.id, 'Используйте меню для навигации:', getMainMenuKeyboard(update.message.from.id));
      }
    }

    if (update.callback_query) {
      const client = await getOrCreateClient(update.callback_query.from);
      await answerCallbackQuery(update.callback_query.id);
      
      // Handle callback queries
      const data = update.callback_query.data;
      
      if (data === 'main_menu') {
        const projectUrl = process.env.PROJECT_URL || 'https://liftme.by';
        const menuImageUrl = `${projectUrl}/menu-image.jpg`;
        await sendPhoto(update.callback_query.message.chat.id, menuImageUrl, 'Вы в главном меню:', getMainMenuKeyboard(update.callback_query.from.id));
      } else if (data === 'free_slots') {
        // Get available slots
        const today = new Date().toISOString().split('T')[0];
        const { data: slots } = await supabase
          .from('slots')
          .select('*')
          .eq('status', 'free')
          .gte('date', today)
          .order('date', { ascending: true })
          .order('time', { ascending: true })
          .limit(30);

        if (!slots || slots.length === 0) {
          await sendMessage(
            update.callback_query.message.chat.id,
            '😔 К сожалению, свободных дат нет.\n\nПопробуйте позже.',
            { inline_keyboard: [[{ text: '◀️ Назад', callback_data: 'main_menu' }]] }
          );
        } else {
          let text = '📁 <b>Свободные даты:</b>\n\n';
          for (const slot of slots) {
            text += `• ${formatDate(slot.date)} в ${formatTime(slot.time)}\n`;
          }
          text += '\nДля записи нажмите "Записаться на консультацию"';
          
          await sendMessage(
            update.callback_query.message.chat.id,
            text,
            { 
              inline_keyboard: [
                [{ text: '📅 Записаться', callback_data: 'book_session' }],
                [{ text: '◀️ Назад', callback_data: 'main_menu' }]
              ] 
            }
          );
        }
      } else {
        await sendMessage(update.callback_query.message.chat.id, 'Функция в разработке. Используйте главное меню.', getMainMenuKeyboard(update.callback_query.from.id));
      }
    }

    res.json({ ok: true });
  } catch (error) {
    console.error('Error processing update:', error);
    res.status(500).json({ error: error.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Bot server running on port ${PORT}`);
});

