import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.89.0'
import {
  formatSlotCalendarDateRu,
  in1hReminderBand,
  in24hReminderBand,
  normalizeSlotTimeString,
  REMINDER_TOLERANCE_SEC,
  remainingUntilSlotSec,
} from './reminder-logic.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const TELEGRAM_BOT_TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN')!
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

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

function formatTime(timeStr: string) {
  return normalizeSlotTimeString(timeStr).slice(0, 5)
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    console.log('Starting reminder check...')

    const nowMs = Date.now()
    const logMoscow = new Date(nowMs).toLocaleString('ru-RU', { timeZone: 'Europe/Moscow' })
    console.log(`Now (Moscow wall): ${logMoscow}, tolerance ±${REMINDER_TOLERANCE_SEC / 60} min`)

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

      const remainingSec = remainingUntilSlotSec(slot.date, slot.time, nowMs)
      if (!Number.isFinite(remainingSec)) {
        console.log(`Skipping booking ${booking.id}: bad slot datetime`)
        continue
      }

      if (!booking.reminder_24h_sent && in24hReminderBand(remainingSec)) {
        console.log(
          `Sending 24h reminder for booking ${booking.id} to client ${client.telegram_id} (remaining ~${Math.round(
            remainingSec / 60,
          )} min)`,
        )

        const name = client.first_name || 'Уважаемый клиент'
        const message24h = `⏰ <b>Напоминание</b>

${name}, завтра у вас консультация!

📅 ${formatSlotCalendarDateRu(slot.date)} в ${formatTime(slot.time)}

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

      if (!booking.reminder_1h_sent && in1hReminderBand(remainingSec)) {
        console.log(
          `Sending 1h reminder for booking ${booking.id} to client ${client.telegram_id} (remaining ~${Math.round(
            remainingSec / 60,
          )} min)`,
        )

        const name = client.first_name || 'Уважаемый клиент'
        const message1h = `⏰ <b>Напоминание</b>

${name}, через 1 час у вас консультация!

📅 ${formatSlotCalendarDateRu(slot.date)} в ${formatTime(slot.time)}

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
        checked: bookings?.length || 0,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    )
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error('Error in send-reminders:', error)
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    )
  }
})
