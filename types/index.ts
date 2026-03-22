/**
 * 牛马工具箱 - 统一类型定义
 * 规则：所有记录只增不删、不覆盖，永久保存
 */

// ========== 设置页配置 ==========

/** 时间配置（必填）：上班/下班/午休起止，格式 "HH:mm" */
export interface TimeConfig {
  workStart: string;
  workEnd: string;
  lunchStart: string;
  lunchEnd: string;
  /** true=有午休，false=不午休（强者从不午休），默认 true */
  lunchEnabled?: boolean;
}

/** 薪资配置：月薪 → 时薪自动计算 */
export interface SalaryConfig {
  monthly_salary: number;  // 月薪（元）
  work_days: number;       // 计薪天数，默认 21.75
  /** 每日有效工时 = (下班-上班) - (午休结束-午休开始)，由 TimeConfig 计算后写入或单独存 */
  effective_hours_per_day?: number;
}

/** 假期配置 */
export interface VacationConfig {
  annualLeaveTotal: number;   // 带薪年假总天数
  sickLeaveTotal: number;     // 带薪病假总天数
  unpaidLeaveTotal: number;   // 无薪假总天数（仅统计，不参与金额）
  annualLeaveUsed: number;
  sickLeaveUsed: number;
  unpaidLeaveUsed: number;
}

/** 个人配置：出生年月日，默认 60 岁退休 */
export interface PersonalConfig {
  birthDate: string;  // "YYYY-MM-DD"
  retireAge?: number; // 退休年龄，默认 60
}

/** 996/007 牛马排班（设置里开启后影响「今日」周末判定、下一工作日等） */
export type NiumaScheduleMode =
  | 'standard'
  | '996_sat'
  | '996_sun'
  | 'alternate_weeks'
  | 'all_week';

export interface NiumaConfig {
  /** 关闭则按标准双休（周六日休息） */
  enabled: boolean;
  mode: NiumaScheduleMode;
  /**
   * 大小周：某个「大周」的周一 YYYY-MM-DD（该周周六需上班）。
   * 与当前周周一相差偶数个自然周 → 大周；奇数 → 小周（双休）。
   */
  alternateBigWeekMonday?: string | null;
}

/** FIRE 提前退休：社保测算（本地保存） */
export type FirePaymentType = 'flexible' | 'employee';

/** 医保参保类型 */
export type FireMedicalInsuranceType = 'employee' | 'resident';

/** 未来分段：每段持续月数 + 该段缴费基数占社平比例（0%=该段停缴） */
export type FutureContributionSegment = {
  months: number;
  baseRatioPercent: number;
};

export interface FireConfig {
  /** 已缴年限（年部分） */
  paidYears: number;
  /** 已缴年限（月部分 0–11） */
  paidMonths: number;
  province: string;
  city: string;
  /** 目标退休年龄 50–70 */
  targetRetireAge: number;
  paymentType: FirePaymentType;
  /**
   * 历史兼容：旧版单一缴费比例；新用户迁移后与 historical/future 对齐。
   * 新逻辑以 historicalBaseRatioPercent / futureBaseRatioPercent 为准。
   */
  baseRatioPercent: number;
  /** 历史平均缴费基数占社平比例 60%～300%，默认 100%（过去已缴年限的平均） */
  historicalBaseRatioPercent: number;
  /** 未来缴费基数占社平比例 0%～300%，默认 60%；0%= 停缴 FIRE（未启用分段时用） */
  futureBaseRatioPercent: number;
  /** 启用未来分段后，按各段月数与基数加权计算；关闭时仅用 futureBaseRatioPercent */
  futureSegmentsEnabled: boolean;
  /** 未来分段列表；月数不足「距退休月数」时自动补最后一段，超出则截断 */
  futureSegments: FutureContributionSegment[];
  /** 当地上年社平工资（元/年），字符串便于输入框空态 */
  socialAvgAnnual: string;
  /** 养老金个人账户已累计金额（元），社保 APP 可查，支持小数 */
  personalAccountBalance: string;

  /** 医保类型：职工 / 城乡居民 */
  medicalInsuranceType: FireMedicalInsuranceType;
  /** 已缴医保累计年限（年） */
  medicalPaidYears: number;
  /** 已缴医保累计年限（月 0–11） */
  medicalPaidMonths: number;
  /** 职工医保退休需缴满年限（年），默认 25；部分城市 30 可手改或联网填入 */
  medicalRetireRequiredYears: string;
  /** 城乡居民医保年缴费（元），默认 380 */
  residentMedicalAnnualYuan: string;
  /** 医保退休年限核算用性别（男/女各地年限不同） */
  medicalGender: 'male' | 'female';
}

// ========== 摸鱼・摸一把（4 种固定） ==========

export type MoyuType = 'toilet' | 'bailan' | 'meeting' | 'daze';

export const MOYU_TYPE_LABELS: Record<MoyuType, string> = {
  toilet: '带薪如厕',
  bailan: '我直接开摆',
  meeting: '无效会议',
  daze: '摸鱼发呆',
};

// ========== 记录分类（只增不删） ==========

/** 摸鱼收入、薅羊毛、支出、加班、休假 */
export type RecordCategory =
  | 'toilet' | 'bailan' | 'meeting' | 'daze'  // 摸鱼（daze 保留兼容旧数据）
  | 'coffee' | 'snack' | 'drink' | 'charge'   // 薅羊毛
  | 'commute' | 'lunch' | 'expense' | 'mortgage'  // 支出（mortgage 兼容旧数据）
  | 'paid_overtime' | 'unpaid_overtime'       // 加班
  | 'annual_leave' | 'sick_leave'             // 假期
  | 'offwork'                                 // 下班打卡
  | 'achievement' | 'other';

/** 单条记录：统一只增不删 */
export interface RecordEntry {
  id: string;
  category: RecordCategory;
  amount: number;       // 收入为正，支出为负
  createdAt: string;    // ISO 字符串，精确到时分
  label?: string;
  content?: string;
  durationSeconds?: number;
  /** 摸鱼类型 / 万能支出名称等 */
  title?: string;
  desc?: string;
  icon?: string;
  calories?: number;
  bossLoss?: number;
}

// ========== 万能支出快捷项 ==========

export type ExpensePresetKey = 'milk_tea' | 'taxi' | 'send_airport' | 'custom';

// ========== 兼容旧类型（充电等） ==========

export interface ChargeConfig {
  batteryMah: number;
  pricePerKwh: number;
}

export interface CoffeePreset {
  id: string;
  name: string;
  price: number;
  label: string;
}

export interface SnackDrinkItem {
  id: string;
  name: string;
  price: number;
  calories?: number;
}

export type MortgageType = 'equal_payment' | 'equal_principal';

export interface MortgageConfig {
  total: number;
  annualRate: number;
  years: number;
  type: MortgageType;
  startPeriod: number;
  /** 每月还款日（1-31），如 15 表示每月 15 号扣款 */
  repaymentDay?: number;
}

// 兼容旧 ToiletScene / BailanScene，新逻辑用 MoyuType
export type ToiletScene = '带薪如厕' | '带薪刷手机' | '带薪发呆' | '带薪摸鱼聊天';
export type BailanScene = '无脑发呆' | '带薪刷手机' | '带薪聊天' | '假装思考' | '坐等下班' | '带薪摸鱼喝水' | '通用摆烂';
