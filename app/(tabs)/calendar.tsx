import React, { useCallback, useState } from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView, Modal, Alert } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { getRecordsInRange, loadLeaveMarks, loadVacationConfig, setLeaveMarkAndUpdateVacation, getHolidaySyncEnabled, loadHolidayDates, loadSalaryConfig } from '@/lib/storage';
import type { LeaveMarkType } from '@/lib/storage';
import { formatMoney } from '@/lib/format';
import type { RecordEntry, RecordCategory } from '@/types';
import { pickHolidayCellCopy } from '@/constants/copy';
import { DEFAULT_WORK_DAYS } from '@/constants/theme';

const CAL = {
  bg: '#FFFFFF',
  primary: '#FF7A00',
  text: '#333333',
  gray: '#999999',
  green: '#38A169',
  danger: '#E53E3E',
  card: '#FFFFFF',
  border: '#E5E5E5',
} as const;

const INCOME_CATS: RecordCategory[] = ['toilet', 'bailan', 'meeting', 'daze', 'coffee', 'snack', 'drink', 'charge', 'paid_overtime'];
const OUTCOME_CATS: RecordCategory[] = ['commute', 'lunch', 'expense', 'mortgage'];
const YANGMAO_CATS: RecordCategory[] = ['toilet', 'bailan', 'meeting', 'daze', 'coffee', 'snack', 'drink', 'charge'];
const CAT_LABELS: Partial<Record<RecordCategory, string>> = {
  toilet: '如厕', bailan: '开摆', meeting: '会议', daze: '发呆',
  coffee: '咖啡', snack: '零食', drink: '饮料', charge: '充电',
  commute: '通勤', lunch: '午饭', expense: '支出', paid_overtime: '有偿加班', unpaid_overtime: '无偿加班',
  offwork: '下班',
};

function getMonthDays(year: number, month: number): (number | null)[] {
  const first = new Date(year, month, 1);
  const last = new Date(year, month + 1, 0);
  const startPad = first.getDay() === 0 ? 6 : first.getDay() - 1;
  const days: (number | null)[] = Array(startPad).fill(null);
  for (let d = 1; d <= last.getDate(); d++) days.push(d);
  return days;
}

