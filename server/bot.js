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

// Validate environment variables
if (!TELEGRAM_BOT_TOKEN) {
  console.error('ERROR: TELEGRAM_BOT_TOKEN is not set!');
  process.exit(1);
}
if (!SUPABASE_URL) {
  console.error('ERROR: SUPABASE_URL is not set!');
  process.exit(1);
}
if (!SUPABASE_SERVICE_ROLE_KEY) {
  console.error('ERROR: SUPABASE_SERVICE_ROLE_KEY is not set!');
  process.exit(1);
}

console.log('✓ Environment variables loaded');
console.log('✓ Supabase URL:', SUPABASE_URL);
console.log('✓ Bot token:', TELEGRAM_BOT_TOKEN ? `${TELEGRAM_BOT_TOKEN.substring(0, 10)}...` : 'NOT SET');

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

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

  if (telegramId === ADMIN_TELEGRAM_ID) {
    keyboard.push([{ text: '📋 Управление расписанием', url: projectUrl }]);
    keyboard.push([{ text: '📢 Рассылка', callback_data: 'admin_broadcast' }]);
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

// Get available slots
async function getAvailableSlots() {
  const today = new Date().toISOString().split('T')[0];
  
  const { data: slots, error } = await supabase
    .from('slots')
    .select('*')
    .eq('status', 'free')
    .gte('date', today)
    .order('date', { ascending: true })
    .order('time', { ascending: true })
    .limit(30);

  if (error) {
    console.error('Error fetching slots:', error);
    return [];
  }

  return slots || [];
}

// Get unique dates from available slots
async function getAvailableDates() {
  const slots = await getAvailableSlots();
  const uniqueDates = [...new Set(slots.map(slot => slot.date))];
  return uniqueDates;
}

// Get slots for a specific date
async function getSlotsForDate(date) {
  const { data: slots, error } = await supabase
    .from('slots')
    .select('*')
    .eq('status', 'free')
    .eq('date', date)
    .order('time', { ascending: true });

  if (error) {
    console.error('Error fetching slots for date:', error);
    return [];
  }

  return slots || [];
}

// Get client's upcoming bookings only
async function getClientBookings(clientId) {
  const now = new Date();
  const today = now.toISOString().split('T')[0];
  const currentTime = now.toTimeString().slice(0, 5);
  
  const { data: bookings, error } = await supabase
    .from('bookings')
    .select(`
      *,
      slots (*)
    `)
    .eq('client_id', clientId)
    .eq('status', 'active')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching bookings:', error);
    return [];
  }

  // Filter only upcoming bookings
  const upcomingBookings = (bookings || []).filter(booking => {
    const slot = booking.slots;
    if (!slot) return false;
    if (slot.date > today) return true;
    if (slot.date === today && slot.time > currentTime) return true;
    return false;
  });

  return upcomingBookings;
}

// Book a slot with format
async function bookSlot(clientId, slotId, format = 'offline') {
  // Get slot info for notification
  const { data: slot } = await supabase
    .from('slots')
    .select('*')
    .eq('id', slotId)
    .single();

  if (!slot) return false;

  // Start transaction: update slot and create booking
  const { error: slotError } = await supabase
    .from('slots')
    .update({ status: 'booked', client_id: clientId, format })
    .eq('id', slotId)
    .eq('status', 'free');

  if (slotError) {
    console.error('Error updating slot:', slotError);
    return false;
  }

  const { error: bookingError } = await supabase
    .from('bookings')
    .insert({
      client_id: clientId,
      slot_id: slotId,
      status: 'active',
    });

  if (bookingError) {
    console.error('Error creating booking:', bookingError);
    return false;
  }

  // Get client info for notification
  const { data: clientData } = await supabase
    .from('clients')
    .select('*')
    .eq('id', clientId)
    .single();

  // Notify admin about new booking
  if (clientData) {
    const name = clientData.first_name || 'Клиент';
    const username = clientData.username ? `@${clientData.username}` : '';
    const formatText = format === 'online' ? '💻 онлайн' : '🏠 очно';
    
    await sendMessage(
      ADMIN_TELEGRAM_ID,
      `📅 <b>Новая запись!</b>\n\nКлиент: ${name} ${username}\n🆔 id: ${clientData.telegram_id}\n\n📆 ${formatDate(slot.date)} в ${formatTime(slot.time)}\n${formatText}`
    );
  }

  return true;
}

