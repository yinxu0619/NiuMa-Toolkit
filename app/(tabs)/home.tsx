import React, { useCallback, useState, useEffect, useRef, useMemo } from 'react';
import { View, Text, TextInput, StyleSheet, ScrollView, RefreshControl, Pressable, Modal, Alert, Vibration, Animated, Platform } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import Constants from 'expo-constants';
import { Ionicons } from '@expo/vector-icons';
import { formatMoney, formatDuration, formatDurationHHMMSS } from '@/lib/format';
import {
  getRecordsInRange,
  loadSalaryConfig,
  loadTimeConfig,
  loadPersonalConfig,
  loadLeaveMarks,
  getCommuteMonthlyBudget,
  getMortgageEnabled,
  loadMortgageConfig,
  addRecord,
  updateRecord,
  deleteRecord,
  getHolidaySyncEnabled,
  loadHolidayDates,
  getOvertimeInProgress,
  setOvertimeInProgress as saveOvertimeInProgress,
  clearOvertimeInProgress,
  loadNiumaConfig,
  loadFireConfig,
} from '@/lib/storage';
import { getFireDailyCosts } from '@/lib/fireDailyCosts';
import { getDailyPayment } from '@/lib/mortgage';
import { getTodayRange, formatLocalDateKey } from '@/lib/today';
import { useSalary } from '@/contexts/SalaryContext';
import { useToast } from '@/contexts/ToastContext';
import { COLORS } from '@/constants/theme';
import { IncomeCoverageModule } from '@/components/IncomeCoverageModule';
import {
  pickCoverageRedCopy,
  pickCoverageGreenCopy,
  pickCoverageStampText,
  COVERAGE_TOAST,
} from '@/constants/coverageCopy';
import { getCurrentPeriod, secondsToLunchStart, secondsToWorkEnd, secondsToWorkStart, parseHHmm, workedSecondsToday } from '@/lib/workTime';
import {
  getNextHoliday,
  isTodayHoliday,
  getNextHolidayFromStored,
  getNextWorkdayStart,
  secondsFromMidnightToday,
} from '@/lib/holidays';
import { getRetirementTotalSeconds, formatRetirementFromSeconds } from '@/lib/retirement';
import { pickOffworkButton, pickOvertimeButtonCopy, pickStopOvertimeCopy, pickOvertimeSettleCopy, OVERTIME_UNPAID_HINT, pickOvertimeEditSaveCopy, pickOvertimeEditDeleteCopy, getTodayBalanceCopy, getCaloriesCopy, pickSickLeaveShuangmoTitle, pickSickLeaveShuangmoFootnote, pickWeekendEarnedLabel } from '@/constants/copy';
import { isNiumaWorkday, isDaySpreadEligibleMonFri, isPureWeekendVibe } from '@/lib/niumaSchedule';
import type { RecordEntry, TimeConfig, NiumaConfig } from '@/types';

const MOYU_CATS = ['toilet', 'bailan', 'meeting'];
const YANGMAO_CATS = ['coffee', 'snack', 'drink', 'charge'];
const MOYU_AND_YANGMAO = [...MOYU_CATS, ...YANGMAO_CATS];
const PAID_OVERTIME_CAT = 'paid_overtime';
const CAT_LABELS: Record<string, string> = {
  toilet: '带薪如厕', bailan: '开摆', meeting: '无效会议',
  coffee: '咖啡', snack: '零食', drink: '饮料', charge: '充电',
};
// 今日总支出 = 房贷/工作日 + 通勤(日均) + 其他(午饭+万能支出)，不从记录里重复算房贷/通勤
const OUTCOME_OTHER = ['lunch', 'expense'];
const WORK_DAYS = 22;

const UI = {
  cardTitle: '#666',
  primary: '#FF7A00',
  success: '#38A169',
  danger: '#E53E3E',
  secondary: '#999',
  statusCardBg: '#FFF9E6',
  cardBg: '#FFFFFF',
  divider: '#EEEEEE',
} as const;

/** 秒数 → HH:MM:SS，每秒更新 */
function formatCountdownSeconds(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}

