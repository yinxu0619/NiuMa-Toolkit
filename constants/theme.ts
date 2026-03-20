/** 全应用统一浅色配色（不再支持深色/主题切换） */
export const COLORS = {
  primary: '#ea580c',
  primaryDark: '#c2410c',
  /** 浅底上的主文字 */
  text: '#0f172a',
  /** 主色/警示色按钮或色块上的文字 */
  onAccent: '#ffffff',
  gray: '#64748b',
  grayLight: '#94a3b8',
  background: '#f8fafc',
  backgroundLight: '#f1f5f9',
  card: '#ffffff',
  cardLight: '#e2e8f0',
  danger: '#dc2626',
  success: '#16a34a',
} as const;

export const DEFAULT_WORK_DAYS = 21.75;
export const DEFAULT_WORK_HOURS = 8;
