-- =============================================
-- Схема базы данных для Telegram-бота психолога
-- PostgreSQL
-- =============================================

-- Типы (ENUM)
CREATE TYPE slot_status AS ENUM ('free', 'booked');
CREATE TYPE booking_status AS ENUM ('active', 'canceled', 'completed');
CREATE TYPE sos_status AS ENUM ('new', 'viewed');

-- Таблица клиентов
CREATE TABLE clients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    telegram_id BIGINT UNIQUE NOT NULL,
    username TEXT,
    first_name TEXT,
    last_name TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Таблица слотов расписания
CREATE TABLE slots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    date DATE NOT NULL,
    time TIME NOT NULL,
    status slot_status DEFAULT 'free' NOT NULL,
    client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
    comment TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    UNIQUE(date, time)
);

-- Таблица записей на консультацию
CREATE TABLE bookings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID REFERENCES clients(id) ON DELETE CASCADE NOT NULL,
    slot_id UUID REFERENCES slots(id) ON DELETE CASCADE NOT NULL,
    status booking_status DEFAULT 'active' NOT NULL,
    reminder_24h_sent BOOLEAN DEFAULT false NOT NULL,
    reminder_1h_sent BOOLEAN DEFAULT false NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Таблица SOS обращений
CREATE TABLE sos_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID REFERENCES clients(id) ON DELETE CASCADE NOT NULL,
    text TEXT,
    status sos_status DEFAULT 'new' NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Таблица записей дневника
CREATE TABLE diary_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID REFERENCES clients(id) ON DELETE CASCADE NOT NULL,
    text TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Таблица настроек бота
CREATE TABLE bot_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key TEXT UNIQUE NOT NULL,
    value JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Вставляем admin_ids
INSERT INTO bot_settings (key, value) VALUES ('admin_ids', '[783321437]');

-- Функция для обновления updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Триггеры для updated_at
CREATE TRIGGER update_slots_updated_at
    BEFORE UPDATE ON slots
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_bot_settings_updated_at
    BEFORE UPDATE ON bot_settings
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Индексы для производительности
CREATE INDEX idx_clients_telegram_id ON clients(telegram_id);
CREATE INDEX idx_slots_date_status ON slots(date, status);
CREATE INDEX idx_bookings_client_status ON bookings(client_id, status);
CREATE INDEX idx_diary_entries_client ON diary_entries(client_id);
CREATE INDEX idx_sos_requests_client_status ON sos_requests(client_id, status);
