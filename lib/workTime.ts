import type { TimeConfig } from '@/types';

/** "HH:mm" → 当日分钟数（0-1439） */
export function parseHHmm(s: string): number {
  const [h, m] = s.split(':').map(Number);
  if (isNaN(h) || isNaN(m)) return 0;
  return Math.max(0, Math.min(1439, h * 60 + m));
}

/** 两个 "HH:mm" 之间的分钟数（同一天内） */
export function minutesBetween(start: string, end: string): number {
  return parseHHmm(end) - parseHHmm(start);
}

/**
 * 每日有效工时（小时）
 * 有午休：(下班-上班)-(午休结束-午休开始)；不午休：下班-上班
 */
export function effectiveHoursPerDay(time: TimeConfig): number {
  const workMins = minutesBetween(time.workStart, time.workEnd);
  if (time.lunchEnabled === false) return workMins / 60;
  const lunchMins = minutesBetween(time.lunchStart, time.lunchEnd);
  return Math.max(0, workMins - lunchMins) / 60;
}

/**
 * 当前时刻处于：上班前 | 上班中 | 午休中 | 下班后（不午休时无 lunch）
 */
export type PeriodType = 'before_work' | 'working' | 'lunch' | 'after_work';

export function getCurrentPeriod(time: TimeConfig): PeriodType {
  const now = new Date();
  const mins = now.getHours() * 60 + now.getMinutes();
  const workStart = parseHHmm(time.workStart);
  const workEnd = parseHHmm(time.workEnd);
  if (mins < workStart) return 'before_work';
  if (mins >= workEnd) return 'after_work';
  if (time.lunchEnabled === false) return 'working';
  const lunchStart = parseHHmm(time.lunchStart);
  const lunchEnd = parseHHmm(time.lunchEnd);
  if (mins >= lunchStart && mins < lunchEnd) return 'lunch';
  return 'working';
}

/** 距上班开始的秒数（今日）；若已过上班点返回 null */
export function secondsToWorkStart(time: TimeConfig): number | null {
  const now = Date.now();
  const target = todayAtHHmm(time.workStart);
  if (now >= target) return null;
  return Math.floor((target - now) / 1000);
}

/** 距午休开始的分钟数（若已过则负数）；若已下班返回 null */
export function minutesToLunchStart(time: TimeConfig): number | null {
  const now = new Date();
  const mins = now.getHours() * 60 + now.getMinutes();
  const workEnd = parseHHmm(time.workEnd);
  if (mins >= workEnd) return null;
  return parseHHmm(time.lunchStart) - mins;
}

/** 距下班分钟数；若已下班返回 null */
export function minutesToWorkEnd(time: TimeConfig): number | null {
  const now = new Date();
  const mins = now.getHours() * 60 + now.getMinutes();
  const workEnd = parseHHmm(time.workEnd);
  if (mins >= workEnd) return null;
  return workEnd - mins;
}

/** 今日 HH:mm 对应的 Date 时间戳 */
function todayAtHHmm(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  const d = new Date();
  d.setHours(h ?? 0, m ?? 0, 0, 0);
  return d.getTime();
}

/** 距午休开始的秒数（含当前秒）；无午休或已过/已下班返回 null */
export function secondsToLunchStart(time: TimeConfig): number | null {
  if (time.lunchEnabled === false) return null;
  const now = Date.now();
  const target = todayAtHHmm(time.lunchStart);
  if (now >= target) return null;
  const workEnd = todayAtHHmm(time.workEnd);
  if (now >= workEnd) return null;
  return Math.floor((target - now) / 1000);
}

/** 距下班的秒数（含当前秒）；已下班返回 null */
export function secondsToWorkEnd(time: TimeConfig): number | null {
  const now = Date.now();
  const target = todayAtHHmm(time.workEnd);
  if (now >= target) return null;
  return Math.floor((target - now) / 1000);
}

/** 今日已上班秒数（用于统计页：按秒算已赚多少，午休时段不累计） */
export function workedSecondsToday(time: TimeConfig): number {
  const now = new Date();
  const nowSec = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();
  const workStartSec = parseHHmm(time.workStart) * 60;
  const workEndSec = parseHHmm(time.workEnd) * 60;
  const lunchStartSec = parseHHmm(time.lunchStart) * 60;
  const lunchEndSec = parseHHmm(time.lunchEnd) * 60;

  if (nowSec < workStartSec) return 0;
  if (nowSec >= workEndSec) {
    if (time.lunchEnabled === false) return workEndSec - workStartSec;
    return (workEndSec - workStartSec) - (lunchEndSec - lunchStartSec);
  }
  if (time.lunchEnabled === false) return nowSec - workStartSec;
  if (nowSec >= lunchStartSec && nowSec < lunchEndSec) return lunchStartSec - workStartSec;
  if (nowSec >= lunchEndSec) return (lunchStartSec - workStartSec) + (nowSec - lunchEndSec);
  return nowSec - workStartSec;
}
