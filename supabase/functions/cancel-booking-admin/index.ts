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
    const { slotId } = await req.json()
    
    if (!slotId) {
      return new Response(
        JSON.stringify({ error: 'slotId is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('Canceling booking for slot:', slotId)

    // Get slot with client info
    const { data: slot, error: slotError } = await supabase
      .from('slots')
      .select(`
        *,
        clients (
          telegram_id,
          first_name
        )
      `)
      .eq('id', slotId)
      .maybeSingle()

    if (slotError) {
      console.error('Error fetching slot:', slotError)
      throw slotError
    }

    if (!slot) {
      return new Response(
        JSON.stringify({ error: 'Slot not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const client = slot.clients as { telegram_id: number; first_name: string | null } | null

    // Cancel the booking
    const { error: bookingError } = await supabase
      .from('bookings')
      .update({ status: 'canceled' })
      .eq('slot_id', slotId)
      .eq('status', 'active')

    if (bookingError) {
      console.error('Error canceling booking:', bookingError)
    }

    // Free the slot
    const { error: updateError } = await supabase
      .from('slots')
      .update({ status: 'free', client_id: null, format: null })
      .eq('id', slotId)

    if (updateError) {
      console.error('Error updating slot:', updateError)
      throw updateError
    }

    // Send notification to client
    if (client?.telegram_id) {
      const name = client.first_name || 'Уважаемый клиент'
      const message = `❌ <b>Запись отменена</b>

${name}, к сожалению, ваша консультация на ${formatDate(slot.date)} в ${formatTime(slot.time)} была отменена.

Пожалуйста, выберите другое удобное время для записи.`

      await sendMessage(client.telegram_id, message)
      console.log('Notification sent to client:', client.telegram_id)
    }

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error('Error in cancel-booking-admin:', error)
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
