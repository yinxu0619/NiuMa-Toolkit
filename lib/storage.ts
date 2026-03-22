import { getStorageAdapter } from '@/lib/storageAdapter';
import type { RecordEntry, SalaryConfig, ChargeConfig, MortgageConfig, TimeConfig, VacationConfig, PersonalConfig, NiumaConfig, FireConfig } from '@/types';
import { getDefaultSalaryConfig } from '@/lib/salary';

const KEY_RECORDS = 'dgrtoolbox_records';
const KEY_SALARY = 'dgrtoolbox_salary';
const KEY_TIME = 'niuma_time';
const KEY_VACATION = 'niuma_vacation';
const KEY_PERSONAL = 'niuma_personal';
const KEY_OFFWORK = 'dgrtoolbox_offwork';
const KEY_PAYDAY = 'dgrtoolbox_payday';
const KEY_FIRST_LAUNCH = 'dgrtoolbox_first_launch';
const KEY_FIRST_SPLASH_DONE = 'dgrtoolbox_first_splash_done';
const KEY_CHARGE = 'dgrtoolbox_charge';
const KEY_MORTGAGE = 'dgrtoolbox_mortgage';
const KEY_MORTGAGE_LAST_DATE = 'dgrtoolbox_mortgage_last_date'; // 上次写入房贷日供的日期 YYYY-MM-DD
const KEY_COMMUTE_MONTHLY = 'dgrtoolbox_commute_monthly'; // 月度通勤费（元），自动 ÷22 为日均
const KEY_HOLIDAY_SYNC_ENABLED = 'niuma_holiday_sync_enabled'; // 是否启用联网同步的法定假日表
const KEY_HOLIDAY_DATES = 'niuma_holiday_dates'; // string[] 休息日 YYYY-MM-DD（含调休后的真实放假）
const KEY_NIUMA = 'niuma_schedule'; // 996/007 排班
const KEY_FIRE = 'niuma_fire_config'; // FIRE 提前退休

const DEFAULT_FIRE: FireConfig = {
  paidYears: 0,
  paidMonths: 0,
  province: '北京市',
  city: '北京市',
  targetRetireAge: 60,
  paymentType: 'flexible',
  baseRatioPercent: 60,
  historicalBaseRatioPercent: 100,
  futureBaseRatioPercent: 60,
  futureSegmentsEnabled: false,
  futureSegments: [],
  socialAvgAnnual: '',
  personalAccountBalance: '0',
  medicalInsuranceType: 'employee',
  medicalPaidYears: 0,
  medicalPaidMonths: 0,
  medicalRetireRequiredYears: '25',
  residentMedicalAnnualYuan: '380',
  medicalGender: 'male',
};

export async function loadFireConfig(): Promise<FireConfig> {
  try {
    const raw = await getStorageAdapter().getItem(KEY_FIRE);
    if (!raw) return { ...DEFAULT_FIRE };
    const parsed = JSON.parse(raw) as Partial<FireConfig> & Record<string, unknown>;
    const merged: FireConfig = { ...DEFAULT_FIRE, ...parsed };
    /** 老数据仅有 baseRatioPercent：历史/未来均用原值，与旧算法无感一致 */
    if (parsed.historicalBaseRatioPercent === undefined && parsed.futureBaseRatioPercent === undefined) {
      merged.historicalBaseRatioPercent = merged.baseRatioPercent;
      merged.futureBaseRatioPercent = merged.baseRatioPercent;
    }
    if (parsed.futureSegmentsEnabled === undefined) merged.futureSegmentsEnabled = false;
    if (parsed.futureSegments === undefined) merged.futureSegments = [];
    return merged;
  } catch {
    return { ...DEFAULT_FIRE };
  }
}

