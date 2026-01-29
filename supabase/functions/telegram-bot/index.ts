import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.89.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const TELEGRAM_BOT_TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN')!
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

// Admin Telegram ID
const ADMIN_TELEGRAM_ID = 783321437

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

interface TelegramUser {
  id: number
  first_name?: string
  last_name?: string
  username?: string
}

interface TelegramPhoto {
  file_id: string
  file_unique_id: string
  width: number
  height: number
}

interface TelegramMessage {
  message_id: number
  from: TelegramUser
  chat: { id: number }
  text?: string
  photo?: TelegramPhoto[]
  date: number
}

interface TelegramCallbackQuery {
  id: string
  from: TelegramUser
  message?: TelegramMessage
  data?: string
}

interface TelegramUpdate {
  update_id: number
  message?: TelegramMessage
  callback_query?: TelegramCallbackQuery
}

// Send message to Telegram
async function sendMessage(chatId: number, text: string, replyMarkup?: object, useReplyKeyboard = true) {
  const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`
  const body: Record<string, unknown> = {
    chat_id: chatId,
    text,
    parse_mode: 'HTML',
  }
  
  if (replyMarkup) {
    body.reply_markup = replyMarkup
  } else if (useReplyKeyboard) {
    body.reply_markup = {
      keyboard: [[{ text: '📋 Главное меню' }]],
      resize_keyboard: true,
      persistent: true
    }
  }
  
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  
  const result = await response.json()
  console.log('sendMessage result:', result)
  return result
}

// Send photo with caption to Telegram
async function sendPhoto(chatId: number, photoUrl: string, caption: string, replyMarkup?: object) {
  const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendPhoto`
  const body: Record<string, unknown> = {
    chat_id: chatId,
    photo: photoUrl,
    caption,
    parse_mode: 'HTML',
  }
  if (replyMarkup) {
    body.reply_markup = replyMarkup
  }
  
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  
  const result = await response.json()
  console.log('sendPhoto result:', result)
  return result
}

