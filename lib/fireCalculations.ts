/**
 * FIRE 社保测算：基础养老金（加权平均缴费指数）+ 个人账户养老金（历史余额 + 未来按未来基数×8%）
 */
import { getRetirementTotalSeconds } from '@/lib/retirement';
import type { FireConfig, FirePaymentType, FutureContributionSegment } from '@/types';

export const FIRE_MIN_MONTHS = 15 * 12;
export const FIRE_RETIRE_AGE_MIN = 50;
export const FIRE_RETIRE_AGE_MAX = 70;

/** 计发月数（60 岁退休） */
export const PENSION_DIVISOR_MONTHS = 139;

/** 历史基数比例 60%～300% */
export const HISTORICAL_BASE_RATIO_MIN = 60;
export const HISTORICAL_BASE_RATIO_MAX = 300;
/** 未来基数比例 0%～300%（0%= 停缴） */
export const FUTURE_BASE_RATIO_MIN = 0;
export const FUTURE_BASE_RATIO_MAX = 300;

export function parseSocialAvgAnnual(s: string): number {
  const n = parseFloat(String(s).replace(/,/g, '').trim());
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/** 个人账户已缴余额（元），支持小数 */
export function parsePersonalAccountBalance(s: string): number {
  const n = parseFloat(String(s).replace(/,/g, '').trim());
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

export function clampRetireAge(age: number): number {
  return Math.min(FIRE_RETIRE_AGE_MAX, Math.max(FIRE_RETIRE_AGE_MIN, Math.round(age)));
}

export function clampHistoricalBaseRatioPercent(n: number): number {
  return Math.min(HISTORICAL_BASE_RATIO_MAX, Math.max(HISTORICAL_BASE_RATIO_MIN, Math.round(n)));
}

export function clampFutureBaseRatioPercent(n: number): number {
  return Math.min(FUTURE_BASE_RATIO_MAX, Math.max(FUTURE_BASE_RATIO_MIN, Math.round(n)));
}

/**
 * 将用户输入的未来分段归一化到「距退休整月数」：不足补一段，超出从后截断。
 */
export function normalizeFutureSegmentsForMonths(
  segments: FutureContributionSegment[],
  monthsFuture: number,
  fallbackRatio: number
): FutureContributionSegment[] {
  if (monthsFuture <= 0) return [];
  const fb = clampFutureBaseRatioPercent(fallbackRatio);
  const cleaned = (segments ?? [])
    .map((s) => ({
      months: Math.max(0, Math.floor(Number(s.months) || 0)),
      baseRatioPercent: clampFutureBaseRatioPercent(Number(s.baseRatioPercent) || 0),
    }))
    .filter((s) => s.months > 0);

  let sum = cleaned.reduce((a, s) => a + s.months, 0);
  if (sum === 0) {
    return [{ months: monthsFuture, baseRatioPercent: fb }];
  }
  if (sum < monthsFuture) {
    const last = cleaned[cleaned.length - 1];
    cleaned.push({ months: monthsFuture - sum, baseRatioPercent: last.baseRatioPercent });
  } else if (sum > monthsFuture) {
    const out: FutureContributionSegment[] = [];
    let rem = monthsFuture;
    for (const s of cleaned) {
      if (rem <= 0) break;
      const take = Math.min(s.months, rem);
      if (take > 0) out.push({ months: take, baseRatioPercent: s.baseRatioPercent });
      rem -= take;
    }
    return out;
  }
  return cleaned;
}

/** 未来各段加权平均基数比例（用于停缴判断、医保口径等） */
export function effectiveWeightedFuturePensionRatioPercent(
  cfg: FireConfig,
  monthsFuture: number
): number {
  const single = cfg.futureBaseRatioPercent ?? cfg.baseRatioPercent;
  if (!cfg.futureSegmentsEnabled || !(cfg.futureSegments?.length)) {
    return clampFutureBaseRatioPercent(single);
  }
  const segs = normalizeFutureSegmentsForMonths(cfg.futureSegments, monthsFuture, single);
  const sumM = segs.reduce((a, s) => a + s.months, 0);
  if (sumM <= 0) return 0;
  return segs.reduce((a, s) => a + s.months * s.baseRatioPercent, 0) / sumM;
}

function weightedAverageContributionIndexFromConfig(
  paidTotalMonths: number,
  monthsFuture: number,
  histRatio: number,
  cfg: FireConfig
): number {
  const histYears = paidTotalMonths / 12;
  const futYears = monthsFuture / 12;
  const denom = histYears + futYears;
  if (denom <= 0) return 0;
  const hi = histRatio / 100;
  let futPart = 0;
  const single = cfg.futureBaseRatioPercent ?? cfg.baseRatioPercent;
  if (cfg.futureSegmentsEnabled && cfg.futureSegments?.length) {
    const segs = normalizeFutureSegmentsForMonths(cfg.futureSegments, monthsFuture, single);
    for (const s of segs) {
      futPart += (s.months / 12) * (s.baseRatioPercent / 100);
    }
  } else {
    const fr = clampFutureBaseRatioPercent(single);
    futPart = futYears * (fr / 100);
  }
  return (histYears * hi + futPart) / denom;
}

function personalAccountTotalAtRetireFromConfig(
  socialAvgAnnual: number,
  cfg: FireConfig,
  existingBalance: number,
  monthsFuture: number
): number {
  if (socialAvgAnnual <= 0) return Math.max(0, existingBalance);
  const single = cfg.futureBaseRatioPercent ?? cfg.baseRatioPercent;
  if (!cfg.futureSegmentsEnabled || !cfg.futureSegments?.length) {
    const fr = clampFutureBaseRatioPercent(single);
    return personalAccountTotalAtRetire(
      socialAvgAnnual,
      fr,
      cfg.paymentType,
      existingBalance,
      monthsFuture
    );
  }
  const segs = normalizeFutureSegmentsForMonths(cfg.futureSegments, monthsFuture, single);
  let sum = Math.max(0, existingBalance);
  for (const s of segs) {
    const m = monthlyPersonalAccountContribution(socialAvgAnnual, s.baseRatioPercent, cfg.paymentType);
    sum += m * s.months;
  }
  return sum;
}

function futureMonthlyPensionPaymentWeighted(
  socialAvgAnnual: number,
  cfg: FireConfig,
  monthsFuture: number
): number {
  if (socialAvgAnnual <= 0 || monthsFuture <= 0) return 0;
  const single = cfg.futureBaseRatioPercent ?? cfg.baseRatioPercent;
  if (!cfg.futureSegmentsEnabled || !cfg.futureSegments?.length) {
    const base = monthlyContributionBase(socialAvgAnnual, clampFutureBaseRatioPercent(single));
    return monthlySocialPayment(base, cfg.paymentType);
  }
  const segs = normalizeFutureSegmentsForMonths(cfg.futureSegments, monthsFuture, single);
  let paySum = 0;
  let mSum = 0;
  for (const s of segs) {
    const base = monthlyContributionBase(socialAvgAnnual, s.baseRatioPercent);
    paySum += monthlySocialPayment(base, cfg.paymentType) * s.months;
    mSum += s.months;
  }
  return mSum > 0 ? paySum / mSum : 0;
}

function futurePensionTotalContributionSum(
  socialAvgAnnual: number,
  cfg: FireConfig,
  monthsFuture: number
): number {
  if (socialAvgAnnual <= 0 || monthsFuture <= 0) return 0;
  const single = cfg.futureBaseRatioPercent ?? cfg.baseRatioPercent;
  if (!cfg.futureSegmentsEnabled || !cfg.futureSegments?.length) {
    const base = monthlyContributionBase(socialAvgAnnual, clampFutureBaseRatioPercent(single));
    const mp = monthlySocialPayment(base, cfg.paymentType);
    return mp * monthsFuture;
  }
  const segs = normalizeFutureSegmentsForMonths(cfg.futureSegments, monthsFuture, single);
  let total = 0;
  for (const s of segs) {
    const base = monthlyContributionBase(socialAvgAnnual, s.baseRatioPercent);
    total += monthlySocialPayment(base, cfg.paymentType) * s.months;
  }
  return total;
}

/** 已缴总月数 */
export function totalPaidMonths(cfg: Pick<FireConfig, 'paidYears' | 'paidMonths'>): number {
  const m = Math.min(11, Math.max(0, Math.floor(cfg.paidMonths)));
  const y = Math.max(0, Math.floor(cfg.paidYears));
  return y * 12 + m;
}

/** 距最低 15 年还差多少月 */
export function monthsUntilFifteenYear(cfg: Pick<FireConfig, 'paidYears' | 'paidMonths'>): number {
  const paid = totalPaidMonths(cfg);
  return Math.max(0, FIRE_MIN_MONTHS - paid);
}

/** 缴费基数（元/月）= 社平年 ÷ 12 × 比例% */
export function monthlyContributionBase(socialAvgAnnual: number, baseRatioPercent: number): number {
  const monthAvg = socialAvgAnnual / 12;
  return monthAvg * (baseRatioPercent / 100);
}

/**
 * 加权平均缴费指数 = (历史已缴年限×历史指数 + 未来待缴年限×未来指数) ÷ 总年限
 * 指数 = 基数比例/100（如 300% → 3.0）
 */
export function weightedAverageContributionIndex(
  paidTotalMonths: number,
  monthsFuture: number,
  historicalBaseRatioPercent: number,
  futureBaseRatioPercent: number
): number {
  const histYears = paidTotalMonths / 12;
  const futYears = monthsFuture / 12;
  const denom = histYears + futYears;
  if (denom <= 0) return 0;
  const hi = historicalBaseRatioPercent / 100;
  const fi = futureBaseRatioPercent / 100;
  return (histYears * hi + futYears * fi) / denom;
}

/**
 * 基础养老金（月）= 退休时当地社平工资（月）× (1 + 加权平均缴费指数) ÷ 2 × 总缴费年限 × 1%
 * 社平为年社平时：月社平 = 年社平 ÷ 12
 */
export function basicPensionMonthlyWeighted(
  socialAvgAnnual: number,
  weightedIndex: number,
  totalContributionYears: number
): number {
  if (socialAvgAnnual <= 0 || totalContributionYears <= 0) return 0;
  const monthlyAvg = socialAvgAnnual / 12;
  const years = Math.min(40, Math.max(0, totalContributionYears));
  return (monthlyAvg * (1 + weightedIndex)) / 2 * years * 0.01;
}

/** 每月进入个人账户金额（按「未来」缴费基数 × 8%，灵活/职工进账规则一致） */
export function monthlyPersonalAccountContribution(
  socialAvgAnnual: number,
  futureBaseRatioPercent: number,
  _paymentType: FirePaymentType
): number {
  if (socialAvgAnnual <= 0 || futureBaseRatioPercent <= 0) return 0;
  const base = monthlyContributionBase(socialAvgAnnual, futureBaseRatioPercent);
  return base * 0.08;
}

/**
 * 未来每月养老缴费（个人承担）= 月社平 × 未来基数比例 × 缴费比例
 * 在职 8%，灵活就业 20%
 */
export function monthlySocialPayment(
  contributionBaseMonthly: number,
  paymentType: FirePaymentType
): number {
  if (contributionBaseMonthly <= 0) return 0;
  return paymentType === 'flexible' ? contributionBaseMonthly * 0.2 : contributionBaseMonthly * 0.08;
}

/** 剩余需缴费用（仅补足 15 年部分），按未来基数估算 */
export function remainingContributionCost(
  cfg: FireConfig,
  socialAvgAnnual: number
): { needMonths: number; monthlyPay: number; totalRemaining: number } {
  const needMonths = monthsUntilFifteenYear(cfg);
  const futureRatio = cfg.futureBaseRatioPercent ?? cfg.baseRatioPercent;
  const base = monthlyContributionBase(socialAvgAnnual, futureRatio);
  const monthlyPay = monthlySocialPayment(base, cfg.paymentType);
  return {
    needMonths,
    monthlyPay,
    totalRemaining: needMonths * monthlyPay,
  };
}

/** 每日社保成本 */
export function dailySocialCost(monthlyPay: number): number {
  return monthlyPay / 30;
}

/**
 * 从今日到「目标退休年龄」当日，剩余整月数（用于未来个人账户进账）
 */
export function monthsFromNowToRetirement(birthDate: string | null, targetRetireAge: number): number {
  if (!birthDate || !/^\d{4}-\d{2}-\d{2}$/.test(birthDate)) return 0;
  const [y, m, d] = birthDate.split('-').map(Number);
  const retire = new Date(y + clampRetireAge(targetRetireAge), m - 1, d);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  retire.setHours(0, 0, 0, 0);
  if (retire.getTime() <= now.getTime()) return 0;
  let months =
    (retire.getFullYear() - now.getFullYear()) * 12 + (retire.getMonth() - now.getMonth());
  if (retire.getDate() < now.getDate()) months -= 1;
  return Math.max(0, months);
}

/** 当前周岁（用于展示） */
export function getCurrentAgeYears(birthDate: string | null): number | null {
  if (!birthDate || !/^\d{4}-\d{2}-\d{2}$/.test(birthDate)) return null;
  const [y, m, d] = birthDate.split('-').map(Number);
  const birth = new Date(y, m - 1, d);
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  const md = now.getMonth() - birth.getMonth();
  if (md < 0 || (md === 0 && now.getDate() < birth.getDate())) age -= 1;
  return Math.max(0, age);
}

/** 退休时个人账户储存额 = 已缴余额 + 月社平×未来基数×8%×未来月数 */
export function personalAccountTotalAtRetire(
  socialAvgAnnual: number,
  futureBaseRatioPercent: number,
  paymentType: FirePaymentType,
  existingBalance: number,
  monthsFutureContribution: number
): number {
  if (socialAvgAnnual <= 0) return Math.max(0, existingBalance);
  const monthlyInto = monthlyPersonalAccountContribution(
    socialAvgAnnual,
    futureBaseRatioPercent,
    paymentType
  );
  return Math.max(0, existingBalance) + monthlyInto * Math.max(0, monthsFutureContribution);
}

export function personalPensionMonthly(
  socialAvgAnnual: number,
  futureBaseRatioPercent: number,
  paymentType: FirePaymentType,
  existingBalance: number,
  monthsFutureContribution: number
): number {
  if (socialAvgAnnual <= 0) return 0;
  const totalBalance = personalAccountTotalAtRetire(
    socialAvgAnnual,
    futureBaseRatioPercent,
    paymentType,
    existingBalance,
    monthsFutureContribution
  );
  return totalBalance / PENSION_DIVISOR_MONTHS;
}

/**
 * 「老子不干了」速算：辞职后以灵活就业身份、最低 60% 基数缴养老，选择职工 or 居民医保。
 * 算出每月/每日总成本 + 退休后每月养老金。
 */
export type QuitFireResult = {
  /** 灵活就业 60% 养老月缴 */
  monthlyPension: number;
  /** 月医保费 */
  monthlyMedical: number;
  /** 月合计 */
  monthlyTotal: number;
  /** 日合计（÷30） */
  dailyTotal: number;
  /** 退休后月养老金 */
  retireMonthlyPension: number;
  /** 基础 + 个账拆分 */
  retireBasic: number;
  retirePersonal: number;
  /** 加权指数 */
  weightedIndex: number;
  /** 距退休月数 */
  monthsToRetire: number;
};

/**
 * @param monthlyMedicalPremium 由调用方传入（避免循环依赖 fireMedicalCalculations）
 */
export function computeQuitFireResult(
  cfg: FireConfig,
  birthDate: string | null,
  monthlyMedicalPremium: number,
): QuitFireResult {
  const social = parseSocialAvgAnnual(cfg.socialAvgAnnual);
  const existingPersonal = parsePersonalAccountBalance(cfg.personalAccountBalance ?? '0');
  const histRatio = cfg.historicalBaseRatioPercent ?? cfg.baseRatioPercent;
  const futRatio = 60;
  const paidM = totalPaidMonths(cfg);
  const mToRetire = monthsFromNowToRetirement(birthDate, cfg.targetRetireAge);

  const wi = weightedAverageContributionIndex(paidM, mToRetire, histRatio, futRatio);
  const totalYears = Math.min(40, (paidM + mToRetire) / 12);

  const base60 = monthlyContributionBase(social, futRatio);
  const monthlyPension = social > 0 ? monthlySocialPayment(base60, 'flexible') : 0;

  const monthlyTotal = monthlyPension + monthlyMedicalPremium;
  const dailyTotal = monthlyTotal / 30;

  const retireBasic = social > 0 ? basicPensionMonthlyWeighted(social, wi, totalYears) : 0;
  const totalAtRetire = personalAccountTotalAtRetire(social, futRatio, 'flexible', existingPersonal, mToRetire);
  const retirePersonal = totalAtRetire / PENSION_DIVISOR_MONTHS;

  return {
    monthlyPension,
    monthlyMedical: monthlyMedicalPremium,
    monthlyTotal,
    dailyTotal,
    retireMonthlyPension: Math.max(0, retireBasic + retirePersonal),
    retireBasic,
    retirePersonal,
    weightedIndex: wi,
    monthsToRetire: mToRetire,
  };
}

export type FireComputed = {
  paidTotalMonths: number;
  needMonthsFor15: number;
  fifteenYearMet: boolean;
  monthlyPay: number;
  dailyPay: number;
  remainingCostFor15: number;
  /** 月养老金合计 */
  estimatedMonthlyPension: number;
  basicPensionMonthly: number;
  personalPensionMonthly: number;
  /** 加权平均缴费指数（如 1.20 表示折合平均约 120% 社平） */
  weightedAverageContributionIndex: number;
  /** 个账已缴（元），与输入一致 */
  personalAccountPaidYuan: number;
  /** 预计退休时个账总额（元） */
  personalAccountTotalAtRetireYuan: number;
  /** 至退休按当前未来基数估算的养老总缴费（元，纯养老不含医保） */
  futurePensionTotalContributionEstimate: number;
  /**
   * 按「历史平均缴费基数」折算的每月养老缴费（元，纯养老不含医保），仅展示用；
   * 在职 8%、灵活就业 20%，与过去实际缴费口径一致。
   */
  historicalMonthlySocialPayYuan: number;
  /** 未来基数是否为 0%（FIRE 停缴），用于 UI 强制零成本展示 */
  futureBaseIsFireStop: boolean;
  /** 已启用未来分段（加权计算） */
  futureSegmentsMode: boolean;
  fireSecondsRemaining: number | null;
};

export function computeFireMetrics(cfg: FireConfig, birthDate: string | null): FireComputed {
  const social = parseSocialAvgAnnual(cfg.socialAvgAnnual);
  const existingPersonal = parsePersonalAccountBalance(cfg.personalAccountBalance ?? '0');
  const histRatio = cfg.historicalBaseRatioPercent ?? cfg.baseRatioPercent;

  const paidTotalMonths = totalPaidMonths(cfg);
  const monthsFuture = monthsFromNowToRetirement(birthDate, cfg.targetRetireAge);
  const weightedIndex = weightedAverageContributionIndexFromConfig(
    paidTotalMonths,
    monthsFuture,
    histRatio,
    cfg
  );
  const totalMonthsAtRetire = paidTotalMonths + monthsFuture;
  const totalContributionYears = Math.min(40, totalMonthsAtRetire / 12);

  const effectiveFutureRatio = effectiveWeightedFuturePensionRatioPercent(cfg, monthsFuture);
  const futureBaseIsFireStop = effectiveFutureRatio <= 0;
  const futureSegmentsMode = Boolean(cfg.futureSegmentsEnabled && cfg.futureSegments?.length);

  if (social <= 0) {
    const needMonthsFor15 = monthsUntilFifteenYear(cfg);
    return {
      paidTotalMonths,
      needMonthsFor15,
      fifteenYearMet: paidTotalMonths >= FIRE_MIN_MONTHS,
      monthlyPay: 0,
      dailyPay: 0,
      remainingCostFor15: 0,
      estimatedMonthlyPension: 0,
      basicPensionMonthly: 0,
      personalPensionMonthly: 0,
      weightedAverageContributionIndex: weightedIndex,
      personalAccountPaidYuan: existingPersonal,
      personalAccountTotalAtRetireYuan: existingPersonal,
      futurePensionTotalContributionEstimate: 0,
      historicalMonthlySocialPayYuan: 0,
      futureBaseIsFireStop,
      futureSegmentsMode,
      fireSecondsRemaining: getRetirementTotalSeconds(birthDate, clampRetireAge(cfg.targetRetireAge)),
    };
  }

  const histBaseMonthly = monthlyContributionBase(social, histRatio);
  const historicalMonthlySocialPayYuan = monthlySocialPayment(histBaseMonthly, cfg.paymentType);

  let monthlyPay = futureMonthlyPensionPaymentWeighted(social, cfg, monthsFuture);
  if (futureBaseIsFireStop) monthlyPay = 0;

  const needMonthsFor15 = monthsUntilFifteenYear(cfg);
  const totalRemaining = needMonthsFor15 * monthlyPay;

  const futurePensionTotalContributionEstimate = futureBaseIsFireStop
    ? 0
    : futurePensionTotalContributionSum(social, cfg, monthsFuture);

  const basic = basicPensionMonthlyWeighted(social, weightedIndex, totalContributionYears);
  const totalAtRetire = personalAccountTotalAtRetireFromConfig(social, cfg, existingPersonal, monthsFuture);
  const personal = totalAtRetire / PENSION_DIVISOR_MONTHS;
  const estimatedMonthlyPension = Math.max(0, basic + personal);

  return {
    paidTotalMonths,
    needMonthsFor15,
    fifteenYearMet: paidTotalMonths >= FIRE_MIN_MONTHS,
    monthlyPay,
    dailyPay: dailySocialCost(monthlyPay),
    remainingCostFor15: totalRemaining,
    estimatedMonthlyPension,
    basicPensionMonthly: basic,
    personalPensionMonthly: personal,
    weightedAverageContributionIndex: weightedIndex,
    personalAccountPaidYuan: existingPersonal,
    personalAccountTotalAtRetireYuan: totalAtRetire,
    futurePensionTotalContributionEstimate,
    historicalMonthlySocialPayYuan,
    futureBaseIsFireStop,
    futureSegmentsMode,
    fireSecondsRemaining: getRetirementTotalSeconds(birthDate, clampRetireAge(cfg.targetRetireAge)),
  };
}
