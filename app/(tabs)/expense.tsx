import React, { useState, useCallback, useMemo } from 'react';
import { View, Text, TextInput, Pressable, TouchableOpacity, StyleSheet, ScrollView, Alert, Modal, Platform } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { formatMoney } from '@/lib/format';
import { addRecord, getRecordsInRange, deleteRecord } from '@/lib/storage';
import { getTodayRange } from '@/lib/today';
import { TOOLBOX_UI } from '@/constants/toolboxUI';
import { pickExpense, pickExpenseDeleteCopy } from '@/constants/copy';
import Constants from 'expo-constants';

const PRESETS: { key: string; label: string; defaultAmount?: number }[] = [
  { key: 'milk_tea', label: '奶茶' },
  { key: 'taxi', label: '打车' },
  { key: 'dinner', label: '聚餐' },
  { key: 'gift', label: '人情往来' },
  { key: 'custom', label: '自定义' },
];

export default function ExpenseScreen() {
  const [customName, setCustomName] = useState('');
  const [amount, setAmount] = useState('');
  const [showResult, setShowResult] = useState(false);
  const [copy, setCopy] = useState('');
  const [lastAmount, setLastAmount] = useState(0);
  const [lastName, setLastName] = useState('');
  const [todayList, setTodayList] = useState<{ id: string; label: string; amount: number; createdAt: string }[]>([]);

  const loadToday = useCallback(async () => {
    const [start, end] = getTodayRange();
    const records = await getRecordsInRange(start, end);
    const expenses = records
      .filter((r) => r.category === 'expense')
      .map((r) => ({ id: r.id, label: r.label || r.content || '支出', amount: Math.abs(r.amount), createdAt: r.createdAt }))
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    setTodayList(expenses);
  }, []);

  const handleDelete = (id: string, label: string, amount: number) => {
    const copy = pickExpenseDeleteCopy();
    Alert.alert(
      copy,
      `确定要删除这条记录吗？\n${label} ${formatMoney(amount)}`,
      [
        { text: '再想想', style: 'cancel' },
        {
          text: '确定删除',
          style: 'destructive',
          onPress: () => {
            setTodayList((prev) => prev.filter((x) => x.id !== id));
            deleteRecord(id)
              .then(() => loadToday())
              .catch(() => loadToday());
          },
        },
      ]
    );
  };

  useFocusEffect(
    useCallback(() => {
      loadToday();
    }, [loadToday])
  );

  /** 今日万能支出按类型汇总（用于细分展示） */
  const todayByLabel = useMemo(() => {
    const m: Record<string, number> = {};
    todayList.forEach((r) => {
      const name = r.label || '其他';
      m[name] = (m[name] || 0) + r.amount;
    });
    return Object.entries(m)
      .sort((a, b) => b[1] - a[1])
      .map(([label, amount]) => ({ label, amount }));
  }, [todayList]);

  const todayTotalExpense = useMemo(() => todayList.reduce((s, r) => s + r.amount, 0), [todayList]);

  const addOne = async (label: string, amt: number) => {
    if (amt <= 0) {
      Alert.alert('提示', '请输入金额');
      return;
    }
    await addRecord({
      category: 'expense',
      amount: -amt,
      label,
      content: label,
    });
    setCopy(pickExpense());
    setLastAmount(amt);
    setLastName(label);
    setShowResult(true);
    setAmount('');
    setCustomName('');
    loadToday();
  };

  const handlePreset = (preset: typeof PRESETS[0]) => {
    if (preset.key === 'custom') {
      const n = customName.trim() || '开支';
      const a = parseFloat(amount) || 0;
      addOne(n, a);
      return;
    }
    const a = parseFloat(amount) || 0;
    if (a <= 0) {
      Alert.alert('提示', `请输入「${preset.label}」金额（元）`);
      return;
    }
    addOne(preset.label, a);
  };

  const styles = makeStyles();
  const topInset = (Constants.statusBarHeight ?? (Platform.OS === 'ios' ? 44 : 24)) + 12;

  return (
    <ScrollView style={styles.container} contentContainerStyle={[styles.content, { paddingTop: topInset }]}>
      <Text style={styles.hint}>每点一次 = 新增一条，不覆盖。名称 + 金额 + 精确到时分。</Text>

      <Text style={styles.label}>金额（元）</Text>
      <TextInput
        style={styles.input}
        value={amount}
        onChangeText={setAmount}
        keyboardType="decimal-pad"
        placeholder="0"
        placeholderTextColor={TOOLBOX_UI.secondary}
      />
      <Text style={styles.label}>自定义名称（选填，用于「自定义」）</Text>
      <TextInput
        style={styles.input}
        value={customName}
        onChangeText={setCustomName}
        placeholder="如：客户奶茶、人情红包"
        placeholderTextColor={TOOLBOX_UI.secondary}
      />

      <View style={styles.presetRow}>
        {PRESETS.map((p) => (
          <Pressable
            key={p.key}
            style={[styles.presetBtn, !amount && styles.presetBtnDisabled]}
            onPress={() => handlePreset(p)}
          >
            <Text style={styles.presetBtnText}>{p.label}</Text>
          </Pressable>
        ))}
      </View>

      <Modal visible={showResult} transparent animationType="fade">
        <Pressable style={styles.modalOverlay} onPress={() => setShowResult(false)}>
          <Pressable style={styles.recordedModalCard} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.recordedModalCopy}>{copy}</Text>
            <Text style={styles.recordedModalMeta}>{lastName} {formatMoney(lastAmount)} 已记账</Text>
            <Pressable style={styles.recordedModalBtn} onPress={() => setShowResult(false)}>
              <Text style={styles.recordedModalBtnText}>知道了</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      {todayList.length > 0 && (
        <View style={styles.breakdownCard}>
          <Text style={styles.breakdownTitle}>今日万能支出细分</Text>
          <View style={styles.breakdownRow}>
            <Text style={styles.breakdownLabel}>今日合计</Text>
            <Text style={styles.breakdownAmount}>{formatMoney(todayTotalExpense)}</Text>
          </View>
          {todayByLabel.map(({ label, amount }) => (
            <View key={label} style={styles.breakdownRow}>
              <Text style={styles.breakdownLabel}>{label}</Text>
              <Text style={styles.breakdownAmount}>{formatMoney(amount)}</Text>
            </View>
          ))}
        </View>
      )}

      <Text style={styles.sectionLabel}>当天记录</Text>
      {todayList.length === 0 ? (
        <Text style={styles.emptyHint}>今日暂无支出记录</Text>
      ) : (
        todayList.map((item) => (
          <View key={item.id} style={styles.listRow}>
            <View style={styles.listRowLeft}>
              <Text style={styles.listLabel}>{item.label}</Text>
              <Text style={styles.listAmount}>{formatMoney(item.amount)}</Text>
              <Text style={styles.listTime}>{new Date(item.createdAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}</Text>
            </View>
            <TouchableOpacity
              style={styles.deleteBtn}
              onPress={() => handleDelete(item.id, item.label, item.amount)}
              activeOpacity={0.7}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <Text style={styles.deleteBtnText}>删除</Text>
            </TouchableOpacity>
          </View>
        ))
      )}
    </ScrollView>
  );
}

