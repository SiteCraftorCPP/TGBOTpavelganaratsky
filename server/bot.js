const express = require('express');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const db = require('./db');
const { initStorage, savePaymentScreenshot } = require('./storage');

const app = express();
app.use(express.json());

// CORS middleware for admin panel
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// Configuration
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const ADMIN_TELEGRAM_IDS = [783321437, 6933111964];

function isAdmin(telegramId) {
  return ADMIN_TELEGRAM_IDS.includes(telegramId);
}

// Validate environment variables
if (!TELEGRAM_BOT_TOKEN) {
  console.error('ERROR: TELEGRAM_BOT_TOKEN is not set!');
  process.exit(1);
}

console.log('✓ Environment variables loaded');
console.log('✓ Bot token:', TELEGRAM_BOT_TOKEN ? `${TELEGRAM_BOT_TOKEN.substring(0, 10)}...` : 'NOT SET');

// Telegram API functions
async function sendMessage(chatId, text, replyMarkup, useReplyKeyboard = true) {
  const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
  const body = {
    chat_id: chatId,
    text,
    parse_mode: 'HTML',
  };

  if (replyMarkup) {
    body.reply_markup = replyMarkup;
  } else if (useReplyKeyboard) {
    body.reply_markup = {
      keyboard: [[{ text: '📋 Меню' }]],
      resize_keyboard: true,
      persistent: true
    };
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
  const projectUrl = process.env.PROJECT_URL || 'https://liftme.by';

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
    keyboard.push([{ text: '📋 Управление расписанием', url: projectUrl }]);
    keyboard.push([{ text: '📢 Рассылка', callback_data: 'admin_broadcast' }]);
  }

  return { inline_keyboard: keyboard };
}

async function getOrCreateClient(telegramUser) {
  let client = await db.getClientByTelegramId(telegramUser.id);

  if (!client) {
    client = await db.createClient(telegramUser);
  }

  return client;
}

// Get available slots
async function getAvailableSlots() {
  return await db.getAvailableSlots(30);
}

// Get unique dates from available slots
async function getAvailableDates() {
  const slots = await getAvailableSlots();
  const uniqueDates = [...new Set(slots.map(slot => {
    // Ensure date is in YYYY-MM-DD format (string)
    const date = slot.date;
    if (date instanceof Date) {
      return date.toISOString().split('T')[0];
    }
    return typeof date === 'string' ? date.split('T')[0] : date;
  }))];
  return uniqueDates;
}

// Get slots for a specific date
async function getSlotsForDate(date) {
  return await db.getSlotsForDate(date);
}

// Get client's upcoming bookings only
async function getClientBookings(clientId) {
  console.log('📅 getClientBookings: querying DB for clientId:', clientId);
  const bookings = await db.getClientBookings(clientId);
  console.log('📅 getClientBookings: raw bookings from DB:', JSON.stringify(bookings, null, 2));
  console.log('📅 getClientBookings: number of bookings:', bookings.length);
  
  const now = new Date();
  const today = now.toISOString().split('T')[0];
  const currentTime = now.toTimeString().slice(0, 5); // HH:MM format
  console.log('📅 Filter criteria:', { today, currentTime });
  
  // Filter only upcoming bookings
  const filtered = bookings.filter(booking => {
    if (!booking.date) {
      return false;
    }
    
    // Convert date to string if needed
    const bookingDate = booking.date instanceof Date 
      ? booking.date.toISOString().split('T')[0]
      : (typeof booking.date === 'string' ? booking.date.split('T')[0] : String(booking.date));
    
    // Convert time to HH:MM format (cut seconds if present)
    const bookingTime = typeof booking.time === 'string' 
      ? booking.time.slice(0, 5) // Take only HH:MM
      : String(booking.time).slice(0, 5);
    
    if (bookingDate > today) {
      return true; // Future date
    }
    if (bookingDate === today && bookingTime >= currentTime) {
      return true; // Today but not past
    }
    return false; // Past booking
  });
  
  return filtered.map(booking => {
    const dateStr = booking.date instanceof Date 
      ? booking.date.toISOString().split('T')[0]
      : (typeof booking.date === 'string' ? booking.date.split('T')[0] : String(booking.date));
    
    return {
      ...booking,
      date: dateStr,
      slots: {
        date: dateStr,
        time: booking.time,
        format: booking.format
      }
    };
  });
}

