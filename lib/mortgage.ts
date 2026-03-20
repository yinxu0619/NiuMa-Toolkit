import type { MortgageConfig } from '@/types';

/** 等额本息：月供 */
export function monthlyPaymentEqualPayment(total: number, annualRate: number, years: number): number {
  const n = years * 12;
  const r = annualRate / 12;
  if (r === 0) return total / n;
  return total * r * Math.pow(1 + r, n) / (Math.pow(1 + r, n) - 1);
}

/** 等额本金：第 period 期月供（1-based） */
export function monthlyPaymentEqualPrincipal(total: number, annualRate: number, years: number, period: number): number {
  const n = years * 12;
  const principalPerMonth = total / n;
  const r = annualRate / 12;
  const remaining = total - principalPerMonth * (period - 1);
  return principalPerMonth + remaining * r;
}

/** 当前期数对应的月供（等额本息每期相同，等额本金按起始期数取） */
export function getMonthlyPayment(config: MortgageConfig): number {
  const { total, annualRate, years, type, startPeriod } = config;
  if (type === 'equal_payment') return monthlyPaymentEqualPayment(total, annualRate, years);
  return monthlyPaymentEqualPrincipal(total, annualRate, years, startPeriod);
}

/** 房贷日供 = 月供 ÷ 22（仅工作日，用于今日固定支出展示） */
export function getDailyPayment(config: MortgageConfig): number {
  return getMonthlyPayment(config) / 22;
}

/** 按还款日计算的「本周期」进度：周期总天数、已过天数、已摊金额、进度比例（0~1） */
export interface RepaymentProgress {
  monthlyPayment: number;
  periodStart: Date;
  periodEnd: Date;
  totalDays: number;
  elapsedDays: number;
  amountAccrued: number;
  progressRatio: number;
}

/**
 * 根据还款日（如 10 号）计算当前计息周期：上一还款日～本周期结束（下一还款日前一天）。
 * 月供按周期内天数均摊，到今天为止「已还」= 月供 × (已过天数 / 周期总天数)。
 * 未设置还款日时按「本月 1 号～月末」计算。
 */
export function getRepaymentProgress(config: MortgageConfig): RepaymentProgress | null {
  const monthly = getMonthlyPayment(config);
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  const d = now.getDate();
  let periodStart: Date;
  let periodEnd: Date;

  if (config.repaymentDay != null && config.repaymentDay >= 1 && config.repaymentDay <= 31) {
    const rd = config.repaymentDay;
    if (d >= rd) {
      periodStart = new Date(y, m, rd, 0, 0, 0, 0);
      periodEnd = new Date(y, m + 1, rd, 0, 0, 0, 0);
      periodEnd.setDate(periodEnd.getDate() - 1);
    } else {
      periodStart = new Date(y, m - 1, rd, 0, 0, 0, 0);
      periodEnd = new Date(y, m, rd, 0, 0, 0, 0);
      periodEnd.setDate(periodEnd.getDate() - 1);
    }
  } else {
    periodStart = new Date(y, m, 1, 0, 0, 0, 0);
    periodEnd = new Date(y, m + 1, 0, 23, 59, 59, 999);
  }

  const startDay = Math.floor(periodStart.getTime() / 86400000);
  const endDay = Math.floor(periodEnd.getTime() / 86400000);
  const todayDay = Math.floor(now.getTime() / 86400000);
  if (todayDay < startDay || todayDay > endDay) return null;

  const totalDays = endDay - startDay + 1;
  const elapsedDays = Math.min(totalDays, Math.max(0, todayDay - startDay + 1));
  const amountAccrued = monthly * (elapsedDays / totalDays);
  const progressRatio = elapsedDays / totalDays;

  return {
    monthlyPayment: monthly,
    periodStart,
    periodEnd,
    totalDays,
    elapsedDays,
    amountAccrued,
    progressRatio,
  };
}
