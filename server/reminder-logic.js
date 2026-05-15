/**
 * Московские слоты (UTC+3). Держим в синхроне с supabase/functions/send-reminders/reminder-logic.ts
 */

const MSC_OFFSET_MS = 3 * 60 * 60 * 1000;

/** ±22 мин от «ровно через 1 ч / через 24 ч» */
const REMINDER_TOLERANCE_SEC = 22 * 60;

const SEC_1H = 60 * 60;
const SEC_24H = 24 * SEC_1H;

function normalizeSlotTimeString(raw) {
  let s = String(raw).trim().split(/\s+/)[0] ?? '';
  if (/[+-]\d{2}:?\d{2}$/.test(s) || /[+-]\d{2}$/.test(s)) {
    const i = Math.max(s.lastIndexOf('+'), s.lastIndexOf('-'));
    if (i > 0 && i > s.indexOf(':')) s = s.slice(0, i).trim();
  }
  if (/[zZ]$/.test(s)) s = s.slice(0, -1).trim();

  const segs = s.split(':');
  const hh = Math.min(23, Math.max(0, parseInt(segs[0]?.replace(/\D/g, '') || '0', 10) || 0));
  const mm = Math.min(59, Math.max(0, parseInt(segs[1]?.replace(/\D/g, '') || '0', 10) || 0));
  const ss = Math.min(59, Math.max(0, parseInt(segs[2]?.replace(/\D/g, '') || '0', 10) || 0));
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
}

function formatSlotCalendarDateRu(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const safe = Number.isFinite(y) && Number.isFinite(m) && Number.isFinite(d);
  if (!safe) return dateStr;
  return new Date(Date.UTC(y, m - 1, d, 12, 0, 0)).toLocaleDateString('ru-RU', {
    weekday: 'short',
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  });
}

function slotStartUtcMs(dateStr, timeStr) {
  const [y, mo, d] = dateStr.split('-').map(Number);
  if (!Number.isFinite(y) || !Number.isFinite(mo) || !Number.isFinite(d)) return NaN;
  const normTime = normalizeSlotTimeString(timeStr);
  const [hh, mm, ss] = normTime.split(':').map(Number);
  return Date.UTC(y, mo - 1, d, hh, mm, ss) - MSC_OFFSET_MS;
}

function remainingUntilSlotSec(dateStr, timeStr, nowMs) {
  const end = slotStartUtcMs(dateStr, timeStr);
  if (!Number.isFinite(end)) return -Infinity;
  return (end - nowMs) / 1000;
}

function in1hReminderBand(remainingSec, toleranceSec = REMINDER_TOLERANCE_SEC) {
  return (
    remainingSec > 0 &&
    remainingSec >= SEC_1H - toleranceSec &&
    remainingSec <= SEC_1H + toleranceSec
  );
}

function in24hReminderBand(remainingSec, toleranceSec = REMINDER_TOLERANCE_SEC) {
  return (
    remainingSec > 0 &&
    remainingSec >= SEC_24H - toleranceSec &&
    remainingSec <= SEC_24H + toleranceSec
  );
}

module.exports = {
  REMINDER_TOLERANCE_SEC,
  normalizeSlotTimeString,
  formatSlotCalendarDateRu,
  slotStartUtcMs,
  remainingUntilSlotSec,
  in1hReminderBand,
  in24hReminderBand,
};
