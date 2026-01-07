-- Создание enum для статусов
CREATE TYPE public.slot_status AS ENUM ('free', 'booked');
CREATE TYPE public.booking_status AS ENUM ('active', 'canceled', 'completed');
CREATE TYPE public.sos_status AS ENUM ('new', 'viewed');

-- Таблица пользователей (клиентов)
CREATE TABLE public.clients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    telegram_id BIGINT UNIQUE NOT NULL,
    username TEXT,
    first_name TEXT,
    last_name TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Таблица слотов расписания
CREATE TABLE public.slots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    date DATE NOT NULL,
    time TIME NOT NULL,
    status public.slot_status DEFAULT 'free' NOT NULL,
    client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
    comment TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    UNIQUE(date, time)
);

-- Таблица записей на консультацию
CREATE TABLE public.bookings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE NOT NULL,
    slot_id UUID REFERENCES public.slots(id) ON DELETE CASCADE NOT NULL,
    status public.booking_status DEFAULT 'active' NOT NULL,
    reminder_24h_sent BOOLEAN DEFAULT false NOT NULL,
    reminder_1h_sent BOOLEAN DEFAULT false NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Таблица SOS обращений
CREATE TABLE public.sos_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE NOT NULL,
    text TEXT,
    status public.sos_status DEFAULT 'new' NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Таблица записей дневника
CREATE TABLE public.diary_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE NOT NULL,
    text TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Таблица настроек бота (для хранения admin_ids и других настроек)
CREATE TABLE public.bot_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key TEXT UNIQUE NOT NULL,
    value JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Вставляем admin_ids
INSERT INTO public.bot_settings (key, value) VALUES ('admin_ids', '[783321437]');

-- Функция для обновления updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Триггеры для updated_at
CREATE TRIGGER update_slots_updated_at
    BEFORE UPDATE ON public.slots
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_bot_settings_updated_at
    BEFORE UPDATE ON public.bot_settings
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- Включаем RLS
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sos_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.diary_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bot_settings ENABLE ROW LEVEL SECURITY;

-- Политики для публичного доступа (бот работает через service role)
CREATE POLICY "Allow all for service role" ON public.clients FOR ALL USING (true);
CREATE POLICY "Allow all for service role" ON public.slots FOR ALL USING (true);
CREATE POLICY "Allow all for service role" ON public.bookings FOR ALL USING (true);
CREATE POLICY "Allow all for service role" ON public.sos_requests FOR ALL USING (true);
CREATE POLICY "Allow all for service role" ON public.diary_entries FOR ALL USING (true);
CREATE POLICY "Allow all for service role" ON public.bot_settings FOR ALL USING (true);