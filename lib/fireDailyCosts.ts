/**
 * 首页 / 统计页：从 FIRE 配置汇总每日社保、医保成本（无 UI）
 */
import type { FireConfig } from '@/types';
import { computeFireMetrics, parseSocialAvgAnnual } from '@/lib/fireCalculations';
import { computeMedicalMetrics } from '@/lib/fireMedicalCalculations';

export type FireDailyCosts = {
  dailySocial: number;
  dailyMedical: number;
  monthlySocial: number;
  monthlyMedical: number;
};

export function getFireDailyCosts(cfg: FireConfig, birthDate: string | null): FireDailyCosts {
  const pension = computeFireMetrics(cfg, birthDate);
  const medical = computeMedicalMetrics(cfg, birthDate);
  const socialOk = parseSocialAvgAnnual(cfg.socialAvgAnnual) > 0;
  return {
    dailySocial: socialOk ? pension.dailyPay : 0,
    dailyMedical: medical.dailyMedicalPay,
    monthlySocial: socialOk ? pension.monthlyPay : 0,
    monthlyMedical: medical.monthlyMedicalPay,
  };
}
