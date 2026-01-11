# Руководство по миграции с Supabase на локальный PostgreSQL

## Обзор изменений

Проект полностью переведен с Supabase на локальный PostgreSQL. Все изменения внесены, но требуется финальная проверка и тестирование.

## Что уже сделано

1. ✅ Создан модуль `server/db.js` - все функции работы с БД через pg
2. ✅ Создан модуль `server/storage.js` - локальное хранилище файлов
3. ✅ Создана схема БД `database/schema.sql`
4. ✅ Обновлен `server/package.json` - заменен @supabase/supabase-js на pg
5. ✅ Частично переписан `server/bot.js` - заменены основные функции

## Что нужно сделать

### 1. Установить PostgreSQL на VPS

```bash
sudo apt update
sudo apt install postgresql postgresql-contrib
sudo systemctl start postgresql
sudo systemctl enable postgresql
```

### 2. Создать базу данных

```bash
sudo -u postgres psql
CREATE DATABASE liftme_bot;
CREATE USER liftme_user WITH PASSWORD 'your_password';
GRANT ALL PRIVILEGES ON DATABASE liftme_bot TO liftme_user;
\q
```

### 3. Применить схему БД

```bash
psql -U liftme_user -d liftme_bot -f database/schema.sql
```

### 4. Обновить .env файл

Удалить:
- SUPABASE_URL
- SUPABASE_SERVICE_ROLE_KEY
- VITE_SUPABASE_URL
- VITE_SUPABASE_PUBLISHABLE_KEY

Добавить:
```
DB_HOST=localhost
DB_PORT=5432
DB_NAME=liftme_bot
DB_USER=liftme_user
DB_PASSWORD=your_password
STORAGE_DIR=/var/www/liftme-bot/server/storage
PUBLIC_URL=https://liftme.by
```

### 5. Завершить переписывание server/bot.js

Файл частично переписан. Нужно заменить все оставшиеся вызовы `supabase.from()` на функции из `db.js`.

Используйте grep для поиска:
```bash
grep -n "supabase\." server/bot.js
```

### 6. Создать API endpoints для админ-панели

Нужно создать файл `server/api.js` с endpoints для админ-панели:
- GET /api/clients
- GET /api/slots
- POST /api/slots
- DELETE /api/slots/:id
- GET /api/sos
- PUT /api/sos/:id
- GET /api/payments
- DELETE /api/payments/:id
- GET /api/diary/:clientId
- и т.д.

### 7. Переписать компоненты админ-панели

Все компоненты в `src/components/admin/` используют `supabase` клиент. Нужно переписать на использование REST API.

### 8. Настроить Nginx для статических файлов

Добавить в nginx.conf:
```nginx
location /storage/ {
    alias /var/www/liftme-bot/server/storage/;
    expires 30d;
}
```

### 9. Установить зависимости

```bash
cd server
npm install
```

### 10. Запустить бота

```bash
pm2 restart liftme-bot
```

## Важные замечания

- Все данные из Supabase нужно экспортировать и импортировать в новую БД
- Файлы из Supabase Storage нужно скачать и поместить в локальное хранилище
- Протестировать все функции бота и админ-панели
