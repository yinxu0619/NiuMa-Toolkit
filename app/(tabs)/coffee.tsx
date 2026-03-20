import React, { useState, useCallback } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, ScrollView, Platform } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { ResultModal } from '@/components/ResultModal';
import { AchievementUnlockModal } from '@/components/AchievementUnlockModal';
import { formatMoney } from '@/lib/format';
import { addRecord, getRecordsInRange } from '@/lib/storage';
import { checkAndUnlockAchievements } from '@/lib/achievementUnlock';
import type { UnlockedAchievement } from '@/lib/achievementUnlock';
import { getTodayRange } from '@/lib/today';
import type { CoffeePreset } from '@/types';
import { TOOLBOX_UI } from '@/constants/toolboxUI';
import Constants from 'expo-constants';

const COFFEE_PRESETS: CoffeePreset[] = [
  { id: 'luckin', name: '美式', price: 10, label: '瑞幸' },
  { id: 'luckin_latte', name: '拿铁', price: 15, label: '瑞幸' },
  { id: 'starbucks', name: '美式', price: 30, label: '星巴克' },
  { id: 'starbucks_latte', name: '拿铁', price: 38, label: '星巴克' },
  { id: 'master', name: '手冲', price: 50, label: '沪币' },
  { id: 'master_special', name: '主理人手冲', price: 65, label: '沪币' },
];

export default function CoffeeScreen() {
  const [cups, setCups] = useState('1');
  const [selectedPreset, setSelectedPreset] = useState<CoffeePreset | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [lastAmount, setLastAmount] = useState(0);
  const [lastLabel, setLastLabel] = useState('');
  const [todayTotal, setTodayTotal] = useState(0);
  const [unlockAchievement, setUnlockAchievement] = useState<UnlockedAchievement | null>(null);

  const fetchToday = useCallback(async () => {
    const [start, end] = getTodayRange();
    const records = await getRecordsInRange(start, end);
    const coffeeOnly = records.filter((r) => r.category === 'coffee');
    setTodayTotal(coffeeOnly.reduce((a, r) => a + r.amount, 0));
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchToday();
    }, [fetchToday])
  );

  const n = Math.max(0, parseInt(cups, 10) || 0);
  const total = selectedPreset ? selectedPreset.price * n : 0;

  const handleConfirm = async () => {
    if (!selectedPreset || n <= 0) return;
    const amount = selectedPreset.price * n;
    setLastAmount(amount);
    setLastLabel(`${selectedPreset.label} · ${selectedPreset.name} x ${n} 杯`);
    setShowResult(true);
    await addRecord({
      category: 'coffee',
      amount,
      label: `${selectedPreset.name} x${n}`,
    });
    await fetchToday();
    const newly = await checkAndUnlockAchievements();
    if (newly.length > 0) setUnlockAchievement(newly[0]);
  };

  const topInset = (Constants.statusBarHeight ?? (Platform.OS === 'ios' ? 44 : 24)) + 12;
  return (
    <ScrollView style={styles.container} contentContainerStyle={[styles.content, { paddingTop: topInset }]}>
      <View style={styles.todayBar}>
        <Text style={styles.todayLabel}>今日合计</Text>
        <Text style={styles.todayValue}>{formatMoney(todayTotal)}</Text>
      </View>
      <Text style={styles.label}>杯数</Text>
      <TextInput
        style={styles.input}
        value={cups}
        onChangeText={setCups}
        keyboardType="number-pad"
        placeholder="1"
        placeholderTextColor={TOOLBOX_UI.secondary}
      />
      <Text style={styles.label}>等价于</Text>
      <View style={styles.presets}>
        {COFFEE_PRESETS.map((p) => (
          <Pressable
            key={p.id}
            style={[styles.preset, selectedPreset?.id === p.id && styles.presetSelected]}
            onPress={() => setSelectedPreset(p)}
          >
            <Text style={styles.presetName}>{p.name}</Text>
            <Text style={styles.presetLabel}>{p.label}</Text>
            <Text style={styles.presetPrice}>{formatMoney(p.price)}/杯</Text>
          </Pressable>
        ))}
      </View>
      <Text style={styles.total}>本单薅羊毛：{formatMoney(total)}</Text>
      <Pressable
        style={[styles.btn, (!selectedPreset || n <= 0) && styles.btnDisabled]}
        onPress={handleConfirm}
        disabled={!selectedPreset || n <= 0}
      >
        <Text style={styles.btnText}>添加记录</Text>
      </Pressable>
      <ResultModal
        visible={showResult}
        line1="添加成功"
        line2={`本单薅了 ${formatMoney(lastAmount)}`}
        line3={lastLabel}
        onClose={() => setShowResult(false)}
      />
      <AchievementUnlockModal
        visible={unlockAchievement != null}
        achievement={unlockAchievement}
        onClose={() => setUnlockAchievement(null)}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: TOOLBOX_UI.bg },
  content: { padding: TOOLBOX_UI.padding, paddingBottom: 48 },
  todayBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: TOOLBOX_UI.topCardBg,
    padding: TOOLBOX_UI.topCardPadding,
    borderRadius: TOOLBOX_UI.topCardRadius,
    marginBottom: 16,
  },
  todayLabel: { fontSize: 16, color: TOOLBOX_UI.cardTitle },
  todayValue: { fontSize: 24, fontWeight: '700', color: TOOLBOX_UI.primary },
  title: { fontSize: 20, color: TOOLBOX_UI.pageTitle, marginBottom: 24 },
  label: { fontSize: 16, color: TOOLBOX_UI.cardTitle, marginBottom: 8 },
  input: {
    backgroundColor: TOOLBOX_UI.cardBg,
    borderRadius: TOOLBOX_UI.radius,
    padding: 16,
    fontSize: 18,
    color: TOOLBOX_UI.body,
    marginBottom: 20,
  },
  presets: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 24 },
  preset: {
    backgroundColor: TOOLBOX_UI.cardBg,
    padding: 14,
    borderRadius: TOOLBOX_UI.radius,
    minWidth: '30%',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  presetSelected: { borderColor: TOOLBOX_UI.primary },
  presetName: { fontSize: 16, color: TOOLBOX_UI.body, fontWeight: '600' },
  presetLabel: { fontSize: 12, color: TOOLBOX_UI.secondary, marginTop: 4 },
  presetPrice: { fontSize: 14, color: TOOLBOX_UI.primary, marginTop: 4 },
  total: { fontSize: 18, color: TOOLBOX_UI.primary, marginBottom: 20 },
  btn: { backgroundColor: TOOLBOX_UI.primary, paddingVertical: 16, borderRadius: TOOLBOX_UI.radius, alignItems: 'center' },
  btnDisabled: { opacity: 0.5 },
  btnText: { fontSize: 18, fontWeight: '600', color: '#fff' },
});