// Answer callback query
async function answerCallbackQuery(callbackQueryId: string, text?: string) {
  const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/answerCallbackQuery`
  await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      callback_query_id: callbackQueryId,
      text,
    }),
  })
}

// Set up menu button for the bot
async function setChatMenuButton(chatId?: number) {
  const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/setChatMenuButton`
  const body: any = {
    menu_button: {
      type: 'commands'
    }
  }
  
  if (chatId) {
    body.chat_id = chatId
  }

  await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

// Set bot commands
async function setMyCommands() {
  const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/setMyCommands`
  await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      commands: [
        { command: 'menu', description: '🏠 Главное меню' }
      ]
    }),
  })
}

// Check if user is admin
function isAdmin(telegramId: number): boolean {
  return telegramId === ADMIN_TELEGRAM_ID
}

// Get or create client
async function getOrCreateClient(telegramUser: TelegramUser): Promise<{
  id: string
  first_name: string | null
  last_name: string | null
  username: string | null
  telegram_id: number
}> {
  const { data: existingClient } = await supabase
    .from('clients')
    .select('*')
    .eq('telegram_id', telegramUser.id)
    .maybeSingle()

  if (existingClient) {
    return existingClient
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
    .single()

  if (error) {
    console.error('Error creating client:', error)
    throw error
  }

  return newClient!
}

// Get available slots for booking
async function getAvailableSlots() {
  const now = new Date()
  const today = now.toISOString().split('T')[0]
  const currentTime = now.toTimeString().slice(0, 5) // HH:MM
  
  const { data: slots, error } = await supabase
    .from('slots')
    .select('*')
    .eq('status', 'free')
    .gte('date', today)
    .order('date', { ascending: true })
    .order('time', { ascending: true })
    .limit(100)

  if (error) {
    console.error('Error fetching slots:', error)
    return []
  }

  // Filter out past time slots for today
  const filteredSlots = (slots || []).filter(slot => {
    const slotDate = typeof slot.date === 'string' ? slot.date.split('T')[0] : String(slot.date)
    if (slotDate === today) {
      const slotTime = typeof slot.time === 'string' ? slot.time.slice(0, 5) : String(slot.time).slice(0, 5)
      return slotTime >= currentTime
    }
    return true // Future dates are always valid
  })

  return filteredSlots.slice(0, 30)
}

// Get unique dates from available slots
async function getAvailableDates() {
  const slots = await getAvailableSlots()
  const uniqueDates = [...new Set(slots.map(slot => slot.date))]
  return uniqueDates
}

// Get slots for a specific date
async function getSlotsForDate(date: string) {
  const now = new Date()
  const today = now.toISOString().split('T')[0]
  const currentTime = now.toTimeString().slice(0, 5) // HH:MM
  const slotDate = typeof date === 'string' ? date.split('T')[0] : String(date)
  
  const { data: slots, error } = await supabase
    .from('slots')
    .select('*')
    .eq('status', 'free')
    .eq('date', date)
    .gte('date', today)
    .order('time', { ascending: true })

  if (error) {
    console.error('Error fetching slots for date:', error)
    return []
  }

  // Filter out past time slots for today
  if (slotDate === today) {
    return (slots || []).filter(slot => {
      const slotTime = typeof slot.time === 'string' ? slot.time.slice(0, 5) : String(slot.time).slice(0, 5)
      return slotTime >= currentTime
    })
  }

  return slots || []
}

// Get client's upcoming bookings only
async function getClientBookings(clientId: string) {
  const now = new Date()
  const today = now.toISOString().split('T')[0]
  const currentTime = now.toTimeString().slice(0, 5)
  
  const { data: bookings, error } = await supabase
    .from('bookings')
    .select(`
      *,
      slots (*)
    `)
    .eq('client_id', clientId)
    .eq('status', 'active')
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching bookings:', error)
    return []
  }

  // Filter only upcoming bookings
  const upcomingBookings = (bookings || []).filter(booking => {
    const slot = booking.slots
    if (!slot) return false
    if (slot.date > today) return true
    if (slot.date === today && slot.time > currentTime) return true
    return false
  })

  return upcomingBookings
}

// Book a slot with format
async function bookSlot(clientId: string, slotId: string, format: string = 'offline') {
  // Get slot info for notification
  const { data: slot } = await supabase
    .from('slots')
    .select('*')
    .eq('id', slotId)
    .single()

  if (!slot) return false

  // Check if slot date is in the past
  const today = new Date().toISOString().split('T')[0]
  const slotDate = typeof slot.date === 'string' ? slot.date.split('T')[0] : String(slot.date)
  
  if (slotDate < today) {
    console.log('❌ Cannot book slot in the past:', slotDate)
    return false
  }

  // Check if slot is today but time has passed
  if (slotDate === today) {
    const now = new Date()
    const currentTime = now.toTimeString().slice(0, 5) // HH:MM
    const slotTime = typeof slot.time === 'string' ? slot.time.slice(0, 5) : String(slot.time).slice(0, 5)
    if (slotTime < currentTime) {
      console.log('❌ Cannot book slot - time has passed:', slotTime)
      return false
    }
  }

  // Start transaction: update slot and create booking
  const { error: slotError } = await supabase
    .from('slots')
    .update({ status: 'booked', client_id: clientId, format })
    .eq('id', slotId)
    .eq('status', 'free')

  if (slotError) {
    console.error('Error updating slot:', slotError)
    return false
  }

  const { error: bookingError } = await supabase
    .from('bookings')
    .insert({
      client_id: clientId,
      slot_id: slotId,
      status: 'active',
    })

  if (bookingError) {
    console.error('Error creating booking:', bookingError)
    return false
  }

  // Get client info for notification
  const { data: clientData } = await supabase
    .from('clients')
    .select('*')
    .eq('id', clientId)
    .single()

  // Notify admin about new booking
  if (clientData) {
    const name = clientData.first_name || 'Клиент'
    const username = clientData.username ? `@${clientData.username}` : ''
    const formatText = format === 'online' ? '💻 онлайн' : '🏠 очно'
    
    await sendMessage(
      ADMIN_TELEGRAM_ID,
      `📅 <b>Новая запись!</b>\n\nКлиент: ${name} ${username}\n🆔 id: ${clientData.telegram_id}\n\n📆 ${formatDate(slot.date)} в ${formatTime(slot.time)}\n${formatText}`
    )
  }

  return true
}

// Cancel booking with 24h check for clients
async function cancelBooking(bookingId: string, isAdminCancel: boolean = false): Promise<{ success: boolean; error?: string; slot?: any; client?: any }> {
  const { data: booking, error: fetchError } = await supabase
    .from('bookings')
    .select('slot_id, client_id')
    .eq('id', bookingId)
    .single()

  if (fetchError || !booking) {
    return { success: false, error: 'Запись не найдена' }
  }

  // Get slot info
  const { data: slot } = await supabase
    .from('slots')
    .select('*')
    .eq('id', booking.slot_id)
    .single()

  if (!slot) {
    return { success: false, error: 'Слот не найден' }
  }

  // Check 24h rule for client cancellations
  if (!isAdminCancel) {
    const slotDateTime = new Date(`${slot.date}T${slot.time}`)
    const now = new Date()
    const hoursUntilSlot = (slotDateTime.getTime() - now.getTime()) / (1000 * 60 * 60)
    
    if (hoursUntilSlot < 24) {
      return { success: false, error: 'Отменить запись можно не позднее чем за 24 часа до начала' }
    }
  }

  // Get client info for notification
  const { data: clientData } = await supabase
    .from('clients')
    .select('*')
    .eq('id', booking.client_id)
    .single()

  const { error: bookingError } = await supabase
    .from('bookings')
    .update({ status: 'canceled' })
    .eq('id', bookingId)

  if (bookingError) {
    return { success: false, error: 'Ошибка отмены записи' }
  }

  const { error: slotError } = await supabase
    .from('slots')
    .update({ status: 'free', client_id: null, format: null })
    .eq('id', booking.slot_id)

  if (slotError) {
    return { success: false, error: 'Ошибка обновления слота' }
  }

  return { success: true, slot, client: clientData }
}

// Save diary entry
async function saveDiaryEntry(clientId: string, text: string) {
  const { error } = await supabase
    .from('diary_entries')
    .insert({
      client_id: clientId,
      text,
    })

  return !error
}

// Get diary entries
async function getDiaryEntries(clientId: string) {
  const { data, error } = await supabase
    .from('diary_entries')
    .select('*')
    .eq('client_id', clientId)
    .order('created_at', { ascending: false })
    .limit(5)

  if (error) {
    console.error('Error fetching diary entries:', error)
    return []
  }

  return data || []
}

// Create SOS request and notify admin
async function createSosRequest(clientId: string, client: { first_name?: string | null; username?: string | null; telegram_id: number }, text?: string) {
  const { error } = await supabase
    .from('sos_requests')
    .insert({
      client_id: clientId,
      text,
      status: 'new',
    })

  if (error) {
    console.error('Error creating SOS request:', error)
    return false
  }

  // Notify admin about SOS
  const name = client.first_name || 'Пользователь'
  const username = client.username ? `@${client.username}` : 'нет username'
  
  const adminMessage = `⚠️ <b>SOS-сигнал</b>

Пользователь нажал кнопку SOS.

🆔 id: ${client.telegram_id}
👤 username: ${username}
📛 Имя: ${name}

Вы можете ответить пользователю напрямую в Telegram.`

  await sendMessage(ADMIN_TELEGRAM_ID, adminMessage)

  return true
}

// Format date for display
function formatDate(dateStr: string) {
  const date = new Date(dateStr)
  const options: Intl.DateTimeFormatOptions = { 
    weekday: 'short', 
    day: 'numeric', 
    month: 'long' 
  }
  return date.toLocaleDateString('ru-RU', options)
}

// Format time for display
function formatTime(timeStr: string) {
  return timeStr.slice(0, 5)
}

// Main menu keyboard for regular users
function getMainMenuKeyboard(telegramId: number) {
  const projectUrl = Deno.env.get('PROJECT_URL') || 'https://your-lovable-project.lovable.app'
  
  const keyboard: Array<Array<{ text: string; callback_data?: string; url?: string }>> = [
    [{ text: '🗓 Записаться на консультацию', callback_data: 'book_session' }],
    [
      { text: '📁 Свободные даты', callback_data: 'free_slots' },
      { text: '🗓 Моя запись', callback_data: 'my_bookings' },
    ],
    [
      { text: '📒 Дневник терапии', callback_data: 'diary' },
      { text: '💳 Оплата', callback_data: 'payment' },
    ],
    [{ text: '👤 Обо мне', callback_data: 'about_me' }],
    [{ text: '🆘 SOS', callback_data: 'sos' }],
  ]

  // Add schedule management button only for admin - direct link to web admin
  if (isAdmin(telegramId)) {
    keyboard.push([{ text: '📋 Управление расписанием', url: projectUrl }])
  }

  return { inline_keyboard: keyboard }
}

// Handle /start command
async function handleStart(chatId: number, telegramId: number) {
  // Set up menu button for this chat
  await setChatMenuButton(chatId)
  await setMyCommands()

  const projectUrl = Deno.env.get('PROJECT_URL') || 'https://your-lovable-project.lovable.app'
  const menuImageUrl = `${projectUrl}/menu-image.jpg`
  
  const text = `Вы в главном меню:`
  await sendPhoto(chatId, menuImageUrl, text, getMainMenuKeyboard(telegramId))
}

// Handle main menu (returning to menu)
async function handleMainMenu(chatId: number, telegramId: number) {
  const projectUrl = Deno.env.get('PROJECT_URL') || 'https://your-lovable-project.lovable.app'
  const menuImageUrl = `${projectUrl}/menu-image.jpg`
  
  const text = `Вы в главном меню:`
  await sendPhoto(chatId, menuImageUrl, text, getMainMenuKeyboard(telegramId))
}

// Handle free slots view
async function handleFreeSlots(chatId: number, telegramId: number) {
  const slots = await getAvailableSlots()

  if (slots.length === 0) {
    await sendMessage(
      chatId,
      '😔 К сожалению, свободных дат нет.\n\nПопробуйте позже.',
      { inline_keyboard: [[{ text: '◀️ Назад', callback_data: 'main_menu' }]] }
    )
    return
  }

  let text = '📁 <b>Свободные даты:</b>\n\n'
  for (const slot of slots) {
    text += `• ${formatDate(slot.date)} в ${formatTime(slot.time)}\n`
  }
  
  text += '\nДля записи нажмите "Записаться на консультацию"'

  await sendMessage(
    chatId,
    text,
    { 
      inline_keyboard: [
        [{ text: '📅 Записаться', callback_data: 'book_session' }],
        [{ text: '◀️ Назад', callback_data: 'main_menu' }]
      ] 
    }
  )
}

// Handle booking flow - step 1: select day
async function handleBookSession(chatId: number, telegramId: number) {
  const dates = await getAvailableDates()

  if (dates.length === 0) {
    await sendMessage(
      chatId,
      '😔 К сожалению, свободных слотов нет.\n\nПопробуйте позже или свяжитесь с психологом напрямую.',
      { inline_keyboard: [[{ text: '◀️ Назад', callback_data: 'main_menu' }]] }
    )
    return
  }

  const keyboard = dates.map((date) => [{
    text: formatDate(date),
    callback_data: `select_date_${date}`,
  }])
  keyboard.push([{ text: '◀️ Назад', callback_data: 'main_menu' }])

  await sendMessage(
    chatId,
    '🗓 <b>Записаться на консультацию</b>\n\nВыберите день:',
    { inline_keyboard: keyboard }
  )
}

// Handle booking flow - step 2: select time for selected date
async function handleSelectTime(chatId: number, date: string) {
  const slots = await getSlotsForDate(date)

  if (slots.length === 0) {
    await sendMessage(
      chatId,
      '😔 К сожалению, на этот день свободных слотов нет.\n\nВыберите другой день.',
      { inline_keyboard: [[{ text: '◀️ Выбрать другой день', callback_data: 'book_session' }]] }
    )
    return
  }

  const keyboard = slots.map((slot) => {
    const formatIcon = slot.available_formats === 'both' ? '🏠💻' : slot.available_formats === 'offline' ? '🏠' : '💻'
    return [{
      text: `${formatTime(slot.time)} ${formatIcon}`,
      callback_data: `select_slot_${slot.id}`,
    }]
  })
  keyboard.push([{ text: '◀️ Выбрать другой день', callback_data: 'book_session' }])

  await sendMessage(
    chatId,
    `🕐 <b>${formatDate(date)}</b>\n\nВыберите время:\n\n🏠 — очно, 💻 — онлайн`,
    { inline_keyboard: keyboard }
  )
}

// Handle format selection - step 3: select format based on available_formats
async function handleSelectFormat(chatId: number, slotId: string) {
  // Fetch slot to get available_formats
  const { data: slot } = await supabase
    .from('slots')
    .select('available_formats')
    .eq('id', slotId)
    .maybeSingle()

  const availableFormats = (slot?.available_formats as string) || 'both'
  
  const buttons = []
  
  if (availableFormats === 'offline' || availableFormats === 'both') {
    buttons.push([{ text: '🏠 Очно', callback_data: `book_offline_${slotId}` }])
  }
  
  if (availableFormats === 'online' || availableFormats === 'both') {
    buttons.push([{ text: '💻 Онлайн', callback_data: `book_online_${slotId}` }])
  }
  
  buttons.push([{ text: '◀️ Назад', callback_data: 'book_session' }])

  await sendMessage(
    chatId,
    '📍 <b>Выберите формат консультации:</b>',
    { inline_keyboard: buttons }
  )
}

// Handle my bookings - only upcoming
async function handleMyBookings(chatId: number, clientId: string, telegramId: number) {
  const bookings = await getClientBookings(clientId)

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
    )
    return
  }

  let text = '🗓 <b>Предстоящие записи:</b>\n\n'
  const keyboard = []

  for (const booking of bookings) {
    const slot = booking.slots
    if (slot) {
      const formatIcon = slot.format === 'online' ? '💻' : '🏠'
      text += `📌 ${formatDate(slot.date)} в ${formatTime(slot.time)} ${formatIcon}\n`
      keyboard.push([{
        text: `❌ Отменить ${formatDate(slot.date)} ${formatTime(slot.time)}`,
        callback_data: `cancel_${booking.id}`,
      }])
    }
  }

  text += '\n<i>Отменить запись можно не позднее чем за 24 часа до начала.</i>'

  keyboard.push([{ text: '◀️ Назад', callback_data: 'main_menu' }])

  await sendMessage(chatId, text, { inline_keyboard: keyboard })
}

// Handle diary with buttons
async function handleDiary(chatId: number, clientId: string, telegramId: number) {
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
  )
}

// Handle view diary entries
async function handleDiaryView(chatId: number, clientId: string, telegramId: number) {
  const entries = await getDiaryEntries(clientId)

  let text = `📖 <b>Ваши записи:</b>\n\n`

  if (entries.length === 0) {
    text = `📖 <b>Ваши записи:</b>\n\nУ вас пока нет записей в дневнике.`
  } else {
    for (const entry of entries) {
      const date = new Date(entry.created_at)
      const dateStr = date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' })
      const preview = entry.text.length > 100 ? entry.text.slice(0, 100) + '...' : entry.text
      text += `📝 <b>${dateStr}:</b>\n${preview}\n\n`
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
  )
}

// Handle add diary entry
async function handleDiaryAdd(chatId: number, clientId: string) {
  await sendMessage(
    chatId,
    `📝 <b>Новая запись</b>\n\nНапишите свои мысли, переживания или то, что вас беспокоит.\n\n<i>Отправьте текст в следующем сообщении.</i>`,
    { inline_keyboard: [[{ text: '◀️ Отмена', callback_data: 'diary' }]] }
  )

  // Set state for waiting diary entry
  await supabase
    .from('bot_settings')
    .upsert({
      key: `state_${chatId}`,
      value: { state: 'waiting_diary' },
    }, { onConflict: 'key' })
}

// Handle payment
async function handlePayment(chatId: number, clientId: string) {
  // Get card number from settings
  const { data: cardSetting } = await supabase
    .from('bot_settings')
    .select('value')
    .eq('key', 'payment_card')
    .maybeSingle()
  
  const cardNumber = (cardSetting?.value as { card_number?: string })?.card_number || '5208130004581850'
  
  // Send card number
  await sendMessage(chatId, `<code>${cardNumber}</code>`)
  
  // Send instructions
  await sendMessage(
    chatId,
    `Это номер карты, его можно удобно скопировать. Пришлите в этот диалог скриншот об оплате`,
    { inline_keyboard: [[{ text: '◀️ Назад', callback_data: 'main_menu' }]] }
  )
  
  // Set state for waiting payment screenshot
  await supabase
    .from('bot_settings')
    .upsert({
      key: `state_${chatId}`,
      value: { state: 'waiting_payment', client_id: clientId },
    }, { onConflict: 'key' })
}

// Handle SOS
async function handleSos(chatId: number, client: { id: string; first_name?: string | null; username?: string | null; telegram_id: number }) {
  await createSosRequest(client.id, client)
  
  await sendMessage(
    chatId,
    `🆘 <b>SOS-связь с психологом.</b>

Я передал ваше обращение!`,
    { inline_keyboard: [[{ text: '◀️ В главное меню', callback_data: 'main_menu' }]] }
  )

  // Set state for waiting SOS description
  await supabase
    .from('bot_settings')
    .upsert({
      key: `state_${chatId}`,
      value: { state: 'waiting_sos', client_id: client.id },
    }, { onConflict: 'key' })
}

// Handle about me
async function handleAboutMe(chatId: number, telegramId: number) {
  try {
    const { data: textSetting } = await supabase
      .from('bot_settings')
      .select('value')
      .eq('key', 'about_me_text')
      .maybeSingle()
    
    const { data: photoSetting } = await supabase
      .from('bot_settings')
      .select('value')
      .eq('key', 'about_me_photo')
      .maybeSingle()
    
    const text = (textSetting?.value as { value?: string })?.value || ''
    const photoUrl = (photoSetting?.value as { photo_url?: string })?.photo_url || null

    if (!text && !photoUrl) {
      await sendMessage(
        chatId,
        'ℹ️ Информация "Обо мне" пока не заполнена.',
        { inline_keyboard: [[{ text: '◀️ Назад', callback_data: 'main_menu' }]] }
      )
      return
    }

    // Send photo with caption if both exist
    if (photoUrl && text) {
      await sendPhoto(
        chatId,
        photoUrl,
        text,
        { inline_keyboard: [[{ text: '◀️ Назад', callback_data: 'main_menu' }]] }
      )
    } else if (photoUrl) {
      // Only photo
      await sendPhoto(
        chatId,
        photoUrl,
        '',
        { inline_keyboard: [[{ text: '◀️ Назад', callback_data: 'main_menu' }]] }
      )
    } else {
      // Only text
      await sendMessage(
        chatId,
        `👤 <b>Обо мне</b>\n\n${text}`,
        { inline_keyboard: [[{ text: '◀️ Назад', callback_data: 'main_menu' }]] }
      )
    }
  } catch (error) {
    console.error('Error in handleAboutMe:', error)
    await sendMessage(
      chatId,
      '❌ Произошла ошибка при загрузке информации.',
      { inline_keyboard: [[{ text: '◀️ Назад', callback_data: 'main_menu' }]] }
    )
  }
}

// Get current state
async function getState(chatId: number) {
  const { data } = await supabase
    .from('bot_settings')
    .select('value')
    .eq('key', `state_${chatId}`)
    .maybeSingle()

  return data?.value as { state: string; client_id?: string } | null
}

// Clear state
async function clearState(chatId: number) {
  await supabase
    .from('bot_settings')
    .delete()
    .eq('key', `state_${chatId}`)
}

// Get file URL from Telegram
async function getFileUrl(fileId: string): Promise<string | null> {
  const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getFile`
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ file_id: fileId }),
  })
  
  const result = await response.json()
  if (result.ok && result.result?.file_path) {
    return `https://api.telegram.org/file/bot${TELEGRAM_BOT_TOKEN}/${result.result.file_path}`
  }
  return null
}

