/** 金额：保留两位小数，PRD 要求避免四舍五入误差用 toFixed(2) */
export function formatMoney(amount: number): string {
  return `¥${Number(amount).toFixed(2)}`;
}

/** 时长：秒 → "XX 分 XX 秒" */
export function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  if (m > 0) return `${m} 分 ${s} 秒`;
  return `${s} 秒`;
}

/** 时长：秒 → "00:00:00"（用于页面中央实时显示） */
export function formatDurationHHMMSS(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}

/** 小时数（小数）→ "X小时X分"（用于设置页每日有效工时展示） */
export function formatHoursToChinese(hours: number): string {
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  if (m === 0) return `${h}小时0分`;
  return `${h}小时${m}分`;
}

/** 时长：毫秒 → "00:00:00.000"（秒表到毫秒，薅羊毛爽感） */
export function formatDurationHHMMSSWithMs(totalMs: number): string {
  const totalSec = totalMs / 1000;
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = Math.floor(totalSec % 60);
  const ms = Math.floor(totalMs % 1000);
  const pad = (n: number, len = 2) => String(n).padStart(len, '0');
  return `${pad(h)}:${pad(m)}:${pad(s)}.${pad(ms, 3)}`;
}
