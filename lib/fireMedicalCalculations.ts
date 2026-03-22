/**
 * FIRE 医保测算：与养老分开；参保地系数见 medicalRegionCoefficients
 */
import type { FireConfig, FirePaymentType } from '@/types';
import {
  monthlyContributionBase,
  parseSocialAvgAnnual,
  monthsFromNowToRetirement,
  clampRetireAge,
  clampFutureBaseRatioPercent,
  normalizeFutureSegmentsForMonths,
  effectiveWeightedFuturePensionRatioPercent,
} from '@/lib/fireCalculations';
import {
  getMedicalRegionCoeff,
  getRequiredRetireYearsForGender,
  type MedicalRegionCoeff,
} from '@/lib/medicalRegionCoefficients';

export function parseMedicalRetireRequiredYears(s: string): number {
  const n = parseFloat(String(s).replace(/,/g, '').trim());
  if (!Number.isFinite(n) || n <= 0) return 25;
  return Math.min(50, Math.max(1, Math.round(n)));
}

export function parseResidentMedicalAnnual(s: string): number {
  const n = parseFloat(String(s).replace(/,/g, '').trim());
  return Number.isFinite(n) && n >= 0 ? n : 380;
}

/** 医保已缴总月数 */
export function totalMedicalPaidMonths(cfg: Pick<FireConfig, 'medicalPaidYears' | 'medicalPaidMonths'>): number {
  const m = Math.min(11, Math.max(0, Math.floor(cfg.medicalPaidMonths)));
  const y = Math.max(0, Math.floor(cfg.medicalPaidYears));
  return y * 12 + m;
}

/** 灵活就业医保：约占医保缴费基数的比例（各地不同，此处为粗算） */
const FLEXIBLE_MEDICAL_RATE = 0.1;

/**
 * 医保缴费基数比例（%）：在职职工随未来养老基数；灵活就业按参保地（如北京固定 100%）
 */
export function resolveMedicalBaseRatioPercentForPremium(
  futurePensionBaseRatio: number,
  pensionPaymentType: FirePaymentType,
  coeff: MedicalRegionCoeff
): number {
  /** 未来养老基数 0% = FIRE 停缴：未来医保缴费同步按 0（不再按北京 100% 社平单独计费） */
  if (futurePensionBaseRatio <= 0) return 0;
  if (pensionPaymentType === 'employee') {
    return futurePensionBaseRatio;
  }
  if (coeff.flexibleMedicalBaseMode === 'fixed_100') {
    return 100;
  }
  return clampFutureBaseRatioPercent(futurePensionBaseRatio);
}

/**
 * 职工医保（个人 2%）或灵活就业医保（按当地基数 × 费率粗算）
 */
export function medicalInsuranceMonthlyPremium(
  socialAvgAnnual: number,
  futurePensionBaseRatio: number,
  pensionPaymentType: FirePaymentType,
  coeff: MedicalRegionCoeff
): number {
  if (socialAvgAnnual <= 0 || futurePensionBaseRatio <= 0) return 0;
  const r = resolveMedicalBaseRatioPercentForPremium(futurePensionBaseRatio, pensionPaymentType, coeff);
  if (r <= 0) return 0;
  const base = monthlyContributionBase(socialAvgAnnual, r);
  if (pensionPaymentType === 'employee') {
    return base * 0.02;
  }
  return base * FLEXIBLE_MEDICAL_RATE;
}

export function dailyMedicalFromMonthly(monthly: number): number {
  return monthly / 30;
}

/** 未来各段加权平均「医保月缴」（元），与养老分段一致 */
function weightedMonthlyMedicalPremium(
  cfg: FireConfig,
  social: number,
  coeff: MedicalRegionCoeff,
  monthsFuture: number
): number {
  if (social <= 0 || monthsFuture <= 0) return 0;
  if (!cfg.futureSegmentsEnabled || !cfg.futureSegments?.length) {
    const fr = cfg.futureBaseRatioPercent ?? cfg.baseRatioPercent;
    return medicalInsuranceMonthlyPremium(social, fr, cfg.paymentType, coeff);
  }
  const segs = normalizeFutureSegmentsForMonths(
    cfg.futureSegments,
    monthsFuture,
    cfg.futureBaseRatioPercent ?? 60
  );
  let sum = 0;
  for (const s of segs) {
    sum += medicalInsuranceMonthlyPremium(social, s.baseRatioPercent, cfg.paymentType, coeff) * s.months;
  }
  return sum / monthsFuture;
}