// Book a slot with format
async function bookSlot(clientId, slotId, format = 'offline') {
  try {
    console.log('📅 bookSlot called:', { clientId, slotId, format });
    const slot = await db.getSlotById(slotId);
    if (!slot) {
      console.log('❌ Slot not found:', slotId);
      return false;
    }

    console.log('✅ Slot found:', slot);
    await db.updateSlot(slotId, { status: 'booked', client_id: clientId, format });
    console.log('✅ Slot updated');

    const booking = await db.createBooking(clientId, slotId);
    console.log('✅ Booking created:', booking);

    const client = await db.getClientById(clientId);

    if (client) {
      const name = client.first_name || 'Клиент';
      const username = client.username ? `@${client.username}` : '';
      const formatText = format === 'online' ? '💻 онлайн' : '🏠 очно';

      await sendMessage(
        ADMIN_TELEGRAM_IDS[0],
        `📅 <b>Новая запись!</b>\n\nКлиент: ${name} ${username}\n🆔 id: ${client.telegram_id}\n\n📆 ${formatDate(slot.date)} в ${formatTime(slot.time)}\n${formatText}`,
        null,
        false
      );
    }

    return true;
  } catch (error) {
    console.error('❌ Error in bookSlot:', error);
    return false;
  }
}

// Cancel booking with 24h check for clients
async function cancelBooking(bookingId, isAdminCancel = false) {
  const bookingResult = await db.query(
    'SELECT slot_id, client_id FROM bookings WHERE id = $1',
    [bookingId]
  );

  if (!bookingResult.rows[0]) {
    return { success: false, error: 'Запись не найдена' };
  }

  const booking = bookingResult.rows[0];
  const slot = await db.getSlotById(booking.slot_id);

  if (!slot) {
    return { success: false, error: 'Слот не найден' };
  }

  // Check 24h rule for client cancellations
  if (!isAdminCancel) {
    const slotDateTime = new Date(`${slot.date}T${slot.time}`);
    const now = new Date();
    const hoursUntilSlot = (slotDateTime.getTime() - now.getTime()) / (1000 * 60 * 60);

    if (hoursUntilSlot < 24) {
      return { success: false, error: 'Отменить запись можно не позднее чем за 24 часа до начала' };
    }
  }

  const client = await db.getClientById(booking.client_id);
  await db.cancelBooking(bookingId);
  await db.updateSlot(booking.slot_id, { status: 'free', client_id: null, format: null });

  return { success: true, slot, client };
}

// Save diary entry
async function saveDiaryEntry(clientId, text) {
  try {
    await db.createDiaryEntry(clientId, text);
    return true;
  } catch (error) {
    console.error('Error saving diary entry:', error);
    return false;
  }
}

// Get diary entries
async function getDiaryEntries(clientId) {
  return await db.getDiaryEntries(clientId, 5);
}

// Create SOS request and notify admin
async function createSosRequest(clientId, client, text) {
  try {
    await db.createSosRequest(clientId, text || '');

    // Notify admin about SOS
    const name = client.first_name || 'Пользователь';
    const username = client.username ? `@${client.username}` : 'нет username';

    const adminMessage = `⚠️ <b>SOS-сигнал</b>

Пользователь нажал кнопку SOS.

🆔 id: ${client.telegram_id}
👤 username: ${username}
📛 Имя: ${name}

Вы можете ответить пользователю напрямую в Telegram.`;

    await sendMessage(ADMIN_TELEGRAM_IDS[0], adminMessage, null, false);
    return true;
  } catch (error) {
    console.error('Error creating SOS request:', error);
    return false;
  }
}

// Get current state
async function getState(chatId) {
  const setting = await db.getSetting(`state_${chatId}`);
  return setting ? (typeof setting.value === 'string' ? JSON.parse(setting.value) : setting.value) : null;
}

// Clear state
async function clearState(chatId) {
  await db.query('DELETE FROM bot_settings WHERE key = $1', [`state_${chatId}`]);
}

// Get file URL from Telegram
async function getFileUrl(fileId) {
  const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getFile`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ file_id: fileId }),
  });

  const result = await response.json();
  if (result.ok && result.result?.file_path) {
    return `https://api.telegram.org/file/bot${TELEGRAM_BOT_TOKEN}/${result.result.file_path}`;
  }
  return null;
}

// Save payment screenshot (using local storage) - function name conflicts, using storage module directly

