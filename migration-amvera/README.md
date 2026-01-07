# Миграция Telegram-бота на Amvera

## Важно!
Бот продолжает работать на Lovable Cloud до тех пор, пока вы не переключите webhook на новый сервер.

## Структура файлов

```
migration-amvera/
├── README.md           # Эта инструкция
├── bot/
│   ├── index.js        # Код бота (Node.js версия)
│   ├── package.json    # Зависимости
│   └── .env.example    # Пример переменных окружения
├── database/
│   └── schema.sql      # SQL-схема базы данных
└── amvera.yml          # Конфигурация для Amvera
```

## Пошаговая инструкция

### 1. Создайте проект PostgreSQL в Amvera

1. Перейдите в Amvera → PostgreSQL
2. Создайте новую базу данных
3. Запишите данные подключения:
   - Host (например: `postgres-xxx.amvera.ru`)
   - Port: `5432`
   - Database name
   - Username
   - Password

### 2. Импортируйте схему базы данных

1. Подключитесь к PostgreSQL через любой клиент (DBeaver, psql, pgAdmin)
2. Выполните SQL из файла `database/schema.sql`

### 3. Экспортируйте данные из Lovable Cloud (опционально)

Если нужно сохранить существующих клиентов и записи:

1. В Lovable откройте Cloud → Database → Tables
2. Экспортируйте каждую таблицу в CSV
3. Импортируйте в PostgreSQL на Amvera

### 4. Создайте приложение Node.js в Amvera

1. Перейдите в Amvera → Приложения → Создать проект
2. Загрузите файлы из папки `bot/`:
   - `index.js`
   - `package.json`
   - `amvera.yml` (скопируйте из корня)

3. Настройте переменные окружения в Amvera:
   ```
   TELEGRAM_BOT_TOKEN=ваш_токен_бота
   DATABASE_URL=postgresql://user:password@host:5432/dbname
   ADMIN_TELEGRAM_ID=783321437
   ```

### 5. Переключите webhook

**ВАЖНО:** Этот шаг переключает бота с Lovable на Amvera!

После деплоя приложения в Amvera вы получите URL вида:
`https://your-app-name.amvera.ru`

Переключите webhook:
```
https://api.telegram.org/bot<YOUR_BOT_TOKEN>/setWebhook?url=https://your-app-name.amvera.ru/webhook
```

### 6. Проверьте работу

Отправьте `/start` боту — он должен ответить из нового сервера.

---

## Откат на Lovable (если что-то пошло не так)

Чтобы вернуть бота на Lovable, переключите webhook обратно:
```
https://api.telegram.org/bot<YOUR_BOT_TOKEN>/setWebhook?url=https://jmzcdecklfrknitzlwyg.supabase.co/functions/v1/telegram-bot
```

---

## Настройка Cron Jobs (напоминания)

Если вам нужны автоматические напоминания о записях, создайте Cron Job в Amvera:
- Название: `reminders`
- Расписание: `*/30 * * * *` (каждые 30 минут)
- Команда: создайте отдельный скрипт для проверки и отправки напоминаний
