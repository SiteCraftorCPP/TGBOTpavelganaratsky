/**
 * Telegram Bot для психолога
 * Node.js версия для Amvera
 */

const express = require('express');
const { createClient } = require('@supabase/supabase-js');

const app = express();
app.use(express.json());

// ============= Конфигурация =============
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const DATABASE_URL = process.env.DATABASE_URL;
const ADMIN_TELEGRAM_ID = parseInt(process.env.ADMIN_TELEGRAM_ID || '783321437');
const PORT = process.env.PORT || 3000;

// Для Amvera используем прямое подключение к PostgreSQL
// Если хотите продолжить использовать Supabase, раскомментируйте:
// const SUPABASE_URL = process.env.SUPABASE_URL;
// const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
// const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// PostgreSQL client для прямого подключения
const { Pool } = require('pg');
const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// ============= Telegram API =============

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

  const result = await response.json();
  console.log('sendMessage result:', result);
  return result;
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

async function setChatMenuButton(chatId) {
  const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/setChatMenuButton`;
  await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      menu_button: { type: 'commands' }
    }),
  });
}

async function setMyCommands() {
  const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/setMyCommands`;
  await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      commands: [
        { command: 'menu', description: '🏠 Главное меню' }
      ]
    }),
  });
}

// ============= Вспомогательные функции =============

function isAdmin(telegramId) {
  return telegramId === ADMIN_TELEGRAM_ID;
}

// ============= База данных =============

