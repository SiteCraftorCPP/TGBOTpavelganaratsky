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
async function sendMessage(chatId: number, text: string, replyMarkup?: object) {
  const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`
  const body: Record<string, unknown> = {
    chat_id: chatId,
    text,
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
  
  return response.json()
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
    const { clientId, date, time, format = 'offline' } = await req.json()

    if (!clientId || !date || !time) {
      return new Response(
        JSON.stringify({ error: 'clientId, date, and time are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Check if date is in the past (only for past dates, not today)
    // Admin can book for any time today or in the future
    const today = new Date().toISOString().split('T')[0]
    const bookingDate = typeof date === 'string' ? date.split('T')[0] : String(date)
    
    if (bookingDate < today) {
      return new Response(
        JSON.stringify({ error: 'Нельзя записаться на дату из прошлого' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    // No time check for today - admin can book for any time today

    // Get client info
    const { data: client, error: clientError } = await supabase
      .from('clients')
      .select('*')
      .eq('id', clientId)
      .single()

    if (clientError || !client) {
      return new Response(
        JSON.stringify({ error: 'Client not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Check if slot exists for this date and time
    const { data: existingSlot } = await supabase
      .from('slots')
      .select('*')
      .eq('date', date)
      .eq('time', time)
      .maybeSingle()

    let slotId: string

    if (existingSlot) {
      // Check if slot is free
      if (existingSlot.status !== 'free') {
        return new Response(
          JSON.stringify({ error: 'Slot is already booked' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
      slotId = existingSlot.id
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
        .single()

      if (slotError || !newSlot) {
        return new Response(
          JSON.stringify({ error: 'Failed to create slot' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
      slotId = newSlot.id
    }

    // Book the slot
    const { error: updateError } = await supabase
      .from('slots')
      .update({ status: 'booked', client_id: clientId, format })
      .eq('id', slotId)

    if (updateError) {
      return new Response(
        JSON.stringify({ error: 'Failed to book slot' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Create booking record
    const { error: bookingError } = await supabase
      .from('bookings')
      .insert({
        client_id: clientId,
        slot_id: slotId,
        status: 'active',
      })

    if (bookingError) {
      return new Response(
        JSON.stringify({ error: 'Failed to create booking' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Send notification to client
    const formatText = format === 'online' ? '💻 онлайн' : '🏠 очно'
    const clientMessage = `📅 <b>Вам назначена консультация!</b>

📆 ${formatDate(date)} в ${formatTime(time)}
${formatText}

Напоминания придут за 24 часа и за 1 час до сессии.`

    await sendMessage(client.telegram_id, clientMessage)

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
