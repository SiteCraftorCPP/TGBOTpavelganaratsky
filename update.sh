#!/bin/bash

# Quick update script (run from project directory)
# Usage: ./update.sh

set -e

echo "🔄 Updating application..."

# Get the directory where the script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

# Pull latest changes
echo "📥 Pulling latest changes..."
git pull origin main || git pull origin master

# Install dependencies
echo "📦 Installing dependencies..."
npm ci

# Build application
echo "🔨 Building application..."
npm run build

# Check if build was successful
if [ ! -d "dist" ]; then
    echo "❌ Build failed: dist directory not found"
    exit 1
fi

# Reload nginx (requires sudo)
echo "🔄 Reloading nginx..."
sudo systemctl reload nginx || echo "⚠️  Could not reload nginx automatically. Run: sudo systemctl reload nginx"

echo "✅ Update completed successfully!"

