# Настройка бота на VPS (без Edge Functions)

## 1. Установка на сервере

```bash
cd /var/www/liftme-bot
mkdir -p server
cd server

# Скопируйте файлы bot.js и package.json в папку server

# Установите зависимости
npm install

# Создайте .env файл
nano .env
```

## 2. Файл .env

```
TELEGRAM_BOT_TOKEN=8420494776:AAHYErzNIj47-TPBQeqUl0rSFfgZCu6mY1M
SUPABASE_URL=https://sciiqtwqnemjuiddqljx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNjaWlxdHdxbmVtanVpZGRxbGp4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2Nzc2Njc1MCwiZXhwIjoyMDgzMzQyNzUwfQ.ifnhrfUJJXekj8LC5_oIVFn89_AN-KVv_O5qLPpXENU
PROJECT_URL=https://liftme.by
PORT=3000
```

## 3. Настройка Nginx для проксирования webhook

```bash
nano /etc/nginx/sites-available/liftme-bot
```

Добавьте в блок server (443) перед закрывающей скобкой:

```
    # Telegram Bot Webhook
    location /webhook {
        proxy_pass http://localhost:3000/webhook;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
```

Проверьте и перезагрузите:
```bash
nginx -t
systemctl reload nginx
```

## 4. Запуск через PM2 (рекомендуется)

```bash
npm install -g pm2
cd /var/www/liftme-bot/server
pm2 start bot.js --name liftme-bot
pm2 save
pm2 startup
```

## 5. Настройка webhook

```bash
curl "https://api.telegram.org/bot8420494776:AAHYErzNIj47-TPBQeqUl0rSFfgZCu6mY1M/setWebhook?url=https://liftme.by/webhook"
```

## 6. Проверка

```bash
# Проверка статуса PM2
pm2 status

# Логи
pm2 logs liftme-bot

# Проверка webhook
curl "https://api.telegram.org/bot8420494776:AAHYErzNIj47-TPBQeqUl0rSFfgZCu6mY1M/getWebhookInfo"
```

## Обновление кода

```bash
cd /var/www/liftme-bot/server
git pull  # если код в git
npm install
pm2 restart liftme-bot
```