function weightedEffectiveMedicalBaseRatioPercent(
  cfg: FireConfig,
  coeff: MedicalRegionCoeff,
  monthsFuture: number
): number {
  if (monthsFuture <= 0) return 0;
  if (!cfg.futureSegmentsEnabled || !cfg.futureSegments?.length) {
    const fr = cfg.futureBaseRatioPercent ?? cfg.baseRatioPercent;
    return resolveMedicalBaseRatioPercentForPremium(fr, cfg.paymentType, coeff);
  }
  const segs = normalizeFutureSegmentsForMonths(
    cfg.futureSegments,
    monthsFuture,
    cfg.futureBaseRatioPercent ?? 60
  );
  let sum = 0;
  let m = 0;
  for (const s of segs) {
    const r = resolveMedicalBaseRatioPercentForPremium(s.baseRatioPercent, cfg.paymentType, coeff);
    sum += r * s.months;
    m += s.months;
  }
  return m > 0 ? sum / m : 0;
}

export type MedicalComputed = {
  monthlyMedicalPay: number;
  dailyMedicalPay: number;
  remainingMonthsToRetirement: number;
  remainingTotalMedicalCost: number;
  employeeMet: boolean;
  employeeShortfallYears: number;
  employeeShortfallMonths: number;
  requiredMedicalMonths: number;
  paidMedicalMonths: number;
  employeeStatusLine: string;
  employeeDetailLine: string;
  residentStatusLine: string;
  residentDetailLine: string;
  retireMedicalBenefitLine: string;
  /** 参保地内置建议年限（按性别） */
  suggestedRetireYearsFromRegion: number;
  /** 红色：特殊城市提示 */
  regionHintRed: string;
  /** 绿色：FIRE 停缴（未来社保+医保均 0） */
  fireStopGreen: string;
  /** 未来基数 >0 时展示「未来缴费」说明 */
  futurePayHintLine: string;
  /** 医保基数规则说明 */
  medicalBaseRuleHint: string;
  /** 实际用于医保月缴的基数比例（%） */
  effectiveMedicalBaseRatioPercent: number;
};

