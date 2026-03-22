import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Alert,
  Share,
  Dimensions,
  Platform,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import Constants from 'expo-constants';

const UI = {
  primary: '#FF7A00',
  success: '#38A169',
  danger: '#E53E3E',
  secondary: '#999',
  cardTitle: '#666',
  bg: '#FFFFFF',
  statusCardBg: '#FFF9E6',
  cardBg: '#FFFFFF',
  divider: '#EEEEEE',
} as const;
const GRID_GAP = 12;
const SCREEN_WIDTH = Dimensions.get('window').width;
import { formatMoney } from '@/lib/format';
import {
  loadRecords,
  getRecordsInRange,
  clearAllRecords,
  loadMortgageConfig,
  getMortgageEnabled,
  getCommuteMonthlyBudget,
  loadTimeConfig,
  deleteRecord,
  loadFireConfig,
  loadPersonalConfig,
} from '@/lib/storage';
import { formatDuration } from '@/lib/format';
import { loadSalaryConfig } from '@/lib/storage';
import { amountToHours, secondWage } from '@/lib/salary';
import { workedSecondsToday } from '@/lib/workTime';
import { useSalary } from '@/contexts/SalaryContext';
import { getMonthlyPayment, getDailyPayment, getRepaymentProgress, type RepaymentProgress } from '@/lib/mortgage';
import { getTodayRange } from '@/lib/today';
import { computeFireMetrics, parseSocialAvgAnnual } from '@/lib/fireCalculations';
import { getFireDailyCosts } from '@/lib/fireDailyCosts';
import { getUnlockedIds } from '@/lib/achievementUnlock';
import { ACHIEVEMENT_COUNT } from '@/constants/achievements';
import { pickBalanceWin, pickBalanceFlat, pickBalanceLose, getReportBalanceCopy, pickYangmaoDeleteCopy } from '@/constants/copy';
import type { RecordEntry, RecordCategory, TimeConfig } from '@/types';

const CATEGORY_LABELS: Record<RecordCategory, string> = {
  toilet: '带薪如厕',
  bailan: '摆烂摸鱼',
  meeting: '无效会议',
  daze: '摸鱼发呆',
  coffee: '咖啡',
  snack: '零食',
  drink: '饮料',
  charge: '充电薅电费',
  offwork: '下班打卡',
  commute: '通勤',
  mortgage: '房贷',
  lunch: '午饭',
  expense: '万能支出',
  paid_overtime: '有偿加班',
  unpaid_overtime: '无偿加班',
  annual_leave: '年假',
  sick_leave: '病假',
  achievement: '勋章',
  other: '其他',
};

const INCOME_CATS: RecordCategory[] = ['toilet', 'bailan', 'meeting', 'daze', 'coffee', 'snack', 'drink', 'charge', 'paid_overtime'];
const OUTCOME_CATS: RecordCategory[] = ['commute', 'mortgage', 'lunch', 'expense'];

function isWorkDay(d: Date): boolean {
  const day = d.getDay();
  return day >= 1 && day <= 5;
}

function getWeekRange(): [Date, Date] {
  const now = new Date();
  const day = now.getDay();
  const diff = day === 0 ? 6 : day - 1;
  const start = new Date(now);
  start.setDate(now.getDate() - diff);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  return [start, end];
}

function getMonthRange(): [Date, Date] {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
  return [start, end];
}

interface CategoryStat {
  amount: number;
  count: number;
}

const MOYU_CATEGORIES: RecordCategory[] = ['toilet', 'bailan', 'meeting', 'daze', 'coffee', 'snack', 'drink', 'charge'];

const emptyCategoryStat = (): Record<RecordCategory, CategoryStat> => ({
  toilet: { amount: 0, count: 0 },
  bailan: { amount: 0, count: 0 },
  meeting: { amount: 0, count: 0 },
  daze: { amount: 0, count: 0 },
  coffee: { amount: 0, count: 0 },
  snack: { amount: 0, count: 0 },
  drink: { amount: 0, count: 0 },
  charge: { amount: 0, count: 0 },
  offwork: { amount: 0, count: 0 },
  commute: { amount: 0, count: 0 },
  mortgage: { amount: 0, count: 0 },
  lunch: { amount: 0, count: 0 },
  expense: { amount: 0, count: 0 },
  paid_overtime: { amount: 0, count: 0 },
  unpaid_overtime: { amount: 0, count: 0 },
  annual_leave: { amount: 0, count: 0 },
  sick_leave: { amount: 0, count: 0 },
  achievement: { amount: 0, count: 0 },
  other: { amount: 0, count: 0 },
});

