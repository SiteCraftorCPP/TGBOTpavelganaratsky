# Команды для настройки на VPS

## 1. Подготовка VPS (выполнить один раз)

### Установка Node.js
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
node --version  # Проверка версии (должна быть 20.x)
```

### Установка Nginx
```bash
sudo apt update
sudo apt install nginx -y
sudo systemctl enable nginx
sudo systemctl start nginx
sudo systemctl status nginx  # Проверка статуса
```

### Установка Git (если еще не установлен)
```bash
sudo apt install git -y
git --version
```

### Установка SSL сертификата (если еще нет)
```bash
sudo apt install certbot python3-certbot-nginx -y
sudo certbot --nginx -d your-domain.com
# Следуйте инструкциям на экране
```

---

## 2. Клонирование и первичная настройка проекта

### Клонирование репозитория
```bash
sudo mkdir -p /var/www
cd /var/www
sudo git clone https://github.com/SiteCraftorCPP/TGBOTpavelganaratsky.git liftme-bot
cd liftme-bot
```

### Настройка переменных окружения
```bash
sudo cp env.example .env
sudo nano .env
```

**В файле .env укажите:**
```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your-anon-key
```

Нажмите `Ctrl+X`, затем `Y`, затем `Enter` для сохранения.

### Настройка прав доступа
```bash
sudo chmod 600 .env  # Ограничение доступа к .env
sudo chmod +x deploy.sh update.sh  # Разрешение выполнения скриптов
```

---

## 3. Настройка deploy.sh

### Редактирование скрипта деплоя
```bash
sudo nano deploy.sh
```

**Замените строки:**
- `REPO_URL="https://github.com/your-username/your-repo.git"` → `REPO_URL="https://github.com/SiteCraftorCPP/TGBOTpavelganaratsky.git"`
- При необходимости измените `BRANCH="main"`

---

## 4. Настройка Nginx

### Редактирование конфигурации
```bash
sudo nano nginx.conf
```

**Замените:**
- `your-domain.com` на ваш домен (все вхождения)
- Пути к SSL сертификатам (если отличаются от стандартных)

### Копирование конфигурации Nginx
```bash
sudo cp nginx.conf /etc/nginx/sites-available/liftme-bot
sudo nano /etc/nginx/sites-available/liftme-bot
# Убедитесь, что все настройки правильные
```

### Включение сайта
```bash
sudo ln -s /etc/nginx/sites-available/liftme-bot /etc/nginx/sites-enabled/
```

### Проверка и перезагрузка Nginx
```bash
sudo nginx -t  # Должно показать "test is successful"
sudo systemctl reload nginx
```

---

## 5. Первый деплой

### Автоматический деплой (рекомендуется)
```bash
cd /var/www/liftme-bot
sudo ./deploy.sh
```

### Или ручной деплой
```bash
cd /var/www/liftme-bot
sudo npm ci
sudo npm run build
sudo chown -R www-data:www-data dist
sudo chmod -R 755 dist
sudo systemctl reload nginx
```

---

## 6. Проверка работы

### Проверка доступности
```bash
curl -I https://your-domain.com
curl https://your-domain.com/health  # Должно вернуть "healthy"
```

### Проверка логов Nginx
```bash
sudo tail -f /var/log/nginx/error.log
sudo tail -f /var/log/nginx/access.log
```

### Проверка файлов
```bash
ls -la /var/www/liftme-bot/dist
ls -la /var/www/liftme-bot/.env  # Должен быть только для root/www-data
```

---

## 7. Обновление проекта (после изменений в Git)

### Быстрое обновление
```bash
cd /var/www/liftme-bot
sudo ./update.sh
```

### Ручное обновление
```bash
cd /var/www/liftme-bot
sudo git pull origin main
sudo npm ci
sudo npm run build
sudo chown -R www-data:www-data dist
sudo chmod -R 755 dist
sudo systemctl reload nginx
```

---

## 8. Полезные команды

### Просмотр статуса Nginx
```bash
sudo systemctl status nginx
sudo systemctl restart nginx  # Перезапуск
sudo systemctl reload nginx   # Перезагрузка без простоя
```

### Просмотр процессов Node.js
```bash
ps aux | grep node
```

### Проверка использования диска
```bash
df -h
du -sh /var/www/liftme-bot
```

### Очистка кеша npm
```bash
cd /var/www/liftme-bot
sudo npm cache clean --force
```

### Просмотр последних коммитов
```bash
cd /var/www/liftme-bot
git log --oneline -10
```

---

## 9. Решение проблем

### Если Nginx не запускается
```bash
sudo nginx -t  # Проверка конфигурации
sudo systemctl status nginx
sudo journalctl -u nginx -n 50  # Последние логи
```

### Если сборка не проходит
```bash
cd /var/www/liftme-bot
rm -rf node_modules dist
sudo npm ci
sudo npm run build
```

### Если файлы не обновляются
```bash
cd /var/www/liftme-bot
sudo git fetch origin
sudo git reset --hard origin/main
sudo npm ci
sudo npm run build
sudo chown -R www-data:www-data dist
```

### Проверка переменных окружения
```bash
cd /var/www/liftme-bot
sudo cat .env
```

---

## 10. Настройка автообновления (опционально)

### Создание cron задачи для автообновления
```bash
sudo crontab -e
```

**Добавьте строку (обновление каждый день в 3:00):**
```
0 3 * * * cd /var/www/liftme-bot && /usr/bin/git pull origin main && /usr/bin/npm ci && /usr/bin/npm run build && /bin/chown -R www-data:www-data dist && /bin/systemctl reload nginx
```

---

## Быстрая шпаргалка

```bash
# Первая установка
sudo apt update && sudo apt install -y nginx nodejs git certbot python3-certbot-nginx
cd /var/www && sudo git clone https://github.com/SiteCraftorCPP/TGBOTpavelganaratsky.git liftme-bot
cd liftme-bot && sudo cp env.example .env && sudo nano .env
sudo chmod +x deploy.sh update.sh && sudo ./deploy.sh

# Обновление
cd /var/www/liftme-bot && sudo ./update.sh

# Проверка
curl https://your-domain.com/health
sudo systemctl status nginx
```