// Cancel booking with 24h check for clients
async function cancelBooking(bookingId, isAdminCancel = false) {
  const { data: booking, error: fetchError } = await supabase
    .from('bookings')
    .select('slot_id, client_id')
    .eq('id', bookingId)
    .single();

  if (fetchError || !booking) {
    return { success: false, error: 'Запись не найдена' };
  }

  // Get slot info
  const { data: slot } = await supabase
    .from('slots')
    .select('*')
    .eq('id', booking.slot_id)
    .single();

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

  // Get client info for notification
  const { data: clientData } = await supabase
    .from('clients')
    .select('*')
    .eq('id', booking.client_id)
    .single();

  const { error: bookingError } = await supabase
    .from('bookings')
    .update({ status: 'canceled' })
    .eq('id', bookingId);

  if (bookingError) {
    return { success: false, error: 'Ошибка отмены записи' };
  }

  const { error: slotError } = await supabase
    .from('slots')
    .update({ status: 'free', client_id: null, format: null })
    .eq('id', booking.slot_id);

  if (slotError) {
    return { success: false, error: 'Ошибка обновления слота' };
  }

  return { success: true, slot, client: clientData };
}

// Save diary entry
async function saveDiaryEntry(clientId, text) {
  const { error } = await supabase
    .from('diary_entries')
    .insert({
      client_id: clientId,
      text,
    });

  return !error;
}

// Get diary entries
async function getDiaryEntries(clientId) {
  const { data, error } = await supabase
    .from('diary_entries')
    .select('*')
    .eq('client_id', clientId)
    .order('created_at', { ascending: false })
    .limit(5);

  if (error) {
    console.error('Error fetching diary entries:', error);
    return [];
  }

  return data || [];
}

// Create SOS request and notify admin
async function createSosRequest(clientId, client, text) {
  const { error } = await supabase
    .from('sos_requests')
    .insert({
      client_id: clientId,
      text,
      status: 'new',
    });

  if (error) {
    console.error('Error creating SOS request:', error);
    return false;
  }

  // Notify admin about SOS
  const name = client.first_name || 'Пользователь';
  const username = client.username ? `@${client.username}` : 'нет username';
  
  const adminMessage = `⚠️ <b>SOS-сигнал</b>

Пользователь нажал кнопку SOS.

🆔 id: ${client.telegram_id}
👤 username: ${username}
📛 Имя: ${name}

Вы можете ответить пользователю напрямую в Telegram.`;

  await sendMessage(ADMIN_TELEGRAM_ID, adminMessage);

  return true;
}

// Get current state
async function getState(chatId) {
  const { data } = await supabase
    .from('bot_settings')
    .select('value')
    .eq('key', `state_${chatId}`)
    .maybeSingle();

  return data?.value || null;
}

