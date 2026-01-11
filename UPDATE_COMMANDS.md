# Команды для обновления на VPS

## Быстрое обновление

```bash
# 1. Перейти в директорию проекта
cd /var/www/liftme-bot

# 2. Остановить бота
pm2 stop liftme-bot

# 3. Получить последние изменения
git pull

# 4. Установить/обновить зависимости сервера
cd server
npm install

# 5. Вернуться в корень и пересобрать админ-панель
cd ..
npm run build

# 6. Запустить бота
cd server
pm2 start liftme-bot

# 7. Перезагрузить Nginx
sudo nginx -t
sudo systemctl reload nginx
```

## Первая настройка (если еще не настроено)

Если это первый запуск после миграции:

```bash
# 1. Перейти в директорию проекта
cd /var/www/liftme-bot

# 2. Получить последние изменения
git pull

# 3. Установить PostgreSQL (если еще не установлен)
sudo apt update
sudo apt install postgresql postgresql-contrib

# 4. Создать пользователя и базу данных
sudo -i -u postgres
createuser --interactive --pwprompt liftme_user
createdb -O liftme_user liftme_db
exit

# 5. Применить схему базы данных
psql -U liftme_user -d liftme_db -h localhost -f /var/www/liftme-bot/database/schema.sql

# 6. Создать директорию для storage
mkdir -p /var/www/liftme-bot/server/storage/payments
chown -R $USER:$USER /var/www/liftme-bot/server/storage

# 7. Настроить .env файл
nano /var/www/liftme-bot/.env
# Добавить переменные из env.example

# 8. Установить зависимости сервера
cd /var/www/liftme-bot/server
npm install

# 9. Пересобрать админ-панель
cd /var/www/liftme-bot
npm run build

# 10. Запустить бота
cd server
pm2 start bot.js --name liftme-bot
pm2 save

# 11. Обновить Nginx конфигурацию
sudo cp /var/www/liftme-bot/nginx.conf /etc/nginx/sites-available/liftme-bot
sudo nginx -t
sudo systemctl reload nginx
```

## Проверка после обновления

```bash
# Проверить логи бота
pm2 logs liftme-bot --lines 50

# Проверить статус бота
pm2 status

# Проверить доступность API
curl http://localhost:3000/api/clients

# Проверить Nginx
sudo nginx -t

# Проверить PostgreSQL
sudo systemctl status postgresql
```

## Откат (если что-то пошло не так)

```bash
cd /var/www/liftme-bot
git log --oneline -10  # Посмотреть последние коммиты
git reset --hard HEAD~1  # Откатить последний коммит
git pull  # Получить изменения заново
pm2 restart liftme-bot
```
