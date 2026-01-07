# Быстрый старт для деплоя на VPS

## Шаги перед деплоем

1. **Отредактируйте `deploy.sh`:**
   - Замените `REPO_URL` на URL вашего репозитория
   - При необходимости измените `BRANCH`

2. **Подготовьте переменные окружения:**
   - Скопируйте `env.example` в `.env` на сервере
   - Заполните значения:
     ```
     VITE_SUPABASE_URL=https://your-project.supabase.co
     VITE_SUPABASE_PUBLISHABLE_KEY=your-anon-key
     ```

3. **Настройте `nginx.conf`:**
   - Замените `your-domain.com` на ваш домен
   - Обновите пути к SSL сертификатам

## Первый деплой

```bash
# На VPS
sudo mkdir -p /var/www
cd /var/www
sudo git clone https://github.com/your-username/your-repo.git liftme-bot
cd liftme-bot

# Настройте .env
sudo cp env.example .env
sudo nano .env  # Заполните переменные

# Отредактируйте deploy.sh перед запуском
sudo nano deploy.sh  # Замените REPO_URL и BRANCH

# Запустите деплой
sudo chmod +x deploy.sh
sudo ./deploy.sh
```

## Обновление приложения

После изменений в репозитории:

```bash
cd /var/www/liftme-bot
sudo ./update.sh
```

Или вручную:

```bash
cd /var/www/liftme-bot
sudo git pull
sudo npm ci
sudo npm run build
sudo chown -R www-data:www-data dist
sudo systemctl reload nginx
```

## Проверка

После деплоя проверьте:
- ✅ Приложение доступно по HTTPS: `https://your-domain.com`
- ✅ Все статические файлы загружаются (CSS, JS)
- ✅ Nginx логи без ошибок: `sudo tail -f /var/log/nginx/error.log`

## Подробная документация

См. [DEPLOY.md](./DEPLOY.md) для полной инструкции.

