/**
 * 法定假日（中国）：内置兜底 + 联网同步 holiday-cn（含调休）
 */

import { loadHolidayDates, saveHolidayDates, setHolidaySyncEnabled } from '@/lib/storage';
import { formatLocalDateKey } from '@/lib/today';
import type { NiumaConfig } from '@/types';
import { isNiumaRestDay, isWorkdayForNextStart } from '@/lib/niumaSchedule';

interface HolidayItem {
  name: string;
  getDate: (year: number) => Date;
}

const HOLIDAYS: HolidayItem[] = [
  { name: '元旦', getDate: (y) => new Date(y, 0, 1) },
  { name: '春节', getDate: (y) => new Date(y, 1, 1) },
  { name: '清明', getDate: (y) => new Date(y, 3, 4) },
  { name: '劳动节', getDate: (y) => new Date(y, 4, 1) },
  { name: '端午', getDate: (y) => new Date(y, 5, 1) },
  { name: '中秋', getDate: (y) => new Date(y, 8, 15) },
  { name: '国庆', getDate: (y) => new Date(y, 9, 1) },
];

const HOLIDAY_CN_BASE = 'https://raw.githubusercontent.com/NateScarlet/holiday-cn/master';
const FETCH_TIMEOUT_MS = 10_000;
const RETRY_DELAY_MS = 1000;
const MAX_ATTEMPTS = 3; // 首次 + 重试 2 次

/**
 * 应用内嵌休息日（与 holiday-cn 一致：仅国务院公布的放假/调休休息日，不含普通周末）。
 * 来源：NateScarlet/holiday-cn 2026.json（与国务院放假通知一致）。
 * 新年份发布后可追加 BUNDLED_HOLIDAY_OFF_DAYS_BY_YEAR[2027] 等；未覆盖的年份走下方周末+近似兜底。
 */
const BUNDLED_HOLIDAY_OFF_DAYS_BY_YEAR: Record<number, readonly string[]> = {
  2026: [
    '2026-01-01',
    '2026-01-02',
    '2026-01-03',
    '2026-02-15',
    '2026-02-16',
    '2026-02-17',
    '2026-02-18',
    '2026-02-19',
    '2026-02-20',
    '2026-02-21',
    '2026-02-22',
    '2026-02-23',
    '2026-04-04',
    '2026-04-05',
    '2026-04-06',
    '2026-05-01',
    '2026-05-02',
    '2026-05-03',
    '2026-05-04',
    '2026-05-05',
    '2026-06-19',
    '2026-06-20',
    '2026-06-21',
    '2026-09-25',
    '2026-09-26',
    '2026-09-27',
    '2026-10-01',
    '2026-10-02',
    '2026-10-03',
    '2026-10-04',
    '2026-10-05',
    '2026-10-06',
    '2026-10-07',
  ],
};

function dateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * 内置兜底：当年 + 次年。
 * - 若某年在 BUNDLED_HOLIDAY_OFF_DAYS_BY_YEAR 中有数据，仅用该精确表（与联网 holiday-cn 一致，含调休）。
 * - 否则用该年的周末 + 法定节假日近似单日（旧逻辑）。
 */
export function getBuiltinHolidayDateStrings(): string[] {
  const year = new Date().getFullYear();
  const set = new Set<string>();
  for (const y of [year, year + 1]) {
    const bundled = BUNDLED_HOLIDAY_OFF_DAYS_BY_YEAR[y];
    if (bundled?.length) {
      for (const dateStr of bundled) set.add(dateStr);
      continue;
    }
    for (const h of HOLIDAYS) {
      set.add(dateKey(h.getDate(y)));
    }
    const end = new Date(y, 11, 31);
    for (let d = new Date(y, 0, 1); d <= end; d.setDate(d.getDate() + 1)) {
      const day = d.getDay();
      if (day === 0 || day === 6) set.add(dateKey(new Date(d)));
    }
  }
  return [...set].sort();
}

/**
 * 首次启动或本地尚无假日表时，写入内置数据并启用「法定假日」展示（与手动同步失败时的兜底同源）。
 * 用户仍可在设置里联网同步以更新全年/次年数据。
 */
export async function seedHolidayDatesIfEmpty(): Promise<void> {
  try {
    const existing = await loadHolidayDates();
    if (existing.length > 0) return;
    await saveHolidayDates(getBuiltinHolidayDateStrings());
    await setHolidaySyncEnabled(true);
  } catch (e) {
    console.warn('[holidays] seedHolidayDatesIfEmpty failed', e);
  }
}

