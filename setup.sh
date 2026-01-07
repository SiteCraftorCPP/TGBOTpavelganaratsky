#!/bin/bash

# Скрипт автоматической настройки VPS для LIFTme-Bot
# ВНИМАНИЕ: Выполняйте только на чистом VPS или после проверки команд!

set -e

echo "🚀 Начало автоматической настройки VPS для LIFTme-Bot"
echo ""

# Цвета для вывода
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Проверка root прав
if [ "$EUID" -ne 0 ]; then 
    echo -e "${RED}❌ Пожалуйста, запустите скрипт с правами root (sudo)${NC}"
    exit 1
fi

# Конфигурация
DOMAIN=""
REPO_URL="https://github.com/SiteCraftorCPP/TGBOTpavelganaratsky.git"
DEPLOY_DIR="/var/www/liftme-bot"

# Запрос домена
echo -e "${BLUE}Введите ваш домен (например: example.com):${NC}"
read -r DOMAIN

if [ -z "$DOMAIN" ]; then
    echo -e "${RED}❌ Домен не может быть пустым${NC}"
    exit 1
fi

echo ""
echo -e "${YELLOW}📦 Шаг 1: Обновление системы...${NC}"
apt update -y

echo ""
echo -e "${YELLOW}📦 Шаг 2: Установка Node.js...${NC}"
if ! command -v node &> /dev/null; then
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt-get install -y nodejs
else
    echo -e "${GREEN}✓ Node.js уже установлен: $(node --version)${NC}"
fi

echo ""
echo -e "${YELLOW}📦 Шаг 3: Установка Nginx...${NC}"
if ! command -v nginx &> /dev/null; then
    apt install nginx -y
    systemctl enable nginx
    systemctl start nginx
else
    echo -e "${GREEN}✓ Nginx уже установлен${NC}"
fi

echo ""
echo -e "${YELLOW}📦 Шаг 4: Установка Git...${NC}"
if ! command -v git &> /dev/null; then
    apt install git -y
else
    echo -e "${GREEN}✓ Git уже установлен${NC}"
fi

echo ""
echo -e "${YELLOW}📦 Шаг 5: Клонирование репозитория...${NC}"
if [ -d "$DEPLOY_DIR" ]; then
    echo -e "${YELLOW}Директория уже существует. Обновление...${NC}"
    cd "$DEPLOY_DIR"
    git pull origin main || true
else
    mkdir -p /var/www
    cd /var/www
    git clone -b main "$REPO_URL" liftme-bot
    cd "$DEPLOY_DIR"
fi

echo ""
echo -e "${YELLOW}📦 Шаг 6: Настройка .env файла...${NC}"
if [ ! -f "$DEPLOY_DIR/.env" ]; then
    if [ -f "$DEPLOY_DIR/env.example" ]; then
        cp env.example .env
    elif [ -f "$DEPLOY_DIR/.env.example" ]; then
        cp .env.example .env
    else
        # Создаем .env файл, если пример отсутствует
        cat > .env << EOF
# Supabase Configuration for Frontend
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_PUBLISHABLE_KEY=your_supabase_anon_key
EOF
        echo -e "${YELLOW}Создан новый .env файл${NC}"
    fi
    echo -e "${RED}⚠️  ВАЖНО: Отредактируйте .env файл с вашими данными Supabase!${NC}"
    echo "Нажмите Enter, когда отредактируете .env (или Ctrl+C для выхода)"
    read -r
fi

echo ""
echo -e "${YELLOW}📦 Шаг 7: Установка зависимостей...${NC}"
npm ci

echo ""
echo -e "${YELLOW}📦 Шаг 8: Сборка проекта...${NC}"
npm run build

echo ""
echo -e "${YELLOW}📦 Шаг 9: Настройка прав доступа...${NC}"
chown -R www-data:www-data dist
chmod -R 755 dist
chmod 600 .env

echo ""
echo -e "${YELLOW}📦 Шаг 10: Настройка Nginx...${NC}"
# Замена домена в nginx.conf
sed "s/your-domain.com/$DOMAIN/g" nginx.conf > /tmp/nginx_liftme.conf

# Замена путей к SSL (стандартные пути Let's Encrypt)
sed -i "s|/etc/letsencrypt/live/your-domain.com|/etc/letsencrypt/live/$DOMAIN|g" /tmp/nginx_liftme.conf

cp /tmp/nginx_liftme.conf /etc/nginx/sites-available/liftme-bot

# Создание симлинка
if [ ! -L /etc/nginx/sites-enabled/liftme-bot ]; then
    ln -s /etc/nginx/sites-available/liftme-bot /etc/nginx/sites-enabled/
fi

echo ""
echo -e "${YELLOW}📦 Шаг 11: Проверка Nginx конфигурации...${NC}"
if nginx -t; then
    echo -e "${GREEN}✓ Конфигурация Nginx корректна${NC}"
    systemctl reload nginx
else
    echo -e "${RED}❌ Ошибка в конфигурации Nginx!${NC}"
    echo "Проверьте файл: /etc/nginx/sites-available/liftme-bot"
    exit 1
fi

echo ""
echo -e "${GREEN}✅ Настройка завершена!${NC}"
echo ""
echo -e "${BLUE}📋 Следующие шаги:${NC}"
echo "1. Убедитесь, что SSL сертификат установлен:"
echo "   sudo certbot --nginx -d $DOMAIN"
echo ""
echo "2. Проверьте доступность сайта:"
echo "   curl https://$DOMAIN/health"
echo ""
echo "3. Проверьте логи при необходимости:"
echo "   sudo tail -f /var/log/nginx/error.log"
echo ""
echo -e "${YELLOW}⚠️  Если SSL сертификат еще не установлен, запустите:${NC}"
echo "   sudo certbot --nginx -d $DOMAIN"
echo ""

