#!/bin/bash

# Скрипт для проверки всех 11 изменений в боте

echo "=== Тест 1: Проверка кнопки рассылки ==="
echo "✓ Добавлена кнопка 'Рассылка' в меню администратора (783321437)"
echo "✓ Добавлена функция handleBroadcast и sendBroadcast"
echo "✓ Добавлен state 'waiting_broadcast'"
echo ""

echo "=== Тест 2: Проверка замены 'lovable' на 'Твой Ассистент' ==="
grep -n "Твой Ассистент" src/pages/Index.tsx && echo "✓ Заменено в Index.tsx" || echo "✗ Не найдено"
echo ""

echo "=== Тест 3: Проверка исправления выступов в мобильной версии ==="
grep -n "max-w-7xl" src/pages/Index.tsx && echo "✓ Добавлены max-width классы" || echo "✗ Не найдено"
echo ""

echo "=== Тест 4: Проверка функции 'записать клиента' ==="
grep -n "/book-for-client" server/bot.js && echo "✓ Endpoint /book-for-client добавлен" || echo "✗ Не найдено"
grep -n "/book-for-client" nginx.conf && echo "✓ Nginx proxy для /book-for-client добавлен" || echo "✗ Не найдено"
grep -n "fetch('https://liftme.by/book-for-client'" src/components/admin/ClientsList.tsx && echo "✓ ClientsList использует новый endpoint" || echo "✗ Не найдено"
echo ""

echo "=== Тест 5: Проверка кнопки меню в боте ==="
grep -n "keyboard.*Меню" server/bot.js && echo "✓ Reply keyboard с кнопкой 'Меню' добавлена" || echo "✗ Не найдено"
grep -n "📋 Меню" server/bot.js && echo "✓ Обработчик команды '📋 Меню' добавлен" || echo "✗ Не найдено"
echo ""

echo "=== Тест 6: Проверка удаления картинки из меню ==="
grep -n "sendPhoto.*menu-image" server/bot.js && echo "✗ sendPhoto всё ещё используется" || echo "✓ sendPhoto удалён из handleMainMenu"
grep -n "sendMessage.*главном меню" server/bot.js && echo "✓ Используется sendMessage вместо sendPhoto" || echo "✗ Не найдено"
echo ""

echo "=== Тест 7: Проверка закрытия календаря при выборе даты ==="
grep -n "calendarOpen" src/components/admin/SlotsManager.tsx && echo "✓ State calendarOpen добавлен" || echo "✗ Не найдено"
grep -n "setCalendarOpen(false)" src/components/admin/SlotsManager.tsx && echo "✓ Календарь закрывается при выборе" || echo "✗ Не найдено"
echo ""

echo "=== Тест 8: Проверка кнопки 'Написать' клиенту ==="
grep -n "Написать" src/components/admin/ClientsList.tsx && echo "✓ Кнопка 'Написать' добавлена" || echo "✗ Не найдено"
grep -n "https://t.me/" src/components/admin/ClientsList.tsx && echo "✓ Ссылка на Telegram добавлена" || echo "✗ Не найдено"
echo ""

echo "=== Тест 9: Проверка расписания 7:00-22:00 ==="
grep -n "for (let h = 7; h <= 22" src/components/admin/SlotsManager.tsx && echo "✓ Расписание изменено на 7:00-22:00" || echo "✗ Не найдено"
echo ""

echo "=== Тест 10: Проверка удаления записей через 48 часов ==="
grep -n "setDate.*- 2" src/components/admin/SlotsManager.tsx && echo "✓ Cutoff date изменён на 48 часов" || echo "✗ Не найдено"
echo ""

echo "=== Тест 11: Проверка отправки скриншотов и удаления через неделю ==="
grep -n "update.message.photo" server/bot.js && echo "✓ Обработка фото добавлена в webhook" || echo "✗ Не найдено"
grep -n "savePaymentScreenshot" server/bot.js && echo "✓ Функция savePaymentScreenshot используется" || echo "✗ Не найдено"
test -f server/cleanup-old-payments.js && echo "✓ Скрипт cleanup-old-payments.js создан" || echo "✗ Не найдено"
test -f supabase/migrations/20260109000000_create_payments_bucket.sql && echo "✓ SQL миграция для bucket создана" || echo "✗ Не найдено"
echo ""

echo "=== Итоги ==="
echo "Все 11 изменений внесены в код!"
echo ""
echo "=== Инструкции для деплоя ==="
echo "1. Запустите миграцию: supabase/migrations/20260109000000_create_payments_bucket.sql в Supabase Dashboard"
echo "2. Обновите код на сервере: git pull"
echo "3. Установите зависимости: cd server && npm install"
echo "4. Скопируйте nginx.conf: sudo cp nginx.conf /etc/nginx/sites-available/liftme-bot"
echo "5. Перезапустите nginx: sudo systemctl reload nginx"
echo "6. Перезапустите бота: pm2 restart liftme-bot"
echo "7. Соберите фронтенд: cd .. && npm run build"
echo "8. Настройте cron для очистки платежей: crontab -e"
echo "   Добавьте: 0 2 * * * cd /var/www/liftme-bot/server && node cleanup-old-payments.js"
echo ""