export default function HomeScreen() {
  const router = useRouter();
  const toast = useToast();
  const colors = COLORS;
  const { salaryPerSecond } = useSalary();
  const [countdown, setCountdown] = useState('');
  const [periodLabel, setPeriodLabel] = useState('');
  const [hourlyWage, setHourlyWage] = useState(0);
  const [monthIncome, setMonthIncome] = useState(0);
  const [todayRealIncome, setTodayRealIncome] = useState(0);
  const [todayMoyuYangmao, setTodayMoyuYangmao] = useState(0);
  const [todayOutcome, setTodayOutcome] = useState(0);
  const [todayBalance, setTodayBalance] = useState(0);
  const [moyuDurationSec, setMoyuDurationSec] = useState(0);
  const [moyuAmountToday, setMoyuAmountToday] = useState(0);
  const [offworkBtnText, setOffworkBtnText] = useState('下班打卡 / 下钟');
  const [unpaidDurationSec, setUnpaidDurationSec] = useState(0);
  const [unpaidAmountToday, setUnpaidAmountToday] = useState(0);
  const [retirementTotalSec, setRetirementTotalSec] = useState<number | null>(null);
  const [nextHoliday, setNextHoliday] = useState<{ name: string; daysLeft: number } | null>(null);
  const [todayIsHoliday, setTodayIsHoliday] = useState(false);
  const [todayIsPaidLeave, setTodayIsPaidLeave] = useState(false);
  /** 今日按排班是否休息（原「周末」含义：不上班则 true，含 996 调休） */
  const [todayIsWeekend, setTodayIsWeekend] = useState(false);
  const [niumaConfig, setNiumaConfig] = useState<NiumaConfig>({
    enabled: false,
    mode: 'standard',
    alternateBigWeekMonday: null,
  });
  /** 今日日历标记：年假算薅、病假用养伤话术 */
  const [todayLeaveMark, setTodayLeaveMark] = useState<'annual_leave' | 'sick_leave' | null>(null);
  const [sickShuangmoTitle, setSickShuangmoTitle] = useState('');
  const [sickShuangmoFootnote, setSickShuangmoFootnote] = useState('');
  const [countdownToWorkSec, setCountdownToWorkSec] = useState(0);
  const [shuangmoSecToday, setShuangmoSecToday] = useState(0);
  const [shuangmoMoney, setShuangmoMoney] = useState(0);
  const [todayFixed, setTodayFixed] = useState(0);
  const [fixedPaidOff, setFixedPaidOff] = useState(false);
  const [lunchEnabled, setLunchEnabled] = useState(true);
  const [lunchCopy, setLunchCopy] = useState(''); // 午休骚话
  const [workSecToday, setWorkSecToday] = useState(0);
  const [earnedByTimeToday, setEarnedByTimeToday] = useState(0);
  const [daySalaryReport, setDaySalaryReport] = useState(0);
  const [salaryMasked, setSalaryMasked] = useState(true); // 时薪、本月收入默认打码，点击显示
  const [todayRecords, setTodayRecords] = useState<RecordEntry[]>([]);
  const [outcomeBreakdown, setOutcomeBreakdown] = useState({
    mortgageDay: 0,
    commuteDay: 0,
    lunch: 0,
    expense: 0,
  });
  const [expenseByLabel, setExpenseByLabel] = useState<{ label: string; amount: number }[]>([]);
  const [todayCalories, setTodayCalories] = useState(0);
  const [balanceCopy, setBalanceCopy] = useState('');
  const [showMoyuDetail, setShowMoyuDetail] = useState(false);
  const [showOutcomeDetail, setShowOutcomeDetail] = useState(false);
  const [showMoyuDurationDetail, setShowMoyuDurationDetail] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [offworkModal, setOffworkModal] = useState(false);
  const [offworkType, setOffworkType] = useState<'early' | 'ontime' | 'overtime' | null>(null);
  const [overtimeMins, setOvertimeMins] = useState(0);
  const [isOvertime, setIsOvertime] = useState(false);
  const [overtimeBtnText, setOvertimeBtnText] = useState('');
  const [overtimeStep, setOvertimeStep] = useState<1 | 2>(1);
  const [overtimeChoice, setOvertimeChoice] = useState<'paid' | 'unpaid' | null>(null);
  const [overtimeInProgress, setOvertimeInProgress] = useState(false);
  const [overtimeStartAt, setOvertimeStartAt] = useState<number | null>(null);
  const [overtimeIsPaid, setOvertimeIsPaid] = useState(false);
  const [overtimeElapsedSec, setOvertimeElapsedSec] = useState(0);
  const [showSettleModal, setShowSettleModal] = useState(false);
  const [stopOvertimeBtnText, setStopOvertimeBtnText] = useState('停止加班');
  const [settleModalCopy, setSettleModalCopy] = useState('');
  const [editOvertimeRecord, setEditOvertimeRecord] = useState<RecordEntry | null>(null);
  const [overtimeEditStart, setOvertimeEditStart] = useState('');
  const [overtimeEditEnd, setOvertimeEditEnd] = useState('');
  const [overtimeEditPaid, setOvertimeEditPaid] = useState(true);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const retirementTickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timeConfigRef = useRef<TimeConfig | null>(null);
  const holidayDatesRef = useRef<string[]>([]);
  /** 日历请假 key→类型，用于「下一工作日」跳过年假/病假日 */
  const leaveMarksRef = useRef<Record<string, string>>({});
  const niumaConfigRef = useRef<NiumaConfig | null>(null);
  const offworkBtnScale = useRef(new Animated.Value(1)).current;

  const [paidOvertimeToday, setPaidOvertimeToday] = useState(0);
  const [daySalaryEligible, setDaySalaryEligible] = useState(false);
  const [todayDataKey, setTodayDataKey] = useState('');
  const [coverageStampText, setCoverageStampText] = useState<string | null>(null);
  const [coverRedCopy, setCoverRedCopy] = useState(pickCoverageRedCopy);
  const [coverGreenCopy, setCoverGreenCopy] = useState(pickCoverageGreenCopy);
  const coverToastFiredRef = useRef(false);
  const prevTodayDataKeyRef = useRef('');
  /** FIRE 页：每日养老 / 医保成本，计入收入覆盖目标 */
  const [fireDailySocial, setFireDailySocial] = useState(0);
  const [fireDailyMedical, setFireDailyMedical] = useState(0);

  const fetch = useCallback(async () => {
    const [start, end] = getTodayRange();
    const records = await getRecordsInRange(start, end);
    const salaryConfig = await loadSalaryConfig();
    const personal = await loadPersonalConfig();
    const fireCfg = await loadFireConfig();
    const fireDaily = getFireDailyCosts(fireCfg, personal?.birthDate ?? null);
    setFireDailySocial(fireDaily.dailySocial);
    setFireDailyMedical(fireDaily.dailyMedical);
    const leaveMarks = await loadLeaveMarks();
    const niuma = await loadNiumaConfig();
    niumaConfigRef.current = niuma;
    setNiumaConfig(niuma);
    const commuteMonthly = await getCommuteMonthlyBudget();
    const [holidayOn, holidayDates] = await Promise.all([getHolidaySyncEnabled(), loadHolidayDates()]);
    holidayDatesRef.current = holidayOn ? holidayDates : [];
    leaveMarksRef.current = leaveMarks as Record<string, string>;
    const isHoliday = holidayOn && isTodayHoliday(holidayDates);
    setTodayIsHoliday(isHoliday);

    const hourly = salaryPerSecond * 3600;
    setHourlyWage(hourly);

    const daySalary = salaryConfig.monthly_salary && salaryConfig.work_days
      ? salaryConfig.monthly_salary / salaryConfig.work_days
      : 0;
    setDaySalaryReport(daySalary);
    const timeConfig = await loadTimeConfig();
    timeConfigRef.current = timeConfig;
    const todayStr = formatLocalDateKey(start);
    const lm = leaveMarks[todayStr];
    const hasCalendarLeave = lm === 'annual_leave' || lm === 'sick_leave';
    const workdayBySchedule = isNiumaWorkday(start, niuma);
    const isOffSchedule = !workdayBySchedule;
    setTodayIsWeekend(isOffSchedule);
    /** 有薪今日：法定休、年假/病假、或排班上的工作日 */
    const daySalaryToday =
      daySalary > 0 && (isHoliday || hasCalendarLeave || workdayBySchedule) ? daySalary : 0;
    /** 不上班日：法定假 / 年假病假 / 排班休息 */
    const isShuangmoDay = isHoliday || hasCalendarLeave || isOffSchedule;
    const workSec = isShuangmoDay ? secondsFromMidnightToday() : workedSecondsToday(timeConfig);
    setWorkSecToday(workSec);
    /** 按天摊仅法定休/带薪假；纯周末日薪为 0（月薪÷工作日，双休不计） */
    setEarnedByTimeToday(
      isShuangmoDay ? daySalaryToday * (workSec / (24 * 3600)) : workSec * salaryPerSecond
    );
    const paidOvertimeMonth = (await getRecordsInRange(
      new Date(start.getFullYear(), start.getMonth(), 1),
      new Date(start.getFullYear(), start.getMonth() + 1, 0, 23, 59, 59, 999)
    ))
      .filter((r) => r.category === 'paid_overtime')
      .reduce((a, r) => a + r.amount, 0);
    setMonthIncome((salaryConfig.monthly_salary || 0) + paidOvertimeMonth);

    const paidOvertimeToday = records.filter((r) => r.category === PAID_OVERTIME_CAT).reduce((a, r) => a + r.amount, 0);
    const moyuYangmaoToday = records.filter((r) => MOYU_CATS.includes(r.category) || YANGMAO_CATS.includes(r.category)).reduce((a, r) => a + r.amount, 0);
    const otherOutcomeToday = Math.abs(records.filter((r) => OUTCOME_OTHER.includes(r.category)).reduce((a, r) => a + r.amount, 0));
    /** 法定休、年假/病假、排班休息：不计日均通勤与今日通勤记录 */
    const isNonCommuteDay = isHoliday || hasCalendarLeave || isOffSchedule;
    const commuteDayBase = !isNonCommuteDay && commuteMonthly > 0 ? commuteMonthly / WORK_DAYS : 0;
    const todayCommuteSum = Math.abs(records.filter((r) => r.category === 'commute').reduce((a, r) => a + r.amount, 0));
    const mortgageConfig = await loadMortgageConfig();
    const mortgageOn = await getMortgageEnabled();
    const mortgageDay = mortgageConfig && mortgageOn && (start.getDay() >= 1 && start.getDay() <= 5) ? getDailyPayment(mortgageConfig) : 0;
    const commuteTotal = isNonCommuteDay ? 0 : commuteDayBase + todayCommuteSum;
    const fixed = commuteTotal + mortgageDay;
    const totalOutcome = fixed + otherOutcomeToday;
    const realIncome = daySalaryToday + paidOvertimeToday;
    const lunchToday = Math.abs(records.filter((r) => r.category === 'lunch').reduce((a, r) => a + r.amount, 0));
    const expenseRecords = records.filter((r) => r.category === 'expense');
    const expenseToday = Math.abs(expenseRecords.reduce((a, r) => a + r.amount, 0));
    const byLabel: Record<string, number> = {};
    expenseRecords.forEach((r) => {
      const name = r.label || r.content || '其他';
      byLabel[name] = (byLabel[name] || 0) + Math.abs(r.amount);
    });
    setExpenseByLabel(
      Object.entries(byLabel)
        .sort((a, b) => b[1] - a[1])
        .map(([label, amount]) => ({ label, amount }))
    );
    setOutcomeBreakdown({
      mortgageDay,
      commuteDay: commuteTotal,
      lunch: lunchToday,
      expense: expenseToday,
    });
    setPaidOvertimeToday(paidOvertimeToday);
    setDaySalaryEligible(daySalaryToday > 0);
    setTodayDataKey(todayStr);
    setTodayFixed(fixed);
    setFixedPaidOff(fixed > 0 && realIncome >= fixed);
    setTodayRealIncome(realIncome);
    setTodayMoyuYangmao(moyuYangmaoToday);
    setTodayOutcome(totalOutcome);
    const balance = realIncome - totalOutcome;
    setTodayBalance(balance);
    setBalanceCopy(getTodayBalanceCopy(balance));

    const calSum = records
      .filter((r) => ['coffee', 'snack', 'drink'].includes(r.category))
      .reduce((a, r) => a + (r.calories ?? 0), 0);
    setTodayCalories(calSum);

    const moyuSec = records.filter((r) => MOYU_CATS.includes(r.category)).reduce((a, r) => a + (r.durationSeconds ?? 0), 0);
    const moyuAmt = records.filter((r) => MOYU_CATS.includes(r.category)).reduce((a, r) => a + r.amount, 0);
    setMoyuDurationSec(moyuSec);
    setMoyuAmountToday(moyuAmt);

    const unpaidRecords = records.filter((r) => r.category === 'unpaid_overtime');
    const unpaidSec = unpaidRecords.reduce((a, r) => a + (r.durationSeconds ?? 0), 0);
    const unpaidAmt = unpaidSec * salaryPerSecond;
    setUnpaidDurationSec(unpaidSec);
    setUnpaidAmountToday(unpaidAmt);

    setRetirementTotalSec(getRetirementTotalSeconds(personal?.birthDate ?? null, personal?.retireAge ?? 60));
    setTodayIsPaidLeave(hasCalendarLeave);
    if (lm === 'sick_leave') {
      setTodayLeaveMark('sick_leave');
      setSickShuangmoTitle(pickSickLeaveShuangmoTitle());
      setSickShuangmoFootnote(pickSickLeaveShuangmoFootnote());
    } else if (lm === 'annual_leave') {
      setTodayLeaveMark('annual_leave');
      setSickShuangmoTitle('');
      setSickShuangmoFootnote('');
    } else {
      setTodayLeaveMark(null);
      setSickShuangmoTitle('');
      setSickShuangmoFootnote('');
    }
    setNextHoliday(holidayOn && holidayDates.length > 0 ? getNextHolidayFromStored(holidayDates) : getNextHoliday());
    setTodayRecords(records);
  }, [salaryPerSecond]);

  useFocusEffect(
    useCallback(() => {
      setCoverRedCopy(pickCoverageRedCopy());
      setCoverGreenCopy(pickCoverageGreenCopy());
      setOffworkBtnText(pickOffworkButton());
      fetch();
      getOvertimeInProgress().then((data) => {
        if (!data) return;
        const startDay = new Date(data.startAt).toDateString();
        const today = new Date().toDateString();
        if (startDay !== today) {
          clearOvertimeInProgress();
          setOvertimeInProgress(false);
          setOvertimeStartAt(null);
          return;
        }
        setOvertimeInProgress(true);
        setOvertimeStartAt(data.startAt);
        setOvertimeIsPaid(data.isPaid);
        setStopOvertimeBtnText(pickStopOvertimeCopy());
      });
    }, [fetch])
  );

  useEffect(() => {
    if (!todayDataKey) return;
    const prev = prevTodayDataKeyRef.current;
    if (todayDataKey === prev) return;
    if (prev !== '') {
      coverToastFiredRef.current = false;
      setCoverageStampText(null);
    }
    prevTodayDataKeyRef.current = todayDataKey;
  }, [todayDataKey]);

  useEffect(() => {
    const commute = outcomeBreakdown.commuteDay;
    const mortgage = outcomeBreakdown.mortgageDay;
    const lunch = outcomeBreakdown.lunch;
    const expense = outcomeBreakdown.expense;
    const target = commute + mortgage + lunch + expense + fireDailySocial + fireDailyMedical;
    if (target <= 0) return;
    const earned = (daySalaryEligible ? earnedByTimeToday : 0) + paidOvertimeToday;
    if (earned >= target) {
      setCoverageStampText((s) => s ?? pickCoverageStampText());
      if (!coverToastFiredRef.current) {
        coverToastFiredRef.current = true;
        toast.show(COVERAGE_TOAST);
        if (Platform.OS !== 'web') {
          try {
            Vibration.vibrate(Platform.OS === 'ios' ? [0, 60, 40, 60] : 100);
          } catch {
            /* ignore */
          }
        }
      }
    }
  }, [
    outcomeBreakdown,
    earnedByTimeToday,
    paidOvertimeToday,
    daySalaryEligible,
    toast,
    fireDailySocial,
    fireDailyMedical,
  ]);

  useEffect(() => {
    if (!overtimeInProgress || overtimeStartAt == null) return;
    const tick = () => {
      const now = Date.now();
      const startDay = new Date(overtimeStartAt).toDateString();
      const today = new Date().toDateString();
      if (startDay !== today) {
        clearOvertimeInProgress();
        setOvertimeInProgress(false);
        setOvertimeStartAt(null);
        setOvertimeElapsedSec(0);
        return;
      }
      setOvertimeElapsedSec(Math.floor((now - overtimeStartAt) / 1000));
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [overtimeInProgress, overtimeStartAt]);

  useEffect(() => {
    const tickSync = () => {
      const time = timeConfigRef.current;
      if (!time) return;
      const shuangmo = todayIsHoliday || todayIsPaidLeave || todayIsWeekend;
      if (shuangmo) {
        const sec = secondsFromMidnightToday();
        const ds = daySalaryReport;
        setWorkSecToday(sec);
        const daySpreadEligible =
          todayIsHoliday || todayIsPaidLeave || isDaySpreadEligibleMonFri(new Date());
        setEarnedByTimeToday(daySpreadEligible && ds > 0 ? ds * (sec / (24 * 3600)) : 0);
        return;
      }
      const sec = workedSecondsToday(time);
      setWorkSecToday(sec);
      setEarnedByTimeToday(sec * salaryPerSecond);
    };
    const init = async () => {
      const time = await loadTimeConfig();
      timeConfigRef.current = time;
      tickSync();
    };
    init();
    const id = setInterval(tickSync, 1000);
    return () => clearInterval(id);
  }, [salaryPerSecond, todayIsHoliday, todayIsPaidLeave, todayIsWeekend, daySalaryReport]);

  // 法定假 / 带薪假 / 周末：爽摸倒计时 + 已爽摸时长 + 已薅多少钱（按秒更新）
  useEffect(() => {
    if (!todayIsHoliday && !todayIsPaidLeave && !todayIsWeekend) return;
    const time = timeConfigRef.current;
    const dates = holidayDatesRef.current;
    const tick = () => {
      if (!time) return;
      const next = getNextWorkdayStart(time.workStart, dates, leaveMarksRef.current, niumaConfigRef.current ?? undefined);
      const sec = Math.max(0, Math.floor((next.getTime() - Date.now()) / 1000));
      setCountdownToWorkSec(sec);
      setShuangmoSecToday(secondsFromMidnightToday());
      const spreadOk =
        todayIsHoliday || todayIsPaidLeave || isDaySpreadEligibleMonFri(new Date());
      setShuangmoMoney(
        spreadOk && daySalaryReport > 0 ? daySalaryReport * (secondsFromMidnightToday() / (24 * 3600)) : 0
      );
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [todayIsHoliday, todayIsPaidLeave, todayIsWeekend, daySalaryReport]);

  useEffect(() => {
    const updateCountdown = async () => {
      const time = await loadTimeConfig();
      const enabled = time.lunchEnabled !== false;
      setLunchEnabled(enabled);
      if (todayIsHoliday || todayIsPaidLeave || todayIsWeekend) {
        const dates = holidayDatesRef.current;
        const next = getNextWorkdayStart(time.workStart, dates, leaveMarksRef.current, niumaConfigRef.current ?? undefined);
        const sec = Math.max(0, Math.floor((next.getTime() - Date.now()) / 1000));
        if (todayIsHoliday) {
          setPeriodLabel('今日法定休息');
        } else if (todayLeaveMark === 'sick_leave') {
          setPeriodLabel('今日病假 · 带薪回血');
        } else if (todayLeaveMark === 'annual_leave') {
          setPeriodLabel('今日年假 · 爽摸中');
        } else if (todayIsWeekend) {
          setPeriodLabel('今日周末 · 休息');
        } else {
          setPeriodLabel('今日休息');
        }
        setCountdown(formatCountdownSeconds(sec));
        setLunchCopy('');
        setIsOvertime(false);
        setOvertimeBtnText('');
        return;
      }
      const period = getCurrentPeriod(time);
      if (period === 'before_work') {
        setPeriodLabel('距上班还有');
        setLunchCopy('');
        const sec = secondsToWorkStart(time);
        setCountdown(sec != null ? formatCountdownSeconds(sec) : '');
        setIsOvertime(false);
        setOvertimeBtnText('');
        return;
      }
      if (period === 'after_work') {
        setPeriodLabel('今日打工已结束');
        setCountdown('');
        setLunchCopy('');
        const workEndMins = parseHHmm(time.workEnd);
        const nowMins = new Date().getHours() * 60 + new Date().getMinutes();
        const overt = nowMins >= workEndMins + 15;
        setIsOvertime(overt);
        if (overt) setOvertimeBtnText((prev) => prev || pickOvertimeButtonCopy());
        else setOvertimeBtnText('');
        return;
      }
      setIsOvertime(false);
      setOvertimeBtnText('');
      if (period === 'lunch') {
        setPeriodLabel('距下班还有');
        setLunchCopy(enabled ? '午休也算时间哦～' : '');
        const sec = secondsToWorkEnd(time);
        setCountdown(sec != null ? formatCountdownSeconds(sec) : '');
        return;
      }
      // working：午休前显示距午休，午休后显示距下班
      if (!enabled) {
        setPeriodLabel('距下班还有');
        setLunchCopy('强者从不午休');
        const sec = secondsToWorkEnd(time);
        setCountdown(sec != null ? formatCountdownSeconds(sec) : '');
        return;
      }
      const lunchEndMins = parseHHmm(time.lunchEnd);
      const nowMins = new Date().getHours() * 60 + new Date().getMinutes();
      if (nowMins >= lunchEndMins) {
        setPeriodLabel('距下班还有');
        setLunchCopy('');
        const sec = secondsToWorkEnd(time);
        setCountdown(sec != null ? formatCountdownSeconds(sec) : '');
      } else {
        setPeriodLabel('距午休还有');
        setLunchCopy('');
        const sec = secondsToLunchStart(time);
        setCountdown(sec != null ? formatCountdownSeconds(sec) : '');
      }
    };
    updateCountdown();
    tickRef.current = setInterval(updateCountdown, 1000);
    return () => {
      if (tickRef.current) clearInterval(tickRef.current);
    };
  }, [todayIsHoliday, todayIsPaidLeave, todayIsWeekend, todayLeaveMark]);

  useEffect(() => {
    retirementTickRef.current = setInterval(() => {
      setRetirementTotalSec((prev) => (prev != null && prev > 0 ? prev - 1 : prev));
    }, 1000);
    return () => {
      if (retirementTickRef.current) clearInterval(retirementTickRef.current);
    };
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetch();
    setRefreshing(false);
  };

  const handleOffworkPress = async () => {
    if (overtimeInProgress) {
      setSettleModalCopy(pickOvertimeSettleCopy());
      setShowSettleModal(true);
      return;
    }
    const time = await loadTimeConfig();
    const now = new Date();
    const nowMins = now.getHours() * 60 + now.getMinutes();
    const workEndMins = parseHHmm(time.workEnd);
    if (nowMins < workEndMins) {
      const early = workEndMins - nowMins;
      setOffworkType('early');
      setOffworkModal(true);
      return;
    }
    if (nowMins >= workEndMins && nowMins < workEndMins + 15) {
      setOffworkType('ontime');
      setOffworkModal(true);
      return;
    }
    const overtime = nowMins - workEndMins;
    setOvertimeMins(overtime);
    setOvertimeStep(1);
    setOvertimeChoice(null);
    setOffworkType('overtime');
    setOffworkModal(true);
  };

  const runOffworkSuccessAnimation = () => {
    Animated.sequence([
      Animated.timing(offworkBtnScale, { toValue: 0.94, duration: 80, useNativeDriver: true }),
      Animated.timing(offworkBtnScale, { toValue: 1, duration: 120, useNativeDriver: true }),
    ]).start();
  };

  const confirmOffwork = async () => {
    if (offworkType === 'early') {
      Alert.alert('今日这个 b 班就上到这了！', '已记录提前下班，结算见上方今日数据。');
      await addRecord({ category: 'offwork', amount: 0, label: '提前下班', content: '提前下班' });
    } else if (offworkType === 'ontime') {
      Alert.alert('准点跑路，拒绝内卷！', '已记录准点下班。');
      await addRecord({ category: 'offwork', amount: 0, label: '准点下班', content: '准点下班' });
    }
    setOffworkModal(false);
    setOffworkType(null);
    fetch();
    runOffworkSuccessAnimation();
  };

  const handleOvertimeChoosePaid = () => {
    setOvertimeChoice('paid');
    setOvertimeStep(2);
  };

  const handleOvertimeChooseUnpaid = () => {
    setOvertimeChoice('unpaid');
    setOvertimeStep(2);
  };

  const handleOvertimeDone = async () => {
    const time = timeConfigRef.current;
    if (!time) return;
    const workEndMins = parseHHmm(time.workEnd);
    const now = new Date();
    const nowMins = now.getHours() * 60 + now.getMinutes();
    const durationMins = Math.max(0, nowMins - workEndMins);
    const durationSec = durationMins * 60;
    if (overtimeChoice === 'paid') {
      const amount = hourlyWage * (durationMins / 60);
      await addRecord({
        category: 'paid_overtime',
        amount,
        durationSeconds: durationSec,
        label: '有偿加班',
        content: '有偿加班',
      });
    } else {
      await addRecord({
        category: 'unpaid_overtime',
        amount: 0,
        durationSeconds: durationSec,
        label: '无偿加班',
        content: '无偿加班',
      });
    }
    setOffworkModal(false);
    setOffworkType(null);
    setOvertimeStep(1);
    setOvertimeChoice(null);
    fetch();
  };

  const handleOvertimeContinue = async () => {
    const time = timeConfigRef.current;
    if (!time) return;
    const [h, m] = time.workEnd.split(':').map(Number);
    const now = new Date();
    const workEndToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, m, 0, 0);
    const startAt = workEndToday.getTime();
    const isPaid = overtimeChoice === 'paid';
    await saveOvertimeInProgress(startAt, isPaid);
    setOvertimeStartAt(startAt);
    setOvertimeIsPaid(isPaid);
    setOvertimeInProgress(true);
    setOvertimeElapsedSec(0);
    setStopOvertimeBtnText(pickStopOvertimeCopy());
    setOffworkModal(false);
    setOffworkType(null);
    setOvertimeStep(1);
    setOvertimeChoice(null);
    fetch();
  };

  const confirmOvertimeSettle = async () => {
    if (overtimeStartAt == null) return;
    const durationSec = Math.floor((Date.now() - overtimeStartAt) / 1000);
    const durationMins = durationSec / 60;
    if (overtimeIsPaid) {
      const amount = hourlyWage * (durationMins / 60);
      await addRecord({
        category: 'paid_overtime',
        amount,
        durationSeconds: durationSec,
        label: '有偿加班',
        content: '有偿加班',
      });
    } else {
      await addRecord({
        category: 'unpaid_overtime',
        amount: 0,
        durationSeconds: durationSec,
        label: '无偿加班',
        content: '无偿加班',
      });
    }
    await clearOvertimeInProgress();
    setOvertimeInProgress(false);
    setOvertimeStartAt(null);
    setShowSettleModal(false);
    fetch();
    runOffworkSuccessAnimation();
  };

  const todayOvertimeRecords = todayRecords.filter((r) => r.category === 'paid_overtime' || r.category === 'unpaid_overtime');

  const openOvertimeEdit = (record: RecordEntry) => {
    const start = new Date(record.createdAt);
    const end = new Date(start.getTime() + (record.durationSeconds ?? 0) * 1000);
    const pad = (n: number) => String(n).padStart(2, '0');
    setEditOvertimeRecord(record);
    setOvertimeEditStart(`${pad(start.getHours())}:${pad(start.getMinutes())}`);
    setOvertimeEditEnd(`${pad(end.getHours())}:${pad(end.getMinutes())}`);
    setOvertimeEditPaid(record.category === 'paid_overtime');
  };

  const saveOvertimeEdit = async () => {
    if (!editOvertimeRecord) return;
    const parseTime = (s: string) => {
      const [h, m] = s.split(':').map(Number);
      return { h: isNaN(h) ? 0 : h, m: isNaN(m) ? 0 : m };
    };
    const d = new Date(editOvertimeRecord.createdAt);
    const start = parseTime(overtimeEditStart);
    const end = parseTime(overtimeEditEnd);
    const startDate = new Date(d.getFullYear(), d.getMonth(), d.getDate(), start.h, start.m, 0, 0);
    const endDate = new Date(d.getFullYear(), d.getMonth(), d.getDate(), end.h, end.m, 0, 0);
    let durationSec = Math.round((endDate.getTime() - startDate.getTime()) / 1000);
    if (durationSec <= 0) durationSec = 0;
    const amount = overtimeEditPaid ? hourlyWage * (durationSec / 3600) : 0;
    await updateRecord(editOvertimeRecord.id, {
      createdAt: startDate.toISOString(),
      durationSeconds: durationSec,
      amount,
      category: overtimeEditPaid ? 'paid_overtime' : 'unpaid_overtime',
      label: overtimeEditPaid ? '有偿加班' : '无偿加班',
      content: overtimeEditPaid ? '有偿加班' : '无偿加班',
    });
    Alert.alert(pickOvertimeEditSaveCopy(), '加班记录已更新');
    setEditOvertimeRecord(null);
    fetch();
  };

  const deleteOvertimeEntry = () => {
    if (!editOvertimeRecord) return;
    Alert.alert(
      pickOvertimeEditDeleteCopy(),
      `确定删除这条加班记录？\n${editOvertimeRecord.label} ${formatDuration(editOvertimeRecord.durationSeconds ?? 0)}`,
      [
        { text: '取消', style: 'cancel' },
        {
          text: '删除',
          style: 'destructive',
          onPress: async () => {
            await deleteRecord(editOvertimeRecord.id);
            setEditOvertimeRecord(null);
            fetch();
          },
        },
      ]
    );
  };

  const styles = makeStyles(colors);

  const topInset = (Constants.statusBarHeight ?? (Platform.OS === 'ios' ? 44 : 24)) + 12;

  const covCommute = outcomeBreakdown.commuteDay;
  const covMortgage = outcomeBreakdown.mortgageDay;
  const covLunch = outcomeBreakdown.lunch;
  const covExpense = outcomeBreakdown.expense;
  const covTarget =
    covCommute + covMortgage + covLunch + covExpense + fireDailySocial + fireDailyMedical;
  const coverageEarned = (daySalaryEligible ? earnedByTimeToday : 0) + paidOvertimeToday;
  const coverageCovered = covTarget > 0 && coverageEarned >= covTarget;

  /** 周六日且非法定假、无年假病假：不按日薪摊，状态卡用骚话+倒计时 */
  const isPureWeekend =
    todayIsWeekend &&
    !todayIsHoliday &&
    !todayIsPaidLeave &&
    isPureWeekendVibe(new Date(), niumaConfig);
  const weekendVibeLine = useMemo(() => pickWeekendEarnedLabel(), [todayDataKey]);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.content, { paddingTop: topInset }]}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
      }
    >
      {/* 顶部状态卡片：打工状态 + 核心数据，点击展开/收起敏感数据 */}
      <Pressable style={styles.statusCard} onPress={() => setSalaryMasked((m) => !m)}>
        <View style={styles.statusLabelWrap}>
          {periodLabel === '今日打工已结束' ? (
            <>
              <Ionicons name="checkmark-circle" size={20} color={UI.success} />
              <Text style={styles.statusLabel}>今日打工已结束</Text>
            </>
          ) : (
            <Text style={styles.statusLabel}>{periodLabel} {countdown || ''}</Text>
          )}
        </View>
        {lunchCopy ? <Text style={styles.statusHint}>{lunchCopy}</Text> : null}
        <View style={styles.statusRow}>
          <View style={styles.statusCol}>
            <Text style={styles.statusColLabel}>
              {isPureWeekend
                ? weekendVibeLine
                : todayIsHoliday || todayIsPaidLeave
                  ? '今日已薅（按天摊）'
                  : '今日已赚'}
            </Text>
            {isPureWeekend ? (
              <>
                <Text style={styles.statusColValue}>{formatCountdownSeconds(countdownToWorkSec)}</Text>
                <Text style={styles.statusColSmall}>距下一工作日到点上班</Text>
              </>
            ) : (
              <>
                <Text style={styles.statusColValue}>{formatMoney(earnedByTimeToday)}</Text>
                <Text style={styles.statusColSmall}>日薪 {formatMoney(daySalaryReport)}</Text>
              </>
            )}
          </View>
          <View style={styles.statusCol}>
            <Text style={styles.statusColLabel}>
              {todayIsHoliday || todayIsPaidLeave || todayIsWeekend ? '已爽摸时长' : '已上班时长'}
            </Text>
            <Text style={styles.statusColValue}>{formatDurationHHMMSS(workSecToday)}</Text>
            <Text style={styles.statusColSmall}>
              {todayIsHoliday || todayIsPaidLeave || todayIsWeekend ? '自 0 点起计时' : '有效工时'}
            </Text>
          </View>
        </View>
        {!salaryMasked && (
          <View style={styles.statusSensitive}>
            <Text style={styles.statusSensitiveText}>时薪 {formatMoney(hourlyWage)}/小时</Text>
            <Text style={styles.statusSensitiveText}>本月收入 {formatMoney(monthIncome)}</Text>
          </View>
        )}
        {salaryMasked && <Text style={styles.statusTapHint}>······ 点击卡片显示时薪/本月收入</Text>}
      </Pressable>

      {/* 数据卡片：今日收支/摸鱼/被白嫖 */}
      <View style={styles.dataCard}>
        <View style={styles.dataRow}>
          <Text style={styles.dataLabel}>今日实际净结余</Text>
          <Text style={[styles.dataValueBig, todayBalance >= 0 ? styles.dataValueSuccess : styles.dataValueDanger]}>{formatMoney(todayBalance)}</Text>
        </View>
        {balanceCopy ? <Text style={styles.dataCopy}>{balanceCopy}</Text> : null}
        <View style={styles.dataDivider} />
        <Pressable style={styles.dataRow} onPress={() => router.push('/(tabs)/reports')}>
          <Text style={styles.dataLabel}>今日摸鱼·薅羊毛</Text>
          <View style={styles.dataRowRight}>
            <Text style={styles.dataValueOrange}>{formatMoney(todayMoyuYangmao)}</Text>
            <Text style={styles.dataTapHint}>点击看明细</Text>
          </View>
        </Pressable>
        <View style={styles.dataDivider} />
        <Pressable style={styles.dataRow} onPress={() => setShowOutcomeDetail((v) => !v)}>
          <Text style={styles.dataLabel}>今日总支出</Text>
          <View style={styles.dataRowRight}>
            <Text style={styles.dataValueDanger}>{formatMoney(todayOutcome)}</Text>
            <Text style={styles.dataTapHint}>点击看明细</Text>
          </View>
        </Pressable>
        {showOutcomeDetail && (
          <View style={styles.dataDetailBlock}>
            <View style={styles.dataDetailRow}><Text style={styles.dataDetailLabel}>房贷/工作日</Text><Text style={styles.dataDetailAmount}>{formatMoney(outcomeBreakdown.mortgageDay)}</Text></View>
            <View style={styles.dataDetailRow}><Text style={styles.dataDetailLabel}>通勤（日均+今日额外）</Text><Text style={styles.dataDetailAmount}>{formatMoney(outcomeBreakdown.commuteDay)}</Text></View>
            {outcomeBreakdown.lunch > 0 && (
              <View style={styles.dataDetailRow}><Text style={styles.dataDetailLabel}>午饭</Text><Text style={styles.dataDetailAmount}>{formatMoney(outcomeBreakdown.lunch)}</Text></View>
            )}
            {outcomeBreakdown.expense > 0 && (
              <>
                <View style={styles.dataDetailRow}><Text style={styles.dataDetailLabel}>支出</Text><Text style={styles.dataDetailAmount}>{formatMoney(outcomeBreakdown.expense)}</Text></View>
                {expenseByLabel.map(({ label, amount }) => (
                  <View key={label} style={styles.dataDetailRow}>
                    <Text style={styles.dataDetailSubLabel}>- {label}</Text>
                    <Text style={[styles.dataDetailAmount, styles.dataDetailLoss]}>{formatMoney(amount)}</Text>
                  </View>
                ))}
              </>
            )}
          </View>
        )}
        <View style={styles.dataDivider} />
        <Pressable style={styles.dataRow} onPress={() => setShowMoyuDurationDetail((v) => !v)}>
          <Text style={styles.dataLabel}>今日摸鱼总时长</Text>
          <View style={styles.dataRowRight}>
            <Text style={styles.dataValueOrange}>{Math.floor(moyuDurationSec / 60)}分{moyuDurationSec % 60}秒 · {formatMoney(moyuAmountToday)}</Text>
            <Text style={styles.dataTapHint}>点击看明细</Text>
          </View>
        </Pressable>
        {showMoyuDurationDetail && (
          <View style={styles.dataDetailBlock}>
            {todayRecords.filter((r) => MOYU_CATS.includes(r.category) && (r.durationSeconds ?? 0) > 0).length === 0 ? (
              <Text style={styles.dataDetailEmpty}>今日暂无摸鱼时长记录</Text>
            ) : (
              todayRecords
                .filter((r) => MOYU_CATS.includes(r.category) && (r.durationSeconds ?? 0) > 0)
                .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                .map((r) => (
                  <View key={r.id} style={styles.dataDetailRow}>
                    <Text style={styles.dataDetailTime}>{new Date(r.createdAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}</Text>
                    <Text style={styles.dataDetailLabel}>{CAT_LABELS[r.category] || r.category}</Text>
                    <Text style={styles.dataDetailAmount}>{formatDuration(r.durationSeconds ?? 0)} · {formatMoney(r.amount)}</Text>
                  </View>
                ))
            )}
          </View>
        )}
        <View style={styles.dataDivider} />
        <View style={styles.dataRow}>
          <Text style={styles.dataLabel}>今日被白嫖时长</Text>
          <Text style={styles.dataValueGray}>{Math.floor(unpaidDurationSec / 60)} 分 · 约 {formatMoney(unpaidAmountToday)}</Text>
        </View>
      </View>

      {todayOvertimeRecords.length > 0 && (
        <View style={styles.overtimeListBlock}>
          <Text style={styles.overtimeListTitle}>今日加班记录</Text>
          {todayOvertimeRecords.map((r) => {
            const start = new Date(r.createdAt);
            const end = new Date(start.getTime() + (r.durationSeconds ?? 0) * 1000);
            const pad = (n: number) => String(n).padStart(2, '0');
            const startStr = `${pad(start.getHours())}:${pad(start.getMinutes())}`;
            const endStr = `${pad(end.getHours())}:${pad(end.getMinutes())}`;
            return (
              <View key={r.id} style={styles.overtimeListRow}>
                <View style={styles.overtimeListLeft}>
                  <Text style={styles.overtimeListLabel}>{r.category === 'paid_overtime' ? '有偿' : '无偿'}</Text>
                  <Text style={styles.overtimeListTime}>{startStr} - {endStr} · {formatDuration(r.durationSeconds ?? 0)}</Text>
                  {r.amount > 0 && <Text style={styles.overtimeListAmount}>{formatMoney(r.amount)}</Text>}
                </View>
                <Pressable style={styles.overtimeListEditBtn} onPress={() => openOvertimeEdit(r)}>
                  <Text style={styles.overtimeListEditText}>编辑</Text>
                </Pressable>
              </View>
            );
          })}
        </View>
      )}

      {/* 倒计时卡片：退休 + 下一个假日 */}
      <View style={styles.countdownCardNew}>
        <View style={styles.countdownCardCol}>
          <View style={styles.countdownCardIconWrap}>
            <Ionicons name="hourglass-outline" size={22} color={UI.primary} />
          </View>
          <Text style={styles.countdownCardLabel}>退休倒计时</Text>
          <Text style={styles.countdownCardValue}>{retirementTotalSec != null ? formatRetirementFromSeconds(retirementTotalSec) : '—'}</Text>
          <Text style={styles.countdownCardHint}>再熬熬就解放！</Text>
        </View>
        <View style={styles.countdownCardDivider} />
        <View style={styles.countdownCardCol}>
          <View style={styles.countdownCardIconWrap}>
            <Ionicons name="umbrella-outline" size={22} color={UI.primary} />
          </View>
          {todayIsHoliday ? (
            <>
              <Text style={styles.countdownCardLabel}>今日假日</Text>
              <Text style={styles.countdownCardValue}>直接爽摸</Text>
            </>
          ) : nextHoliday ? (
            <>
              <Text style={styles.countdownCardLabel}>下一个法定假日</Text>
              <Text style={styles.countdownCardValue}>{nextHoliday.name} 还有{nextHoliday.daysLeft}天</Text>
              <Text style={styles.countdownCardHint}>再撑{nextHoliday.daysLeft}天就能躺平！</Text>
            </>
          ) : (
            <>
              <Text style={styles.countdownCardLabel}>下一个法定假日</Text>
              <Text style={styles.countdownCardValue}>—</Text>
            </>
          )}
        </View>
      </View>

      {(todayIsHoliday || todayIsPaidLeave || todayIsWeekend) && (
        <View style={styles.shuangmoCard}>
          <Text style={styles.shuangmoTitle}>
            {todayLeaveMark === 'sick_leave' && sickShuangmoTitle
              ? sickShuangmoTitle
              : isPureWeekend
                ? '周末愉快 · 下个班再说'
                : '你还能爽摸的倒计时'}
          </Text>
          <Text style={styles.shuangmoCountdown}>
            下一工作日到点上班 · 还有 {formatCountdownSeconds(countdownToWorkSec)}
          </Text>
          <View style={styles.shuangmoRow}>
            <Text style={styles.shuangmoLabel}>已爽摸</Text>
            <Text style={styles.shuangmoValue}>{formatCountdownSeconds(shuangmoSecToday)}</Text>
          </View>
          {!isPureWeekend && (
            <View style={styles.shuangmoRow}>
              <Text style={styles.shuangmoLabel}>{todayLeaveMark === 'sick_leave' ? '带薪回血' : '已薅'}</Text>
              <Text style={styles.shuangmoValue}>{formatMoney(shuangmoMoney)}</Text>
            </View>
          )}
          {todayLeaveMark === 'sick_leave' && sickShuangmoFootnote ? (
            <Text style={styles.shuangmoFootnote}>{sickShuangmoFootnote}</Text>
          ) : null}
        </View>
      )}

      {covTarget > 0 && (
        <IncomeCoverageModule
          commute={covCommute}
          mortgage={covMortgage}
          fireSocial={fireDailySocial}
          fireMedical={fireDailyMedical}
          lunch={covLunch}
          expense={covExpense}
          coverageEarned={coverageEarned}
          statusRedCopy={coverRedCopy}
          statusGreenCopy={coverGreenCopy}
          stampText={coverageCovered ? coverageStampText : null}
          isCovered={coverageCovered}
          onPressNavigate={() => router.push('/(tabs)/reports')}
        />
      )}

      {overtimeInProgress && overtimeStartAt != null && (
        <View style={styles.overtimeCard}>
          <Text style={styles.overtimeCardTitle}>加班中</Text>
          <Text style={styles.overtimeCardTime}>已加班 {formatCountdownSeconds(overtimeElapsedSec)}</Text>
          {overtimeStartAt > 0 && (
            <Text style={styles.overtimeCardStart}>开始时间 {new Date(overtimeStartAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}</Text>
          )}
          {overtimeIsPaid ? (
            <Text style={styles.overtimeCardMoney}>加班费 {formatMoney(hourlyWage * (overtimeElapsedSec / 3600))}</Text>
          ) : (
            <>
              <Text style={styles.overtimeCardUnpaid}>{OVERTIME_UNPAID_HINT}</Text>
              <Text style={styles.overtimeCardLost}>少赚 {formatMoney(hourlyWage * (overtimeElapsedSec / 3600))}</Text>
            </>
          )}
        </View>
      )}

      <Animated.View style={{ transform: [{ scale: offworkBtnScale }] }}>
        <Pressable
          style={styles.offworkBtn}
          onPress={() => {
            Vibration.vibrate(50);
            handleOffworkPress();
          }}
        >
          {overtimeInProgress ? (
            <Text style={styles.offworkBtnText}>{stopOvertimeBtnText}</Text>
          ) : isOvertime ? (
            <Text style={styles.offworkBtnText}>{overtimeBtnText || '今天加班了，记一笔'}</Text>
          ) : periodLabel === '今日打工已结束' ? (
            <View style={styles.offworkBtnRow}>
              <Ionicons name="checkmark-circle" size={20} color="#FFFFFF" style={styles.offworkBtnIcon} />
              <Text style={styles.offworkBtnText}>今日打工结束，明天再卷</Text>
            </View>
          ) : (
            <View style={styles.offworkBtnRow}>
              <Ionicons name="exit-outline" size={20} color="#FFFFFF" style={styles.offworkBtnIcon} />
              <Text style={styles.offworkBtnText}>到点跑路，拒绝内卷</Text>
            </View>
          )}
        </Pressable>
      </Animated.View>

      <Pressable style={styles.statsLink} onPress={() => router.push('/(tabs)/reports')}>
        <Text style={styles.statsLinkText}>→ 查看完整统计</Text>
      </Pressable>

      <Modal visible={offworkModal} transparent animationType="fade">
        <Pressable style={styles.modalOverlay} onPress={() => { setOffworkModal(false); setOffworkType(null); setOvertimeStep(1); setOvertimeChoice(null); }}>
          <Pressable style={styles.modalCard} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.modalTitle}>
              {offworkType === 'early' && '今日这个 b 班就上到这了！'}
              {offworkType === 'ontime' && '准点跑路，拒绝内卷！'}
              {offworkType === 'overtime' && overtimeStep === 1 && `已加班 ${overtimeMins} 分钟`}
              {offworkType === 'overtime' && overtimeStep === 2 && '选好了～ 还在干还是干够了？'}
            </Text>
            <Text style={styles.modalHint}>
              {offworkType === 'early' && '结算见上方今日数据，提前时长算薅老板～'}
              {offworkType === 'ontime' && '正常结算今日摸鱼与收支'}
              {offworkType === 'overtime' && overtimeStep === 1 && '请选择：有偿（计入收入）/ 无偿（只记被白嫖）'}
              {offworkType === 'overtime' && overtimeStep === 2 && (overtimeChoice === 'paid' ? '有偿加班，干够了就记一笔' : '无偿加班，干够了就记被白嫖')}
            </Text>
            <View style={styles.modalRow}>
              <Pressable style={styles.modalBtnCancel} onPress={() => { setOffworkModal(false); setOffworkType(null); setOvertimeStep(1); setOvertimeChoice(null); }}>
                <Text style={styles.modalBtnCancelText}>取消</Text>
              </Pressable>
              {offworkType === 'overtime' && overtimeStep === 1 ? (
                <>
                  <Pressable style={[styles.modalBtnOk, styles.modalBtnSecondary]} onPress={handleOvertimeChooseUnpaid}>
                    <Text style={styles.modalBtnOkText}>无偿</Text>
                  </Pressable>
                  <Pressable style={styles.modalBtnOk} onPress={handleOvertimeChoosePaid}>
                    <Text style={styles.modalBtnOkText}>有偿</Text>
                  </Pressable>
                </>
              ) : offworkType === 'overtime' && overtimeStep === 2 ? (
                <>
                  <Pressable style={[styles.modalBtnOk, styles.modalBtnSecondary]} onPress={handleOvertimeDone}>
                    <Text style={styles.modalBtnOkText}>干够了</Text>
                  </Pressable>
                  <Pressable style={styles.modalBtnOk} onPress={handleOvertimeContinue}>
                    <Text style={styles.modalBtnOkText}>还在干</Text>
                  </Pressable>
                </>
              ) : (
                <Pressable style={styles.modalBtnOk} onPress={confirmOffwork}>
                  <Text style={styles.modalBtnOkText}>确定</Text>
                </Pressable>
              )}
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={showSettleModal} transparent animationType="fade">
        <Pressable style={styles.modalOverlay} onPress={() => setShowSettleModal(false)}>
          <Pressable style={styles.modalCard} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.modalTitle}>{settleModalCopy || '加班结算'}</Text>
            <View style={styles.settleBlock}>
              <Text style={styles.settleRow}>加班时长 {formatDuration(overtimeElapsedSec)}</Text>
              {overtimeStartAt != null && (
                <Text style={styles.settleRow}>开始时间 {new Date(overtimeStartAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}</Text>
              )}
              {overtimeIsPaid ? (
                <Text style={[styles.settleRow, styles.settleMoney]}>加班费 {formatMoney(hourlyWage * (overtimeElapsedSec / 3600))}</Text>
              ) : (
                <Text style={[styles.settleRow, styles.settleLoss]}>少赚 {formatMoney(hourlyWage * (overtimeElapsedSec / 3600))}（无偿）</Text>
              )}
            </View>
            <View style={styles.modalRow}>
              <Pressable style={styles.modalBtnCancel} onPress={() => setShowSettleModal(false)}>
                <Text style={styles.modalBtnCancelText}>取消</Text>
              </Pressable>
              <Pressable style={styles.modalBtnOk} onPress={confirmOvertimeSettle}>
                <Text style={styles.modalBtnOkText}>确认结算</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={editOvertimeRecord != null} transparent animationType="fade">
        <Pressable style={styles.modalOverlay} onPress={() => setEditOvertimeRecord(null)}>
          <Pressable style={[styles.modalCard, styles.editModalCard]} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.modalTitle}>编辑加班</Text>
            <Text style={styles.editLabel}>开始时间</Text>
            <TextInput
              style={styles.editInput}
              value={overtimeEditStart}
              onChangeText={setOvertimeEditStart}
              placeholder="18:00"
              placeholderTextColor={colors.gray}
            />
            <Text style={styles.editLabel}>结束时间</Text>
            <TextInput
              style={styles.editInput}
              value={overtimeEditEnd}
              onChangeText={setOvertimeEditEnd}
              placeholder="20:00"
              placeholderTextColor={colors.gray}
            />
            <Text style={styles.editLabel}>类型</Text>
            <View style={styles.editTypeRow}>
              <Pressable
                style={[styles.editTypeBtn, overtimeEditPaid && styles.editTypeBtnActive]}
                onPress={() => setOvertimeEditPaid(true)}
              >
                <Text style={[styles.editTypeText, overtimeEditPaid && styles.editTypeTextActive]}>有偿</Text>
              </Pressable>
              <Pressable
                style={[styles.editTypeBtn, !overtimeEditPaid && styles.editTypeBtnActive]}
                onPress={() => setOvertimeEditPaid(false)}
              >
                <Text style={[styles.editTypeText, !overtimeEditPaid && styles.editTypeTextActive]}>无偿</Text>
              </Pressable>
            </View>
            <Pressable style={styles.editDeleteBtn} onPress={deleteOvertimeEntry}>
              <Text style={styles.editDeleteText}>删除这条记录</Text>
            </Pressable>
            <View style={styles.modalRow}>
              <Pressable style={styles.modalBtnCancel} onPress={() => setEditOvertimeRecord(null)}>
                <Text style={styles.modalBtnCancelText}>取消</Text>
              </Pressable>
              <Pressable style={styles.modalBtnOk} onPress={saveOvertimeEdit}>
                <Text style={styles.modalBtnOkText}>保存</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </ScrollView>
  );
}

