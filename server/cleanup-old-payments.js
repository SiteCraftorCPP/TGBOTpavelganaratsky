// Cleanup old payment screenshots (local storage version)
const { getPayments, deletePayment } = require('./db');
const { deletePaymentFile } = require('./storage');

async function cleanupOldPayments() {
  try {
    // Calculate date 7 days ago
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);

    console.log(`Cleaning up payments older than ${weekAgo.toISOString()}`);

    // Get all payments
    const payments = await getPayments();
    const oldPayments = payments.filter(p => new Date(p.created_at) < weekAgo);

    if (oldPayments.length === 0) {
      console.log('No old payments to delete');
      return;
    }

    console.log(`Found ${oldPayments.length} old payments to delete`);

    // Delete from storage and database
    for (const payment of oldPayments) {
      try {
        await deletePaymentFile(payment.screenshot_url);
        await deletePayment(payment.id);
        console.log(`Deleted payment: ${payment.id}`);
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
cleanupOldPayments().then(() => process.exit(0)).catch(err => {
  console.error(err);
  process.exit(1);
});