// Handle booking flow - step 1: select day
async function handleBookSession(chatId, telegramId) {
  try {
    console.log('📅 handleBookSession: getting available slots');
    const slots = await getAvailableSlots();
    console.log('📅 Raw slots from DB:', JSON.stringify(slots, null, 2));
    console.log('📅 Number of slots:', slots.length);
    
    const dates = await getAvailableDates();
    console.log('📅 Available dates after processing:', dates);
    console.log('📅 Number of dates:', dates.length);

    if (dates.length === 0) {
      console.log('❌ No available dates - checking slots in DB');
      const allSlotsCheck = await db.query(
        'SELECT COUNT(*) as total, COUNT(*) FILTER (WHERE status = $1) as free_count FROM slots WHERE date >= CURRENT_DATE',
        ['free']
      );
      console.log('📊 Slots check:', allSlotsCheck.rows[0]);
      
      await sendMessage(
        chatId,
        '😔 К сожалению, свободных слотов нет.\n\nПопробуйте позже или свяжитесь с психологом напрямую.',
        { inline_keyboard: [[{ text: '◀️ Назад', callback_data: 'main_menu' }]] }
      );
      return;
    }

    const keyboard = dates.map((date) => [{
      text: formatDate(date),
      callback_data: `select_date_${date}`,
    }]);
    keyboard.push([{ text: '◀️ Назад', callback_data: 'main_menu' }]);

    console.log('📅 Sending date selection message');
    await sendMessage(
      chatId,
      '🗓 <b>Записаться на консультацию</b>\n\nВыберите день:',
      { inline_keyboard: keyboard }
    );
    console.log('✅ Date selection message sent');
  } catch (error) {
    console.error('❌ Error in handleBookSession:', error);
    throw error;
  }
}

// Handle booking flow - step 2: select time for selected date
async function handleSelectTime(chatId, date) {
  const slots = await getSlotsForDate(date);

  if (slots.length === 0) {
    await sendMessage(
      chatId,
      '😔 К сожалению, на этот день свободных слотов нет.\n\nВыберите другой день.',
      { inline_keyboard: [[{ text: '◀️ Выбрать другой день', callback_data: 'book_session' }]] }
    );
    return;
  }

  const keyboard = slots.map((slot) => {
    const formatIcon = slot.available_formats === 'both' ? '🏠💻' : slot.available_formats === 'offline' ? '🏠' : '💻';
    return [{
      text: `${formatTime(slot.time)} ${formatIcon}`,
      callback_data: `select_slot_${slot.id}`,
    }];
  });
  keyboard.push([{ text: '◀️ Выбрать другой день', callback_data: 'book_session' }]);

  await sendMessage(
    chatId,
    `🕐 <b>${formatDate(date)}</b>\n\nВыберите время:\n\n🏠 — очно, 💻 — онлайн`,
    { inline_keyboard: keyboard }
  );
}

// Handle format selection - step 3: select format based on available_formats
async function handleSelectFormat(chatId, slotId) {
  const slot = await db.getSlotById(slotId);
  const availableFormats = slot?.available_formats || 'both';

  const buttons = [];

  if (availableFormats === 'offline' || availableFormats === 'both') {
    buttons.push([{ text: '🏠 Очно', callback_data: `book_offline_${slotId}` }]);
  }

  if (availableFormats === 'online' || availableFormats === 'both') {
    buttons.push([{ text: '💻 Онлайн', callback_data: `book_online_${slotId}` }]);
  }

  buttons.push([{ text: '◀️ Назад', callback_data: 'book_session' }]);

  await sendMessage(
    chatId,
    '📍 <b>Выберите формат консультации:</b>',
    { inline_keyboard: buttons }
  );
}

// Handle my bookings - only upcoming
async function handleMyBookings(chatId, clientId, telegramId) {
  try {
    console.log('📅 handleMyBookings: getting bookings for clientId:', clientId);
    const bookings = await getClientBookings(clientId);
    console.log('📅 Client bookings:', bookings.length);

    if (bookings.length === 0) {
      console.log('📅 No bookings, sending empty message');
      await sendMessage(
        chatId,
        '🗓 <b>Моя запись</b>\n\nУ вас нет предстоящих записей.\n\nХотите записаться на консультацию?',
        {
          inline_keyboard: [
            [{ text: '📅 Записаться', callback_data: 'book_session' }],
            [{ text: '◀️ Назад', callback_data: 'main_menu' }],
          ]
        }
      );
      console.log('✅ Empty bookings message sent');
      return;
    }

    let text = '🗓 <b>Предстоящие записи:</b>\n\n';
    const keyboard = [];

    for (const booking of bookings) {
      const slot = booking.slots;
      if (slot) {
        const formatIcon = slot.format === 'online' ? '💻' : '🏠';
        text += `📌 ${formatDate(slot.date)} в ${formatTime(slot.time)} ${formatIcon}\n`;
        keyboard.push([{
          text: `❌ Отменить ${formatDate(slot.date)} ${formatTime(slot.time)}`,
          callback_data: `cancel_${booking.id}`,
        }]);
      }
    }

    text += '\n<i>Отменить запись можно не позднее чем за 24 часа до начала.</i>';

    keyboard.push([{ text: '◀️ Назад', callback_data: 'main_menu' }]);

    console.log('📅 Sending bookings list');
    await sendMessage(chatId, text, { inline_keyboard: keyboard });
    console.log('✅ Bookings list sent');
  } catch (error) {
    console.error('❌ Error in handleMyBookings:', error);
    throw error;
  }
}