// Save payment screenshot
async function savePaymentScreenshot(clientId: string, fileUrl: string): Promise<boolean> {
  try {
    // Download file from Telegram
    const response = await fetch(fileUrl)
    const blob = await response.blob()
    
    // Generate unique filename
    const filename = `${clientId}/${Date.now()}.jpg`
    
    // Upload to Supabase Storage
    const { error: uploadError } = await supabase.storage
      .from('payments')
      .upload(filename, blob, { contentType: 'image/jpeg' })
    
    if (uploadError) {
      console.error('Error uploading file:', uploadError)
      return false
    }
    
    // Get public URL
    const { data: urlData } = supabase.storage
      .from('payments')
      .getPublicUrl(filename)
    
    // Save to payments table
    const { error: dbError } = await supabase
      .from('payments')
      .insert({
        client_id: clientId,
        screenshot_url: urlData.publicUrl,
      })
    
    if (dbError) {
      console.error('Error saving payment record:', dbError)
      return false
    }
    
    return true
  } catch (error) {
    console.error('Error processing payment screenshot:', error)
    return false
  }
}

// Handle text messages
async function handleTextMessage(message: TelegramMessage, client: { id: string; first_name?: string | null; username?: string | null; telegram_id: number }) {
  const chatId = message.chat.id
  const text = message.text || ''
  const telegramId = message.from.id

  // Check for commands
  if (text === '/start' || text === '/menu' || text === '📋 Главное меню') {
    await clearState(chatId)
    await handleStart(chatId, telegramId)
    return
  }

  // Check current state
  const state = await getState(chatId)

  // Handle payment screenshot
  if (state?.state === 'waiting_payment' && message.photo && message.photo.length > 0) {
    // Get the largest photo
    const photo = message.photo[message.photo.length - 1]
    const fileUrl = await getFileUrl(photo.file_id)
    
    if (fileUrl) {
      const success = await savePaymentScreenshot(client.id, fileUrl)
      
      if (success) {
        await clearState(chatId)
        await sendMessage(
          chatId,
          '✅ Скриншот оплаты получен. Спасибо!',
          getMainMenuKeyboard(telegramId)
        )
        
        // Notify admin
        const name = client.first_name || 'Пользователь'
        const username = client.username ? `@${client.username}` : ''
        await sendMessage(
          ADMIN_TELEGRAM_ID,
          `💳 <b>Новый скриншот оплаты</b>\n\nОт: ${name} ${username}\n🆔 id: ${client.telegram_id}`
        )
        return
      }
    }
    
    await sendMessage(
      chatId,
      '❌ Ошибка сохранения скриншота. Попробуйте ещё раз.',
      { inline_keyboard: [[{ text: '◀️ Назад', callback_data: 'main_menu' }]] }
    )
    return
  }

  if (state?.state === 'waiting_diary') {
    await saveDiaryEntry(client.id, text)
    await clearState(chatId)
    await sendMessage(
      chatId,
      '✅ Запись сохранена в дневник.\n\nСпасибо, что делитесь своими мыслями.',
      { 
        inline_keyboard: [
          [{ text: '📖 Посмотреть записи', callback_data: 'diary_view' }],
          [{ text: '◀️ В главное меню', callback_data: 'main_menu' }]
        ] 
      }
    )
    return
  }

  if (state?.state === 'waiting_sos') {
    // Update the last SOS request with text
    await supabase
      .from('sos_requests')
      .update({ text })
      .eq('client_id', client.id)
      .eq('status', 'new')
      .order('created_at', { ascending: false })
      .limit(1)

    await clearState(chatId)
    
    // Notify admin about the additional message
    const name = client.first_name || 'Пользователь'
    const username = client.username ? `@${client.username}` : 'нет username'
    
    const adminMessage = `📝 <b>Дополнение к SOS</b>

От: ${name} (${username})
🆔 id: ${client.telegram_id}

Сообщение:
${text}`

    await sendMessage(ADMIN_TELEGRAM_ID, adminMessage)
    
    await sendMessage(
      chatId,
      '✅ Сообщение отправлено психологу.',
      getMainMenuKeyboard(telegramId)
    )
    return
  }

  // Default response
  await sendMessage(
    chatId,
    'Используйте меню для навигации:',
    getMainMenuKeyboard(telegramId)
  )
}

