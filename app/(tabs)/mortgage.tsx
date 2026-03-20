import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ScrollView,
  Modal,
  Switch,
  Vibration,
  Alert,
  Platform,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { formatMoney } from '@/lib/format';
import {
  loadMortgageConfig,
  saveMortgageConfig,
  getMortgageEnabled,
  setMortgageEnabled,
  getMortgageLastWrittenDate,
  setMortgageLastWrittenDate,
  addRecord,
  getRecordsInRange,
} from '@/lib/storage';
import { getTodayRange } from '@/lib/today';
import { getDailyPayment, getMonthlyPayment } from '@/lib/mortgage';
import { Ionicons } from '@expo/vector-icons';
import { pickMortgageDone, pickMortgageOffCopy } from '@/constants/copy';
import type { MortgageConfig, MortgageType } from '@/types';
import { TOOLBOX_UI } from '@/constants/toolboxUI';
import Constants from 'expo-constants';

const INCOME_CATEGORIES = ['toilet', 'bailan', 'coffee', 'snack', 'drink', 'meeting', 'charge'];

function todayDateKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function isWorkDay(): boolean {
  const d = new Date().getDay();
  return d >= 1 && d <= 5;
}

export default function MortgageScreen() {
  const [total, setTotal] = useState('');
  const [annualRate, setAnnualRate] = useState('');
  const [years, setYears] = useState('');
  const [type, setType] = useState<MortgageType>('equal_payment');
  const [startPeriod, setStartPeriod] = useState('1');
  const [repaymentDay, setRepaymentDay] = useState('');
  const [enabled, setEnabled] = useState(false);
  const [monthlyPay, setMonthlyPay] = useState(0);
  const [dailyPay, setDailyPay] = useState(0);
  const [showDoneModal, setShowDoneModal] = useState(false);
  const [doneCopy, setDoneCopy] = useState('');

  const load = useCallback(async () => {
    const c = await loadMortgageConfig();
    if (c) {
      setTotal(String(c.total));
      setAnnualRate(String(c.annualRate * 100));
      setYears(String(c.years));
      setType(c.type);
      setStartPeriod(String(c.startPeriod));
      setRepaymentDay(c.repaymentDay != null ? String(c.repaymentDay) : '');
      setMonthlyPay(getMonthlyPayment(c));
      setDailyPay(getDailyPayment(c));
    }
    const on = await getMortgageEnabled();
    setEnabled(on);
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const totalNum = parseFloat(total) || 0;
  const rateNum = parseFloat(annualRate) || 0;
  const yearsNum = parseInt(years, 10) || 0;
  const startNum = Math.max(1, parseInt(startPeriod, 10) || 1);
  const repaymentDayNum = (() => {
    const n = parseInt(repaymentDay, 10);
    if (!repaymentDay.trim() || isNaN(n)) return undefined;
    return Math.min(31, Math.max(1, n));
  })();

  useEffect(() => {
    if (totalNum <= 0 || yearsNum <= 0) return;
    const config: MortgageConfig = {
      total: totalNum,
      annualRate: rateNum / 100,
      years: yearsNum,
      type,
      startPeriod: startNum,
      repaymentDay: repaymentDayNum,
    };
    setMonthlyPay(getMonthlyPayment(config));
    setDailyPay(getDailyPayment(config));
  }, [totalNum, rateNum, yearsNum, type, startNum, repaymentDayNum]);

  const handleSave = async () => {
    if (totalNum <= 0 || yearsNum <= 0) {
      Alert.alert('提示', '请填写贷款总额和年限');
      return;
    }
    const config: MortgageConfig = {
      total: totalNum,
      annualRate: rateNum / 100,
      years: yearsNum,
      type,
      startPeriod: startNum,
      repaymentDay: repaymentDayNum,
    };
    await saveMortgageConfig(config);
    setMonthlyPay(getMonthlyPayment(config));
    setDailyPay(getDailyPayment(config));
    Alert.alert('已保存', '房贷配置已更新');
  };

  const handleToggle = async (value: boolean) => {
    if (!value) {
      Alert.alert(
        '关闭房贷模式',
        pickMortgageOffCopy(),
        [
          { text: '再想想', style: 'cancel' },
          {
            text: '确定关闭',
            style: 'default',
            onPress: async () => {
              setEnabled(false);
              await setMortgageEnabled(false);
            },
          },
        ]
      );
      return;
    }
    setEnabled(value);
    await setMortgageEnabled(value);
    if (totalNum > 0 && yearsNum > 0) {
      await ensureTodayMortgageWritten();
    }
  };

  async function ensureTodayMortgageWritten() {
    const config = await loadMortgageConfig();
    if (!config || !isWorkDay()) return;
    const daily = getDailyPayment(config);
    if (daily <= 0) return;
    const today = todayDateKey();
    const last = await getMortgageLastWrittenDate();
    if (last === today) return;
    await addRecord({
      category: 'mortgage',
      amount: -daily,
      label: '房贷日供',
      content: '房贷日供',
    });
    await setMortgageLastWrittenDate(today);
  }

  async function checkMortgageDone() {
    if (!enabled) return;
    const config = await loadMortgageConfig();
    if (!config) return;
    const daily = getDailyPayment(config);
    if (daily <= 0) return;
    const [start, end] = getTodayRange();
    const records = await getRecordsInRange(start, end);
    const income = records
      .filter((r) => INCOME_CATEGORIES.includes(r.category))
      .reduce((a, r) => a + r.amount, 0);
    if (income < daily) return;
    const { getMortgageDoneShownDate, setMortgageDoneShownDate } = await import('@/lib/storage');
    const today = todayDateKey();
    const shown = await getMortgageDoneShownDate();
    if (shown === today) return;
    setDoneCopy(pickMortgageDone());
    setShowDoneModal(true);
    Vibration.vibrate(300);
    await setMortgageDoneShownDate(today);
  }

  useFocusEffect(
    useCallback(() => {
      if (!enabled || totalNum <= 0) return;
      ensureTodayMortgageWritten();
      checkMortgageDone();
    }, [enabled, totalNum, dailyPay])
  );

  const topInset = (Constants.statusBarHeight ?? (Platform.OS === 'ios' ? 44 : 24)) + 12;
  return (
    <ScrollView style={styles.container} contentContainerStyle={[styles.content, { paddingTop: topInset }]}>
      <Text style={styles.label}>贷款总额（元）</Text>
      <TextInput
        style={styles.input}
        value={total}
        onChangeText={setTotal}
        keyboardType="decimal-pad"
        placeholder="2000000"
        placeholderTextColor={TOOLBOX_UI.secondary}
      />
      <Text style={styles.label}>年利率（%）</Text>
      <TextInput
        style={styles.input}
        value={annualRate}
        onChangeText={setAnnualRate}
        keyboardType="decimal-pad"
        placeholder="4"
        placeholderTextColor={TOOLBOX_UI.secondary}
      />
      <Text style={styles.label}>年限（年）</Text>
      <TextInput
        style={styles.input}
        value={years}
        onChangeText={setYears}
        keyboardType="number-pad"
        placeholder="30"
        placeholderTextColor={TOOLBOX_UI.secondary}
      />
      <View style={styles.row}>
        <Text style={styles.label}>还款方式</Text>
        <View style={styles.switchRow}>
          <Pressable
            style={[styles.typeBtn, type === 'equal_payment' && styles.typeBtnActive]}
            onPress={() => setType('equal_payment')}
          >
            <Text style={[styles.typeBtnText, type === 'equal_payment' && styles.typeBtnTextActive]}>等额本息</Text>
          </Pressable>
          <Pressable
            style={[styles.typeBtn, type === 'equal_principal' && styles.typeBtnActive]}
            onPress={() => setType('equal_principal')}
          >
            <Text style={[styles.typeBtnText, type === 'equal_principal' && styles.typeBtnTextActive]}>等额本金</Text>
          </Pressable>
        </View>
      </View>
      <Text style={styles.label}>起始期数（等额本金用）</Text>
      <TextInput
        style={styles.input}
        value={startPeriod}
        onChangeText={setStartPeriod}
        keyboardType="number-pad"
        placeholder="1"
        placeholderTextColor={TOOLBOX_UI.secondary}
      />
      <Text style={styles.label}>还款日（每月几号扣款，1-31 选填）</Text>
      <TextInput
        style={styles.input}
        value={repaymentDay}
        onChangeText={setRepaymentDay}
        keyboardType="number-pad"
        placeholder="如 15 表示每月 15 号"
        placeholderTextColor={TOOLBOX_UI.secondary}
      />
      <Pressable style={styles.saveBtn} onPress={handleSave}>
        <Text style={styles.saveBtnText}>保存配置</Text>
      </Pressable>

      {monthlyPay > 0 && (
        <View style={styles.card}>
          <Text style={styles.cardLabel}>月供</Text>
          <Text style={styles.cardValue}>{formatMoney(monthlyPay)}</Text>
          {repaymentDayNum != null && (
            <Text style={styles.cardLabel}>还款日：每月 {repaymentDayNum} 号</Text>
          )}
          <Text style={styles.cardLabel}>房贷日供（÷22 工作日）</Text>
          <Text style={styles.cardValue}>{formatMoney(dailyPay)}</Text>
        </View>
      )}

      <View style={styles.toggleRow}>
        <Text style={styles.toggleLabel}>房贷模式（达标弹窗 + 每日自动记日供）</Text>
        <Switch value={enabled} onValueChange={handleToggle} trackColor={{ false: TOOLBOX_UI.secondary, true: TOOLBOX_UI.primary }} thumbColor="#fff" />
      </View>

      <Modal visible={showDoneModal} transparent animationType="fade">
        <Pressable style={styles.modalOverlay} onPress={() => setShowDoneModal(false)}>
          <Pressable style={styles.modalCard} onPress={(e) => e.stopPropagation()}>
            <View style={styles.modalTitleRow}>
              <Ionicons name="sparkles" size={22} color={TOOLBOX_UI.primary} style={styles.modalTitleIcon} />
              <Text style={styles.modalTitle}>房贷达标</Text>
            </View>
            <Text style={styles.modalCopy}>{doneCopy}</Text>
            <Pressable style={styles.modalBtn} onPress={() => setShowDoneModal(false)}>
              <Text style={styles.modalBtnText}>太爽了</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: TOOLBOX_UI.bg },
  content: { padding: TOOLBOX_UI.padding, paddingBottom: 48 },
  title: { fontSize: 20, color: TOOLBOX_UI.pageTitle, marginBottom: 24 },
  label: { fontSize: 16, color: TOOLBOX_UI.cardTitle, marginBottom: 8 },
  input: {
    backgroundColor: TOOLBOX_UI.cardBg,
    borderRadius: TOOLBOX_UI.radius,
    padding: 16,
    fontSize: 18,
    color: TOOLBOX_UI.body,
    marginBottom: 16,
  },
  row: { marginBottom: 16 },
  switchRow: { flexDirection: 'row', gap: 12, marginTop: 8 },
  typeBtn: { paddingVertical: 10, paddingHorizontal: 16, borderRadius: TOOLBOX_UI.radius, backgroundColor: TOOLBOX_UI.cardBg },
  typeBtnActive: { backgroundColor: TOOLBOX_UI.primary },
  typeBtnText: { color: TOOLBOX_UI.secondary },
  typeBtnTextActive: { color: '#fff', fontWeight: '600' },
  saveBtn: {
    alignSelf: 'flex-start',
    backgroundColor: TOOLBOX_UI.primary,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: TOOLBOX_UI.radius,
    marginBottom: 24,
  },
  saveBtnText: { color: '#fff', fontWeight: '600' },
  card: { backgroundColor: TOOLBOX_UI.topCardBg, borderRadius: TOOLBOX_UI.topCardRadius, padding: TOOLBOX_UI.topCardPadding, marginBottom: 24 },
  cardLabel: { fontSize: 14, color: TOOLBOX_UI.cardTitle, marginBottom: 4 },
  cardValue: { fontSize: 22, fontWeight: '700', color: TOOLBOX_UI.primary, marginBottom: 12 },
  toggleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  toggleLabel: { fontSize: 15, color: TOOLBOX_UI.body, flex: 1 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  modalCard: { backgroundColor: TOOLBOX_UI.cardBg, borderRadius: 20, padding: 28, minWidth: 280, alignItems: 'center', borderWidth: 2, borderColor: TOOLBOX_UI.primary },
  modalTitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 16, gap: 8 },
  modalTitleIcon: {},
  modalTitle: { fontSize: 22, fontWeight: '700', color: TOOLBOX_UI.primary },
  modalCopy: { fontSize: 16, color: TOOLBOX_UI.body, textAlign: 'center', marginBottom: 24, lineHeight: 24 },
  modalBtn: { backgroundColor: TOOLBOX_UI.primary, paddingVertical: 14, paddingHorizontal: 32, borderRadius: TOOLBOX_UI.radius },
  modalBtnText: { color: '#fff', fontWeight: '600', fontSize: 16 },
});
