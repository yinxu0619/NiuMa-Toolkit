/**
 * 退休倒计时：默认 60 岁退休，根据出生日计算
 */

export function getRetirementCountdown(birthDate: string | null, retireAge = 60): { years: number; months: number; days: number; seconds: number } | null {
  if (!birthDate || !/^\d{4}-\d{2}-\d{2}$/.test(birthDate)) return null;
  const [y, m, d] = birthDate.split('-').map(Number);
  const retire = new Date(y + retireAge, m - 1, d, 0, 0, 0, 0);
  const now = new Date();
  if (now >= retire) return { years: 0, months: 0, days: 0, seconds: 0 };
  const totalSec = Math.floor((retire.getTime() - now.getTime()) / 1000);
  const seconds = totalSec % 60;
  const daysFromSec = Math.floor(totalSec / 86400);
  const months = Math.floor(daysFromSec / 30) % 12;
  const years = Math.floor(daysFromSec / 365.25);
  const days = Math.floor(daysFromSec % 30);
  return { years, months, days, seconds };
}

/** 剩余总秒数（用于每秒递减展示） */
export function getRetirementTotalSeconds(birthDate: string | null, retireAge = 60): number | null {
  if (!birthDate || !/^\d{4}-\d{2}-\d{2}$/.test(birthDate)) return null;
  const [y, m, d] = birthDate.split('-').map(Number);
  const retire = new Date(y + retireAge, m - 1, d, 0, 0, 0, 0);
  const now = Date.now();
  if (now >= retire.getTime()) return 0;
  return Math.floor((retire.getTime() - now) / 1000);
}

export function formatRetirementCountdown(birthDate: string | null, retireAge = 60): string {
  const r = getRetirementCountdown(birthDate, retireAge);
  if (r == null) return '—';
  if (r.years === 0 && r.months === 0 && r.days === 0 && r.seconds === 0) return '已退休';
  return `${r.years} 年 ${r.months} 月 ${r.days} 天 ${r.seconds} 秒`;
}

/** 从总秒数格式化为 年 月 天 秒（用于实时倒计时） */
export function formatRetirementFromSeconds(totalSeconds: number): string {
  if (totalSeconds <= 0) return '已退休';
  const sec = totalSeconds % 60;
  const day = Math.floor(totalSeconds / 86400) % 30;
  const month = Math.floor(totalSeconds / (86400 * 30)) % 12;
  const year = Math.floor(totalSeconds / (86400 * 365.25));
  const parts: string[] = [];
  if (year > 0) parts.push(`${year} 年`);
  if (month > 0) parts.push(`${month} 月`);
  if (day > 0) parts.push(`${day} 天`);
  parts.push(`${sec} 秒`);
  return parts.join(' ');
}