const makeStyles = (c: Record<string, string>) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: c.background },
    content: { padding: 16, paddingBottom: 48 },
    statusCard: {
      backgroundColor: UI.statusCardBg,
      borderRadius: 16,
      padding: 20,
      marginBottom: 12,
      alignItems: 'center',
    },
    statusLabelWrap: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginBottom: 4 },
    statusLabel: { fontSize: 16, color: UI.cardTitle, fontWeight: '600' },
    statusHint: { fontSize: 12, color: UI.secondary, marginTop: 4 },
    statusRow: { flexDirection: 'row', width: '100%', justifyContent: 'space-between', marginTop: 16, gap: 16 },
    statusCol: { flex: 1, alignItems: 'center' },
    statusColLabel: { fontSize: 12, color: UI.secondary, marginBottom: 4 },
    statusColValue: { fontSize: 28, fontWeight: '700', color: UI.primary, fontVariant: ['tabular-nums'] },
    statusColSmall: { fontSize: 12, color: UI.secondary, marginTop: 2 },
    statusSensitive: { marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: UI.divider, width: '100%', alignItems: 'center' },
    statusSensitiveText: { fontSize: 14, color: UI.cardTitle },
    statusTapHint: { fontSize: 12, color: UI.secondary, marginTop: 8 },
    dataCard: {
      backgroundColor: UI.cardBg,
      borderRadius: 12,
      padding: 16,
      marginBottom: 12,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.06,
      shadowRadius: 4,
      elevation: 2,
    },
    dataRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', paddingVertical: 12, gap: 8 },
    dataLabel: { fontSize: 16, color: UI.cardTitle, flex: 1 },
    dataValueBig: { fontSize: 28, fontWeight: '700', fontVariant: ['tabular-nums'] },
    dataValueSuccess: { color: UI.success },
    dataValueDanger: { color: UI.danger, fontWeight: '600', fontVariant: ['tabular-nums'] },
    dataValueOrange: { fontSize: 16, fontWeight: '600', color: UI.primary, fontVariant: ['tabular-nums'] },
    dataValueGray: { fontSize: 14, color: UI.secondary, fontVariant: ['tabular-nums'] },
    dataCopy: { fontSize: 12, color: UI.secondary, fontStyle: 'italic', marginTop: 2 },
    dataDivider: { height: 1, backgroundColor: UI.divider, marginVertical: 4 },
    dataTapHint: { fontSize: 12, color: UI.secondary },
    dataRowRight: { alignItems: 'flex-end' },
    dataDetailBlock: { paddingVertical: 8, paddingLeft: 12, borderLeftWidth: 3, borderLeftColor: UI.primary, marginTop: 4 },
    dataDetailRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 4, gap: 8 },
    dataDetailLabel: { flex: 1, fontSize: 14, color: UI.cardTitle },
    dataDetailAmount: { fontSize: 14, fontWeight: '600', color: UI.primary },
    dataDetailSubLabel: { flex: 1, fontSize: 14, color: UI.secondary, marginLeft: 8 },
    dataDetailLoss: { color: UI.danger },
    dataDetailEmpty: { fontSize: 12, color: UI.secondary, fontStyle: 'italic', paddingVertical: 8 },
    dataDetailTime: { fontSize: 12, color: UI.secondary, width: 40 },
    countdownCardNew: {
      flexDirection: 'row',
      backgroundColor: UI.cardBg,
      borderRadius: 12,
      padding: 16,
      marginBottom: 12,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.06,
      shadowRadius: 4,
      elevation: 2,
    },
    countdownCardCol: { flex: 1, alignItems: 'center' },
    countdownCardIconWrap: { marginBottom: 4, height: 24, justifyContent: 'center', alignItems: 'center' },
    countdownCardLabel: { fontSize: 12, color: UI.secondary, marginBottom: 2 },
    countdownCardValue: { fontSize: 16, fontWeight: '700', color: UI.primary, fontVariant: ['tabular-nums'] },
    countdownCardHint: { fontSize: 12, color: UI.secondary, marginTop: 2 },
    countdownCardDivider: { width: 1, backgroundColor: UI.divider, marginHorizontal: 8 },
    countdownCard: {
      backgroundColor: c.card,
      borderRadius: 16,
      padding: 20,
      marginBottom: 16,
      alignItems: 'center',
      borderLeftWidth: 4,
      borderLeftColor: c.primary,
    },
    countdownLabel: { fontSize: 14, color: c.gray, marginBottom: 4 },
    countdownValue: { fontSize: 28, fontWeight: '700', color: c.primary, fontVariant: ['tabular-nums'] },
    countdownHint: { fontSize: 13, color: c.gray, marginTop: 6 },
    row: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 12,
      paddingHorizontal: 4,
      borderBottomWidth: 1,
      borderBottomColor: c.cardLight,
    },
    rowLabel: { fontSize: 14, color: c.gray, flex: 1 },
    rowValue: { fontSize: 15, fontWeight: '600', color: c.primary, fontVariant: ['tabular-nums'] },
    loss: { color: c.danger },
    offworkBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      height: 50,
      backgroundColor: UI.primary,
      borderRadius: 12,
      marginTop: 20,
      width: '100%',
    },
    offworkBtnRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
    offworkBtnIcon: { marginRight: 8 },
    offworkBtnText: { fontSize: 17, fontWeight: '600', color: '#FFFFFF' },
    statsLink: { alignItems: 'center', marginTop: 16, paddingVertical: 12 },
    statsLinkText: { fontSize: 16, color: UI.primary, fontWeight: '500' },
    linkCard: {
      backgroundColor: c.card,
      borderRadius: 12,
      padding: 16,
      marginTop: 16,
      alignItems: 'center',
    },
    linkText: { fontSize: 16, color: c.primary, fontWeight: '500' },
    fixedCard: { backgroundColor: c.card, borderRadius: 16, padding: 20, marginTop: 16, marginBottom: 8 },
    shuangmoCard: { backgroundColor: c.card, borderRadius: 16, padding: 20, marginTop: 12, marginBottom: 8, borderLeftWidth: 4, borderLeftColor: c.primary },
    shuangmoTitle: { fontSize: 15, color: c.gray, marginBottom: 8 },
    shuangmoCountdown: { fontSize: 22, fontWeight: '700', color: c.primary, fontVariant: ['tabular-nums'], marginBottom: 12 },
    shuangmoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6 },
    shuangmoLabel: { fontSize: 14, color: c.gray },
    shuangmoValue: { fontSize: 15, fontWeight: '600', color: c.primary, fontVariant: ['tabular-nums'] },
    shuangmoFootnote: { fontSize: 12, color: c.gray, marginTop: 10, lineHeight: 18 },
    fixedHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
    cardLabel: { fontSize: 14, color: c.gray },
    badge: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    badgeText: { fontSize: 13, color: c.success, fontWeight: '600' },
    progressTrack: { height: 8, borderRadius: 4, backgroundColor: 'rgba(15,23,42,0.08)', overflow: 'hidden' },
    progressTrackWithSegments: { position: 'relative' as const, height: 10 },
    progressSegmentLine: { position: 'absolute' as const, top: 0, bottom: 0, width: 2, marginLeft: -1, backgroundColor: 'rgba(15,23,42,0.15)' },
    earnedProgress: { height: 12, marginTop: 12, position: 'relative' },
    progressSegmentAbs: { position: 'absolute', left: 0, top: 0, bottom: 0, borderRadius: 4 },
    progressFill: { height: '100%', borderRadius: 4, opacity: 0.9 },
    progressLabel: { fontSize: 11, color: c.gray, marginTop: 6, fontStyle: 'italic' },
    progressLegend: { fontSize: 10, color: c.gray, marginTop: 2, fontStyle: 'italic' },
    rowWithCopy: { borderBottomWidth: 1, borderBottomColor: c.cardLight, paddingBottom: 6 },
    rowInner: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 4 },
    copyHint: { fontSize: 11, color: c.gray, fontStyle: 'italic', marginTop: 4, paddingHorizontal: 4 },
    detailBlock: { paddingHorizontal: 4, paddingVertical: 8, paddingLeft: 12, borderLeftWidth: 3, borderLeftColor: c.primary, marginBottom: 8 },
    detailRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 4, gap: 8 },
    detailTime: { fontSize: 12, color: c.gray, width: 40 },
    detailLabel: { flex: 1, fontSize: 14, color: c.text },
    detailSubLabel: { flex: 1, fontSize: 14, color: c.gray, marginLeft: 8 },
    detailAmount: { fontSize: 14, fontWeight: '600', color: c.primary },
    detailEmpty: { fontSize: 12, color: c.gray, fontStyle: 'italic', paddingVertical: 8 },
    tapHint: { fontSize: 11, fontWeight: '400', color: c.gray, fontStyle: 'italic' },
    caloriesRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8, paddingHorizontal: 4, borderBottomWidth: 1, borderBottomColor: c.cardLight },
    earnedCard: { backgroundColor: c.card, borderRadius: 16, padding: 20, marginBottom: 16 },
    earnedTitle: { fontSize: 16, fontWeight: '600', color: c.gray, marginBottom: 12 },
    cardHint: { fontSize: 11, color: c.gray, marginTop: 4, fontStyle: 'italic' },
    maskedValue: { fontSize: 15, color: c.gray, letterSpacing: 2 },
    maskedHint: { fontSize: 12, color: c.gray, fontWeight: '400', letterSpacing: 0 },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: 24 },
    modalCard: { backgroundColor: c.card, borderRadius: 20, padding: 24, minWidth: 280 },
    modalTitle: { fontSize: 18, fontWeight: '700', color: c.text, marginBottom: 12, textAlign: 'center' },
    modalHint: { fontSize: 14, color: c.gray, marginBottom: 20, textAlign: 'center', lineHeight: 20 },
    modalRow: { flexDirection: 'row', gap: 12, justifyContent: 'flex-end', flexWrap: 'wrap' },
    modalBtnCancel: { paddingVertical: 10, paddingHorizontal: 20 },
    modalBtnCancelText: { fontSize: 16, color: c.gray },
    modalBtnOk: { backgroundColor: c.primary, paddingVertical: 10, paddingHorizontal: 24, borderRadius: 12 },
    modalBtnSecondary: { backgroundColor: c.cardLight },
    modalBtnOkText: { fontSize: 16, fontWeight: '600', color: c.onAccent },
    overtimeCard: {
      backgroundColor: c.card,
      borderRadius: 16,
      padding: 20,
      marginTop: 16,
      marginBottom: 12,
      borderLeftWidth: 4,
      borderLeftColor: c.primary,
    },
    overtimeCardTitle: { fontSize: 14, color: c.gray, marginBottom: 8 },
    overtimeCardTime: { fontSize: 22, fontWeight: '700', color: c.primary, fontVariant: ['tabular-nums'], marginBottom: 4 },
    overtimeCardStart: { fontSize: 13, color: c.gray, marginBottom: 8 },
    overtimeCardMoney: { fontSize: 15, fontWeight: '600', color: c.primary },
    overtimeCardUnpaid: { fontSize: 15, color: c.danger, fontWeight: '600', marginBottom: 2 },
    overtimeCardLost: { fontSize: 14, color: c.gray },
    settleBlock: { marginBottom: 20 },
    settleRow: { fontSize: 15, color: c.text, marginBottom: 8 },
    settleMoney: { fontWeight: '600', color: c.primary },
    settleLoss: { color: c.danger },
    overtimeListBlock: { marginTop: 8, marginBottom: 8 },
    overtimeListTitle: { fontSize: 14, color: c.gray, marginBottom: 8, paddingHorizontal: 4 },
    overtimeListRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10, paddingHorizontal: 4, borderBottomWidth: 1, borderBottomColor: c.cardLight },
    overtimeListLeft: { flex: 1 },
    overtimeListLabel: { fontSize: 15, color: c.text, marginBottom: 2 },
    overtimeListTime: { fontSize: 13, color: c.gray },
    overtimeListAmount: { fontSize: 14, color: c.primary, marginTop: 2 },
    overtimeListEditBtn: { paddingVertical: 8, paddingHorizontal: 16, borderRadius: 8, backgroundColor: c.cardLight },
    overtimeListEditText: { fontSize: 14, color: c.primary },
    editModalCard: { maxWidth: 340 },
    editLabel: { fontSize: 14, color: c.gray, marginBottom: 6, marginTop: 12 },
    editInput: { backgroundColor: c.cardLight, borderRadius: 12, padding: 14, fontSize: 16, color: c.text, marginBottom: 4 },
    editTypeRow: { flexDirection: 'row', gap: 12, marginTop: 8 },
    editTypeBtn: { flex: 1, paddingVertical: 12, borderRadius: 12, alignItems: 'center', backgroundColor: c.cardLight },
    editTypeBtnActive: { backgroundColor: c.primary },
    editTypeText: { fontSize: 15, color: c.gray },
    editTypeTextActive: { color: '#fff', fontWeight: '600' },
    editDeleteBtn: { marginTop: 20, paddingVertical: 10, alignItems: 'center' },
    editDeleteText: { fontSize: 14, color: c.danger },
  });