// Clear state
async function clearState(chatId) {
  await supabase
    .from('bot_settings')
    .delete()
    .eq('key', `state_${chatId}`);
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

// Save payment screenshot
async function savePaymentScreenshot(clientId, fileUrl) {
  try {
    // First, check if bucket exists and get its details
    const { data: buckets, error: listError } = await supabase.storage.listBuckets();
    
    if (listError) {
      console.error('Error listing buckets:', listError);
      return false;
    }
    
    const paymentsBucket = buckets?.find(b => b.id === 'payments');
    if (!paymentsBucket) {
      console.error('Bucket "payments" not found. Available buckets:', buckets?.map(b => b.id));
      return false;
    }
    
    console.log('Bucket "payments" found:', paymentsBucket);
    console.log('Bucket is public:', paymentsBucket.public);
    
    // Download file from Telegram
    console.log('Downloading file from Telegram:', fileUrl);
    const response = await fetch(fileUrl);
    if (!response.ok) {
      console.error('Failed to download file from Telegram:', response.status, response.statusText);
      return false;
    }
    
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    console.log('File downloaded, size:', buffer.length, 'bytes');
    
    // Generate unique filename
    const filename = `${clientId}/${Date.now()}.jpg`;
    console.log('Uploading file to storage:', filename);
    
    // Use direct REST API call to Storage API
    const storageUrl = `${SUPABASE_URL}/storage/v1/object/payments/${filename}`;
    console.log('Storage URL:', storageUrl);
    
    // Upload using direct fetch to Storage API
    const uploadResponse = await fetch(storageUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        'Content-Type': 'image/jpeg',
        'x-upsert': 'false',
        'apikey': SUPABASE_SERVICE_ROLE_KEY
      },
      body: buffer
    });
    
    console.log('Upload response status:', uploadResponse.status);
    console.log('Upload response headers:', Object.fromEntries(uploadResponse.headers.entries()));
    
    if (!uploadResponse.ok) {
      const errorText = await uploadResponse.text();
      console.error('Upload failed:', uploadResponse.status, uploadResponse.statusText);
      console.error('Error response:', errorText);
      
      // Try to parse error
      try {
        const errorJson = JSON.parse(errorText);
        console.error('Error JSON:', JSON.stringify(errorJson, null, 2));
      } catch (e) {
        console.error('Could not parse error as JSON');
      }
      
      return false;
    }
    
    const uploadResult = await uploadResponse.json();
    console.log('File uploaded successfully:', uploadResult);
    
    // Get public URL
    const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/payments/${filename}`;
    console.log('Public URL:', publicUrl);
    
    // Save to payments table
    const { error: dbError } = await supabase
      .from('payments')
      .insert({
        client_id: clientId,
        screenshot_url: publicUrl,
      });
    
    if (dbError) {
      console.error('Error saving payment record:', dbError);
      return false;
    }
    
    console.log('Payment record saved successfully');
    return true;
  } catch (error) {
    console.error('Error processing payment screenshot:', error);
    console.error('Error name:', error.name);
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);
    return false;
  }
}

// Handle booking flow - step 1: select day
async function handleBookSession(chatId, telegramId) {
  const dates = await getAvailableDates();

  if (dates.length === 0) {
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

  await sendMessage(
    chatId,
    '🗓 <b>Записаться на консультацию</b>\n\nВыберите день:',
    { inline_keyboard: keyboard }
  );
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
  // Fetch slot to get available_formats
  const { data: slot } = await supabase
    .from('slots')
    .select('available_formats')
    .eq('id', slotId)
    .maybeSingle();

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
  const bookings = await getClientBookings(clientId);

  if (bookings.length === 0) {
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

  await sendMessage(chatId, text, { inline_keyboard: keyboard });
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
  await supabase
    .from('bot_settings')
    .upsert({
      key: `state_${chatId}`,
      value: { state: 'waiting_diary' },
    }, { onConflict: 'key' });
}

// Handle payment
async function handlePayment(chatId, clientId) {
  // Get card number from settings
  const { data: cardSetting } = await supabase
    .from('bot_settings')
    .select('value')
    .eq('key', 'payment_card')
    .maybeSingle();
  
  const cardNumber = cardSetting?.value?.card_number || '5208130004581850';
  
  // Send card number
  await sendMessage(chatId, `<code>${cardNumber}</code>`);
  
  // Send instructions
  await sendMessage(
    chatId,
    `Это номер карты, его можно удобно скопировать. Пришлите в этот диалог скриншот об оплате`,
    { inline_keyboard: [[{ text: '◀️ Назад', callback_data: 'main_menu' }]] }
  );
  
  // Set state for waiting payment screenshot
  await supabase
    .from('bot_settings')
    .upsert({
      key: `state_${chatId}`,
      value: { state: 'waiting_payment', client_id: clientId },
    }, { onConflict: 'key' });
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
  await supabase
    .from('bot_settings')
    .upsert({
      key: `state_${chatId}`,
      value: { state: 'waiting_sos', client_id: client.id },
    }, { onConflict: 'key' });
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

  await supabase
    .from('bot_settings')
    .upsert({
      key: `state_${chatId}`,
      value: { state: 'waiting_broadcast' },
    }, { onConflict: 'key' });
}

async function sendBroadcast(text) {
  const { data: clients } = await supabase
    .from('clients')
    .select('telegram_id');

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
  
  if (text === '/cancel' && telegramId === ADMIN_TELEGRAM_ID) {
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
    const { data: sosRequests } = await supabase
      .from('sos_requests')
      .select('id')
      .eq('client_id', client.id)
      .eq('status', 'new')
      .order('created_at', { ascending: false })
      .limit(1);

    if (sosRequests && sosRequests.length > 0) {
      await supabase
        .from('sos_requests')
        .update({ text })
        .eq('id', sosRequests[0].id);
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

    await sendMessage(ADMIN_TELEGRAM_ID, adminMessage, null, false);
    
    await sendMessage(
      chatId,
      '✅ Сообщение отправлено психологу.',
      getMainMenuKeyboard(telegramId)
    );
    return;
  }
  
  if (state?.state === 'waiting_broadcast' && telegramId === ADMIN_TELEGRAM_ID) {
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

  if (!chatId || !data) {
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
  
  if (data === 'admin_broadcast' && telegramId === ADMIN_TELEGRAM_ID) {
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
          ADMIN_TELEGRAM_ID,
          `❌ <b>Клиент отменил запись</b>\n\nКлиент: ${name} ${username}\n🆔 id: ${client.telegram_id}\n\n📆 ${formatDate(result.slot.date)} в ${formatTime(result.slot.time)}`
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

    if (update.message) {
      const client = await getOrCreateClient(update.message.from);
      
      // Handle photos separately from text messages
      if (update.message.photo) {
        const chatId = update.message.chat.id;
        const telegramId = update.message.from.id;
        const state = await getState(chatId);
        
        // Handle payment screenshot
        if (state?.state === 'waiting_payment') {
          // Get the largest photo
          const photo = update.message.photo[update.message.photo.length - 1];
          const fileUrl = await getFileUrl(photo.file_id);
          
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
                ADMIN_TELEGRAM_ID,
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
    const { data: client, error: clientError } = await supabase
      .from('clients')
      .select('*')
      .eq('id', clientId)
      .single();

    if (clientError || !client) {
      return res.status(404).json({ error: 'Client not found' });
    }

    // Check if slot exists for this date and time
    const { data: existingSlot } = await supabase
      .from('slots')
      .select('*')
      .eq('date', date)
      .eq('time', time)
      .maybeSingle();

    let slotId;

    if (existingSlot) {
      // Check if slot is free
      if (existingSlot.status !== 'free') {
        return res.status(400).json({ error: 'Slot is already booked' });
      }
      slotId = existingSlot.id;
    } else {
      // Create a new slot
      const { data: newSlot, error: slotError } = await supabase
        .from('slots')
        .insert({
          date,
          time,
          status: 'free',
          available_formats: 'both'
        })
        .select()
        .single();

      if (slotError || !newSlot) {
        return res.status(500).json({ error: 'Failed to create slot' });
      }
      slotId = newSlot.id;
    }

    // Book the slot
    const { error: updateError } = await supabase
      .from('slots')
      .update({ status: 'booked', client_id: clientId, format })
      .eq('id', slotId);

    if (updateError) {
      return res.status(500).json({ error: 'Failed to book slot' });
    }

    // Create booking record
    const { error: bookingError } = await supabase
      .from('bookings')
      .insert({
        client_id: clientId,
        slot_id: slotId,
        status: 'active',
      });

    if (bookingError) {
      return res.status(500).json({ error: 'Failed to create booking' });
    }

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

// Check storage bucket on startup
async function checkStorageBucket() {
  try {
    const { data: buckets, error } = await supabase.storage.listBuckets();
    if (error) {
      console.error('❌ Error listing buckets:', error);
      return;
    }
    
    console.log('📦 Available buckets:', buckets?.map(b => b.id) || 'none');
    
    const paymentsBucket = buckets?.find(b => b.id === 'payments');
    if (paymentsBucket) {
      console.log('✅ Bucket "payments" found and ready');
    } else {
      console.error('❌ Bucket "payments" NOT FOUND! Please create it in Supabase Dashboard.');
    }
  } catch (error) {
    console.error('❌ Error checking storage bucket:', error);
  }
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, async () => {
  console.log(`Bot server running on port ${PORT}`);
  await checkStorageBucket();
});