export default function ReportsScreen() {
  const router = useRouter();
  const [todayTotal, setTodayTotal] = useState(0);
  const [weeklyTotal, setWeeklyTotal] = useState(0);
  const [monthlyTotal, setMonthlyTotal] = useState(0);
  const [moyuTotal, setMoyuTotal] = useState(0);
  const [commuteLoss, setCommuteLoss] = useState(0);
  const [monthCommute, setMonthCommute] = useState(0);
  const [monthYangmao, setMonthYangmao] = useState(0);
  const [mortgageMonth, setMortgageMonth] = useState(0);
  const [lunchMonth, setLunchMonth] = useState(0);
  const [expenseMonth, setExpenseMonth] = useState(0);
  const [chargeMonth, setChargeMonth] = useState(0);
  const [chargeCount, setChargeCount] = useState(0);
  const [offworkCount, setOffworkCount] = useState(0);
  const [achievementUnlocked, setAchievementUnlocked] = useState(0);
  const [todayBalance, setTodayBalance] = useState(0);
  const [monthBalance, setMonthBalance] = useState(0);
  const [balanceCopy, setBalanceCopy] = useState('');
  const [byCategory, setByCategory] = useState<Record<RecordCategory, CategoryStat>>(emptyCategoryStat());
  const [moyuHours, setMoyuHours] = useState(0);
  const [mortgageConfigMonthly, setMortgageConfigMonthly] = useState<number | null>(null);
  const [mortgageConfigDaily, setMortgageConfigDaily] = useState<number | null>(null);
  const [mortgageRepaymentDay, setMortgageRepaymentDay] = useState<number | null>(null);
  const [mortgageProgress, setMortgageProgress] = useState<RepaymentProgress | null>(null);
  const [commuteMonthlyBudget, setCommuteMonthlyBudget] = useState(0);
  const [unpaidOvertimeSec, setUnpaidOvertimeSec] = useState(0);
  const [unpaidOvertimeAmount, setUnpaidOvertimeAmount] = useState(0);
  const [allRecordsList, setAllRecordsList] = useState<RecordEntry[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [workSecToday, setWorkSecToday] = useState(0);
  const [earnedByTimeToday, setEarnedByTimeToday] = useState(0);
  const [daySalaryReport, setDaySalaryReport] = useState(0);
  const [todayFixedReport, setTodayFixedReport] = useState(0);
  const [todayYangmao, setTodayYangmao] = useState(0);
  const [todayYangmaoByCat, setTodayYangmaoByCat] = useState<Record<string, { amount: number; count: number }>>({});
  const [todayYangmaoRecords, setTodayYangmaoRecords] = useState<RecordEntry[]>([]);
  const [reportBalanceCopy, setReportBalanceCopy] = useState('');
  const [showYangmaoDetail, setShowYangmaoDetail] = useState(false);
  const [summarySegment, setSummarySegment] = useState<'week' | 'month'>('week');
  const [showAllDetailExpand, setShowAllDetailExpand] = useState(false);
  const [showCategoryExpand, setShowCategoryExpand] = useState(false);
  const scrollViewRef = useRef<ScrollView>(null);
  const allDetailY = useRef(0);
  const categoryY = useRef(0);
  const { salaryPerSecond } = useSalary();
  const timeConfigRef = useRef<TimeConfig | null>(null);
  const todayFixedReportRef = useRef(0);
  const [firePensionPreview, setFirePensionPreview] = useState<number | null>(null);

  const fetch = useCallback(async () => {
    const [todayStart, todayEnd] = getTodayRange();
    const [weekStart, weekEnd] = getWeekRange();
    const [monthStart, monthEnd] = getMonthRange();
    const salaryConfig = await loadSalaryConfig();
    const secWage = secondWage(salaryConfig);

    const todayRecords = await getRecordsInRange(todayStart, todayEnd);
    const weekRecords = await getRecordsInRange(weekStart, weekEnd);
    const monthRecords = await getRecordsInRange(monthStart, monthEnd);
    const all = await loadRecords();

    const sum = (list: RecordEntry[]) => list.reduce((a, r) => a + r.amount, 0);
    const byCat = (list: RecordEntry[]) => {
      const o = emptyCategoryStat();
      list.forEach((r) => {
        o[r.category].amount += r.amount;
        o[r.category].count += 1;
      });
      return o;
    };

    const monthMoyuAmount = monthRecords
      .filter((r) => MOYU_CATEGORIES.includes(r.category))
      .reduce((a, r) => a + r.amount, 0);
    const hours = amountToHours(monthMoyuAmount, secWage);

    const moyuSum = all
      .filter((r) => MOYU_CATEGORIES.includes(r.category))
      .reduce((a, r) => a + r.amount, 0);
    const commuteSum = all
      .filter((r) => r.category === 'commute')
      .reduce((a, r) => a + r.amount, 0);
    const offworkCnt = all.filter((r) => r.category === 'offwork').length;
    const unlocked = await getUnlockedIds();

    const monthOutcomeCommute = monthRecords.filter((r) => r.category === 'commute').reduce((a, r) => a + r.amount, 0);
    const monthOutcomeMortgage = monthRecords.filter((r) => r.category === 'mortgage').reduce((a, r) => a + r.amount, 0);
    const monthOutcomeLunch = monthRecords.filter((r) => r.category === 'lunch').reduce((a, r) => a + r.amount, 0);
    const monthOutcomeExpense = monthRecords.filter((r) => r.category === 'expense').reduce((a, r) => a + r.amount, 0);
    const monthIncomeMoyu = monthRecords.filter((r) => INCOME_CATS.includes(r.category)).reduce((a, r) => a + r.amount, 0);
    const chargeRecords = monthRecords.filter((r) => r.category === 'charge');

    const daySalary = salaryConfig.monthly_salary && salaryConfig.work_days ? salaryConfig.monthly_salary / salaryConfig.work_days : 0;
    const todayIncome = (isWorkDay(new Date()) ? daySalary : 0) + todayRecords.filter((r) => INCOME_CATS.includes(r.category)).reduce((a, r) => a + r.amount, 0);
    const todayOutcome = Math.abs(todayRecords.filter((r) => OUTCOME_CATS.includes(r.category)).reduce((a, r) => a + r.amount, 0));
    const todayBal = todayIncome - todayOutcome;
    const monthOutcome = Math.abs(monthOutcomeCommute + monthOutcomeMortgage + monthOutcomeLunch + monthOutcomeExpense);
    const monthBal = monthIncomeMoyu - monthOutcome;
    if (todayBal > 1) setBalanceCopy(pickBalanceWin());
    else if (todayBal >= -1) setBalanceCopy(pickBalanceFlat());
    else setBalanceCopy(pickBalanceLose());

    setTodayTotal(sum(todayRecords));
    setWeeklyTotal(sum(weekRecords));
    setMonthlyTotal(sum(monthRecords));
    setMoyuTotal(moyuSum);
    setCommuteLoss(Math.abs(commuteSum));
    setMonthCommute(Math.abs(monthOutcomeCommute));
    setMonthYangmao(monthRecords.filter((r) => MOYU_CATEGORIES.includes(r.category)).reduce((a, r) => a + r.amount, 0));
    setMortgageMonth(Math.abs(monthOutcomeMortgage));
    setLunchMonth(Math.abs(monthOutcomeLunch));
    setExpenseMonth(Math.abs(monthOutcomeExpense));
    setChargeMonth(chargeRecords.reduce((a, r) => a + r.amount, 0));
    setChargeCount(chargeRecords.length);
    setOffworkCount(offworkCnt);
    setAchievementUnlocked(unlocked.size);
    setTodayBalance(todayBal);
    setMonthBalance(monthBal);
    setByCategory(byCat(all));
    setMoyuHours(hours);

    const mortgageConfig = await loadMortgageConfig();
    if (mortgageConfig) {
      setMortgageConfigMonthly(getMonthlyPayment(mortgageConfig));
      setMortgageConfigDaily(getDailyPayment(mortgageConfig));
      setMortgageRepaymentDay(mortgageConfig.repaymentDay ?? null);
      setMortgageProgress(getRepaymentProgress(mortgageConfig));
    } else {
      setMortgageConfigMonthly(null);
      setMortgageConfigDaily(null);
      setMortgageRepaymentDay(null);
      setMortgageProgress(null);
    }
    const commuteMon = await getCommuteMonthlyBudget();
    setCommuteMonthlyBudget(commuteMon);
    const timeConfig = await loadTimeConfig();
    timeConfigRef.current = timeConfig;
    const workSec = workedSecondsToday(timeConfig);
    setWorkSecToday(workSec);
    setEarnedByTimeToday(workSec * secWage);
    setDaySalaryReport(daySalary);
    const mortgageCfg = await loadMortgageConfig();
    const mortgageOn = await getMortgageEnabled();
    const commuteDay = commuteMon > 0 ? commuteMon / 22 : 0;
    const mortgageDay = mortgageCfg && mortgageOn && isWorkDay(new Date()) ? getDailyPayment(mortgageCfg) : 0;
    const [fireCfg, personal] = await Promise.all([loadFireConfig(), loadPersonalConfig()]);
    const { dailySocial, dailyMedical } = getFireDailyCosts(fireCfg, personal?.birthDate ?? null);
    const fixed = commuteDay + mortgageDay + dailySocial + dailyMedical;
    setTodayFixedReport(fixed);
    todayFixedReportRef.current = fixed;
    const unpaidMonth = monthRecords.filter((r) => r.category === 'unpaid_overtime');
    const unpaidSec = unpaidMonth.reduce((a, r) => a + (r.durationSeconds ?? 0), 0);
    setUnpaidOvertimeSec(unpaidSec);
    setUnpaidOvertimeAmount(unpaidSec * secWage);
    const allRec = await loadRecords();
    setAllRecordsList(allRec.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 200));
    const yangmaoToday = todayRecords.filter((r) => MOYU_CATEGORIES.includes(r.category));
    setTodayYangmao(yangmaoToday.reduce((a, r) => a + r.amount, 0));
    const yangmaoByCat: Record<string, { amount: number; count: number }> = {};
    MOYU_CATEGORIES.forEach((c) => { yangmaoByCat[c] = { amount: 0, count: 0 }; });
    yangmaoToday.forEach((r) => {
      yangmaoByCat[r.category].amount += r.amount;
      yangmaoByCat[r.category].count += 1;
    });
    setTodayYangmaoByCat(yangmaoByCat);
    setTodayYangmaoRecords(yangmaoToday.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
    setReportBalanceCopy(getReportBalanceCopy(workSec * secWage, fixed));

    if (parseSocialAvgAnnual(fireCfg.socialAvgAnnual) > 0) {
      setFirePensionPreview(computeFireMetrics(fireCfg, personal?.birthDate ?? null).estimatedMonthlyPension);
    } else {
      setFirePensionPreview(null);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetch();
    }, [fetch])
  );

  useEffect(() => {
    const tickSync = () => {
      const time = timeConfigRef.current;
      if (!time) return;
      const sec = workedSecondsToday(time);
      const earned = sec * salaryPerSecond;
      setWorkSecToday(sec);
      setEarnedByTimeToday(earned);
      setReportBalanceCopy(getReportBalanceCopy(earned, todayFixedReportRef.current));
    };
    const init = async () => {
      const time = await loadTimeConfig();
      timeConfigRef.current = time;
      tickSync();
    };
    init();
    const id = setInterval(tickSync, 1000);
    return () => clearInterval(id);
  }, [salaryPerSecond]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetch();
    setRefreshing(false);
  };

  const handleExport = async () => {
    const lines = [
      '今日净结余：' + formatMoney(todayBalance),
      '本月薅了多少：' + formatMoney(monthYangmao),
      balanceCopy,
      '摸鱼总收益：' + formatMoney(moyuTotal),
      '通勤/房贷/午饭/开支：' + formatMoney(commuteLoss) + ' / ' + formatMoney(mortgageMonth) + ' / ' + formatMoney(lunchMonth) + ' / ' + formatMoney(expenseMonth),
      '充电：' + formatMoney(chargeMonth) + '，' + chargeCount + ' 次',
      '本月准点跑路：' + offworkCount + ' 次',
      '勋章：' + achievementUnlocked + ' / ' + ACHIEVEMENT_COUNT + ' 枚',
      salaryPerSecond > 0 ? `相当于带薪摸鱼 ${moyuHours.toFixed(1)} 小时` : '',
    ].filter(Boolean);
    try {
      await Share.share({ message: lines.join('\n'), title: '薅羊毛统计' });
    } catch {
      // ignore
    }
  };

  const handleClear = () => {
    Alert.alert(
      '清空所有记录',
      '确定要清空所有记录吗？此操作不可恢复。',
      [
        { text: '取消', style: 'cancel' },
        {
          text: '确定清空',
          style: 'destructive',
          onPress: async () => {
            await clearAllRecords();
            await fetch();
          },
        },
      ]
    );
  };

  const styles = makeStyles();

  const todayNet = earnedByTimeToday - todayFixedReport;
  const topInset = (Constants.statusBarHeight ?? (Platform.OS === 'ios' ? 44 : 24)) + 12;

  return (
    <ScrollView
      ref={scrollViewRef}
      style={styles.container}
      contentContainerStyle={[styles.content, { paddingTop: topInset }]}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={UI.primary} />
      }
    >
      {/* 今日净结余卡片：大卡片、浅黄背景 */}
      <View style={styles.balanceCard}>
        <Text style={styles.balanceLabel}>今日净结余</Text>
        <Text style={[styles.balanceValue, todayNet < 0 && styles.balanceValueDanger]}>
          {formatMoney(todayNet)}
        </Text>
        {reportBalanceCopy ? <Text style={styles.balanceCopy}>{reportBalanceCopy}</Text> : null}
      </View>

      {firePensionPreview != null && firePensionPreview > 0 && (
        <Pressable style={styles.fireCard} onPress={() => router.push('/(tabs)/fire')}>
          <Text style={styles.fireCardTitle}>FIRE 提前退休</Text>
          <Text style={styles.fireCardSub}>粗算养老金 {formatMoney(firePensionPreview)}/月 · 与工具箱配置联动</Text>
          <Text style={styles.fireCardHint}>点击查看 / 调整参数</Text>
        </Pressable>
      )}

      {/* 今日已薅：可展开 */}
      <Pressable style={styles.dataCard} onPress={() => setShowYangmaoDetail((v) => !v)}>
        <View style={styles.dataCardRow}>
          <Text style={styles.dataCardLabel}>今日已薅</Text>
          <Text style={styles.dataCardValue}>{formatMoney(todayYangmao)}</Text>
          <Text style={styles.dataCardHint}>{showYangmaoDetail ? '收起' : '点击展开'}</Text>
        </View>
        {showYangmaoDetail && (
          <>
            {MOYU_CATEGORIES.map((cat) => {
              const { amount, count } = todayYangmaoByCat[cat] ?? { amount: 0, count: 0 };
              if (amount === 0 && count === 0) return null;
              return (
                <View key={cat} style={styles.yangmaoRow}>
                  <Text style={styles.yangmaoRowLabel}>{CATEGORY_LABELS[cat]}</Text>
                  <Text style={styles.yangmaoRowValue}>{formatMoney(amount)} · {count} 次</Text>
                </View>
              );
            })}
            {todayYangmaoRecords.length > 0 && (
              <View style={styles.yangmaoDetailBlock}>
                {todayYangmaoRecords.slice(0, 30).map((r) => (
                  <View key={r.id} style={styles.yangmaoDetailRow}>
                    <Text style={styles.yangmaoDetailDate}>{new Date(r.createdAt).toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</Text>
                    <Text style={styles.yangmaoDetailLabel}>{CATEGORY_LABELS[r.category]}</Text>
                    <Text style={styles.yangmaoDetailAmount}>+{formatMoney(r.amount)}</Text>
                    <Pressable
                      style={styles.yangmaoDeleteBtn}
                      onPress={() => {
                        Alert.alert(
                          pickYangmaoDeleteCopy(),
                          `确定删除？${CATEGORY_LABELS[r.category]} +${formatMoney(r.amount)}`,
                          [
                            { text: '取消', style: 'cancel' },
                            { text: '删除', style: 'destructive', onPress: () => deleteRecord(r.id).then(() => fetch()) },
                          ]
                        );
                      }}
                      hitSlop={8}
                    >
                      <Text style={styles.yangmaoDeleteText}>删除</Text>
                    </Pressable>
                  </View>
                ))}
              </View>
            )}
          </>
        )}
      </Pressable>

      {/* 本月・总览：2 列 8 格 */}
      <Text style={styles.sectionTitle}>本月 · 总览</Text>
      <View style={styles.grid}>
        <Pressable style={styles.gridCell} onPress={() => { scrollViewRef.current?.scrollTo({ y: categoryY.current, animated: true }); }}>
          <Text style={[styles.gridValue, styles.gridValueOrange]}>{formatMoney(monthYangmao)}</Text>
          <Text style={styles.gridSub}>摸鱼＋白嫖</Text>
        </Pressable>
        <Pressable style={styles.gridCell} onPress={() => router.push('/(tabs)/commute')}>
          <Text style={[styles.gridValue, styles.gridValueRed]}>{formatMoney(monthCommute)}</Text>
          <Text style={styles.gridSub}>本月已花</Text>
        </Pressable>
        <Pressable style={styles.gridCell} onPress={() => router.push('/(tabs)/mortgage')}>
          <Text style={[styles.gridValue, styles.gridValueGray]}>{mortgageConfigDaily != null ? formatMoney(mortgageConfigDaily) : '—'}</Text>
          <Text style={styles.gridSub}>已记·自动算</Text>
        </Pressable>
        <Pressable style={styles.gridCell} onPress={() => router.push('/(tabs)/lunch')}>
          <Text style={[styles.gridValue, styles.gridValueRed]}>{formatMoney(lunchMonth)}</Text>
          <Text style={styles.gridSub}>本月总支出</Text>
        </Pressable>
        <Pressable style={styles.gridCell} onPress={() => router.push('/(tabs)/expense')}>
          <Text style={[styles.gridValue, styles.gridValueRed]}>{formatMoney(expenseMonth)}</Text>
          <Text style={styles.gridSub}>奶茶/打车/人情</Text>
        </Pressable>
        <Pressable style={styles.gridCell} onPress={() => scrollViewRef.current?.scrollTo({ y: allDetailY.current, animated: true })}>
          <Text style={[styles.gridValue, styles.gridValueOrange]}>{offworkCount} 次</Text>
          <Text style={styles.gridSub}>准点跑路</Text>
        </Pressable>
        <Pressable style={styles.gridCell} onPress={() => router.push('/(tabs)/achievements')}>
          <Text style={[styles.gridValue, styles.gridValueOrange]}>{achievementUnlocked}/{ACHIEVEMENT_COUNT}</Text>
          <Text style={styles.gridSub}>已解锁</Text>
        </Pressable>
        <Pressable style={styles.gridCell} onPress={() => router.push('/(tabs)/charge')}>
          <Text style={[styles.gridValue, styles.gridValueOrange]}>{chargeCount} 次</Text>
          <Text style={styles.gridSub}>白嫖充电</Text>
        </Pressable>
      </View>

      {/* 本周 / 本月汇总：滑动切换 */}
      <Text style={styles.sectionTitle}>本周 / 本月汇总</Text>
      <ScrollView
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={(e) => {
          const page = Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH);
          setSummarySegment(page === 0 ? 'week' : 'month');
        }}
        style={styles.summarySwipe}
        contentContainerStyle={styles.summarySwipeContent}
      >
        <View style={styles.summarySlide}>
          <Text style={styles.summaryLabel}>本周</Text>
          <Text style={styles.summaryValue}>{formatMoney(weeklyTotal)}</Text>
        </View>
        <View style={styles.summarySlide}>
          <Text style={styles.summaryLabel}>本月</Text>
          <Text style={styles.summaryValue}>{formatMoney(monthlyTotal)}</Text>
        </View>
      </ScrollView>

      {/* 入口行 */}
      <View style={styles.entryRow}>
        <Pressable
          style={styles.entryBtn}
          onPress={() => {
            setShowAllDetailExpand((v) => {
              if (!v) setTimeout(() => scrollViewRef.current?.scrollTo({ y: allDetailY.current, animated: true }), 50);
              return !v;
            });
          }}
        >
          <Text style={styles.entryBtnText}>全部明细</Text>
        </Pressable>
        <Pressable
          style={styles.entryBtn}
          onPress={() => {
            setShowCategoryExpand((v) => {
              if (!v) setTimeout(() => scrollViewRef.current?.scrollTo({ y: categoryY.current, animated: true }), 50);
              return !v;
            });
          }}
        >
          <Text style={styles.entryBtnText}>分类统计</Text>
        </Pressable>
        <Pressable style={styles.entryBtn} onPress={() => router.push('/(tabs)/calendar')}>
          <Text style={styles.entryBtnText}>日历</Text>
        </Pressable>
      </View>

      {/* 全部明细：可展开 + 可上下拖动的框 */}
      <View style={styles.draggableBox} onLayout={(e) => { allDetailY.current = e.nativeEvent.layout.y; }} collapsable={false}>
        <View style={styles.dragHandle} />
        <Pressable style={styles.draggableBoxHeader} onPress={() => setShowAllDetailExpand((v) => !v)}>
          <Text style={styles.blockTitle}>全部明细</Text>
          <Text style={styles.expandHint}>{showAllDetailExpand ? '点击收起' : `点击展开 · ${allRecordsList.length} 条`}</Text>
        </Pressable>
        {showAllDetailExpand && (
          <ScrollView style={styles.draggableBoxContent} nestedScrollEnabled showsVerticalScrollIndicator={true}>
            {allRecordsList.map((r) => (
              <View key={r.id} style={styles.detailRow}>
                <Text style={styles.detailDate}>{new Date(r.createdAt).toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</Text>
                <Text style={styles.detailLabel}>{CATEGORY_LABELS[r.category]}{r.label && r.label !== CATEGORY_LABELS[r.category] ? ` · ${r.label}` : ''}</Text>
                <Text style={[styles.detailAmount, r.amount < 0 && styles.detailAmountLoss]}>
                  {r.amount > 0 ? `+${formatMoney(r.amount)}` : formatMoney(r.amount)}
                  {r.durationSeconds != null && r.durationSeconds > 0 ? ` (${formatDuration(r.durationSeconds)})` : ''}
                </Text>
              </View>
            ))}
          </ScrollView>
        )}
      </View>

      {/* 分类统计：可展开 + 可上下拖动的框 */}
      <View style={styles.draggableBox} onLayout={(e) => { categoryY.current = e.nativeEvent.layout.y; }} collapsable={false}>
        <View style={styles.dragHandle} />
        <Pressable style={styles.draggableBoxHeader} onPress={() => setShowCategoryExpand((v) => !v)}>
          <Text style={styles.blockTitle}>分类统计</Text>
          <Text style={styles.expandHint}>{showCategoryExpand ? '点击收起' : '点击展开'}</Text>
        </Pressable>
        {showCategoryExpand && (
          <ScrollView style={styles.draggableBoxContent} nestedScrollEnabled showsVerticalScrollIndicator={true}>
            {(Object.keys(byCategory) as RecordCategory[]).map((cat) => {
              if (cat === 'achievement') return null;
              const { amount, count } = byCategory[cat];
              if (amount === 0 && count === 0) return null;
              const isLoss = OUTCOME_CATS.includes(cat);
              return (
                <View key={cat} style={styles.categoryRow}>
                  <Text style={styles.categoryRowLabel}>{CATEGORY_LABELS[cat]}</Text>
                  <View style={styles.categoryRowRight}>
                    {cat === 'offwork' ? (
                      <Text style={styles.categoryRowValue}>{count} 次</Text>
                    ) : (
                      <Text style={[styles.categoryRowValue, isLoss && styles.categoryRowValueLoss]}>{formatMoney(isLoss ? Math.abs(amount) : amount)}</Text>
                    )}
                    {cat !== 'offwork' && <Text style={styles.categoryRowCount}>{count} 次</Text>}
                  </View>
                </View>
              );
            })}
          </ScrollView>
        )}
      </View>

      <View style={styles.actions}>
        <Pressable style={styles.exportBtn} onPress={handleExport}>
          <Text style={styles.exportBtnText}>分享统计</Text>
        </Pressable>
        <Pressable style={styles.clearBtn} onPress={handleClear}>
          <Text style={styles.clearBtnText}>清空记录</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const makeStyles = () =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: UI.bg },
    content: { padding: 16, paddingBottom: 48 },
    balanceCard: {
      backgroundColor: UI.statusCardBg,
      borderRadius: 16,
      padding: 20,
      marginBottom: 12,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.06,
      shadowRadius: 4,
      elevation: 2,
    },
    balanceLabel: { fontSize: 16, color: UI.cardTitle, marginBottom: 4 },
    balanceValue: { fontSize: 28, fontWeight: '700', color: UI.primary },
    balanceValueDanger: { color: UI.danger },
    balanceCopy: { fontSize: 12, color: UI.secondary, marginTop: 6, fontStyle: 'italic' },
    fireCard: {
      backgroundColor: UI.statusCardBg,
      borderRadius: 12,
      padding: 16,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: '#FFE0B2',
    },
    fireCardTitle: { fontSize: 16, fontWeight: '700', color: UI.cardTitle, marginBottom: 6 },
    fireCardSub: { fontSize: 14, color: UI.primary, fontWeight: '600' },
    fireCardHint: { fontSize: 12, color: UI.secondary, marginTop: 8 },
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
    dataCardRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 },
    dataCardLabel: { fontSize: 16, color: UI.cardTitle, flex: 1 },
    dataCardValue: { fontSize: 20, fontWeight: '700', color: UI.primary },
    dataCardHint: { fontSize: 12, color: UI.secondary },
    yangmaoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8, borderTopWidth: 1, borderTopColor: UI.divider },
    yangmaoRowLabel: { fontSize: 14, color: UI.cardTitle },
    yangmaoRowValue: { fontSize: 14, fontWeight: '600', color: UI.primary },
    yangmaoDetailBlock: { marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: UI.divider },
    yangmaoDetailRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, gap: 8, borderBottomWidth: 1, borderBottomColor: UI.divider },
    yangmaoDetailDate: { fontSize: 12, color: UI.secondary, width: 72 },
    yangmaoDetailLabel: { flex: 1, fontSize: 14, color: UI.cardTitle },
    yangmaoDetailAmount: { fontSize: 14, fontWeight: '600', color: UI.primary },
    yangmaoDeleteBtn: { paddingVertical: 6, paddingHorizontal: 10, borderRadius: 8, backgroundColor: UI.divider },
    yangmaoDeleteText: { fontSize: 12, color: UI.danger },
    sectionTitle: { fontSize: 16, fontWeight: '600', color: UI.cardTitle, marginBottom: 12 },
    grid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: GRID_GAP,
      marginBottom: 12,
    },
    gridCell: {
      width: (SCREEN_WIDTH - 16 * 2 - GRID_GAP) / 2,
      backgroundColor: UI.cardBg,
      borderRadius: 8,
      padding: 12,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.05,
      shadowRadius: 3,
      elevation: 2,
    },
    gridValue: { fontSize: 20, fontWeight: '700' },
    gridValueOrange: { color: UI.primary },
    gridValueRed: { color: UI.danger },
    gridValueGray: { color: UI.secondary },
    gridSub: { fontSize: 14, color: UI.secondary, marginTop: 4 },
    summarySwipe: { marginBottom: 12 },
    summarySwipeContent: {},
    summarySlide: {
      width: SCREEN_WIDTH,
      paddingVertical: 16,
      paddingHorizontal: 16,
      backgroundColor: UI.cardBg,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.06,
      shadowRadius: 4,
      elevation: 2,
    },
    summaryLabel: { fontSize: 14, color: UI.secondary, marginBottom: 4 },
    summaryValue: { fontSize: 24, fontWeight: '700', color: UI.primary },
    entryRow: { flexDirection: 'row', gap: 12, marginBottom: 20 },
    entryBtn: { flex: 1, paddingVertical: 12, borderRadius: 12, backgroundColor: UI.cardBg, alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3, elevation: 2 },
    entryBtnText: { fontSize: 16, color: UI.primary, fontWeight: '600' },
    draggableBox: {
      backgroundColor: UI.cardBg,
      borderRadius: 12,
      paddingHorizontal: 16,
      paddingBottom: 16,
      marginBottom: 12,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.06,
      shadowRadius: 4,
      elevation: 2,
      overflow: 'hidden',
    },
    dragHandle: {
      alignSelf: 'center',
      width: 36,
      height: 4,
      borderRadius: 2,
      backgroundColor: UI.divider,
      marginTop: 10,
      marginBottom: 4,
    },
    draggableBoxHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 12,
    },
    blockTitle: { fontSize: 16, color: UI.cardTitle, marginBottom: 0 },
    expandHint: { fontSize: 12, color: UI.secondary },
    draggableBoxContent: {
      maxHeight: 280,
      borderTopWidth: 1,
      borderTopColor: UI.divider,
    },
    detailRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: UI.divider, gap: 8 },
    detailDate: { fontSize: 12, color: UI.secondary, width: 72 },
    detailLabel: { flex: 1, fontSize: 14, color: UI.cardTitle },
    detailAmount: { fontSize: 14, fontWeight: '600', color: UI.primary },
    detailAmountLoss: { color: UI.danger },
    categoryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: UI.divider },
    categoryRowLabel: { fontSize: 16, color: UI.cardTitle },
    categoryRowRight: { alignItems: 'flex-end' },
    categoryRowValue: { fontSize: 16, fontWeight: '600', color: UI.primary },
    categoryRowValueLoss: { color: UI.danger },
    categoryRowCount: { fontSize: 13, color: UI.secondary, marginTop: 2 },
    actions: { marginTop: 24, gap: 12 },
    exportBtn: { backgroundColor: UI.primary, paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
    exportBtnText: { fontSize: 16, fontWeight: '600', color: '#fff' },
    clearBtn: { paddingVertical: 14, borderRadius: 12, alignItems: 'center', borderWidth: 1, borderColor: UI.divider },
    clearBtnText: { fontSize: 16, color: UI.secondary },
  });