const makeStyles = () =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: TOOLBOX_UI.bg },
    content: { padding: TOOLBOX_UI.padding, paddingBottom: 48 },
    title: { fontSize: 20, color: TOOLBOX_UI.pageTitle, marginBottom: 8 },
    hint: { fontSize: 14, color: TOOLBOX_UI.cardTitle, marginBottom: 20 },
    label: { fontSize: 14, color: TOOLBOX_UI.cardTitle, marginBottom: 8 },
    input: {
      backgroundColor: TOOLBOX_UI.cardBg,
      borderRadius: TOOLBOX_UI.radius,
      padding: 16,
      fontSize: 18,
      color: TOOLBOX_UI.body,
      marginBottom: 16,
    },
    presetRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 24 },
    presetBtn: {
      backgroundColor: TOOLBOX_UI.primary,
      paddingVertical: 12,
      paddingHorizontal: 20,
      borderRadius: TOOLBOX_UI.radius,
    },
    presetBtnDisabled: { opacity: 0.5 },
    presetBtnText: { fontSize: 16, fontWeight: '600', color: '#fff' },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 24 },
    recordedModalCard: {
      backgroundColor: TOOLBOX_UI.cardBg,
      borderRadius: 16,
      padding: 24,
      minWidth: 280,
      borderLeftWidth: 4,
      borderLeftColor: TOOLBOX_UI.danger,
    },
    recordedModalCopy: { fontSize: 15, color: TOOLBOX_UI.body, lineHeight: 22, marginBottom: 8, fontStyle: 'italic' },
    recordedModalMeta: { fontSize: 14, color: TOOLBOX_UI.primary, fontWeight: '600', marginBottom: 20 },
    recordedModalBtn: { backgroundColor: TOOLBOX_UI.primary, paddingVertical: 12, borderRadius: TOOLBOX_UI.radius, alignItems: 'center' },
    recordedModalBtnText: { fontSize: 16, fontWeight: '600', color: '#fff' },
    breakdownCard: {
      backgroundColor: TOOLBOX_UI.cardBg,
      borderRadius: TOOLBOX_UI.radius,
      padding: 16,
      marginBottom: 20,
      borderLeftWidth: 4,
      borderLeftColor: TOOLBOX_UI.danger,
    },
    breakdownTitle: { fontSize: 15, color: TOOLBOX_UI.cardTitle, marginBottom: 12 },
    breakdownRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6 },
    breakdownLabel: { fontSize: 15, color: TOOLBOX_UI.body },
    breakdownAmount: { fontSize: 15, fontWeight: '600', color: TOOLBOX_UI.danger, fontVariant: ['tabular-nums'] },
    sectionLabel: { fontSize: 16, color: TOOLBOX_UI.cardTitle, marginBottom: 12 },
    emptyHint: { fontSize: 14, color: TOOLBOX_UI.secondary, marginBottom: 16 },
    listRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: '#EEEEEE',
    },
    listRowLeft: { flex: 1, flexDirection: 'row', alignItems: 'center' },
    listLabel: { flex: 1, fontSize: 16, color: TOOLBOX_UI.body },
    listAmount: { fontSize: 16, fontWeight: '600', color: TOOLBOX_UI.danger, marginRight: 12 },
    listTime: { fontSize: 13, color: TOOLBOX_UI.secondary },
    deleteBtn: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 8, backgroundColor: '#EEEEEE' },
    deleteBtnText: { fontSize: 14, color: TOOLBOX_UI.danger },
  });