// Handle diary with buttons
async function handleDiary(chatId, clientId, telegramId) {
  await sendMessage(
    chatId,
    `📒 <b>Дневник терапии</b>\n\nЗдесь вы можете записывать свои мысли, переживания или то, что вас беспокоит. Это останется между нами.`,
    {
      inline_keyboard: [
        [{ text: '➕ Добавить запись', callback_data: 'diary_add' }],
        [{ text: '📖 Посмотреть записи', callback_data: 'diary_view' }],
        [{ text: '◀️ Назад', callback_data: 'main_menu' }]
      ]
    }
  );
}

// Handle view diary entries
async function handleDiaryView(chatId, clientId, telegramId) {
  const entries = await getDiaryEntries(clientId);

  let text = `📖 <b>Ваши записи:</b>\n\n`;

  if (entries.length === 0) {
    text = `📖 <b>Ваши записи:</b>\n\nУ вас пока нет записей в дневнике.`;
  } else {
    for (const entry of entries) {
      const date = new Date(entry.created_at);
      const dateStr = date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' });
      const preview = entry.text.length > 100 ? entry.text.slice(0, 100) + '...' : entry.text;
      text += `📝 <b>${dateStr}:</b>\n${preview}\n\n`;
    }
  }

  await sendMessage(
    chatId,
    text,
    {
      inline_keyboard: [
        [{ text: '➕ Добавить запись', callback_data: 'diary_add' }],
        [{ text: '◀️ Назад в дневник', callback_data: 'diary' }]
      ]
    }
  );
}

// Handle add diary entry
async function handleDiaryAdd(chatId, clientId) {
  await sendMessage(
    chatId,
    `📝 <b>Новая запись</b>\n\nНапишите свои мысли, переживания или то, что вас беспокоит.\n\n<i>Отправьте текст в следующем сообщении.</i>`,
    { inline_keyboard: [[{ text: '◀️ Отмена', callback_data: 'diary' }]] }
  );

  // Set state for waiting diary entry
  await db.setSetting(`state_${chatId}`, { state: 'waiting_diary' });
}

// Handle payment
async function handlePayment(chatId, clientId) {
  // Get card number from settings
  const cardSetting = await db.getSetting('payment_card');
  const cardNumber = (cardSetting && typeof cardSetting.value === 'string'
    ? JSON.parse(cardSetting.value)
    : cardSetting?.value)?.card_number || '5208130004581850';

  // Send card number
  await sendMessage(chatId, `<code>${cardNumber}</code>`);

  // Send instructions
  await sendMessage(
    chatId,
    `Это номер карты, его можно удобно скопировать. Пришлите в этот диалог скриншот об оплате`,
    { inline_keyboard: [[{ text: '◀️ Назад', callback_data: 'main_menu' }]] }
  );

  // Set state for waiting payment screenshot
  await db.setSetting(`state_${chatId}`, { state: 'waiting_payment', client_id: clientId });
}

// Handle SOS
async function handleSos(chatId, client) {
  await createSosRequest(client.id, client);

  await sendMessage(
    chatId,
    `🆘 <b>SOS-связь с психологом.</b>

Я передал ваше обращение!`,
    { inline_keyboard: [[{ text: '◀️ В главное меню', callback_data: 'main_menu' }]] }
  );

  // Set state for waiting SOS description
  await db.setSetting(`state_${chatId}`, { state: 'waiting_sos', client_id: client.id });
}

// Handle free slots view
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

  await sendMessage(
    chatId,
    text,
    {
      inline_keyboard: [
        [{ text: '📅 Записаться', callback_data: 'book_session' }],
        [{ text: '◀️ Назад', callback_data: 'main_menu' }]
      ]
    }
  );
}

// Handle main menu
async function handleMainMenu(chatId, telegramId) {
  const text = `Вы в главном меню:`;
  await sendMessage(chatId, text, getMainMenuKeyboard(telegramId));
}

// Handle broadcast admin function
async function handleBroadcast(chatId) {
  await sendMessage(
    chatId,
    '📢 <b>Рассылка</b>\n\nОтправьте сообщение, которое хотите разослать всем клиентам.\n\n<i>Для отмены отправьте /cancel</i>',
    { inline_keyboard: [[{ text: '❌ Отмена', callback_data: 'main_menu' }]] }
  );

  await db.setSetting(`state_${chatId}`, { state: 'waiting_broadcast' });
}

