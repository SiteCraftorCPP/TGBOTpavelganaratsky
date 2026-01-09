# Инструкции по деплою - 11 изменений

## Быстрый деплой

Выполните эти команды на сервере:

```bash
# 1. Перейти в директорию проекта
cd /var/www/liftme-bot

# 2. Получить изменения
git pull

# 3. Установить зависимости
cd server
npm install
cd ..

# 4. Собрать фронтенд
npm run build

# 5. Обновить nginx
sudo cp nginx.conf /etc/nginx/sites-available/liftme-bot
sudo nginx -t
sudo systemctl reload nginx

# 6. Перезапустить бота
cd server
pm2 restart liftme-bot
pm2 logs liftme-bot --lines 30
```

## Важно! Выполнить в Supabase Dashboard

1. Откройте https://supabase.com/dashboard/project/sciiqtwqnemjuiddqljx/sql/new
2. Вставьте и выполните:

```sql
-- Create storage bucket for payment screenshots
INSERT INTO storage.buckets (id, name, public)
VALUES ('payments', 'payments', true)
ON CONFLICT (id) DO NOTHING;

-- Set up storage policies
CREATE POLICY IF NOT EXISTS "Allow service role full access to payments"
ON storage.objects FOR ALL
TO service_role
USING (bucket_id = 'payments');

CREATE POLICY IF NOT EXISTS "Allow public read access to payments"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'payments');
```

## Настроить автоочистку платежей (опционально)

```bash
# Открыть crontab
crontab -e

# Добавить строку:
0 2 * * * cd /var/www/liftme-bot/server && /usr/bin/node cleanup-old-payments.js >> /var/log/cleanup-payments.log 2>&1
```

## Что изменилось

✅ **11 функций добавлено:**

1. Кнопка рассылки для админа
2. "Твой Ассистент" вместо "Панель управления"
3. Исправлена мобильная вёрстка
4. Исправлено "Записать клиента"
5. Кнопка "📋 Меню" в боте
6. Удалена картинка из меню
7. Календарь закрывается автоматически
8. Кнопка "Написать" клиенту
9. Расписание 7:00-22:30
10. Старые записи удаляются через 48 часов
11. Скриншоты работают + автоудаление через 7 дней

## Проверка

Запустите тест:
```bash
cd /var/www/liftme-bot
chmod +x test-bot-features.sh
./test-bot-features.sh
```

Должны быть все ✓ (галочки).

## Проблемы?

```bash
# Логи бота
pm2 logs liftme-bot --lines 50

# Статус
pm2 status

# Перезапуск
pm2 restart liftme-bot

# Nginx
sudo nginx -t
sudo systemctl status nginx
```