export async function saveFireConfig(config: FireConfig): Promise<void> {
  await getStorageAdapter().setItem(KEY_FIRE, JSON.stringify(config));
}
// ---------- 薪资配置 ----------
export async function loadSalaryConfig(): Promise<SalaryConfig> {
  try {
    const raw = await getStorageAdapter().getItem(KEY_SALARY);
    if (!raw) return getDefaultSalaryConfig();
    return { ...getDefaultSalaryConfig(), ...JSON.parse(raw) };
  } catch {
    return getDefaultSalaryConfig();
  }
}

export async function saveSalaryConfig(config: SalaryConfig): Promise<void> {
  await getStorageAdapter().setItem(KEY_SALARY, JSON.stringify(config));
}

export async function clearSalaryConfig(): Promise<void> {
  await getStorageAdapter().removeItem(KEY_SALARY);
}

// ---------- 时间配置（上班/下班/午休）----------
const DEFAULT_TIME: TimeConfig = {
  workStart: '09:00',
  workEnd: '18:00',
  lunchStart: '12:00',
  lunchEnd: '13:00',
  lunchEnabled: true,
};

export async function loadTimeConfig(): Promise<TimeConfig> {
  try {
    const raw = await getStorageAdapter().getItem(KEY_TIME);
    if (!raw) return { ...DEFAULT_TIME };
    return { ...DEFAULT_TIME, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_TIME };
  }
}

export async function saveTimeConfig(config: TimeConfig): Promise<void> {
  await getStorageAdapter().setItem(KEY_TIME, JSON.stringify(config));
}

// ---------- 假期配置 ----------
const DEFAULT_VACATION: VacationConfig = {
  annualLeaveTotal: 0,
  sickLeaveTotal: 0,
  unpaidLeaveTotal: 0,
  annualLeaveUsed: 0,
  sickLeaveUsed: 0,
  unpaidLeaveUsed: 0,
};

export async function loadVacationConfig(): Promise<VacationConfig> {
  try {
    const raw = await getStorageAdapter().getItem(KEY_VACATION);
    if (!raw) return { ...DEFAULT_VACATION };
    return { ...DEFAULT_VACATION, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_VACATION };
  }
}

export async function saveVacationConfig(config: VacationConfig): Promise<void> {
  await getStorageAdapter().setItem(KEY_VACATION, JSON.stringify(config));
}

