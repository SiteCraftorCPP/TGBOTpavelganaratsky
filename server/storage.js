// Local file storage module (replacing Supabase Storage)
const fs = require('fs').promises;
const path = require('path');
const { createPayment } = require('./db');

const STORAGE_DIR = process.env.STORAGE_DIR || path.join(__dirname, 'storage');
const PAYMENTS_DIR = path.join(STORAGE_DIR, 'payments');
const PUBLIC_URL = process.env.PUBLIC_URL || 'https://liftme.by';

// Initialize storage directories
async function initStorage() {
  try {
    await fs.mkdir(STORAGE_DIR, { recursive: true });
    await fs.mkdir(PAYMENTS_DIR, { recursive: true });
    console.log('✓ Storage directories initialized');
  } catch (error) {
    console.error('Error initializing storage:', error);
  }
}

// Save payment screenshot
async function savePaymentScreenshot(clientId, fileUrl) {
  try {
    // Download file from Telegram
    const response = await fetch(fileUrl);
    if (!response.ok) {
      console.error('Failed to download file from Telegram:', response.status);
      return false;
    }
    
    const buffer = Buffer.from(await response.arrayBuffer());
    
    // Create client directory
    const clientDir = path.join(PAYMENTS_DIR, clientId);
    await fs.mkdir(clientDir, { recursive: true });
    
    // Generate filename
    const filename = `${Date.now()}.jpg`;
    const filePath = path.join(clientDir, filename);
    
    // Save file
    await fs.writeFile(filePath, buffer);
    
    // Generate public URL
    const publicUrl = `${PUBLIC_URL}/storage/payments/${clientId}/${filename}`;
    
    // Save to database
    await createPayment(clientId, publicUrl);
    
    console.log('Payment screenshot saved:', publicUrl);
    return true;
  } catch (error) {
    console.error('Error saving payment screenshot:', error);
    return false;
  }
}

// Delete payment file
async function deletePaymentScreenshot(screenshotUrl) {
  try {
    // Extract path from URL (format: https://liftme.by/storage/payments/clientId/filename.jpg)
    const urlParts = screenshotUrl.split('/storage/payments/');
    if (urlParts.length > 1) {
      const relativePath = urlParts[1];
      const filePath = path.join(STORAGE_DIR, 'payments', relativePath);
      await fs.unlink(filePath);
      console.log('Deleted file:', filePath);
    }
  } catch (error) {
    // File might not exist, ignore error
    console.log('File not found or already deleted:', screenshotUrl);
  }
}

// Cleanup old payments (older than 7 days)
async function cleanupOldPayments() {
  try {
    const { getPayments, deletePayment } = require('./db');
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    
    const payments = await getPayments();
    const oldPayments = payments.filter(p => new Date(p.created_at) < weekAgo);
    
    for (const payment of oldPayments) {
      await deletePaymentScreenshot(payment.screenshot_url);
      await deletePayment(payment.id);
      console.log('Deleted old payment:', payment.id);
    }
    
    console.log(`Cleaned up ${oldPayments.length} old payments`);
  } catch (error) {
    console.error('Error cleaning up old payments:', error);
  }
}

module.exports = {
  initStorage,
  savePaymentScreenshot,
  deletePaymentScreenshot,
  deletePaymentFile: deletePaymentScreenshot, // Alias for backward compatibility
  cleanupOldPayments,
  STORAGE_DIR,
  PAYMENTS_DIR,
};
