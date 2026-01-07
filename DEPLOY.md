# Инструкция по деплою на VPS

## Требования

- VPS с Ubuntu/Debian
- Установленный Node.js 18+ и npm
- Установленный Nginx
- SSL сертификат (Let's Encrypt)
- Git
- Доступ по SSH с правами root или sudo

## Подготовка VPS

### 1. Установка Node.js

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
```

### 2. Установка Nginx

```bash
sudo apt update
sudo apt install nginx -y
sudo systemctl enable nginx
sudo systemctl start nginx
```

### 3. Установка SSL сертификата (если еще нет)

```bash
sudo apt install certbot python3-certbot-nginx -y
sudo certbot --nginx -d your-domain.com
```

## Настройка проекта

### 1. Клонирование репозитория

```bash
sudo mkdir -p /var/www
cd /var/www
sudo git clone https://github.com/your-username/your-repo.git liftme-bot
cd liftme-bot
```

### 2. Настройка переменных окружения

```bash
sudo cp .env.example .env
sudo nano .env
```

Заполните переменные:
```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your-anon-key
```

### 3. Настройка Nginx

Скопируйте `nginx.conf` и настройте:

```bash
sudo cp nginx.conf /etc/nginx/sites-available/liftme-bot
sudo nano /etc/nginx/sites-available/liftme-bot
```

**Важно:** Замените в конфигурации:
- `your-domain.com` на ваш домен
- Пути к SSL сертификатам на правильные

Включите конфигурацию:

```bash
sudo ln -s /etc/nginx/sites-available/liftme-bot /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

## Первый деплой

### Вариант 1: Автоматический (рекомендуется)

Сделайте скрипт исполняемым и запустите:

```bash
chmod +x deploy.sh
sudo ./deploy.sh
```

**Важно:** Перед запуском отредактируйте `deploy.sh`:
- Замените `REPO_URL` на URL вашего репозитория
- При необходимости измените `BRANCH` (по умолчанию `main`)

### Вариант 2: Ручной деплой

```bash
# Перейдите в директорию проекта
cd /var/www/liftme-bot

# Обновите код
sudo git pull origin main

# Установите зависимости
sudo npm ci

# Соберите проект
sudo npm run build

# Установите права
sudo chown -R www-data:www-data dist
sudo chmod -R 755 dist

# Перезагрузите nginx
sudo systemctl reload nginx
```

## Автоматический деплой через Git Hook (опционально)

Для автоматического деплоя при push в репозиторий:

### 1. Создайте post-receive hook на сервере

```bash
sudo mkdir -p /var/www/liftme-bot.git
cd /var/www/liftme-bot.git
sudo git init --bare

sudo nano hooks/post-receive
```

Добавьте содержимое:

```bash
#!/bin/bash
WORK_TREE=/var/www/liftme-bot
GIT_DIR=/var/www/liftme-bot.git
cd $WORK_TREE
git --git-dir=$GIT_DIR --work-tree=$WORK_TREE checkout -f main
cd $WORK_TREE
npm ci
npm run build
chown -R www-data:www-data dist
chmod -R 755 dist
systemctl reload nginx
```

Сделайте исполняемым:

```bash
sudo chmod +x hooks/post-receive
```

### 2. Настройте remote на локальной машине

```bash
git remote add production ssh://user@your-server/var/www/liftme-bot.git
git push production main
```

## Структура файлов на сервере

```
/var/www/liftme-bot/
├── .env                 # Переменные окружения (не в Git)
├── .git/               # Репозиторий Git
├── dist/               # Собранные файлы (отдается через Nginx)
├── src/                # Исходный код
├── package.json
└── ...
```

## Обновление приложения

### Через скрипт:

```bash
cd /var/www/liftme-bot
sudo ./deploy.sh
```

### Вручную:

```bash
cd /var/www/liftme-bot
sudo git pull
sudo npm ci
sudo npm run build
sudo chown -R www-data:www-data dist
sudo systemctl reload nginx
```

## Настройка для Telegram Mini App

Если ваш домен уже настроен для Mini App с HTTPS/SSL, после деплоя:

1. Убедитесь, что приложение доступно по HTTPS
2. Проверьте, что все статические файлы загружаются (CSS, JS, изображения)
3. Настройте webhook для Telegram бота (если нужно)

## Troubleshooting

### Проверка логов Nginx

```bash
sudo tail -f /var/log/nginx/error.log
sudo tail -f /var/log/nginx/access.log
```

### Проверка статуса Nginx

```bash
sudo systemctl status nginx
sudo nginx -t
```

### Проверка прав доступа

```bash
ls -la /var/www/liftme-bot/dist
```

### Пересборка при проблемах

```bash
cd /var/www/liftme-bot
rm -rf dist node_modules
npm ci
npm run build
sudo chown -R www-data:www-data dist
sudo systemctl reload nginx
```

## Безопасность

1. **Не коммитьте `.env` в Git** - он уже в `.gitignore`
2. **Используйте HTTPS** - настройте редирект с HTTP
3. **Ограничьте доступ к `.env`**:
   ```bash
   sudo chmod 600 /var/www/liftme-bot/.env
   ```
4. **Регулярно обновляйте зависимости**:
   ```bash
   npm audit
   npm audit fix
   ```

## Мониторинг

Для мониторинга доступности можно использовать:

```bash
# Проверка health endpoint
curl https://your-domain.com/health
```

## Полезные команды

```bash
# Перезапуск Nginx
sudo systemctl restart nginx

# Проверка конфигурации Nginx
sudo nginx -t

# Просмотр статуса
sudo systemctl status nginx

# Очистка кеша npm
npm cache clean --force
```