async function fetchOneYearJson(year: number, signal: AbortSignal): Promise<string[]> {
  const url = `${HOLIDAY_CN_BASE}/${year}.json`;
  const res = await fetch(url, {
    method: 'GET',
    signal,
    headers: {
      Accept: 'application/json',
      'Accept-Charset': 'utf-8',
    },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  let data: unknown;
  try {
    data = await res.json();
  } catch {
    throw new Error('JSON parse failed');
  }
  const days = (data as { days?: Array<{ date?: string; isOffDay?: boolean }> })?.days;
  if (!Array.isArray(days)) throw new Error('Invalid days array');
  const out: string[] = [];
  for (const item of days) {
    if (item?.isOffDay === true && typeof item.date === 'string') out.push(item.date);
  }
  return out;
}

/** 单次拉取两年数据（每年独立超时），任一年失败不阻断另一年 */
async function fetchRemoteHolidayDatesOnce(): Promise<string[]> {
  const year = new Date().getFullYear();
  const all: string[] = [];
  for (const y of [year, year + 1]) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    try {
      const part = await fetchOneYearJson(y, controller.signal);
      all.push(...part);
    } catch {
      // 单年失败继续下一年
    } finally {
      clearTimeout(timer);
    }
  }
  const merged = [...new Set(all)].sort();
  if (merged.length === 0) throw new Error('Empty holiday list');
  return merged;
}

export type HolidayFetchResult = {
  dates: string[];
  /** true：来自 holiday-cn；false：已降级为内置数据 */
  fromRemote: boolean;
};

/**
 * 带重试、超时、解析保护；完全失败时返回内置数据，不抛错（调用方永不因假日接口崩溃）
 */
export async function fetchHolidayDatesWithFallback(): Promise<HolidayFetchResult> {
  let lastErr: unknown;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    try {
      const dates = await fetchRemoteHolidayDatesOnce();
      return { dates, fromRemote: true };
    } catch (e) {
      lastErr = e;
      if (attempt < MAX_ATTEMPTS - 1) await sleep(RETRY_DELAY_MS);
    }
  }
  console.warn('[holidays] remote fetch failed after retries, using builtin', lastErr);
  return { dates: getBuiltinHolidayDateStrings(), fromRemote: false };
}

/** @deprecated 请使用 fetchHolidayDatesWithFallback；保留兼容旧调用 */
export async function fetchHolidayDatesFromRemote(): Promise<string[]> {
  const r = await fetchHolidayDatesWithFallback();
  return r.dates;
}

export function isTodayHoliday(storedDates: string[]): boolean {
  const d = new Date();
  const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  return storedDates.length > 0 && storedDates.includes(today);
}

/**
 * 今日是否「不用按工作日打卡」：周末（或牛马排班下的休息日）、法定休息日（已同步）、日历年假/病假。
 * 注：未同步假日表时仅周末+请假；补班周末需精确日历，当前按周末一律休息。
 */
export function isRestDay(
  d: Date,
  holidaySyncEnabled: boolean,
  holidayDates: string[],
  leaveMarks: Record<string, string | undefined>,
  niuma?: NiumaConfig | null
): boolean {
  const key = formatLocalDateKey(d);
  if (holidaySyncEnabled && holidayDates.length > 0 && holidayDates.includes(key)) return true;
  const lm = leaveMarks[key];
  if (lm === 'annual_leave' || lm === 'sick_leave') return true;
  if (niuma?.enabled) {
    return isNiumaRestDay(d, niuma);
  }
  const wd = d.getDay();
  return wd === 0 || wd === 6;
}

export function getNextHolidayFromStored(storedDates: string[]): { name: string; daysLeft: number } | null {
  const d = new Date();
  const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const next = storedDates.find((x) => x >= today);
  if (!next) return null;
  const a = new Date(next + 'T00:00:00').getTime();
  const b = new Date(today + 'T00:00:00').getTime();
  const daysLeft = Math.ceil((a - b) / (24 * 60 * 60 * 1000));
  return { name: next === today ? '今日' : '下一休息日', daysLeft };
}

/**
 * 下一个「工作日」的上班时刻（本地时区）。从明天起找，跳过周末、法定休息日、年假/病假标记日。
 */
export function getNextWorkdayStart(
  workStart: string,
  holidayDates: string[],
  leaveMarks?: Record<string, string | undefined>,
  niuma?: NiumaConfig | null
): Date {
  const [h, m] = workStart.split(':').map(Number);
  const hour = isNaN(h) ? 9 : h;
  const min = isNaN(m) ? 0 : m;
  const now = new Date();
  for (let offset = 1; offset <= 366; offset++) {
    const d = new Date(now);
    d.setDate(d.getDate() + offset);
    if (!isWorkdayForNextStart(d, holidayDates, leaveMarks, niuma)) continue;
    d.setHours(hour, min, 0, 0);
    return d;
  }
  const fallback = new Date(now);
  fallback.setDate(fallback.getDate() + 1);
  fallback.setHours(hour, min, 0, 0);
  return fallback;
}

export function secondsFromMidnightToday(): number {
  const now = new Date();
  return now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();
}

export function getNextHoliday(): { name: string; daysLeft: number } | null {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const year = today.getFullYear();
  let next: { name: string; date: Date } | null = null;
  for (const h of HOLIDAYS) {
    for (const y of [year, year + 1]) {
      const d = new Date(h.getDate(y));
      d.setHours(0, 0, 0, 0);
      if (d >= today) {
        if (!next || d < next.date) next = { name: h.name, date: d };
        break;
      }
    }
  }
  if (!next) return null;
  const daysLeft = Math.ceil((next.date.getTime() - today.getTime()) / (24 * 60 * 60 * 1000));
  return { name: next.name, daysLeft };
}
