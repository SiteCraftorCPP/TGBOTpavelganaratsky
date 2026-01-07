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

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    console.log('Starting reminder check...')
    
    // Get current time in Moscow timezone (UTC+3)
    const now = new Date()
    const moscowOffset = 3 * 60 * 60 * 1000 // 3 hours in milliseconds
    const moscowNow = new Date(now.getTime() + moscowOffset)
    
    const currentDate = moscowNow.toISOString().split('T')[0]
    const currentHour = moscowNow.getUTCHours()
    const currentMinute = moscowNow.getUTCMinutes()
    
    console.log(`Current Moscow time: ${currentDate} ${currentHour}:${currentMinute}`)
    
    // Calculate target time range (1 hour from now, with 10 min buffer)
    const targetTime = new Date(moscowNow.getTime() + 60 * 60 * 1000) // +1 hour
    const targetHour = targetTime.getUTCHours()
    const targetMinute = targetTime.getUTCMinutes()
    
    // Format time for comparison (HH:MM:SS)
    const timeFrom = `${String(targetHour).padStart(2, '0')}:${String(Math.max(0, targetMinute - 5)).padStart(2, '0')}:00`
    const timeTo = `${String(targetHour).padStart(2, '0')}:${String(Math.min(59, targetMinute + 5)).padStart(2, '0')}:00`
    
    console.log(`Looking for slots between ${timeFrom} and ${timeTo} on ${currentDate}`)
    
    // Calculate target date for 24h reminder (tomorrow)
    const tomorrow = new Date(moscowNow.getTime() + 24 * 60 * 60 * 1000)
    const tomorrowDate = tomorrow.toISOString().split('T')[0]
    
    console.log(`Looking for 24h reminders for date ${tomorrowDate}`)
    
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
      
      // Check for 24h reminder
      if (!booking.reminder_24h_sent && slot.date === tomorrowDate) {
        // Check if same time window (±5 minutes)
        if (slot.time >= timeFrom && slot.time <= timeTo) {
          console.log(`Sending 24h reminder for booking ${booking.id} to client ${client.telegram_id}`)
          
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
      }
      
      // Check for 1h reminder
      if (!booking.reminder_1h_sent && slot.date === currentDate) {
        if (slot.time >= timeFrom && slot.time <= timeTo) {
          console.log(`Sending 1h reminder for booking ${booking.id} to client ${client.telegram_id}`)
          
          // Send reminder
          const name = client.first_name || 'Уважаемый клиент'
          const message1h = `⏰ <b>Напоминание</b>

${name}, через 1 час у вас консультация!

📅 ${formatDate(slot.date)} в ${formatTime(slot.time)}

До встречи! 🙌`

          const result = await sendMessage(client.telegram_id, message1h)
          
          if (result.ok) {
            // Mark reminder as sent
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