async function getOrCreateClient(telegramUser) {
  const { rows } = await pool.query(
    'SELECT * FROM clients WHERE telegram_id = $1',
    [telegramUser.id]
  );

  if (rows.length > 0) {
    return rows[0];
  }

  const { rows: newRows } = await pool.query(
    `INSERT INTO clients (telegram_id, first_name, last_name, username)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [telegramUser.id, telegramUser.first_name || null, telegramUser.last_name || null, telegramUser.username || null]
  );

  return newRows[0];
}

async function getAvailableSlots() {
  const today = new Date().toISOString().split('T')[0];
  
  const { rows } = await pool.query(
    `SELECT * FROM slots 
     WHERE status = 'free' AND date >= $1
     ORDER BY date ASC, time ASC
     LIMIT 10`,
    [today]
  );

  return rows;
}

async function getClientBookings(clientId) {
  const { rows } = await pool.query(
    `SELECT b.*, s.date, s.time 
     FROM bookings b
     JOIN slots s ON b.slot_id = s.id
     WHERE b.client_id = $1 AND b.status = 'active'
     ORDER BY b.created_at DESC`,
    [clientId]
  );

  return rows;
}

async function bookSlot(clientId, slotId) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rowCount } = await client.query(
      `UPDATE slots SET status = 'booked', client_id = $1
       WHERE id = $2 AND status = 'free'`,
      [clientId, slotId]
    );

    if (rowCount === 0) {
      await client.query('ROLLBACK');
      return false;
    }

    await client.query(
      `INSERT INTO bookings (client_id, slot_id, status)
       VALUES ($1, $2, 'active')`,
      [clientId, slotId]
    );

    await client.query('COMMIT');
    return true;
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('Error booking slot:', e);
    return false;
  } finally {
    client.release();
  }
}

async function cancelBooking(bookingId) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows } = await client.query(
      'SELECT slot_id FROM bookings WHERE id = $1',
      [bookingId]
    );

    if (rows.length === 0) {
      await client.query('ROLLBACK');
      return false;
    }

    await client.query(
      `UPDATE bookings SET status = 'canceled' WHERE id = $1`,
      [bookingId]
    );

    await client.query(
      `UPDATE slots SET status = 'free', client_id = NULL WHERE id = $1`,
      [rows[0].slot_id]
    );

    await client.query('COMMIT');
    return true;
  } catch (e) {
    await client.query('ROLLBACK');
    return false;
  } finally {
    client.release();
  }
}

async function saveDiaryEntry(clientId, text) {
  try {
    await pool.query(
      'INSERT INTO diary_entries (client_id, text) VALUES ($1, $2)',
      [clientId, text]
    );
    return true;
  } catch (e) {
    console.error('Error saving diary entry:', e);
    return false;
  }
}

async function getDiaryEntries(clientId) {
  const { rows } = await pool.query(
    `SELECT * FROM diary_entries 
     WHERE client_id = $1 
     ORDER BY created_at DESC 
     LIMIT 5`,
    [clientId]
  );
  return rows;
}

async function createSosRequest(clientId, clientInfo, text) {
  try {
    await pool.query(
      `INSERT INTO sos_requests (client_id, text, status) VALUES ($1, $2, 'new')`,
      [clientId, text || null]
    );

    const name = clientInfo.first_name || 'Пользователь';
    const username = clientInfo.username ? `@${clientInfo.username}` : 'нет username';

    const adminMessage = `⚠️ <b>SOS-сигнал</b>

Пользователь нажал кнопку SOS.

🆔 id: ${clientInfo.telegram_id}
👤 username: ${username}
📛 Имя: ${name}

Вы можете ответить пользователю напрямую в Telegram.`;

    await sendMessage(ADMIN_TELEGRAM_ID, adminMessage);
    return true;
  } catch (e) {
    console.error('Error creating SOS request:', e);
    return false;
  }
}

// State management
const userStates = new Map();

function getState(chatId) {
  return userStates.get(chatId) || null;
}

function setState(chatId, state) {
  userStates.set(chatId, state);
}

function clearState(chatId) {
  userStates.delete(chatId);
}

// ============= Форматирование =============

function formatDate(dateStr) {
  const date = new Date(dateStr);
  const options = { weekday: 'short', day: 'numeric', month: 'long' };
  return date.toLocaleDateString('ru-RU', options);
}

function formatTime(timeStr) {
  return timeStr.slice(0, 5);
}

// ============= Клавиатуры =============

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

  if (isAdmin(telegramId)) {
    keyboard.push([{ text: '⚙️ Админ-панель', callback_data: 'admin_panel' }]);
  }

  return { inline_keyboard: keyboard };
}

// ============= Обработчики =============

async function handleStart(chatId, telegramId) {
  await setChatMenuButton(chatId);
  await setMyCommands();

  const text = `Вы в главном меню. Выберите нужный пункт:`;
  await sendMessage(chatId, text, getMainMenuKeyboard(telegramId));
}

async function handleMainMenu(chatId, telegramId) {
  const text = `Вы в главном меню. Выберите нужный пункт:`;
  await sendMessage(chatId, text, getMainMenuKeyboard(telegramId));
}

async function handleFreeSlots(chatId, telegramId) {
  const slots = await getAvailableSlots();

  if (slots.length === 0) {
    await sendMessage(
      chatId,
      '😔 К сожалению, свободных дат нет.\n\nПопробуйте позже.',
      { inline_keyboard: [[{ text: '◀️ Назад', callback_data: 'main_menu' }]] }
    );
    return;
  }

  let text = '📁 <b>Свободные даты:</b>\n\n';
  for (const slot of slots) {
    text += `• ${formatDate(slot.date)} в ${formatTime(slot.time)}\n`;
  }

  text += '\nДля записи нажмите "Записаться на консультацию"';

  await sendMessage(chatId, text, {
    inline_keyboard: [
      [{ text: '📅 Записаться', callback_data: 'book_session' }],
      [{ text: '◀️ Назад', callback_data: 'main_menu' }]
    ]
  });
}

async function handleBookSession(chatId, telegramId) {
  const slots = await getAvailableSlots();

  if (slots.length === 0) {
    await sendMessage(
      chatId,
      '😔 К сожалению, свободных слотов нет.\n\nПопробуйте позже или свяжитесь с психологом напрямую.',
      { inline_keyboard: [[{ text: '◀️ Назад', callback_data: 'main_menu' }]] }
    );
    return;
  }

  const keyboard = slots.map((slot) => [{
    text: `${formatDate(slot.date)} в ${formatTime(slot.time)}`,
    callback_data: `book_${slot.id}`,
  }]);
  keyboard.push([{ text: '◀️ Назад', callback_data: 'main_menu' }]);

  await sendMessage(
    chatId,
    '🗓 <b>Записаться на консультацию</b>\n\nВыберите удобное время:',
    { inline_keyboard: keyboard }
  );
}

async function handleMyBookings(chatId, clientId, telegramId) {
  const bookings = await getClientBookings(clientId);

  if (bookings.length === 0) {
    await sendMessage(
      chatId,
      '🗓 <b>Моя запись</b>\n\nУ вас пока нет активных записей.\n\nХотите записаться на консультацию?',
      {
        inline_keyboard: [
          [{ text: '📅 Записаться', callback_data: 'book_session' }],
          [{ text: '◀️ Назад', callback_data: 'main_menu' }],
        ]
      }
    );
    return;
  }

  let text = '🗓 <b>Моя запись:</b>\n\n';
  const keyboard = [];

  for (const booking of bookings) {
    text += `📌 ${formatDate(booking.date)} в ${formatTime(booking.time)}\n`;
    keyboard.push([{
      text: `❌ Отменить ${formatDate(booking.date)} ${formatTime(booking.time)}`,
      callback_data: `cancel_${booking.id}`,
    }]);
  }

  keyboard.push([{ text: '◀️ Назад', callback_data: 'main_menu' }]);

  await sendMessage(chatId, text, { inline_keyboard: keyboard });
}

async function handleDiary(chatId, clientId, telegramId) {
  const entries = await getDiaryEntries(clientId);

  let text = `📒 <b>Дневник терапии</b>\n\n`;

  if (entries.length > 0) {
    text += `<b>Последние записи:</b>\n\n`;
    for (const entry of entries) {
      const date = new Date(entry.created_at);
      const dateStr = date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
      const preview = entry.text.length > 50 ? entry.text.slice(0, 50) + '...' : entry.text;
      text += `📝 ${dateStr}: ${preview}\n`;
    }
    text += '\n';
  }

  text += `Напишите свои мысли, переживания или то, что вас беспокоит. Это останется между нами.\n\n<i>Отправьте текст в следующем сообщении.</i>`;

  await sendMessage(chatId, text, { inline_keyboard: [[{ text: '◀️ Назад', callback_data: 'main_menu' }]] });

  setState(chatId, { state: 'waiting_diary' });
}

async function handlePayment(chatId, telegramId) {
  await sendMessage(
    chatId,
    `💳 <b>Оплата</b>

Для оплаты консультации используйте следующие реквизиты:

💳 Карта: <code>1234 5678 9012 3456</code>
📝 Получатель: Психолог

После оплаты напишите психологу для подтверждения.

<i>Стоимость консультации: договорная</i>`,
    { inline_keyboard: [[{ text: '◀️ Назад', callback_data: 'main_menu' }]] }
  );
}

async function handleSos(chatId, client) {
  await createSosRequest(client.id, client);

  await sendMessage(
    chatId,
    `🆘 <b>SOS-связь с психологом.</b>

Я передал ваше обращение, скоро с вами свяжутся.
Напишите здесь, что случилось, или дождитесь ответа.

Если вам нужна срочная помощь:
📞 Телефон доверия: 8-800-2000-122 (бесплатно)`,
    { inline_keyboard: [[{ text: '◀️ В главное меню', callback_data: 'main_menu' }]] }
  );

  setState(chatId, { state: 'waiting_sos', client_id: client.id });
}

async function handleAdminPanel(chatId, telegramId) {
  if (!isAdmin(telegramId)) {
    await sendMessage(chatId, '⛔ У вас нет доступа к админ-панели.');
    return;
  }

  const projectUrl = process.env.PROJECT_URL || 'https://your-lovable-project.lovable.app';

  await sendMessage(
    chatId,
    `⚙️ <b>Админ-панель</b>

Для управления ботом перейдите в веб-панель:

🔗 <a href="${projectUrl}">Открыть админ-панель</a>

В панели вы можете:
• 📅 Управлять слотами
• 👥 Просматривать клиентов
• 📒 Читать записи дневника
• 🆘 Просматривать SOS-запросы`,
    { inline_keyboard: [[{ text: '◀️ Назад', callback_data: 'main_menu' }]] }
  );
}

async function handleTextMessage(message, client) {
  const chatId = message.chat.id;
  const text = message.text || '';
  const telegramId = message.from.id;

  if (text === '/start' || text === '/menu') {
    clearState(chatId);
    await handleStart(chatId, telegramId);
    return;
  }

  const state = getState(chatId);

  if (state?.state === 'waiting_diary') {
    await saveDiaryEntry(client.id, text);
    clearState(chatId);
    await sendMessage(
      chatId,
      '✅ Запись сохранена в дневник.\n\nСпасибо, что делитесь своими мыслями.',
      getMainMenuKeyboard(telegramId)
    );
    return;
  }

  if (state?.state === 'waiting_sos') {
    // Update SOS with text
    await pool.query(
      `UPDATE sos_requests SET text = $1 
       WHERE client_id = $2 AND status = 'new'
       ORDER BY created_at DESC LIMIT 1`,
      [text, client.id]
    );

    clearState(chatId);

    const name = client.first_name || 'Пользователь';
    const username = client.username ? `@${client.username}` : 'нет username';

    const adminMessage = `📝 <b>Дополнение к SOS</b>

От: ${name} (${username})
🆔 id: ${client.telegram_id}

Сообщение:
${text}`;

    await sendMessage(ADMIN_TELEGRAM_ID, adminMessage);

    await sendMessage(
      chatId,
      '✅ Сообщение отправлено психологу.\n\nМы свяжемся с вами как можно скорее.',
      getMainMenuKeyboard(telegramId)
    );
    return;
  }

  await sendMessage(
    chatId,
    'Используйте меню для навигации:',
    getMainMenuKeyboard(telegramId)
  );
}

async function handleCallbackQuery(callbackQuery, client) {
  const chatId = callbackQuery.message?.chat.id;
  const data = callbackQuery.data;
  const telegramId = callbackQuery.from.id;

  if (!chatId || !data) {
    await answerCallbackQuery(callbackQuery.id);
    return;
  }

  clearState(chatId);
  await answerCallbackQuery(callbackQuery.id);

  if (data === 'main_menu') {
    await handleMainMenu(chatId, telegramId);
    return;
  }

  if (data === 'free_slots') {
    await handleFreeSlots(chatId, telegramId);
    return;
  }

  if (data === 'book_session') {
    await handleBookSession(chatId, telegramId);
    return;
  }

  if (data === 'my_bookings') {
    await handleMyBookings(chatId, client.id, telegramId);
    return;
  }

  if (data === 'diary') {
    await handleDiary(chatId, client.id, telegramId);
    return;
  }

  if (data === 'payment') {
    await handlePayment(chatId, telegramId);
    return;
  }

  if (data === 'sos') {
    await handleSos(chatId, client);
    return;
  }

  if (data === 'admin_panel') {
    await handleAdminPanel(chatId, telegramId);
    return;
  }

  if (data.startsWith('book_')) {
    const slotId = data.replace('book_', '');
    const success = await bookSlot(client.id, slotId);

    if (success) {
      await sendMessage(
        chatId,
        '✅ <b>Вы успешно записались!</b>\n\nНапоминания придут за 24 часа и за 1 час до сессии.',
        getMainMenuKeyboard(telegramId)
      );
    } else {
      await sendMessage(
        chatId,
        '😔 К сожалению, это время уже занято.\n\nПожалуйста, выберите другой слот.',
        { inline_keyboard: [[{ text: '📅 Выбрать другое время', callback_data: 'book_session' }]] }
      );
    }
    return;
  }

  if (data.startsWith('cancel_')) {
    const bookingId = data.replace('cancel_', '');
    const success = await cancelBooking(bookingId);

    if (success) {
      await sendMessage(
        chatId,
        '✅ Запись отменена.',
        getMainMenuKeyboard(telegramId)
      );
    } else {
      await sendMessage(
        chatId,
        '❌ Не удалось отменить запись. Попробуйте позже.',
        getMainMenuKeyboard(telegramId)
      );
    }
    return;
  }
}

// ============= Webhook endpoint =============

app.post('/webhook', async (req, res) => {
  console.log('Received webhook:', JSON.stringify(req.body, null, 2));

  try {
    const update = req.body;

    if (update.message) {
      const client = await getOrCreateClient(update.message.from);
      await handleTextMessage(update.message, client);
    }

    if (update.callback_query) {
      const client = await getOrCreateClient(update.callback_query.from);
      await handleCallbackQuery(update.callback_query, client);
    }

    res.json({ ok: true });
  } catch (error) {
    console.error('Error processing update:', error);
    res.status(500).json({ error: error.message });
  }
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Start server
app.listen(PORT, () => {
  console.log(`Bot server running on port ${PORT}`);
});