async function sendBroadcast(text) {
  const clients = await db.getAllClientsForBroadcast();

  if (!clients || clients.length === 0) {
    return 0;
  }

  let sentCount = 0;
  for (const client of clients) {
    try {
      await sendMessage(client.telegram_id, text, null, false);
      sentCount++;
      // Small delay to avoid rate limits
      await new Promise(resolve => setTimeout(resolve, 50));
    } catch (error) {
      console.error(`Failed to send to ${client.telegram_id}:`, error);
    }
  }

  return sentCount;
}

// Handle text messages
async function handleTextMessage(message, client) {
  const chatId = message.chat.id;
  const text = message.text || '';
  const telegramId = message.from.id;

  // Check for commands
  if (text === '/start' || text === '/menu' || text === '📋 Меню') {
    await clearState(chatId);
    await sendMessage(chatId, 'Вы в главном меню:', getMainMenuKeyboard(telegramId));
    return;
  }

  if (text === '/cancel' && isAdmin(telegramId)) {
    await clearState(chatId);
    await sendMessage(chatId, 'Отменено', getMainMenuKeyboard(telegramId));
    return;
  }

  // Check current state
  const state = await getState(chatId);

  if (state?.state === 'waiting_diary') {
    await saveDiaryEntry(client.id, text);
    await clearState(chatId);
    await sendMessage(
      chatId,
      '✅ Запись сохранена в дневник.\n\nСпасибо, что делитесь своими мыслями.',
      {
        inline_keyboard: [
          [{ text: '📖 Посмотреть записи', callback_data: 'diary_view' }],
          [{ text: '◀️ В главное меню', callback_data: 'main_menu' }]
        ]
      }
    );
    return;
  }

  if (state?.state === 'waiting_sos') {
    // Update the last SOS request with text
    const sosRequests = await db.query(
      `SELECT id FROM sos_requests 
       WHERE client_id = $1 AND status = 'new' 
       ORDER BY created_at DESC LIMIT 1`,
      [client.id]
    );

    if (sosRequests.rows.length > 0) {
      await db.query(
        'UPDATE sos_requests SET text = $1 WHERE id = $2',
        [text, sosRequests.rows[0].id]
      );
    }

    await clearState(chatId);

    // Notify admin about the additional message
    const name = client.first_name || 'Пользователь';
    const username = client.username ? `@${client.username}` : 'нет username';

    const adminMessage = `📝 <b>Дополнение к SOS</b>

От: ${name} (${username})
🆔 id: ${client.telegram_id}

Сообщение:
${text}`;

    await sendMessage(ADMIN_TELEGRAM_IDS[0], adminMessage, null, false);

    await sendMessage(
      chatId,
      '✅ Сообщение отправлено психологу.',
      getMainMenuKeyboard(telegramId)
    );
    return;
  }

  if (state?.state === 'waiting_broadcast' && isAdmin(telegramId)) {
    await clearState(chatId);
    await sendMessage(chatId, '⏳ Рассылаю сообщение...', null, false);

    const sentCount = await sendBroadcast(text);

    await sendMessage(
      chatId,
      `✅ Рассылка завершена!\n\nОтправлено: ${sentCount} клиентам`,
      getMainMenuKeyboard(telegramId)
    );
    return;
  }

  // Default response
  await sendMessage(
    chatId,
    'Используйте меню для навигации:',
    getMainMenuKeyboard(telegramId)
  );
}