// Handle callback queries
async function handleCallbackQuery(callbackQuery: TelegramCallbackQuery, client: { id: string; first_name?: string | null; username?: string | null; telegram_id: number }) {
  const chatId = callbackQuery.message?.chat.id
  const data = callbackQuery.data
  const telegramId = callbackQuery.from.id

  if (!chatId || !data) {
    await answerCallbackQuery(callbackQuery.id)
    return
  }

  await clearState(chatId)
  await answerCallbackQuery(callbackQuery.id)

  if (data === 'main_menu') {
    await handleMainMenu(chatId, telegramId)
    return
  }

  if (data === 'free_slots') {
    await handleFreeSlots(chatId, telegramId)
    return
  }

  if (data === 'book_session') {
    await handleBookSession(chatId, telegramId)
    return
  }

  if (data === 'my_bookings') {
    await handleMyBookings(chatId, client.id, telegramId)
    return
  }

  if (data === 'diary') {
    await handleDiary(chatId, client.id, telegramId)
    return
  }

  if (data === 'diary_add') {
    await handleDiaryAdd(chatId, client.id)
    return
  }

  if (data === 'diary_view') {
    await handleDiaryView(chatId, client.id, telegramId)
    return
  }

  if (data === 'payment') {
    await handlePayment(chatId, client.id)
    return
  }

  if (data === 'about_me') {
    await handleAboutMe(chatId, telegramId)
    return
  }

  if (data === 'sos') {
    await handleSos(chatId, client)
    return
  }

  // Handle date selection - show times for that date
  if (data.startsWith('select_date_')) {
    const selectedDate = data.replace('select_date_', '')
    await handleSelectTime(chatId, selectedDate)
    return
  }

  // Handle slot selection - show format options
  if (data.startsWith('select_slot_')) {
    const slotId = data.replace('select_slot_', '')
    await handleSelectFormat(chatId, slotId)
    return
  }

  // Handle booking with format
  if (data.startsWith('book_offline_') || data.startsWith('book_online_')) {
    const isOnline = data.startsWith('book_online_')
    const slotId = data.replace('book_offline_', '').replace('book_online_', '')
    const format = isOnline ? 'online' : 'offline'
    
    const success = await bookSlot(client.id, slotId, format)

    if (success) {
      const formatText = isOnline ? '💻 онлайн' : '🏠 очно'
      await sendMessage(
        chatId,
        `✅ <b>Вы успешно записались!</b>\n\nФормат: ${formatText}\n\nНапоминания придут за 24 часа и за 1 час до сессии.`,
        getMainMenuKeyboard(telegramId)
      )
    } else {
      await sendMessage(
        chatId,
        '😔 К сожалению, это время уже занято.\n\nПожалуйста, выберите другой слот.',
        { inline_keyboard: [[{ text: '📅 Выбрать другое время', callback_data: 'book_session' }]] }
      )
    }
    return
  }

  if (data.startsWith('cancel_')) {
    const bookingId = data.replace('cancel_', '')
    const result = await cancelBooking(bookingId, false) // false = client cancellation

    if (result.success) {
      await sendMessage(
        chatId,
        '✅ Запись отменена.',
        getMainMenuKeyboard(telegramId)
      )
      
      // Notify admin about client cancellation
      if (result.slot) {
        const name = client.first_name || 'Клиент'
        const username = client.username ? `@${client.username}` : ''
        await sendMessage(
          ADMIN_TELEGRAM_ID,
          `❌ <b>Клиент отменил запись</b>\n\nКлиент: ${name} ${username}\n🆔 id: ${client.telegram_id}\n\n📆 ${formatDate(result.slot.date)} в ${formatTime(result.slot.time)}`
        )
      }
    } else {
      await sendMessage(
        chatId,
        `❌ ${result.error || 'Не удалось отменить запись. Попробуйте позже.'}`,
        getMainMenuKeyboard(telegramId)
      )
    }
    return
  }
}

// Main handler
Deno.serve(async (req) => {
  console.log('Received request:', req.method)

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const update: TelegramUpdate = await req.json()
    console.log('Telegram update:', JSON.stringify(update, null, 2))

    if (update.message) {
      const client = await getOrCreateClient(update.message.from)
      await handleTextMessage(update.message, client)
    }

    if (update.callback_query) {
      const client = await getOrCreateClient(update.callback_query.from)
      await handleCallbackQuery(update.callback_query, client)
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('Error processing update:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})