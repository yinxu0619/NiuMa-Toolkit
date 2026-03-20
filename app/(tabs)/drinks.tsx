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

const DEFAULT_DRINKS: { name: string; price: number; calories?: number }[] = [
  { name: '瓶装水', price: 2, calories: 0 },
  { name: '可乐/雪碧', price: 5, calories: 140 },
  { name: '果汁', price: 8, calories: 120 },
  { name: '茶饮', price: 12, calories: 80 },
  { name: '冰红茶', price: 4, calories: 100 },
  { name: '气泡水', price: 6, calories: 0 },
  { name: '牛奶', price: 5, calories: 130 },
];

export default function DrinksScreen() {
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
    const drinkOnly = records.filter((r) => r.category === 'drink');
    setTodayTotal(drinkOnly.reduce((a, r) => a + r.amount, 0));
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchToday();
    }, [fetchToday])
  );

  const handleQuickAdd = async (name: string, price: number, calories?: number) => {
    setLastAmount(price);
    setLastLabel(calories != null && calories > 0 ? `${name} · ${calories} kcal` : name);
    setShowResult(true);
    await addRecord({
      category: 'drink',
      amount: price,
      label: name,
      calories: calories != null && calories > 0 ? calories : undefined,
    });
    await fetchToday();
    const newly = await checkAndUnlockAchievements();
    if (newly.length > 0) setUnlockAchievement(newly[0]);
  };

  const handleCustomAdd = async () => {
    const name = customName.trim() || '饮料';
    const price = parseFloat(customPrice) || 0;
    if (price <= 0) return;
    const calNum = parseInt(customCal, 10);
    const calories = !isNaN(calNum) && calNum > 0 ? calNum : undefined;
    setLastAmount(price);
    setLastLabel(calories != null ? `${name} · ${calories} kcal` : name);
    setShowResult(true);
    await addRecord({
      category: 'drink',
      amount: price,
      label: name,
      calories,
    });
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
        {DEFAULT_DRINKS.map((item) => (
          <Pressable
            key={item.name}
            style={styles.quickItem}
            onPress={() => handleQuickAdd(item.name, item.price, item.calories)}
          >
            <View>
              <Text style={styles.quickName}>{item.name}</Text>
              {item.calories != null && item.calories > 0 ? (
                <Text style={styles.quickCal}>{item.calories} kcal</Text>
              ) : null}
            </View>
            <Text style={styles.quickPrice}>{formatMoney(item.price)}</Text>
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
        style={[styles.btn, (parseFloat(customPrice) || 0) <= 0 && styles.btnDisabled]}
        onPress={handleCustomAdd}
        disabled={(parseFloat(customPrice) || 0) <= 0}
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
    borderWidth: 1,
    borderColor: '#E5E5E5',
  },
  quickName: { fontSize: 16, color: TOOLBOX_UI.body, fontWeight: '600' },
  quickCal: { fontSize: 12, color: TOOLBOX_UI.secondary, marginTop: 4 },
  quickPrice: { fontSize: 16, color: TOOLBOX_UI.primary },
  input: {
    backgroundColor: TOOLBOX_UI.cardBg,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E5E5',
    padding: 14,
    fontSize: 16,
    color: TOOLBOX_UI.body,
    marginBottom: 12,
  },
  btn: { backgroundColor: TOOLBOX_UI.primary, paddingVertical: 16, borderRadius: TOOLBOX_UI.radius, alignItems: 'center', marginTop: 8 },
  btnDisabled: { opacity: 0.5 },
  btnText: { fontSize: 18, fontWeight: '600', color: '#fff' },
});
