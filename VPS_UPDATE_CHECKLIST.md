# Чеклист обновления на VPS

## ✅ Что нужно проверить:

### 1. Обновлен ли код?
```bash
cd /var/www/liftme-bot
git pull
# Должны появиться новые файлы: server/db.js, server/storage.js, database/schema.sql
```

### 2. Установлен ли PostgreSQL?
```bash
sudo systemctl status postgresql
# Если не установлен:
sudo apt update
sudo apt install postgresql postgresql-contrib
```

### 3. Создана ли база данных?
```bash
# Проверить подключение
psql -U liftme_user -d liftme_db -h localhost
# Если ошибка - нужно создать БД и пользователя
```

### 4. Применена ли схема базы данных?
```bash
cd /var/www/liftme-bot
psql -U liftme_user -d liftme_db -h localhost -f database/schema.sql
```

### 5. Настроен ли .env файл?
```bash
cd /var/www/liftme-bot
cat .env
# Должны быть переменные:
# DB_HOST=localhost
# DB_PORT=5432
# DB_NAME=liftme_db
# DB_USER=liftme_user
# DB_PASSWORD=...
```

### 6. Установлены ли зависимости?
```bash
cd /var/www/liftme-bot/server
npm install
# Должна установиться библиотека 'pg'
```

### 7. Перезапущен ли бот?
```bash
pm2 stop liftme-bot
cd /var/www/liftme-bot/server
pm2 start bot.js --name liftme-bot
pm2 logs liftme-bot --lines 20
# В логах НЕ должно быть упоминаний Supabase Storage
# Должно быть: "✓ Connected to PostgreSQL database"
```
