import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ScrollView,
  Alert,
  Platform,
  Modal,
  TextInput,
  KeyboardAvoidingView,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import {
  loadVacationConfig,
  loadLeaveMarks,
  setLeaveMarkAndUpdateVacation,
  loadSalaryConfig,
} from '@/lib/storage';
import type { LeaveMarkType } from '@/lib/storage';
import type { VacationConfig } from '@/types';
import { TOOLBOX_UI } from '@/constants/toolboxUI';
import { pickSickLeaveEarnedHint } from '@/constants/copy';
import Constants from 'expo-constants';

const MAX_LEAVE_RANGE_DAYS = 62;

function dateKeyFromDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function isValidDateKey(key: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) return false;
  const [y, m, d] = key.split('-').map((x) => parseInt(x, 10));
  if (m < 1 || m > 12 || d < 1 || d > 31) return false;
  const dt = new Date(y, m - 1, d);
  return dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d;
}

/** 含首尾；无效或 end&lt;start 返回 [] */
function eachDateKeyInclusive(startKey: string, endKey: string): string[] {
  const start = new Date(startKey + 'T12:00:00');
  const end = new Date(endKey + 'T12:00:00');
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) return [];
  const out: string[] = [];
  for (let t = start.getTime(); t <= end.getTime(); t += 86400000) {
    out.push(dateKeyFromDate(new Date(t)));
  }
  return out;
}

/** 批量改为 targetType 后，模拟已用天数是否超总额 */
function simulateBatchLeave(
  keys: string[],
  targetType: LeaveMarkType,
  marks: Record<string, LeaveMarkType>,
  vac: VacationConfig
): string | null {
  let aU = vac.annualLeaveUsed ?? 0;
  let sU = vac.sickLeaveUsed ?? 0;
  for (const key of keys) {
    const prev = marks[key] ?? null;
    if (prev === targetType) continue;
    if (prev === 'annual_leave') aU -= 1;
    if (prev === 'sick_leave') sU -= 1;
    if (targetType === 'annual_leave') {
      aU += 1;
      if (aU > (vac.annualLeaveTotal ?? 0)) return '年假额度不够（请缩短区间或在设置里增加年假总天数）';
    } else {
      sU += 1;
      if (sU > (vac.sickLeaveTotal ?? 0)) return '病假额度不够（请缩短区间或在设置里增加病假总天数）';
    }
  }
  if (aU < 0 || sU < 0) return '假期数据异常，请稍后再试';
  return null;
}