// ---------- 个人配置（出生日）----------
export async function loadPersonalConfig(): Promise<PersonalConfig | null> {
  try {
    const raw = await getStorageAdapter().getItem(KEY_PERSONAL);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export async function savePersonalConfig(config: PersonalConfig | null): Promise<void> {
  const s = getStorageAdapter();
  if (config == null) await s.removeItem(KEY_PERSONAL);
  else await s.setItem(KEY_PERSONAL, JSON.stringify(config));
}

const DEFAULT_NIUMA: NiumaConfig = {
  enabled: false,
  mode: 'standard',
  alternateBigWeekMonday: null,
};

export async function loadNiumaConfig(): Promise<NiumaConfig> {
  try {
    const raw = await getStorageAdapter().getItem(KEY_NIUMA);
    if (!raw) return { ...DEFAULT_NIUMA };
    return { ...DEFAULT_NIUMA, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_NIUMA };
  }
}

export async function saveNiumaConfig(config: NiumaConfig): Promise<void> {
  await getStorageAdapter().setItem(KEY_NIUMA, JSON.stringify(config));
}

// ---------- 假期标记（某日为带薪假/病假）----------
const KEY_LEAVE_MARKS = 'niuma_leave_marks'; // { "YYYY-MM-DD": "annual_leave"|"sick_leave" }

export type LeaveMarkType = 'annual_leave' | 'sick_leave';

export async function loadLeaveMarks(): Promise<Record<string, LeaveMarkType>> {
  try {
    const raw = await getStorageAdapter().getItem(KEY_LEAVE_MARKS);
    if (!raw) return {};
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

export async function setLeaveMark(dateKey: string, type: LeaveMarkType | null): Promise<void> {
  const marks = await loadLeaveMarks();
  if (type == null) delete marks[dateKey];
  else marks[dateKey] = type;
  await getStorageAdapter().setItem(KEY_LEAVE_MARKS, JSON.stringify(marks));
}

/** 标记/取消某日为带薪假或病假，并同步扣减/回退假期配置的已用天数 */
export async function setLeaveMarkAndUpdateVacation(dateKey: string, newType: LeaveMarkType | null): Promise<void> {
  const marks = await loadLeaveMarks();
  const prev = marks[dateKey] ?? null;
  const vac = await loadVacationConfig();
  if (prev === 'annual_leave') vac.annualLeaveUsed = Math.max(0, vac.annualLeaveUsed - 1);
  if (prev === 'sick_leave') vac.sickLeaveUsed = Math.max(0, vac.sickLeaveUsed - 1);
  if (newType === 'annual_leave') vac.annualLeaveUsed += 1;
  if (newType === 'sick_leave') vac.sickLeaveUsed += 1;
  await saveVacationConfig(vac);
  if (newType == null) delete marks[dateKey];
  else marks[dateKey] = newType;
  await getStorageAdapter().setItem(KEY_LEAVE_MARKS, JSON.stringify(marks));
}

// ---------- 下班时间（默认 18:00）----------
export async function getOffworkTime(): Promise<string> {
  const v = await getStorageAdapter().getItem(KEY_OFFWORK);
  return v || '18:00';
}

export async function setOffworkTime(time: string): Promise<void> {
  await getStorageAdapter().setItem(KEY_OFFWORK, time);
}

// ---------- 发薪日（每月几号）----------
export async function getPaydayDay(): Promise<number> {
  const v = await getStorageAdapter().getItem(KEY_PAYDAY);
  return v != null ? parseInt(v, 10) : 15;
}

export async function setPaydayDay(day: number): Promise<void> {
  await getStorageAdapter().setItem(KEY_PAYDAY, String(day));
}

// ---------- 首次使用时间（勋章「使用满 30 天」）----------
export async function getFirstLaunchTime(): Promise<number | null> {
  const v = await getStorageAdapter().getItem(KEY_FIRST_LAUNCH);
  return v != null ? parseInt(v, 10) : null;
}

export async function setFirstLaunchTimeIfNeeded(): Promise<void> {
  const s = getStorageAdapter();
  const v = await s.getItem(KEY_FIRST_LAUNCH);
  if (v == null) await s.setItem(KEY_FIRST_LAUNCH, String(Date.now()));
}

// ---------- 开屏动画（每天只显示一次，从后台切回不显示）----------
function todayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** 今天是否已经显示过开屏，若未显示或不是今天则返回 true（需要显示） */
export async function getShouldShowSplashToday(): Promise<boolean> {
  const v = await getStorageAdapter().getItem(KEY_FIRST_SPLASH_DONE);
  const today = todayKey();
  return v !== today;
}

export async function setSplashShownToday(): Promise<void> {
  await getStorageAdapter().setItem(KEY_FIRST_SPLASH_DONE, todayKey());
}

// ---------- 充电配置 ----------
export async function loadChargeConfig(): Promise<ChargeConfig | null> {
  const raw = await getStorageAdapter().getItem(KEY_CHARGE);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export async function saveChargeConfig(config: ChargeConfig): Promise<void> {
  await getStorageAdapter().setItem(KEY_CHARGE, JSON.stringify(config));
}

// ---------- 房贷配置 ----------
export async function loadMortgageConfig(): Promise<MortgageConfig | null> {
  const raw = await getStorageAdapter().getItem(KEY_MORTGAGE);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export async function saveMortgageConfig(config: MortgageConfig | null): Promise<void> {
  const s = getStorageAdapter();
  if (config == null) await s.removeItem(KEY_MORTGAGE);
  else await s.setItem(KEY_MORTGAGE, JSON.stringify(config));
}

export async function getMortgageLastWrittenDate(): Promise<string | null> {
  return await getStorageAdapter().getItem(KEY_MORTGAGE_LAST_DATE);
}

export async function setMortgageLastWrittenDate(date: string): Promise<void> {
  await getStorageAdapter().setItem(KEY_MORTGAGE_LAST_DATE, date);
}

const KEY_MORTGAGE_ENABLED = 'dgrtoolbox_mortgage_enabled';
const KEY_MORTGAGE_DONE_SHOWN = 'dgrtoolbox_mortgage_done_shown'; // 今日已弹过达标 YYYY-MM-DD

export async function getMortgageEnabled(): Promise<boolean> {
  const v = await getStorageAdapter().getItem(KEY_MORTGAGE_ENABLED);
  return v === '1';
}

export async function setMortgageEnabled(enabled: boolean): Promise<void> {
  await getStorageAdapter().setItem(KEY_MORTGAGE_ENABLED, enabled ? '1' : '0');
}

export async function getMortgageDoneShownDate(): Promise<string | null> {
  return await getStorageAdapter().getItem(KEY_MORTGAGE_DONE_SHOWN);
}

export async function setMortgageDoneShownDate(date: string): Promise<void> {
  await getStorageAdapter().setItem(KEY_MORTGAGE_DONE_SHOWN, date);
}

// ---------- 通勤：月度费用（自动摊到每日）----------
export async function getCommuteMonthlyBudget(): Promise<number> {
  const v = await getStorageAdapter().getItem(KEY_COMMUTE_MONTHLY);
  return v != null ? parseFloat(v) || 0 : 0;
}

export async function setCommuteMonthlyBudget(amount: number): Promise<void> {
  await getStorageAdapter().setItem(KEY_COMMUTE_MONTHLY, String(amount));
}

// ---------- 法定假日（联网同步到本地）----------
export async function getHolidaySyncEnabled(): Promise<boolean> {
  const v = await getStorageAdapter().getItem(KEY_HOLIDAY_SYNC_ENABLED);
  return v === '1';
}

export async function setHolidaySyncEnabled(enabled: boolean): Promise<void> {
  await getStorageAdapter().setItem(KEY_HOLIDAY_SYNC_ENABLED, enabled ? '1' : '0');
}

export async function loadHolidayDates(): Promise<string[]> {
  try {
    const raw = await getStorageAdapter().getItem(KEY_HOLIDAY_DATES);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

export async function saveHolidayDates(dates: string[]): Promise<void> {
  await getStorageAdapter().setItem(KEY_HOLIDAY_DATES, JSON.stringify(dates));
}

const KEY_HOLIDAY_LAST_SYNC = 'niuma_holiday_last_sync'; // ISO 字符串，上次同步时间

export async function getHolidayLastSyncAt(): Promise<string | null> {
  return await getStorageAdapter().getItem(KEY_HOLIDAY_LAST_SYNC);
}

export async function setHolidayLastSyncAt(iso: string): Promise<void> {
  await getStorageAdapter().setItem(KEY_HOLIDAY_LAST_SYNC, iso);
}

export async function clearHolidayDates(): Promise<void> {
  const s = getStorageAdapter();
  await s.removeItem(KEY_HOLIDAY_DATES);
  await s.removeItem(KEY_HOLIDAY_LAST_SYNC);
}

// ---------- 加班进行中（还在干）----------
const KEY_OVERTIME_START = 'niuma_overtime_start'; // 开始时间戳 number
const KEY_OVERTIME_PAID = 'niuma_overtime_paid';  // 'true' | 'false'

export async function getOvertimeInProgress(): Promise<{ startAt: number; isPaid: boolean } | null> {
  try {
    const rawStart = await getStorageAdapter().getItem(KEY_OVERTIME_START);
    const rawPaid = await getStorageAdapter().getItem(KEY_OVERTIME_PAID);
    if (!rawStart) return null;
    const startAt = parseInt(rawStart, 10);
    if (Number.isNaN(startAt)) return null;
    const isPaid = rawPaid === 'true';
    return { startAt, isPaid };
  } catch {
    return null;
  }
}

export async function setOvertimeInProgress(startAt: number, isPaid: boolean): Promise<void> {
  const s = getStorageAdapter();
  await s.setItem(KEY_OVERTIME_START, String(startAt));
  await s.setItem(KEY_OVERTIME_PAID, isPaid ? 'true' : 'false');
}

export async function clearOvertimeInProgress(): Promise<void> {
  const s = getStorageAdapter();
  await s.removeItem(KEY_OVERTIME_START);
  await s.removeItem(KEY_OVERTIME_PAID);
}

// ---------- 摸鱼/消费/会议/下班/通勤/勋章/充电/房贷/午饭/开支记录 ----------
export async function loadRecords(): Promise<RecordEntry[]> {
  try {
    const raw = await getStorageAdapter().getItem(KEY_RECORDS);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export async function saveRecords(records: RecordEntry[]): Promise<void> {
  await getStorageAdapter().setItem(KEY_RECORDS, JSON.stringify(records));
}

/** 统一写入：category, content(存 label), amount?（achievement 无金额则 0） */
export async function addRecord(entry: Omit<RecordEntry, 'id' | 'createdAt'>): Promise<RecordEntry> {
  const records = await loadRecords();
  const newEntry: RecordEntry = {
    ...entry,
    id: `rec_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
    createdAt: new Date().toISOString(),
    label: entry.label ?? entry.content,
    amount: entry.amount ?? 0,
  };
  records.push(newEntry);
  await saveRecords(records);
  return newEntry;
}

export async function getRecordsInRange(start: Date, end: Date): Promise<RecordEntry[]> {
  const records = await loadRecords();
  return records.filter((r) => {
    const t = new Date(r.createdAt).getTime();
    return t >= start.getTime() && t <= end.getTime();
  });
}

/** 删除单条记录（如支出），删除后不可恢复 */
export async function deleteRecord(id: string): Promise<void> {
  const records = await loadRecords();
  const next = records.filter((r) => r.id !== id);
  await saveRecords(next);
}

/** 更新单条记录（如加班条目的开始/结束时间、有偿无偿） */
export async function updateRecord(id: string, updates: Partial<Omit<RecordEntry, 'id'>>): Promise<void> {
  const records = await loadRecords();
  const idx = records.findIndex((r) => r.id === id);
  if (idx < 0) return;
  records[idx] = { ...records[idx], ...updates };
  await saveRecords(records);
}

export async function clearAllRecords(): Promise<void> {
  await getStorageAdapter().removeItem(KEY_RECORDS);
}

/** 清空所有数据：记录 + 房贷/生日/假期/通勤/发薪日/充电/加班进行中（保留主题、首次启动、法定假日同步开关与数据） */
export async function clearAllData(): Promise<void> {
  const s = getStorageAdapter();
  await s.removeItem(KEY_RECORDS);
  await s.removeItem(KEY_MORTGAGE);
  await s.removeItem(KEY_MORTGAGE_LAST_DATE);
  await s.removeItem(KEY_MORTGAGE_DONE_SHOWN);
  await s.removeItem(KEY_MORTGAGE_ENABLED);
  await s.removeItem(KEY_PERSONAL);
  await s.removeItem(KEY_VACATION);
  await s.removeItem(KEY_LEAVE_MARKS);
  await s.removeItem(KEY_COMMUTE_MONTHLY);
  await s.removeItem(KEY_PAYDAY);
  await s.removeItem(KEY_CHARGE);
  await s.removeItem(KEY_NIUMA);
  await s.removeItem(KEY_FIRE);
  await clearOvertimeInProgress();
}
