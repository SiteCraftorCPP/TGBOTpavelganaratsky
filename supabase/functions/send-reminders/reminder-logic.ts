/**
 * Чистые функции триггеров напоминаний (Москва, как в приложении записи).
 * Использует Europe/Moscow в константе смещения (РФ без переходов на летнее время — фиксируем +3 UTC).
 */

const MSC_OFFSET_MS = 3 * 60 * 60 * 1000

/** ±22 мин: перекрывает «1 ч + минута» и пару промахов cron без триггера за 30–35 мин (текст «через час»). */
export const REMINDER_TOLERANCE_SEC = 22 * 60

const SEC_1H = 60 * 60
const SEC_24H = 24 * SEC_1H

/** TIME из PostgreSQL: "15:30:00", "9:05", возможен суффикс "+03" или "Z". */
export function normalizeSlotTimeString(raw: string): string {
  let s = String(raw).trim().split(/\s+/)[0] ?? ''
  if (/[+-]\d{2}:?\d{2}$/.test(s) || /[+-]\d{2}$/.test(s)) {
    const i = Math.max(s.lastIndexOf('+'), s.lastIndexOf('-'))
    if (i > 0 && i > s.indexOf(':')) s = s.slice(0, i).trim()
  }
  if (/[zZ]$/.test(s)) s = s.slice(0, -1).trim()

  const segs = s.split(':')
  const hh = Math.min(23, Math.max(0, parseInt(segs[0]?.replace(/\D/g, '') || '0', 10) || 0))
  const mm = Math.min(59, Math.max(0, parseInt(segs[1]?.replace(/\D/g, '') || '0', 10) || 0))
  const ss = Math.min(59, Math.max(0, parseInt(segs[2]?.replace(/\D/g, '') || '0', 10) || 0))
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`
}

/** YYYY-MM-DD в подпись для Telegram без сдвига из-за TZ парсера. */
export function formatSlotCalendarDateRu(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  const safe = Number.isFinite(y) && Number.isFinite(m) && Number.isFinite(d)
  if (!safe) return dateStr
  return new Date(Date.UTC(y, m - 1, d, 12, 0, 0)).toLocaleDateString('ru-RU', {
    weekday: 'short',
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  })
}

export function slotStartUtcMs(dateStr: string, timeStr: string): number {
  const [y, mo, d] = dateStr.split('-').map(Number)
  if (!Number.isFinite(y) || !Number.isFinite(mo) || !Number.isFinite(d)) return NaN
  const normTime = normalizeSlotTimeString(timeStr)
  const [hh, mm, ss] = normTime.split(':').map(Number)
  return Date.UTC(y, mo - 1, d, hh, mm, ss) - MSC_OFFSET_MS
}

/** Секунды до начала слота (может быть < 0 если слот уже прошёл). */
export function remainingUntilSlotSec(dateStr: string, timeStr: string, nowMs: number): number {
  const end = slotStartUtcMs(dateStr, timeStr)
  if (!Number.isFinite(end)) return -Infinity
  return (end - nowMs) / 1000
}

export function in1hReminderBand(remainingSec: number, toleranceSec = REMINDER_TOLERANCE_SEC): boolean {
  return (
    remainingSec > 0 &&
    remainingSec >= SEC_1H - toleranceSec &&
    remainingSec <= SEC_1H + toleranceSec
  )
}

export function in24hReminderBand(remainingSec: number, toleranceSec = REMINDER_TOLERANCE_SEC): boolean {
  return (
    remainingSec > 0 &&
    remainingSec >= SEC_24H - toleranceSec &&
    remainingSec <= SEC_24H + toleranceSec
  )
}
