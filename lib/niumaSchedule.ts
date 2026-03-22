import type { NiumaConfig } from '@/types';
import { formatLocalDateKey } from '@/lib/today';

/** 本地周一 00:00 */
export function mondayOfWeek(d: Date): Date {
  const x = new Date(d);
  const day = x.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  x.setDate(x.getDate() + diff);
  x.setHours(0, 0, 0, 0);
  return x;
}

function weeksBetweenMondays(a: Date, b: Date): number {
  const ms = 7 * 24 * 3600 * 1000;
  return Math.round((mondayOfWeek(a).getTime() - mondayOfWeek(b).getTime()) / ms);
}

/** 大小周：当前自然周是否「大周」（周六需上班） */
export function isAlternateBigWeek(config: NiumaConfig, d: Date = new Date()): boolean {
  if (!config.alternateBigWeekMonday) return true;
  const anchor = new Date(config.alternateBigWeekMonday + 'T12:00:00');
  const w = weeksBetweenMondays(d, anchor);
  return w % 2 === 0;
}

/**
 * 按牛马排班，当天是否「上班」日（与法定假/请假无关，仅日历排班）。
 * 未开启或 standard → 周一～周五。
 */
export function isNiumaWorkday(d: Date, config: NiumaConfig): boolean {
  if (!config.enabled || config.mode === 'standard') {
    const wd = d.getDay();
    return wd >= 1 && wd <= 5;
  }
  const wd = d.getDay();
  switch (config.mode) {
    case '996_sat':
      return wd >= 1 && wd <= 6;
    case '996_sun':
      return wd === 0 || (wd >= 1 && wd <= 5);
    case 'alternate_weeks':
      if (wd >= 1 && wd <= 5) return true;
      if (wd === 0) return false;
      if (wd === 6) return isAlternateBigWeek(config, d);
      return false;
    case 'all_week':
      return true;
    default:
      return wd >= 1 && wd <= 5;
  }
}

/** 排班上的「休息日」（未含法定假表、请假） */
export function isNiumaRestDay(d: Date, config: NiumaConfig): boolean {
  if (!config.enabled || config.mode === 'standard') {
    const wd = d.getDay();
    return wd === 0 || wd === 6;
  }
  return !isNiumaWorkday(d, config);
}

/** 用于按天摊：在「爽摸」分支里，仅法定假/带薪假，或周一～周五（含调休上班日）才按日摊；纯周末不摊 */
export function isDaySpreadEligibleMonFri(d: Date): boolean {
  const wd = d.getDay();
  return wd >= 1 && wd <= 5;
}

/** 首页「纯周末」骚话：周六日且真的是排班休息、且非法定假无请假 */
export function isPureWeekendVibe(d: Date, config: NiumaConfig): boolean {
  const wd = d.getDay();
  if (wd !== 0 && wd !== 6) return false;
  return isNiumaRestDay(d, config);
}

/**
 * 下一工作日倒计时：跳过法定休、年假病假，并按牛马排班判断「是否上班」。
 */
export function isWorkdayForNextStart(
  d: Date,
  holidayDates: string[],
  leaveMarks: Record<string, string | undefined> | undefined,
  niuma?: NiumaConfig | null
): boolean {
  const key = formatLocalDateKey(d);
  if (holidayDates.includes(key)) return false;
  if (leaveMarks) {
    const lm = leaveMarks[key];
    if (lm === 'annual_leave' || lm === 'sick_leave') return false;
  }
  if (niuma?.enabled) {
    return isNiumaWorkday(d, niuma);
  }
  const day = d.getDay();
  return day >= 1 && day <= 5;
}
