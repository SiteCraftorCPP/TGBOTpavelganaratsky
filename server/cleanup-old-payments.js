const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function cleanupOldPayments() {
  try {
    // Calculate date 7 days ago
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    const weekAgoISO = weekAgo.toISOString();

    console.log(`Cleaning up payments older than ${weekAgoISO}`);

    // Get old payments
    const { data: oldPayments, error: fetchError } = await supabase
      .from('payments')
      .select('id, screenshot_url')
      .lt('created_at', weekAgoISO);

    if (fetchError) {
      console.error('Error fetching old payments:', fetchError);
      return;
    }

    if (!oldPayments || oldPayments.length === 0) {
      console.log('No old payments to delete');
      return;
    }

    console.log(`Found ${oldPayments.length} old payments to delete`);

    // Delete from storage and database
    for (const payment of oldPayments) {
      try {
        // Extract file path from URL
        const urlParts = payment.screenshot_url.split('/payments/');
        if (urlParts.length > 1) {
          const filePath = urlParts[1].split('?')[0];
          
          // Delete from storage
          const { error: storageError } = await supabase.storage
            .from('payments')
            .remove([filePath]);

          if (storageError) {
            console.error(`Error deleting file ${filePath}:`, storageError);
          } else {
            console.log(`Deleted file: ${filePath}`);
          }
        }

        // Delete from database
        const { error: dbError } = await supabase
          .from('payments')
          .delete()
          .eq('id', payment.id);

        if (dbError) {
          console.error(`Error deleting payment record ${payment.id}:`, dbError);
        } else {
          console.log(`Deleted payment record: ${payment.id}`);
        }
      } catch (error) {
        console.error(`Error processing payment ${payment.id}:`, error);
      }
    }

    console.log('Cleanup completed');
  } catch (error) {
    console.error('Error in cleanup:', error);
  }
}

// Run cleanup
cleanupOldPayments();
