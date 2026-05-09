import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.89.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const TELEGRAM_BOT_TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN')!
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

// Send message to Telegram
async function sendMessage(chatId: number, text: string) {
  const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`
  const body = {
    chat_id: chatId,
    text,
    parse_mode: 'HTML',
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

/** Слот в БД хранится как дата + время календаря Москвы (UTC+3 без DST). */
function slotStartUtcMs(dateStr: string, timeStr: string): number {
  const [y, mo, d] = dateStr.split('-').map(Number)
  const parts = timeStr.trim().split(':')
  const hh = Number(parts[0])
  const mm = Number(parts[1] ?? 0)
  const ss = Number(parts[2] ?? 0)
  const MSC_OFFSET_MS = 3 * 60 * 60 * 1000
  return Date.UTC(y, mo - 1, d, hh, mm, ss) - MSC_OFFSET_MS
}

/** Окно вокруг «ровно через N секунд»: cron раз в минуту + записи не ровно на час. */
const REMINDER_TOLERANCE_SEC = 20 * 60 // ±20 мин

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    console.log('Starting reminder check...')

    const nowMs = Date.now()
    const SEC_1H = 60 * 60
    const SEC_24H = 24 * SEC_1H
    const logMoscow = new Date(nowMs).toLocaleString('ru-RU', { timeZone: 'Europe/Moscow' })
    console.log(`Now (Moscow wall): ${logMoscow}`)

    const in1hBand = (remainingSec: number) =>
      remainingSec > 0 &&
      remainingSec >= SEC_1H - REMINDER_TOLERANCE_SEC &&
      remainingSec <= SEC_1H + REMINDER_TOLERANCE_SEC

    const in24hBand = (remainingSec: number) =>
      remainingSec > 0 &&
      remainingSec >= SEC_24H - REMINDER_TOLERANCE_SEC &&
      remainingSec <= SEC_24H + REMINDER_TOLERANCE_SEC
    
    // Find bookings that need 1-hour reminder
    const { data: bookings, error: bookingsError } = await supabase
      .from('bookings')
      .select(`
        id,
        reminder_1h_sent,
        reminder_24h_sent,
        client_id,
        clients (
          telegram_id,
          first_name
        ),
        slots (
          date,
          time
        )
      `)
      .eq('status', 'active')

    if (bookingsError) {
      console.error('Error fetching bookings:', bookingsError)
      throw bookingsError
    }

    console.log(`Found ${bookings?.length || 0} active bookings`)

    let sentCount1h = 0
    let sentCount24h = 0
    
    for (const booking of bookings || []) {
      const slotData = booking.slots as unknown
      const clientData = booking.clients as unknown
      const slot = slotData as { date: string; time: string } | null
      const client = clientData as { telegram_id: number; first_name: string | null } | null
      
      if (!slot || !client) {
        console.log(`Skipping booking ${booking.id}: missing slot or client data`)
        continue
      }

      const remainingSec = (slotStartUtcMs(slot.date, slot.time) - nowMs) / 1000

      // Check for 24h reminder (по остатку времени до слота, не по строкам даты/времени)
      if (!booking.reminder_24h_sent && in24hBand(remainingSec)) {
        console.log(`Sending 24h reminder for booking ${booking.id} to client ${client.telegram_id} (remaining ~${Math.round(remainingSec / 60)} min)`)

        const name = client.first_name || 'Уважаемый клиент'
        const message24h = `⏰ <b>Напоминание</b>

${name}, завтра у вас консультация!

📅 ${formatDate(slot.date)} в ${formatTime(slot.time)}

До встречи! 🙌`

        const result = await sendMessage(client.telegram_id, message24h)

        if (result.ok) {
          const { error: updateError } = await supabase
            .from('bookings')
            .update({ reminder_24h_sent: true })
            .eq('id', booking.id)

          if (updateError) {
            console.error(`Error updating 24h reminder for booking ${booking.id}:`, updateError)
          } else {
            sentCount24h++
            console.log(`24h reminder sent and marked for booking ${booking.id}`)
          }
        } else {
          console.error(`Failed to send 24h message for booking ${booking.id}:`, result)
        }
      }
      
      // Check for 1h reminder
      if (!booking.reminder_1h_sent && in1hBand(remainingSec)) {
        console.log(`Sending 1h reminder for booking ${booking.id} to client ${client.telegram_id} (remaining ~${Math.round(remainingSec / 60)} min)`)

        const name = client.first_name || 'Уважаемый клиент'
        const message1h = `⏰ <b>Напоминание</b>

${name}, через 1 час у вас консультация!

📅 ${formatDate(slot.date)} в ${formatTime(slot.time)}

До встречи! 🙌`

        const result = await sendMessage(client.telegram_id, message1h)

        if (result.ok) {
          const { error: updateError } = await supabase
            .from('bookings')
            .update({ reminder_1h_sent: true })
            .eq('id', booking.id)

          if (updateError) {
            console.error(`Error updating booking ${booking.id}:`, updateError)
          } else {
            sentCount1h++
            console.log(`1h reminder sent and marked for booking ${booking.id}`)
          }
        } else {
          console.error(`Failed to send 1h message for booking ${booking.id}:`, result)
        }
      }
    }

    console.log(`Reminder check complete. Sent ${sentCount24h} 24h reminders and ${sentCount1h} 1h reminders.`)

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Sent ${sentCount24h} 24h reminders and ${sentCount1h} 1h reminders`,
        checked: bookings?.length || 0
      }),
      { 
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error('Error in send-reminders:', error)
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})