export function computeMedicalMetrics(cfg: FireConfig, birthDate: string | null): MedicalComputed {
  const retireAge = clampRetireAge(cfg.targetRetireAge);
  const remainingMonths = monthsFromNowToRetirement(birthDate, retireAge);
  const paidMedicalMonths = totalMedicalPaidMonths(cfg);
  const coeff = getMedicalRegionCoeff(cfg.province, cfg.city);
  const gender = cfg.medicalGender ?? 'male';
  const suggestedYears = getRequiredRetireYearsForGender(coeff, gender);

  /** 未来养老基数加权平均（用于停缴判断、居民医保等） */
  const futRatio = effectiveWeightedFuturePensionRatioPercent(cfg, remainingMonths);
  const effMedRatio =
    futRatio <= 0 ? 0 : weightedEffectiveMedicalBaseRatioPercent(cfg, coeff, remainingMonths);

  let regionHintRed = '';
  if (
    futRatio > 0 &&
    coeff.flexibleMedicalBaseMode === 'fixed_100' &&
    cfg.paymentType === 'flexible'
  ) {
    regionHintRed =
      '参保地规则：灵活就业医保缴费基数固定为 100% 社平（不可按养老 3 倍基数缴医保），与养老基数分开核算';
  }

  const fireStopGreen =
    futRatio <= 0 ? '✅ FIRE 停缴模式生效，未来不再缴纳社保 / 医保' : '';

  const futurePayHintLine =
    futRatio > 0
      ? cfg.futureSegmentsEnabled
        ? '以下为「未来缴费」加权结果（分段已启用）；各段与参保地规则单独核算后取平均月缴'
        : '以下为「未来缴费」（从现在到目标退休），按未来基数与参保地规则计算；与上方历史缴费分开'
      : '';

  let medicalBaseRuleHint = '';
  if (cfg.paymentType === 'employee') {
    medicalBaseRuleHint = '在职职工医保：月社平 × 未来养老基数 × 2%（与养老基数联动）';
  } else if (coeff.flexibleMedicalBaseMode === 'fixed_100') {
    medicalBaseRuleHint = '灵活就业医保：缴费基数按参保地（如北京为 100% 社平）× 约 10% 粗算';
  } else {
    medicalBaseRuleHint = '灵活就业医保：缴费基数可在 60%～300% 社平（与未来养老基数一致）× 约 10% 粗算';
  }
  if (futRatio <= 0 && cfg.medicalInsuranceType === 'employee') {
    medicalBaseRuleHint = 'FIRE 停缴：未来医保费用按 0 计（与养老停缴同步）';
  }

  const requiredYears = parseMedicalRetireRequiredYears(cfg.medicalRetireRequiredYears ?? String(suggestedYears));
  const requiredMedicalMonths = requiredYears * 12;

  if (cfg.medicalInsuranceType === 'resident') {
    const annual = parseResidentMedicalAnnual(cfg.residentMedicalAnnualYuan ?? '380');
    const monthly = futRatio <= 0 ? 0 : annual / 12;
    const daily = dailyMedicalFromMonthly(monthly);
    const remainingTotal = monthly * remainingMonths;
    return {
      monthlyMedicalPay: monthly,
      dailyMedicalPay: daily,
      remainingMonthsToRetirement: remainingMonths,
      remainingTotalMedicalCost: remainingTotal,
      employeeMet: false,
      employeeShortfallYears: 0,
      employeeShortfallMonths: 0,
      requiredMedicalMonths,
      paidMedicalMonths,
      employeeStatusLine: '',
      employeeDetailLine: '',
      residentStatusLine: '居民医保终身缴费，无退休免缴政策',
      residentDetailLine: '需持续缴费至终身，保障不中断',
      retireMedicalBenefitLine:
        futRatio <= 0
          ? 'FIRE 停缴：未来居民医保按 0 计'
          : `按年缴约 ${Math.round(annual)} 元 · 折算约 ${monthly.toFixed(2)} 元/月（无终身免缴）`,
      suggestedRetireYearsFromRegion: suggestedYears,
      regionHintRed,
      fireStopGreen,
      medicalBaseRuleHint:
        futRatio <= 0
          ? 'FIRE 停缴：未来居民医保费用按 0 计（与「未来不再缴费」一致）'
          : '城乡居民医保：按年缴费折算月成本',
      effectiveMedicalBaseRatioPercent: 0,
      futurePayHintLine,
    };
  }

  const social = parseSocialAvgAnnual(cfg.socialAvgAnnual);

  if (social <= 0) {
    const shortM = Math.max(0, requiredMedicalMonths - paidMedicalMonths);
    const sy = Math.floor(shortM / 12);
    const sm = shortM % 12;
    const empMet = paidMedicalMonths >= requiredMedicalMonths;
    let esl: string;
    let edl: string;
    let rbl: string;
    if (empMet) {
      esl = '职工医保年限已达标（请填写社平以显示月缴）';
      edl = '达到年限要求后可享退休医保待遇（以当地为准）';
      rbl = '年限已满足；填写社平后显示月缴估算';
    } else {
      esl = `还差 ${sy} 年 ${sm} 月达到退休缴费要求`;
      edl = '请先填写社平工资，以估算职工医保月缴费';
      rbl = '未填社平：无法估算职工医保月缴与补缴';
    }
    return {
      monthlyMedicalPay: 0,
      dailyMedicalPay: 0,
      remainingMonthsToRetirement: remainingMonths,
      remainingTotalMedicalCost: 0,
      employeeMet: empMet,
      employeeShortfallYears: sy,
      employeeShortfallMonths: sm,
      requiredMedicalMonths,
      paidMedicalMonths,
      employeeStatusLine: esl,
      employeeDetailLine: edl,
      residentStatusLine: '',
      residentDetailLine: '',
      retireMedicalBenefitLine: rbl,
      suggestedRetireYearsFromRegion: suggestedYears,
      regionHintRed,
      fireStopGreen,
      medicalBaseRuleHint,
      effectiveMedicalBaseRatioPercent: effMedRatio,
      futurePayHintLine,
    };
  }

  const monthly = weightedMonthlyMedicalPremium(cfg, social, coeff, remainingMonths);
  const daily = dailyMedicalFromMonthly(monthly);
  const remainingTotal = monthly * remainingMonths;
  const employeeMet = paidMedicalMonths >= requiredMedicalMonths;
  const shortM = Math.max(0, requiredMedicalMonths - paidMedicalMonths);
  const sy = Math.floor(shortM / 12);
  const sm = shortM % 12;

  let employeeStatusLine: string;
  let employeeDetailLine: string;
  let retireMedicalBenefitLine: string;

  if (employeeMet) {
    employeeStatusLine = '职工医保已缴满，退休后终身免费享受医保';
    employeeDetailLine = '达到当地退休缴费年限要求（以参保地政策为准）';
    retireMedicalBenefitLine = '退休后按规定享受医保待遇（终身）';
  } else {
    employeeStatusLine = `还差 ${sy} 年 ${sm} 月达到退休缴费要求`;
    employeeDetailLine = '退休时需缴满当地年限方可免缴；不足部分可能需补缴（各地政策不同）';
    retireMedicalBenefitLine = `未达标：退休前约需再缴 ¥${remainingTotal.toFixed(0)}（按月估算至退休，仅供参考）`;
  }

  return {
    monthlyMedicalPay: monthly,
    dailyMedicalPay: daily,
    remainingMonthsToRetirement: remainingMonths,
    remainingTotalMedicalCost: remainingTotal,
    employeeMet,
    employeeShortfallYears: sy,
    employeeShortfallMonths: sm,
    requiredMedicalMonths,
    paidMedicalMonths,
    employeeStatusLine,
    employeeDetailLine,
    residentStatusLine: '',
    residentDetailLine: '',
    retireMedicalBenefitLine,
    suggestedRetireYearsFromRegion: suggestedYears,
    regionHintRed,
    fireStopGreen,
    medicalBaseRuleHint,
    effectiveMedicalBaseRatioPercent: effMedRatio,
    futurePayHintLine,
  };
}
