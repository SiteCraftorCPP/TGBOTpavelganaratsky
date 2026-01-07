#!/bin/bash

# Deployment script for LIFTme-Bot on VPS
# Usage: ./deploy.sh

set -e  # Exit on error

echo "🚀 Starting deployment..."

# Configuration
APP_NAME="liftme-bot"
DEPLOY_DIR="/var/www/${APP_NAME}"
REPO_URL="https://github.com/your-username/your-repo.git"  # Замените на ваш репозиторий
BRANCH="main"
NGINX_CONFIG="/etc/nginx/sites-available/${APP_NAME}"
NGINX_ENABLED="/etc/nginx/sites-enabled/${APP_NAME}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if running as root
if [ "$EUID" -ne 0 ]; then 
    echo -e "${RED}Please run as root or with sudo${NC}"
    exit 1
fi

# Create deployment directory if it doesn't exist
if [ ! -d "$DEPLOY_DIR" ]; then
    echo -e "${YELLOW}Creating deployment directory...${NC}"
    mkdir -p "$DEPLOY_DIR"
fi

# Clone or update repository
if [ -d "$DEPLOY_DIR/.git" ]; then
    echo -e "${YELLOW}Updating repository...${NC}"
    cd "$DEPLOY_DIR"
    git fetch origin
    git reset --hard "origin/${BRANCH}"
    git clean -fd
else
    echo -e "${YELLOW}Cloning repository...${NC}"
    git clone -b "$BRANCH" "$REPO_URL" "$DEPLOY_DIR"
    cd "$DEPLOY_DIR"
fi

# Check if .env exists
if [ ! -f "$DEPLOY_DIR/.env" ]; then
    echo -e "${YELLOW}Creating .env from env.example...${NC}"
    if [ -f "$DEPLOY_DIR/env.example" ]; then
        cp "$DEPLOY_DIR/env.example" "$DEPLOY_DIR/.env"
        echo -e "${RED}⚠️  Please edit .env file with your configuration!${NC}"
        echo "Run: nano $DEPLOY_DIR/.env"
        exit 1
    elif [ -f "$DEPLOY_DIR/.env.example" ]; then
        cp "$DEPLOY_DIR/.env.example" "$DEPLOY_DIR/.env"
        echo -e "${RED}⚠️  Please edit .env file with your configuration!${NC}"
        echo "Run: nano $DEPLOY_DIR/.env"
        exit 1
    else
        echo -e "${RED}Error: env.example or .env.example not found${NC}"
        exit 1
    fi
fi

# Install dependencies
echo -e "${YELLOW}Installing dependencies...${NC}"
cd "$DEPLOY_DIR"
npm ci --production=false

# Build application
echo -e "${YELLOW}Building application...${NC}"
npm run build

# Check if build was successful
if [ ! -d "$DEPLOY_DIR/dist" ]; then
    echo -e "${RED}Build failed: dist directory not found${NC}"
    exit 1
fi

# Set proper permissions
echo -e "${YELLOW}Setting permissions...${NC}"
chown -R www-data:www-data "$DEPLOY_DIR/dist"
chmod -R 755 "$DEPLOY_DIR/dist"

# Setup nginx configuration
if [ ! -f "$NGINX_CONFIG" ]; then
    echo -e "${YELLOW}Creating nginx configuration...${NC}"
    # Copy nginx.conf to sites-available (you'll need to edit it first)
    if [ -f "$DEPLOY_DIR/nginx.conf" ]; then
        cp "$DEPLOY_DIR/nginx.conf" "$NGINX_CONFIG"
        # Replace placeholder domain
        read -p "Enter your domain name: " DOMAIN
        sed -i "s/your-domain.com/$DOMAIN/g" "$NGINX_CONFIG"
        echo -e "${YELLOW}⚠️  Please edit nginx config to match your SSL certificate paths:${NC}"
        echo "nano $NGINX_CONFIG"
    fi
fi

# Enable nginx site
if [ ! -L "$NGINX_ENABLED" ]; then
    echo -e "${YELLOW}Enabling nginx site...${NC}"
    ln -s "$NGINX_CONFIG" "$NGINX_ENABLED"
fi

# Test nginx configuration
echo -e "${YELLOW}Testing nginx configuration...${NC}"
if nginx -t; then
    echo -e "${GREEN}Nginx configuration is valid${NC}"
    systemctl reload nginx
else
    echo -e "${RED}Nginx configuration test failed${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Deployment completed successfully!${NC}"
echo -e "${YELLOW}Your application should be available at: https://your-domain.com${NC}"

