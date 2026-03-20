import type { SalaryConfig, TimeConfig } from '@/types';
import { effectiveHoursPerDay } from '@/lib/workTime';

const DEFAULT_WORK_DAYS = 21.75;

/**
 * 时薪 = 月薪 ÷ 21.75 ÷ 每日有效工时
 * 每日有效工时由 TimeConfig 计算；(下班-上班)-(午休结束-午休开始)
 */
export function hourlyWageFromTime(salary: SalaryConfig, time: TimeConfig): number {
  if (!salary.monthly_salary || salary.monthly_salary <= 0) return 0;
  const effective = effectiveHoursPerDay(time);
  if (!effective) return 0;
  const days = salary.work_days ?? DEFAULT_WORK_DAYS;
  return salary.monthly_salary / days / effective;
}

/** 兼容旧：时薪 = 月薪 ÷ 月计薪天数 ÷ 日工作时长（无 TimeConfig 时用） */
export function hourlyWage(config: SalaryConfig): number {
  const { monthly_salary, work_days, work_hours, effective_hours_per_day } = config;
  if (!monthly_salary) return 0;
  const days = work_days ?? DEFAULT_WORK_DAYS;
  const hours = effective_hours_per_day ?? work_hours ?? 8;
  if (!hours) return 0;
  return monthly_salary / days / hours;
}

/** 秒薪 = 时薪 ÷ 3600 */
export function secondWage(config: SalaryConfig): number {
  return hourlyWage(config) / 3600;
}

/** 有时钟配置时优先用 workTime + 月薪/21.75/有效工时 */
export function secondWageWithTime(salary: SalaryConfig, time: TimeConfig | null): number {
  if (time) return hourlyWageFromTime(salary, time) / 3600;
  return secondWage(salary);
}

export function amountToHours(amount: number, salaryPerSecond: number): number {
  if (!salaryPerSecond) return 0;
  return amount / (salaryPerSecond * 3600);
}

export function getDefaultSalaryConfig(): SalaryConfig {
  return {
    monthly_salary: 0,
    work_days: DEFAULT_WORK_DAYS,
    work_hours: 8,
  };
}
