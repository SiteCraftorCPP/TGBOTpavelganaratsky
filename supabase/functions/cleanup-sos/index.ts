import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    
    // Calculate date 7 days ago
    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
    
    console.log(`Deleting SOS requests older than: ${sevenDaysAgo.toISOString()}`)
    
    // Delete SOS requests older than 7 days
    const { data, error, count } = await supabase
      .from('sos_requests')
      .delete()
      .lt('created_at', sevenDaysAgo.toISOString())
      .select()
    
    if (error) {
      console.error('Error deleting old SOS requests:', error)
      throw error
    }
    
    const deletedCount = data?.length || 0
    console.log(`Successfully deleted ${deletedCount} old SOS requests`)
    
    return new Response(
      JSON.stringify({ 
        success: true, 
        deleted: deletedCount,
        message: `Deleted ${deletedCount} SOS requests older than 7 days` 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    )
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error'
    console.error('Cleanup error:', err)
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    )
  }
})
