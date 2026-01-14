# Настройка второго бота на admin2.liftme.by

## Шаг 1: Создание SSL сертификата

```bash
sudo certbot --nginx -d admin2.liftme.by
```

Выбери вариант 2 (Redirect HTTP to HTTPS), если спросит.

## Шаг 2: Создание отдельной БД

```bash
sudo -i -u postgres
createdb -O liftme_user admin2_liftme_db
exit
```

Примени схему БД:
```bash
psql -U liftme_user -d admin2_liftme_db -h localhost -f /var/www/liftme-bot/database/schema.sql
```

(Пароль: Qwerty098@)

## Шаг 3: Создание директории и копирование проекта

```bash
cd /var/www
sudo cp -r liftme-bot admin2-liftme-bot
cd admin2-liftme-bot
```

## Шаг 4: Настройка .env файла

```bash
sudo nano .env
```

Замени содержимое на:
```
# Database Configuration
DB_HOST=localhost
DB_PORT=5432
DB_NAME=admin2_liftme_db
DB_USER=liftme_user
DB_PASSWORD=Qwerty098@

# Storage Configuration
STORAGE_DIR=/var/www/admin2-liftme-bot/server/storage
PUBLIC_URL=https://admin2.liftme.by

# Telegram Bot Configuration
TELEGRAM_BOT_TOKEN=8595004902:AAFGkrVseAyKu6tO7EViBPOR1Ms11cjlm8s
ADMIN_TELEGRAM_IDS=252446646

# API Configuration for Frontend
VITE_API_URL=https://admin2.liftme.by/api

# Server Configuration
PORT=3001
PROJECT_URL=https://admin2.liftme.by
```

## Шаг 5: Обновление ADMIN_TELEGRAM_IDS в коде

```bash
sudo nano server/bot.js
```

Найди строку (примерно строка 23):
```javascript
const ADMIN_TELEGRAM_IDS = [783321437, 6933111964];
```

Замени на:
```javascript
const ADMIN_TELEGRAM_IDS = [252446646];
```

## Шаг 6: Установка зависимостей и сборка

```bash
cd /var/www/admin2-liftme-bot
npm ci
npm run build
```

## Шаг 7: Настройка Nginx

```bash
sudo cp /var/www/admin2-liftme-bot/nginx-admin2.conf /etc/nginx/sites-available/admin2-liftme-bot
sudo ln -s /etc/nginx/sites-available/admin2-liftme-bot /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

## Шаг 8: Настройка прав и запуск бота

```bash
sudo chown -R www-data:www-data /var/www/admin2-liftme-bot/dist
sudo chmod -R 755 /var/www/admin2-liftme-bot/dist
sudo chmod 600 /var/www/admin2-liftme-bot/.env

cd /var/www/admin2-liftme-bot/server
pm2 start bot.js --name admin2-liftme-bot
pm2 save
```

## Шаг 9: Настройка webhook для второго бота

После запуска бота настрой webhook через админ-панель на https://admin2.liftme.by или вручную:

```bash
curl -X POST "https://api.telegram.org/bot8595004902:AAFGkrVseAyKu6tO7EViBPOR1Ms11cjlm8s/setWebhook?url=https://admin2.liftme.by/webhook"
```

## Проверка

1. Проверь статус бота: `pm2 status`
2. Проверь логи: `pm2 logs admin2-liftme-bot --lines 30`
3. Проверь доступность админки: `curl https://admin2.liftme.by/health`
4. Проверь API: `curl https://admin2.liftme.by/api/clients`

## Обновление кода в будущем

Для обновления второго бота:
```bash
cd /var/www/admin2-liftme-bot
sudo git pull  # если используешь git, или скопируй файлы вручную
cd server
npm install
cd ..
npm run build
sudo chown -R www-data:www-data dist
pm2 restart admin2-liftme-bot
```