export default function CalendarScreen() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [dayBalances, setDayBalances] = useState<Record<string, number>>({});
  const [dayYangmao, setDayYangmao] = useState<Record<string, number>>({});
  const [dayWages, setDayWages] = useState<Record<string, number>>({});
  const [dayJieyu, setDayJieyu] = useState<Record<string, number>>({});
  const [leaveMarks, setLeaveMarks] = useState<Record<string, string>>({});
  const [holidayDates, setHolidayDates] = useState<string[]>([]);
  const [holidayEnabled, setHolidayEnabled] = useState(false);
  const [daySalary, setDaySalary] = useState<number>(0);
  const [holidayCopy, setHolidayCopy] = useState('');
  const [selectedDay, setSelectedDay] = useState<{ y: number; m: number; d: number } | null>(null);
  const [dayRecords, setDayRecords] = useState<RecordEntry[]>([]);

  const load = useCallback(async () => {
    const [marks, enabled, dates, salaryConfig] = await Promise.all([
      loadLeaveMarks(),
      getHolidaySyncEnabled(),
      loadHolidayDates(),
      loadSalaryConfig(),
    ]);
    setLeaveMarks(marks as Record<string, string>);
    setHolidayEnabled(enabled);
    setHolidayDates(enabled ? dates : []);
    const sal = salaryConfig?.monthly_salary && salaryConfig.monthly_salary > 0 && salaryConfig.work_days
      ? salaryConfig.monthly_salary / (salaryConfig.work_days || DEFAULT_WORK_DAYS)
      : 0;
    setDaySalary(sal);
    if (enabled && dates.length > 0) setHolidayCopy(pickHolidayCellCopy());
    const start = new Date(year, month, 1);
    const end = new Date(year, month + 1, 0, 23, 59, 59, 999);
    const records = await getRecordsInRange(start, end);
    const byDay: Record<string, number> = {};
    const byYangmao: Record<string, number> = {};
    const byWage: Record<string, number> = {};
    const byJieyu: Record<string, number> = {};
    for (let d = 1; d <= end.getDate(); d++) {
      const dayStart = new Date(year, month, d, 0, 0, 0, 0);
      const dayEnd = new Date(year, month, d, 23, 59, 59, 999);
      const dayRecs = records.filter((r) => {
        const t = new Date(r.createdAt).getTime();
        return t >= dayStart.getTime() && t <= dayEnd.getTime();
      });
      const inc = dayRecs.filter((r) => INCOME_CATS.includes(r.category)).reduce((a, r) => a + r.amount, 0);
      const out = Math.abs(dayRecs.filter((r) => OUTCOME_CATS.includes(r.category)).reduce((a, r) => a + r.amount, 0));
      const key = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      byDay[key] = inc - out;
      byYangmao[key] = dayRecs.filter((r) => YANGMAO_CATS.includes(r.category)).reduce((a, r) => a + r.amount, 0);
      const wd = dayStart.getDay();
      const mark = marks[key];
      const hasLeave = mark === 'annual_leave' || mark === 'sick_leave';
      let baseWage = 0;
      if (sal > 0) {
        if (enabled && dates.includes(key)) baseWage = sal;
        else if (hasLeave) baseWage = sal;
        else if (wd !== 0 && wd !== 6) baseWage = sal;
      }
      byWage[key] = baseWage;
      byJieyu[key] = baseWage - out;
    }
    setDayBalances(byDay);
    setDayYangmao(byYangmao);
    setDayWages(byWage);
    setDayJieyu(byJieyu);
  }, [year, month]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const openDay = async (d: number) => {
    const dayStart = new Date(year, month, d, 0, 0, 0, 0);
    const dayEnd = new Date(year, month, d, 23, 59, 59, 999);
    const records = await getRecordsInRange(dayStart, dayEnd);
    setDayRecords(records.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
    setSelectedDay({ y: year, m: month, d });
  };

  const keyFor = (d: number) => `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  const onLongPressDay = (d: number) => {
    const key = keyFor(d);
    const current = leaveMarks[key] as LeaveMarkType | undefined;
    if (current) {
      Alert.alert('标记假期', '取消该日的假期标记？', [
        { text: '取消', style: 'cancel' },
        { text: '取消标记', onPress: async () => { await setLeaveMarkAndUpdateVacation(key, null); load(); } },
      ]);
    } else {
      Alert.alert('标记假期', '将该日标记为：', [
        { text: '取消', style: 'cancel' },
        { text: '标记年假', onPress: async () => { const vac = await loadVacationConfig(); if (vac.annualLeaveTotal - vac.annualLeaveUsed <= 0) { Alert.alert('提示', '年假余额不足'); return; } await setLeaveMarkAndUpdateVacation(key, 'annual_leave'); load(); } },
        { text: '标记病假', onPress: async () => { const vac = await loadVacationConfig(); if (vac.sickLeaveTotal - vac.sickLeaveUsed <= 0) { Alert.alert('提示', '病假余额不足'); return; } await setLeaveMarkAndUpdateVacation(key, 'sick_leave'); load(); } },
      ]);
    }
  };

  const days = getMonthDays(year, month);
  const weekLabels = ['一', '二', '三', '四', '五', '六', '日'];

  const styles = makeStyles();

  const summaryKey =
    selectedDay != null
      ? `${selectedDay.y}-${String(selectedDay.m + 1).padStart(2, '0')}-${String(selectedDay.d).padStart(2, '0')}`
      : '';
  const modalWage = summaryKey ? (dayWages[summaryKey] ?? 0) : 0;
  const modalJieyu = summaryKey ? (dayJieyu[summaryKey] ?? 0) : 0;
  const modalYangmao = summaryKey ? (dayYangmao[summaryKey] ?? 0) : 0;
  const modalLeaveType = summaryKey ? (leaveMarks[summaryKey] as string | undefined) : undefined;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Pressable onPress={() => setMonth((m) => (m <= 0 ? m : m - 1))}>
          <Text style={styles.navBtn}>←</Text>
        </Pressable>
        <View style={styles.headerCenter}>
          <Text style={styles.title}>{year} 年 {month + 1} 月</Text>
          <Text style={styles.subTitle}>长按某天可标记 / 取消年假、病假</Text>
        </View>
        <Pressable onPress={() => setMonth((m) => (m >= 11 ? m : m + 1))}>
          <Text style={styles.navBtn}>→</Text>
        </Pressable>
      </View>
      <View style={styles.weekRow}>
        {weekLabels.map((w) => (
          <Text key={w} style={styles.weekCell}>{w}</Text>
        ))}
      </View>
      <View style={styles.grid}>
        {days.map((d, i) => {
          if (d == null) return <View key={i} style={styles.cell} />;
          const key = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
          const balance = dayBalances[key] ?? 0;
          const yangmao = dayYangmao[key] ?? 0;
          const leave = leaveMarks[key];
          const isStatutory = holidayEnabled && holidayDates.includes(key);
          const isToday = now.getFullYear() === year && now.getMonth() === month && now.getDate() === d;
          return (
            <Pressable
              key={i}
              style={[
                styles.cell,
                balance > 0 && styles.cellSurplus,
                balance < 0 && styles.cellDeficit,
                isToday && styles.cellToday,
                isStatutory && styles.cellStatutory,
              ]}
              onPress={() => openDay(d)}
              onLongPress={() => onLongPressDay(d)}
            >
              <Text style={[styles.cellDay, balance !== 0 && styles.cellDayColored]}>{d}</Text>
              {isStatutory && daySalary > 0 ? (
                <>
                  <Text style={styles.cellAmount}>薪水 {formatMoney(daySalary)}</Text>
                  <Text style={styles.cellCopy}>{holidayCopy || '赚麻了'}</Text>
                </>
              ) : (
                <>
                  {balance !== 0 && (
                    <Text style={[styles.cellAmount, balance < 0 && styles.cellAmountLoss]}>
                      {balance > 0 ? '+' : ''}{formatMoney(balance)}
                    </Text>
                  )}
                  {yangmao > 0 && <Text style={styles.cellYangmao}>薅 {formatMoney(yangmao)}</Text>}
                </>
              )}
              <View style={styles.cellBadges}>
                {isStatutory && <Text style={styles.cellStatutoryLabel}>法</Text>}
                {leave && <Text style={styles.cellLeave}>{leave === 'annual_leave' ? '假' : '病'}</Text>}
              </View>
            </Pressable>
          );
        })}
      </View>
      <View style={styles.legend}>
        <View style={[styles.legendDot, styles.cellSurplus]} /><Text style={styles.legendText}>盈余</Text>
        <View style={[styles.legendDot, styles.cellDeficit]} /><Text style={styles.legendText}>赤字</Text>
        {holidayDates.length > 0 && <Text style={styles.legendText}>法=法定假期</Text>}
        <Text style={styles.legendText}>假=年假（薅假）病=病假（应得养伤）</Text>
      </View>

      <Modal visible={selectedDay != null} transparent animationType="slide">
        <Pressable style={styles.modalOverlay} onPress={() => setSelectedDay(null)}>
          <Pressable style={styles.modalCard} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.modalTitle}>
              {selectedDay && `${selectedDay.y}-${String(selectedDay.m + 1).padStart(2, '0')}-${String(selectedDay.d).padStart(2, '0')} 明细`}
            </Text>
            {selectedDay != null && (
              <View style={styles.modalSummary}>
                <Text style={styles.modalSummaryLine}>
                  <Text style={styles.modalSummaryLabel}>工资：</Text>
                  <Text style={styles.modalSummaryOrange}>{formatMoney(modalWage)}</Text>
                </Text>
                <Text style={styles.modalSummaryLine}>
                  <Text style={styles.modalSummaryLabel}>结余：</Text>
                  <Text style={[styles.modalSummaryValue, modalJieyu >= 0 ? styles.modalSummaryGreen : styles.modalSummaryRed]}>
                    {formatMoney(modalJieyu)}
                  </Text>
                </Text>
                <Text style={styles.modalSummaryLine}>
                  <Text style={styles.modalSummaryLabel}>
                    {modalLeaveType === 'sick_leave' ? '摸鱼零嘴等：' : '已薅：'}
                  </Text>
                  <Text style={styles.modalSummaryOrange}>{formatMoney(modalYangmao)}</Text>
                </Text>
              </View>
            )}
            <ScrollView style={styles.modalList}>
              {dayRecords.length === 0 ? (
                <Text style={styles.modalEmpty}>当日无记录</Text>
              ) : (
                dayRecords.map((r) => (
                  <View key={r.id} style={styles.modalRow}>
                    <Text style={styles.modalTime}>{new Date(r.createdAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}</Text>
                    <Text style={styles.modalLabel}>{CAT_LABELS[r.category] ?? r.category} {r.label ?? ''}</Text>
                    <Text style={[styles.modalAmount, r.amount < 0 && styles.loss]}>
                      {r.amount > 0 ? `+${formatMoney(r.amount)}` : formatMoney(r.amount)}
                    </Text>
                  </View>
                ))
              )}
            </ScrollView>
            <Pressable style={styles.modalClose} onPress={() => setSelectedDay(null)}>
              <Text style={styles.modalCloseText}>关闭</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </ScrollView>
  );
}

const makeStyles = () =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: CAL.bg },
    content: { padding: 16, paddingBottom: 48 },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
    headerCenter: { flex: 1, alignItems: 'center', paddingHorizontal: 4 },
    navBtn: { fontSize: 24, color: CAL.primary, padding: 8 },
    title: { fontSize: 18, fontWeight: '700', color: CAL.text },
    subTitle: { fontSize: 11, color: CAL.gray, marginTop: 2, textAlign: 'center' },
    weekRow: { flexDirection: 'row', marginBottom: 8 },
    weekCell: { flex: 1, textAlign: 'center', fontSize: 12, color: CAL.gray },
    grid: { flexDirection: 'row', flexWrap: 'wrap' },
    cell: {
      width: '14.28%',
      aspectRatio: 1,
      justifyContent: 'center',
      alignItems: 'center',
      borderRadius: 8,
      marginBottom: 4,
    },
    cellSurplus: { backgroundColor: 'rgba(56, 161, 105, 0.18)' },
    cellDeficit: { backgroundColor: 'rgba(229, 62, 62, 0.15)' },
    cellToday: { borderWidth: 2, borderColor: CAL.primary },
    cellStatutory: { backgroundColor: 'rgba(255, 122, 0, 0.12)' },
    cellDay: { fontSize: 14, color: CAL.gray },
    cellDayColored: { color: CAL.text, fontWeight: '600' },
    cellAmount: { fontSize: 9, color: CAL.primary, fontWeight: '600', marginTop: 1 },
    cellAmountLoss: { color: CAL.danger },
    cellYangmao: { fontSize: 8, color: CAL.gray, marginTop: 0 },
    cellCopy: { fontSize: 8, color: CAL.gray, fontStyle: 'italic', marginTop: 0 },
    cellBadges: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 2, marginTop: 1 },
    cellStatutoryLabel: { fontSize: 9, color: CAL.primary },
    cellLeave: { fontSize: 9, color: CAL.primary },
    legend: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 16, flexWrap: 'wrap' },
    legendDot: { width: 12, height: 12, borderRadius: 6 },
    legendText: { fontSize: 12, color: CAL.gray },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
    modalCard: { backgroundColor: CAL.card, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, maxHeight: '75%' },
    modalTitle: { fontSize: 18, fontWeight: '700', color: CAL.text, marginBottom: 12 },
    modalSummary: {
      backgroundColor: '#FFF9E6',
      borderRadius: 12,
      padding: 12,
      marginBottom: 12,
    },
    modalSummaryLine: { marginBottom: 6 },
    modalSummaryLabel: { fontSize: 14, color: CAL.text },
    modalSummaryOrange: { fontSize: 14, fontWeight: '700', color: CAL.primary },
    modalSummaryValue: { fontSize: 14, fontWeight: '700' },
    modalSummaryGreen: { color: CAL.green },
    modalSummaryRed: { color: CAL.danger },
    modalList: { maxHeight: 280 },
    modalEmpty: { fontSize: 14, color: CAL.gray, textAlign: 'center', padding: 24 },
    modalRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: CAL.border },
    modalTime: { width: 56, fontSize: 13, color: CAL.gray },
    modalLabel: { flex: 1, fontSize: 14, color: CAL.text },
    modalAmount: { fontSize: 14, fontWeight: '600', color: CAL.primary },
    loss: { color: CAL.danger },
    modalClose: { marginTop: 16, paddingVertical: 12, alignItems: 'center' },
    modalCloseText: { fontSize: 16, color: CAL.primary, fontWeight: '600' },
  });