// Handle callback queries
async function handleCallbackQuery(callbackQuery, client) {
  const chatId = callbackQuery.message?.chat.id;
  const data = callbackQuery.data;
  const telegramId = callbackQuery.from.id;

  console.log('🔔 handleCallbackQuery:', { chatId, telegramId, data, clientId: client.id });

  if (!chatId || !data) {
    console.log('❌ Missing chatId or data in callback query');
    await answerCallbackQuery(callbackQuery.id);
    return;
  }

  await clearState(chatId);
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
    try {
      console.log('📅 Calling handleBookSession');
      await handleBookSession(chatId, telegramId);
      console.log('✅ handleBookSession completed');
    } catch (error) {
      console.error('❌ Error in handleBookSession:', error);
      await sendMessage(chatId, '❌ Произошла ошибка. Попробуйте позже.', getMainMenuKeyboard(telegramId));
    }
    return;
  }

  if (data === 'my_bookings') {
    try {
      console.log('📅 Calling handleMyBookings');
      await handleMyBookings(chatId, client.id, telegramId);
      console.log('✅ handleMyBookings completed');
    } catch (error) {
      console.error('❌ Error in handleMyBookings:', error);
      await sendMessage(chatId, '❌ Произошла ошибка. Попробуйте позже.', getMainMenuKeyboard(telegramId));
    }
    return;
  }

  if (data === 'diary') {
    await handleDiary(chatId, client.id, telegramId);
    return;
  }

  if (data === 'diary_add') {
    await handleDiaryAdd(chatId, client.id);
    return;
  }

  if (data === 'diary_view') {
    await handleDiaryView(chatId, client.id, telegramId);
    return;
  }

  if (data === 'payment') {
    await handlePayment(chatId, client.id);
    return;
  }

  if (data === 'sos') {
    await handleSos(chatId, client);
    return;
  }

  if (data === 'admin_broadcast' && isAdmin(telegramId)) {
    await handleBroadcast(chatId);
    return;
  }

  // Handle date selection - show times for that date
  if (data.startsWith('select_date_')) {
    const selectedDate = data.replace('select_date_', '');
    await handleSelectTime(chatId, selectedDate);
    return;
  }

  // Handle slot selection - show format options
  if (data.startsWith('select_slot_')) {
    const slotId = data.replace('select_slot_', '');
    await handleSelectFormat(chatId, slotId);
    return;
  }

  // Handle booking with format
  if (data.startsWith('book_offline_') || data.startsWith('book_online_')) {
    const isOnline = data.startsWith('book_online_');
    const slotId = data.replace('book_offline_', '').replace('book_online_', '');
    const format = isOnline ? 'online' : 'offline';

    console.log('📅 Booking request:', { slotId, format, clientId: client.id, callbackData: data });

    const success = await bookSlot(client.id, slotId, format);

    if (success) {
      const formatText = isOnline ? '💻 онлайн' : '🏠 очно';
      await sendMessage(
        chatId,
        `✅ <b>Вы успешно записались!</b>\n\nФормат: ${formatText}\n\nНапоминания придут за 24 часа и за 1 час до сессии.`,
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
    const result = await cancelBooking(bookingId, false); // false = client cancellation

    if (result.success) {
      await sendMessage(
        chatId,
        '✅ Запись отменена.',
        getMainMenuKeyboard(telegramId)
      );

      // Notify admin about client cancellation
      if (result.slot) {
        const name = client.first_name || 'Клиент';
        const username = client.username ? `@${client.username}` : '';
        await sendMessage(
          ADMIN_TELEGRAM_IDS[0],
          `❌ <b>Клиент отменил запись</b>\n\nКлиент: ${name} ${username}\n🆔 id: ${client.telegram_id}\n\n📆 ${formatDate(result.slot.date)} в ${formatTime(result.slot.time)}`,
          null,
          false
        );
      }
    } else {
      await sendMessage(
        chatId,
        `❌ ${result.error || 'Не удалось отменить запись. Попробуйте позже.'}`,
        getMainMenuKeyboard(telegramId)
      );
    }
    return;
  }
}

// Main webhook handler
app.post('/webhook', async (req, res) => {
  try {
    const update = req.body;
    console.log('📥 Webhook received:', {
      hasMessage: !!update.message,
      hasCallbackQuery: !!update.callback_query,
      callbackData: update.callback_query?.data,
      messageText: update.message?.text
    });

    if (update.message) {
      const client = await getOrCreateClient(update.message.from);

      // Handle photos separately from text messages
      if (update.message.photo) {
        console.log('📸 Photo received in webhook');
        const chatId = update.message.chat.id;
        const telegramId = update.message.from.id;
        const state = await getState(chatId);
        console.log('Current state:', state);

        // Handle payment screenshot
        if (state?.state === 'waiting_payment') {
          console.log('✅ State is waiting_payment, processing photo...');
          // Get the largest photo
          const photo = update.message.photo[update.message.photo.length - 1];
          console.log('Photo object:', photo);
          const fileUrl = await getFileUrl(photo.file_id);
          console.log('Got fileUrl from Telegram:', fileUrl);

          if (fileUrl) {
            const success = await savePaymentScreenshot(client.id, fileUrl);

            if (success) {
              await clearState(chatId);
              await sendMessage(
                chatId,
                '✅ Скриншот оплаты получен. Спасибо!',
                getMainMenuKeyboard(telegramId)
              );

              // Notify admin
              const name = client.first_name || 'Пользователь';
              const username = client.username ? `@${client.username}` : '';
              await sendMessage(
                ADMIN_TELEGRAM_IDS[0],
                `💳 <b>Новый скриншот оплаты</b>\n\nОт: ${name} ${username}\n🆔 id: ${client.telegram_id}`,
                null,
                false
              );
            } else {
              await sendMessage(
                chatId,
                '❌ Ошибка сохранения скриншота. Попробуйте ещё раз.',
                { inline_keyboard: [[{ text: '◀️ Назад', callback_data: 'main_menu' }]] }
              );
            }
          } else {
            await sendMessage(
              chatId,
              '❌ Не удалось получить файл. Попробуйте ещё раз.',
              { inline_keyboard: [[{ text: '◀️ Назад', callback_data: 'main_menu' }]] }
            );
          }
        }
      } else {
        await handleTextMessage(update.message, client);
      }
    }

    if (update.callback_query) {
      console.log('🔔 Callback query received:', {
        id: update.callback_query.id,
        data: update.callback_query.data,
        from: update.callback_query.from?.id,
        message: update.callback_query.message?.chat?.id
      });
      const client = await getOrCreateClient(update.callback_query.from);
      await handleCallbackQuery(update.callback_query, client);
    }

    res.json({ ok: true });
  } catch (error) {
    console.error('Error processing update:', error);
    res.status(500).json({ error: error.message });
  }
});

// Endpoint for booking client from admin panel
app.post('/book-for-client', async (req, res) => {
  try {
    const { clientId, date, time, format = 'offline' } = req.body;

    if (!clientId || !date || !time) {
      return res.status(400).json({ error: 'clientId, date, and time are required' });
    }

    // Get client info
    const client = await db.getClientById(clientId);

    if (!client) {
      return res.status(404).json({ error: 'Client not found' });
    }

    // Check if slot exists for this date and time
    const existingSlotResult = await db.query(
      'SELECT * FROM slots WHERE date = $1 AND time = $2',
      [date, time]
    );
    const existingSlot = existingSlotResult.rows[0];

    let slotId;

    if (existingSlot) {
      // Check if slot is free
      if (existingSlot.status !== 'free') {
        return res.status(400).json({ error: 'Slot is already booked' });
      }
      slotId = existingSlot.id;
    } else {
      // Create a new slot
      const newSlot = await db.createSlot(date, time, 'both');
      if (!newSlot) {
        return res.status(500).json({ error: 'Failed to create slot' });
      }
      slotId = newSlot.id;
    }

    // Book the slot
    await db.updateSlot(slotId, { status: 'booked', client_id: clientId, format });
    await db.createBooking(clientId, slotId);

    // Send notification to client
    const formatText = format === 'online' ? '💻 онлайн' : '🏠 очно';
    const clientMessage = `📅 <b>Вам назначена консультация!</b>

📆 ${formatDate(date)} в ${formatTime(time)}
${formatText}

Напоминания придут за 24 часа и за 1 час до сессии.`;

    await sendMessage(client.telegram_id, clientMessage, null, false);

    res.json({ success: true });
  } catch (error) {
    console.error('Error in book-for-client:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Endpoint for canceling booking from admin panel
app.post('/cancel-booking-admin', async (req, res) => {
  try {
    const { slotId } = req.body;

    if (!slotId) {
      return res.status(400).json({ error: 'slotId is required' });
    }

    console.log('Canceling booking for slot:', slotId);

    // Get slot with client info
    const slot = await db.getSlotWithClient(slotId);

    if (!slot) {
      return res.status(404).json({ error: 'Slot not found' });
    }

    const client = slot.telegram_id ? {
      telegram_id: slot.telegram_id,
      first_name: slot.first_name
    } : null;

    // Cancel the booking (update status to 'canceled')
    await db.cancelBookingBySlotId(slotId);

    // Free the slot
    await db.updateSlot(slotId, { status: 'free', client_id: null, format: null });

    // Send notification to client
    if (client?.telegram_id) {
      const name = client.first_name || 'Уважаемый клиент';
      const message = `❌ <b>Запись отменена</b>

${name}, к сожалению, ваша консультация на ${formatDate(slot.date)} в ${formatTime(slot.time)} была отменена.

Пожалуйста, выберите другое удобное время для записи.`;

      await sendMessage(client.telegram_id, message, null, false);
      console.log('Notification sent to client:', client.telegram_id);
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Error in cancel-booking-admin:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ==================== REST API ENDPOINTS FOR ADMIN PANEL ====================

// GET /api/clients - Get all clients
app.get('/api/clients', async (req, res) => {
  try {
    const clients = await db.getAllClients();
    res.json(clients);
  } catch (error) {
    console.error('Error fetching clients:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/clients/:id - Update client
app.put('/api/clients/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { first_name, last_name } = req.body;

    await db.query(
      'UPDATE clients SET first_name = $1, last_name = $2 WHERE id = $3',
      [first_name || null, last_name || null, id]
    );

    res.json({ success: true });
  } catch (error) {
    console.error('Error updating client:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/clients/:id - Delete client
app.delete('/api/clients/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Get client info before deletion
    const client = await db.getClientById(id);
    if (!client) {
      return res.status(404).json({ error: 'Client not found' });
    }

    // Get active bookings for this client
    const bookings = await db.getClientBookings(id);

    // Cancel all active bookings and send notifications
    for (const booking of bookings) {
      const slot = await db.getSlotById(booking.slot_id);
      if (slot) {
        // Cancel booking
        await db.cancelBooking(booking.id);
        // Free the slot
        await db.updateSlot(booking.slot_id, { status: 'free', client_id: null, format: null });

        // Send notification to client
        if (client.telegram_id) {
          const name = client.first_name || 'Уважаемый клиент';
          const message = `❌ <b>Запись отменена</b>

${name}, к сожалению, ваша консультация на ${formatDate(slot.date)} в ${formatTime(slot.time)} была отменена.

Пожалуйста, выберите другое удобное время для записи.`;

          try {
            await sendMessage(client.telegram_id, message, null, false);
          } catch (error) {
            console.error('Error sending cancellation notification:', error);
          }
        }
      }
    }

    // Delete client (will cascade delete related records)
    await db.deleteClient(id);
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting client:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/slots - Get all slots (only future slots)
app.get('/api/slots', async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const slots = await db.getSlots(today);
    res.json(slots);
  } catch (error) {
    console.error('Error fetching slots:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/slots - Create slot
app.post('/api/slots', async (req, res) => {
  try {
    const { date, time, available_formats } = req.body;

    if (!date || !time) {
      return res.status(400).json({ error: 'date and time are required' });
    }

    const slot = await db.createSlot(date, time, available_formats || 'both');
    res.json(slot);
  } catch (error) {
    console.error('Error creating slot:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/slots/:id - Delete slot
app.delete('/api/slots/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await db.deleteSlot(id);
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting slot:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/sos - Get all SOS requests
app.get('/api/sos', async (req, res) => {
  try {
    const requests = await db.getSosRequests();
    res.json(requests);
  } catch (error) {
    console.error('Error fetching SOS requests:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/sos/:id - Mark SOS request as viewed
app.put('/api/sos/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await db.updateSosRequestStatus(id, 'viewed');
    res.json({ success: true });
  } catch (error) {
    console.error('Error updating SOS request:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/payments - Get all payments
app.get('/api/payments', async (req, res) => {
  try {
    const payments = await db.getPayments();
    res.json(payments);
  } catch (error) {
    console.error('Error fetching payments:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/payments/:id - Delete payment
app.delete('/api/payments/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Get payment to delete file
    const payments = await db.getPayments();
    const payment = payments.find(p => p.id === id);

    if (payment) {
      const { deletePaymentFile } = require('./storage');
      await deletePaymentFile(payment.screenshot_url);
    }

    await db.deletePayment(id);
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting payment:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/bookings/:id - Delete booking (admin only, cancels booking and frees slot)
app.delete('/api/bookings/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Get booking info
    const bookingResult = await db.query(
      'SELECT slot_id, client_id FROM bookings WHERE id = $1',
      [id]
    );

    if (!bookingResult.rows[0]) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    const booking = bookingResult.rows[0];
    const slot = await db.getSlotById(booking.slot_id);

    if (slot) {
      // Cancel booking
      await db.cancelBooking(id);
      // Free the slot
      await db.updateSlot(booking.slot_id, { status: 'free', client_id: null, format: null });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting booking:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/payment-card - Get payment card number
app.get('/api/payment-card', async (req, res) => {
  try {
    const setting = await db.getSetting('payment_card');
    const cardNumber = setting && typeof setting.value === 'string'
      ? JSON.parse(setting.value)
      : setting?.value;
    res.json(cardNumber || { card_number: '5208130004581850' });
  } catch (error) {
    console.error('Error fetching payment card:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/payment-card - Save payment card number
app.put('/api/payment-card', async (req, res) => {
  try {
    const { card_number } = req.body;
    await db.setSetting('payment_card', { card_number });
    res.json({ success: true });
  } catch (error) {
    console.error('Error saving payment card:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/diary - Get all diary entries
app.get('/api/diary', async (req, res) => {
  try {
    const result = await db.query(
      `SELECT d.*, 
       c.first_name, c.last_name, c.username
     FROM diary_entries d
     JOIN clients c ON d.client_id = c.id
     ORDER BY d.created_at DESC
     LIMIT 50`
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching diary entries:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Initialize storage on startup
const PORT = process.env.PORT || 3000;
app.listen(PORT, async () => {
  console.log(`Bot server running on port ${PORT}`);
  await initStorage();
  console.log('✓ Storage initialized');
});
