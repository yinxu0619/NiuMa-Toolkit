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
import { TOOLBOX_UI } from '@/constants/toolboxUI';
import Constants from 'expo-constants';

const DEFAULT_SNACKS = [
  { name: '薯片', price: 8, calories: 150 },
  { name: '小蛋糕', price: 15, calories: 280 },
  { name: '水果切盒', price: 12, calories: 80 },
  { name: '曲奇', price: 10, calories: 120 },
  { name: '奶茶', price: 18 },
  { name: '下午茶套餐', price: 35, calories: 400 },
];

export default function SnacksScreen() {
  const [customName, setCustomName] = useState('');
  const [customPrice, setCustomPrice] = useState('');
  const [customCal, setCustomCal] = useState('');
  const [showResult, setShowResult] = useState(false);
  const [lastAmount, setLastAmount] = useState(0);
  const [lastLabel, setLastLabel] = useState('');
  const [todayTotal, setTodayTotal] = useState(0);
  const [unlockAchievement, setUnlockAchievement] = useState<UnlockedAchievement | null>(null);

  const fetchToday = useCallback(async () => {
    const [start, end] = getTodayRange();
    const records = await getRecordsInRange(start, end);
    const snackOnly = records.filter((r) => r.category === 'snack');
    setTodayTotal(snackOnly.reduce((a, r) => a + r.amount, 0));
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchToday();
    }, [fetchToday])
  );

  const customPriceNum = parseFloat(customPrice) || 0;
  const customCalNum = parseInt(customCal, 10) || undefined;

  const handleQuickAdd = async (name: string, price: number, calories?: number) => {
    setLastAmount(price);
    setLastLabel(calories != null ? `${name} · ${calories} kcal` : name);
    setShowResult(true);
    await addRecord({ category: 'snack', amount: price, label: name, calories });
    await fetchToday();
    const newly = await checkAndUnlockAchievements();
    if (newly.length > 0) setUnlockAchievement(newly[0]);
  };

  const handleCustomAdd = async () => {
    const name = customName.trim() || '零食';
    const price = customPriceNum;
    if (price <= 0) return;
    setLastAmount(price);
    setLastLabel(customCalNum != null ? `${name} · ${customCalNum} kcal` : name);
    setShowResult(true);
    await addRecord({ category: 'snack', amount: price, label: name, calories: customCalNum });
    setCustomName('');
    setCustomPrice('');
    setCustomCal('');
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
      <Text style={styles.sectionLabel}>快捷选择</Text>
      <View style={styles.quickList}>
        {DEFAULT_SNACKS.map((item) => (
          <Pressable
            key={item.name}
            style={styles.quickItem}
            onPress={() => handleQuickAdd(item.name, item.price, item.calories)}
          >
            <Text style={styles.quickName}>{item.name}</Text>
            <Text style={styles.quickMeta}>
              {formatMoney(item.price)} {item.calories ? `· ${item.calories} kcal` : ''}
            </Text>
          </Pressable>
        ))}
      </View>
      <Text style={styles.sectionLabel}>自定义</Text>
      <TextInput
        style={styles.input}
        value={customName}
        onChangeText={setCustomName}
        placeholder="商品名称"
        placeholderTextColor={TOOLBOX_UI.secondary}
      />
      <TextInput
        style={styles.input}
        value={customPrice}
        onChangeText={setCustomPrice}
        keyboardType="decimal-pad"
        placeholder="金额（元）"
        placeholderTextColor={TOOLBOX_UI.secondary}
      />
      <TextInput
        style={styles.input}
        value={customCal}
        onChangeText={setCustomCal}
        keyboardType="number-pad"
        placeholder="热量 kcal（可选）"
        placeholderTextColor={TOOLBOX_UI.secondary}
      />
      <Pressable
        style={[styles.btn, customPriceNum <= 0 && styles.btnDisabled]}
        onPress={handleCustomAdd}
        disabled={customPriceNum <= 0}
      >
        <Text style={styles.btnText}>添加记录</Text>
      </Pressable>
      <ResultModal
        visible={showResult}
        line1="添加成功"
        line2={`薅了 ${formatMoney(lastAmount)}`}
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
  sectionLabel: { fontSize: 16, color: TOOLBOX_UI.cardTitle, marginBottom: 12 },
  quickList: { marginBottom: 24 },
  quickItem: {
    backgroundColor: TOOLBOX_UI.cardBg,
    padding: 16,
    borderRadius: TOOLBOX_UI.radius,
    marginBottom: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  quickName: { fontSize: 16, color: TOOLBOX_UI.body, fontWeight: '600' },
  quickMeta: { fontSize: 14, color: TOOLBOX_UI.secondary },
  input: {
    backgroundColor: TOOLBOX_UI.cardBg,
    borderRadius: TOOLBOX_UI.radius,
    padding: 16,
    fontSize: 16,
    color: TOOLBOX_UI.body,
    marginBottom: 12,
  },
  btn: { backgroundColor: TOOLBOX_UI.primary, paddingVertical: 16, borderRadius: TOOLBOX_UI.radius, alignItems: 'center', marginTop: 8 },
  btnDisabled: { opacity: 0.5 },
  btnText: { fontSize: 18, fontWeight: '600', color: '#fff' },
});