export default function LeaveScreen() {
  const router = useRouter();
  const [vacation, setVacation] = useState({ annualLeaveTotal: 0, sickLeaveTotal: 0, annualLeaveUsed: 0, sickLeaveUsed: 0 });
  const [marks, setMarks] = useState<Record<string, LeaveMarkType>>({});
  const [daySalary, setDaySalary] = useState(0);
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [startInput, setStartInput] = useState('');
  const [endInput, setEndInput] = useState('');
  const [addType, setAddType] = useState<LeaveMarkType>('annual_leave');
  const [savingBatch, setSavingBatch] = useState(false);

  const load = useCallback(async () => {
    const vac = await loadVacationConfig();
    setVacation(vac);
    const m = await loadLeaveMarks();
    setMarks(m);
    const salary = await loadSalaryConfig();
    const day = salary.monthly_salary && salary.work_days ? salary.monthly_salary / salary.work_days : 0;
    setDaySalary(day);
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const openAddModal = useCallback(() => {
    setStartInput(dateKeyFromDate(new Date()));
    setEndInput('');
    setAddType('annual_leave');
    setAddModalVisible(true);
  }, []);

  const changeMarkType = useCallback(
    async (dateKey: string, newType: LeaveMarkType) => {
      const current = marks[dateKey];
      if (current === newType) return;
      const marksNow = await loadLeaveMarks();
      const vacNow = await loadVacationConfig();
      const err = simulateBatchLeave([dateKey], newType, marksNow, vacNow);
      if (err) {
        Alert.alert('无法修改', err);
        return;
      }
      await setLeaveMarkAndUpdateVacation(dateKey, newType);
      await load();
    },
    [marks, load]
  );

  const confirmDeleteMark = useCallback(
    (dateKey: string) => {
      Alert.alert('删除标记', `确定删除 ${dateKey} 的假期标记？已用天数会回退。`, [
        { text: '取消', style: 'cancel' },
        {
          text: '删除',
          style: 'destructive',
          onPress: async () => {
            await setLeaveMarkAndUpdateVacation(dateKey, null);
            load();
          },
        },
      ]);
    },
    [load]
  );

  const openMarkActions = useCallback(
    (dateKey: string, type: LeaveMarkType) => {
      const actions: { text: string; style?: 'destructive' | 'cancel'; onPress?: () => void }[] = [];
      if (type !== 'annual_leave') {
        actions.push({ text: '改为年假', onPress: () => void changeMarkType(dateKey, 'annual_leave') });
      }
      if (type !== 'sick_leave') {
        actions.push({ text: '改为病假', onPress: () => void changeMarkType(dateKey, 'sick_leave') });
      }
      actions.push({
        text: '删除标记',
        style: 'destructive',
        onPress: () => confirmDeleteMark(dateKey),
      });
      actions.push({ text: '取消', style: 'cancel' });
      Alert.alert(`${dateKey}`, '编辑这一天（改类型或删除）', actions);
    },
    [changeMarkType, confirmDeleteMark]
  );

  const submitAddBatch = useCallback(async () => {
    const start = startInput.trim();
    if (!isValidDateKey(start)) {
      Alert.alert('提示', '开始日期请使用 YYYY-MM-DD，且为有效日期。');
      return;
    }
    const endRaw = endInput.trim();
    const end = endRaw === '' ? start : endRaw;
    if (!isValidDateKey(end)) {
      Alert.alert('提示', '结束日期格式不对；只记一天请把结束日期留空。');
      return;
    }
    const keys = eachDateKeyInclusive(start, end);
    if (keys.length === 0) {
      Alert.alert('提示', '结束日期不能早于开始日期。');
      return;
    }
    if (keys.length > MAX_LEAVE_RANGE_DAYS) {
      Alert.alert('提示', `一次最多补记 ${MAX_LEAVE_RANGE_DAYS} 天，请分段操作。`);
      return;
    }
    const marksNow = await loadLeaveMarks();
    const vacNow = await loadVacationConfig();
    const err = simulateBatchLeave(keys, addType, marksNow, vacNow);
    if (err) {
      Alert.alert('无法保存', err);
      return;
    }
    setSavingBatch(true);
    try {
      for (const key of keys) {
        const m = await loadLeaveMarks();
        if (m[key] === addType) continue;
        await setLeaveMarkAndUpdateVacation(key, addType);
      }
      setAddModalVisible(false);
      await load();
      Alert.alert('完成', `已标记 ${keys.length} 天为${addType === 'annual_leave' ? '年假' : '病假'}。`);
    } catch {
      Alert.alert('失败', '保存时出错，请重试。');
    } finally {
      setSavingBatch(false);
    }
  }, [startInput, endInput, addType, load]);

  const markEntries = Object.entries(marks).sort(([a], [b]) => b.localeCompare(a));

  const styles = makeStyles();
  const topInset = (Constants.statusBarHeight ?? (Platform.OS === 'ios' ? 44 : 24)) + 12;

  const annualUsed = vacation.annualLeaveUsed ?? 0;
  const sickUsed = vacation.sickLeaveUsed ?? 0;
  const usedTotal = annualUsed + sickUsed;
  const remainAnnual = Math.max(0, vacation.annualLeaveTotal - annualUsed);
  const remainSick = Math.max(0, vacation.sickLeaveTotal - sickUsed);
  const grabbedAnnualMoney = daySalary * annualUsed;
  const sickRecoverMoney = daySalary * sickUsed;
  const potentialGrabAnnual = daySalary * remainAnnual;
  const sickPoolMoney = daySalary * remainSick;
  const hasVacationConfig = (vacation.annualLeaveTotal ?? 0) + (vacation.sickLeaveTotal ?? 0) > 0;

  return (
    <ScrollView style={styles.container} contentContainerStyle={[styles.content, { paddingTop: topInset }]}>
      <View style={styles.howToCard}>
        <Text style={styles.howToTitle}>怎么记请假？</Text>
        <Text style={styles.howToLine}>1. 先在「设置 → 假期配置」填好年假/病假总天数。</Text>
        <Text style={styles.howToLine}>2. 点下面「补记假期」按日期添加（支持连续多天）；或去「日历」长按某一天。</Text>
        <Text style={styles.howToLine}>3. 在下方列表点「编辑」可改年假/病假或删除；删除会退回已用天数。</Text>
      </View>

      <Pressable style={styles.primaryBtn} onPress={openAddModal}>
        <Text style={styles.primaryBtnText}>补记假期（按日期添加）</Text>
      </Pressable>

      <Text style={styles.hint}>
        年假算薅到老板，带薪病假算应得养伤回血～补记会占用对应假期余额，改类型会按差额自动调整。
      </Text>

      {daySalary > 0 && hasVacationConfig && (
        <View style={[styles.card, styles.highlightCard]}>
          {usedTotal === 0 ? (
            <>
              <Text style={styles.cardLabel}>还没休？账上额度一览</Text>
              {remainAnnual > 0 && (
                <View style={styles.moneyBlock}>
                  <Text style={styles.cardSubLabel}>未休年假 · 休了算薅老板</Text>
                  <Text style={styles.moneyValue}>¥{potentialGrabAnnual.toFixed(2)}</Text>
                  <Text style={styles.cardHint}>剩 {remainAnnual} 天 × 日薪 {daySalary.toFixed(0)}</Text>
                </View>
              )}
              {remainSick > 0 && (
                <View style={[styles.moneyBlock, remainAnnual > 0 && styles.moneyBlockSpaced]}>
                  <Text style={styles.cardSubLabel}>未休病假 · 福利额度（真病了再用）</Text>
                  <Text style={[styles.moneyValue, styles.moneyValueMuted]}>¥{sickPoolMoney.toFixed(2)}</Text>
                  <Text style={styles.cardHint}>剩 {remainSick} 天 · 不算薅羊毛，劳动合同里写的</Text>
                </View>
              )}
            </>
          ) : (
            <>
              <Text style={styles.cardLabel}>已用假期 · 分开算更清楚</Text>
              {annualUsed > 0 && (
                <View style={styles.moneyBlock}>
                  <Text style={styles.cardSubLabel}>年假已休 · 算薅到老板</Text>
                  <Text style={styles.moneyValue}>¥{grabbedAnnualMoney.toFixed(2)}</Text>
                  <Text style={styles.cardHint}>{annualUsed} 天 × 日薪 {daySalary.toFixed(0)}</Text>
                </View>
              )}
              {sickUsed > 0 && (
                <View style={[styles.moneyBlock, annualUsed > 0 && styles.moneyBlockSpaced]}>
                  <Text style={styles.cardSubLabel}>病假已休 · 带薪回血（应得）</Text>
                  <Text style={[styles.moneyValue, styles.moneyValueMuted]}>¥{sickRecoverMoney.toFixed(2)}</Text>
                  <Text style={styles.cardHint}>{sickUsed} 天 × 日薪 · {pickSickLeaveEarnedHint()}</Text>
                </View>
              )}
            </>
          )}
        </View>
      )}

      <View style={styles.card}>
        <Text style={styles.cardLabel}>年假</Text>
        <Text style={styles.cardValue}>剩余 {remainAnnual} 天</Text>
        <Text style={styles.cardHint}>总 {vacation.annualLeaveTotal} 天，已用 {vacation.annualLeaveUsed ?? 0} 天</Text>
      </View>
      <View style={styles.card}>
        <Text style={styles.cardLabel}>病假</Text>
        <Text style={styles.cardValue}>剩余 {remainSick} 天</Text>
        <Text style={styles.cardHint}>总 {vacation.sickLeaveTotal} 天，已用 {vacation.sickLeaveUsed ?? 0} 天</Text>
      </View>

      <Text style={styles.sectionLabel}>已标记日期</Text>
      {markEntries.length === 0 ? (
        <Text style={styles.empty}>暂无标记。点上方「补记假期」或去日历长按某天即可添加。</Text>
      ) : (
        markEntries.map(([dateKey, type]) => (
          <View key={dateKey} style={styles.row}>
            <View style={styles.rowLeft}>
              <Text style={styles.rowDate}>{dateKey}</Text>
              <Text style={styles.rowType}>{type === 'annual_leave' ? '年假' : '病假'}</Text>
            </View>
            <View style={styles.rowActions}>
              <Pressable style={styles.rowBtnSecondary} onPress={() => openMarkActions(dateKey, type)}>
                <Text style={styles.rowBtnSecondaryText}>编辑</Text>
              </Pressable>
              <Pressable style={styles.rowBtn} onPress={() => confirmDeleteMark(dateKey)}>
                <Text style={styles.rowBtnText}>删除</Text>
              </Pressable>
            </View>
          </View>
        ))
      )}

      <Pressable style={styles.link} onPress={() => router.push('/(tabs)/calendar')}>
        <Text style={styles.linkText}>去日历长按某天快速标记 →</Text>
      </Pressable>

      <View style={styles.footer}>
        <Text style={styles.footerText}>年假薅假，病假养伤，都是正经权益！</Text>
      </View>

      <Modal visible={addModalVisible} transparent animationType="fade" onRequestClose={() => !savingBatch && setAddModalVisible(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalOverlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => !savingBatch && setAddModalVisible(false)} />
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>补记假期</Text>
            <Text style={styles.modalHint}>日期格式 YYYY-MM-DD；结束日期留空表示只记一天。</Text>
            <Text style={styles.modalLabel}>开始日期</Text>
            <TextInput
              style={styles.modalInput}
              value={startInput}
              onChangeText={setStartInput}
              placeholder="2026-03-01"
              placeholderTextColor={TOOLBOX_UI.secondary}
              editable={!savingBatch}
            />
            <Text style={styles.modalLabel}>结束日期（可选）</Text>
            <TextInput
              style={styles.modalInput}
              value={endInput}
              onChangeText={setEndInput}
              placeholder="留空 = 仅开始那一天"
              placeholderTextColor={TOOLBOX_UI.secondary}
              editable={!savingBatch}
            />
            <Text style={styles.modalLabel}>类型</Text>
            <View style={styles.typeRow}>
              <Pressable
                style={[styles.typeChip, addType === 'annual_leave' && styles.typeChipOn]}
                onPress={() => setAddType('annual_leave')}
                disabled={savingBatch}
              >
                <Text style={[styles.typeChipText, addType === 'annual_leave' && styles.typeChipTextOn]}>年假</Text>
              </Pressable>
              <Pressable
                style={[styles.typeChip, addType === 'sick_leave' && styles.typeChipOn]}
                onPress={() => setAddType('sick_leave')}
                disabled={savingBatch}
              >
                <Text style={[styles.typeChipText, addType === 'sick_leave' && styles.typeChipTextOn]}>病假</Text>
              </Pressable>
            </View>
            <Text style={styles.modalFoot}>单次最多连续 {MAX_LEAVE_RANGE_DAYS} 天，会与已有标记合并计算余额。</Text>
            <View style={styles.modalBtns}>
              <Pressable style={styles.modalBtnGhost} onPress={() => !savingBatch && setAddModalVisible(false)} disabled={savingBatch}>
                <Text style={styles.modalBtnGhostText}>取消</Text>
              </Pressable>
              <Pressable
                style={[styles.modalBtnPrimary, savingBatch && styles.modalBtnDisabled]}
                onPress={() => void submitAddBatch()}
                disabled={savingBatch}
              >
                <Text style={styles.modalBtnPrimaryText}>{savingBatch ? '保存中…' : '保存'}</Text>
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </ScrollView>
  );
}

const makeStyles = () =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: TOOLBOX_UI.bg },
    content: { padding: TOOLBOX_UI.padding, paddingBottom: 48 },
    howToCard: {
      backgroundColor: TOOLBOX_UI.topCardBg,
      borderRadius: TOOLBOX_UI.topCardRadius,
      padding: TOOLBOX_UI.topCardPadding,
      marginBottom: 12,
      borderLeftWidth: 4,
      borderLeftColor: TOOLBOX_UI.primary,
    },
    howToTitle: { fontSize: 16, fontWeight: '700', color: TOOLBOX_UI.pageTitle, marginBottom: 10 },
    howToLine: { fontSize: 13, color: TOOLBOX_UI.cardTitle, lineHeight: 20, marginBottom: 6 },
    primaryBtn: {
      backgroundColor: TOOLBOX_UI.primary,
      borderRadius: TOOLBOX_UI.radius,
      paddingVertical: 14,
      alignItems: 'center',
      marginBottom: 12,
    },
    primaryBtnText: { fontSize: 16, fontWeight: '700', color: '#FFFFFF' },
    hint: { fontSize: 14, color: TOOLBOX_UI.cardTitle, marginBottom: 20, lineHeight: 21 },
    card: { backgroundColor: TOOLBOX_UI.topCardBg, borderRadius: TOOLBOX_UI.topCardRadius, padding: TOOLBOX_UI.topCardPadding, marginBottom: 12 },
    cardLabel: { fontSize: 14, color: TOOLBOX_UI.cardTitle, marginBottom: 4 },
    cardValue: { fontSize: 20, fontWeight: '700', color: TOOLBOX_UI.primary },
    cardHint: { fontSize: 12, color: TOOLBOX_UI.secondary, marginTop: 4 },
    highlightCard: { borderLeftWidth: 4, borderLeftColor: TOOLBOX_UI.primary },
    moneyValue: { fontSize: 24, fontWeight: '700', color: TOOLBOX_UI.primary, marginVertical: 8 },
    moneyValueMuted: { color: TOOLBOX_UI.cardTitle },
    moneyBlock: {},
    moneyBlockSpaced: { marginTop: 16, paddingTop: 16, borderTopWidth: 1, borderTopColor: '#EEEEEE' },
    cardSubLabel: { fontSize: 13, color: TOOLBOX_UI.secondary, marginBottom: 4 },
    footer: { marginTop: 32, paddingVertical: 20, alignItems: 'center' },
    footerText: { fontSize: 18, fontWeight: '700', color: TOOLBOX_UI.primary },
    sectionLabel: { fontSize: 16, color: TOOLBOX_UI.cardTitle, marginTop: 24, marginBottom: 12 },
    empty: { fontSize: 14, color: TOOLBOX_UI.secondary, marginBottom: 16 },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: '#EEEEEE',
    },
    rowLeft: { flex: 1, marginRight: 8 },
    rowDate: { fontSize: 16, color: TOOLBOX_UI.body, fontWeight: '600' },
    rowType: { fontSize: 14, color: TOOLBOX_UI.primary, marginTop: 2 },
    rowActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    rowBtn: { paddingVertical: 8, paddingHorizontal: 12 },
    rowBtnText: { fontSize: 14, color: TOOLBOX_UI.danger, fontWeight: '600' },
    rowBtnSecondary: { paddingVertical: 8, paddingHorizontal: 12, backgroundColor: '#FFF4E6', borderRadius: 8 },
    rowBtnSecondaryText: { fontSize: 14, color: TOOLBOX_UI.primary, fontWeight: '600' },
    link: { marginTop: 24, padding: 16, backgroundColor: TOOLBOX_UI.cardBg, borderRadius: TOOLBOX_UI.radius, alignItems: 'center' },
    linkText: { fontSize: 16, color: TOOLBOX_UI.primary, fontWeight: '500' },
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.45)',
      justifyContent: 'center',
      padding: 24,
    },
    modalCard: {
      backgroundColor: '#FFFFFF',
      borderRadius: 16,
      padding: 20,
    },
    modalTitle: { fontSize: 18, fontWeight: '700', color: TOOLBOX_UI.pageTitle, marginBottom: 8 },
    modalHint: { fontSize: 13, color: TOOLBOX_UI.secondary, marginBottom: 16, lineHeight: 19 },
    modalLabel: { fontSize: 13, color: TOOLBOX_UI.cardTitle, marginBottom: 6 },
    modalInput: {
      borderWidth: 1,
      borderColor: '#E5E5E5',
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 10,
      fontSize: 16,
      color: TOOLBOX_UI.body,
      marginBottom: 14,
    },
    typeRow: { flexDirection: 'row', gap: 10, marginBottom: 12 },
    typeChip: {
      flex: 1,
      paddingVertical: 12,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: '#E5E5E5',
      alignItems: 'center',
    },
    typeChipOn: { backgroundColor: '#FFF4E6', borderColor: TOOLBOX_UI.primary },
    typeChipText: { fontSize: 15, color: TOOLBOX_UI.secondary, fontWeight: '600' },
    typeChipTextOn: { color: TOOLBOX_UI.primary },
    modalFoot: { fontSize: 12, color: TOOLBOX_UI.secondary, lineHeight: 17, marginBottom: 16 },
    modalBtns: { flexDirection: 'row', gap: 12 },
    modalBtnGhost: {
      flex: 1,
      paddingVertical: 14,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: '#E5E5E5',
      alignItems: 'center',
    },
    modalBtnGhostText: { fontSize: 16, color: TOOLBOX_UI.cardTitle, fontWeight: '600' },
    modalBtnPrimary: {
      flex: 1,
      paddingVertical: 14,
      borderRadius: 10,
      backgroundColor: TOOLBOX_UI.primary,
      alignItems: 'center',
    },
    modalBtnDisabled: { opacity: 0.6 },
    modalBtnPrimaryText: { fontSize: 16, color: '#FFFFFF', fontWeight: '700' },
  });
