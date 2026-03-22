import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Platform, Dimensions, RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';
import Constants from 'expo-constants';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { getRecordsInRange } from '@/lib/storage';
import { getTodayRange } from '@/lib/today';
import { formatMoney } from '@/lib/format';
import { TOOLBOX_UI } from '@/constants/toolboxUI';

const YANGMAO_CATS = ['toilet', 'bailan', 'meeting', 'daze', 'coffee', 'snack', 'drink', 'charge'];
const SCREEN_WIDTH = Dimensions.get('window').width;
const GRID_ITEM_WIDTH = (SCREEN_WIDTH - 16 * 2 - TOOLBOX_UI.gridGap * 2) / 3;

/** 核心功能 9 格：白嫖 + 记账 */
const GRID_ITEMS: { route: string; title: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { route: '/(tabs)/coffee', title: '咖啡', icon: 'cafe' },
  { route: '/(tabs)/snacks', title: '零食', icon: 'nutrition' },
  { route: '/(tabs)/drinks', title: '饮料', icon: 'water' },
  { route: '/(tabs)/charge', title: '充电', icon: 'battery-charging' },
  { route: '/(tabs)/commute', title: '通勤成本', icon: 'car' },
  { route: '/(tabs)/mortgage', title: '房贷', icon: 'home' },
  { route: '/(tabs)/lunch', title: '午饭吃啥', icon: 'restaurant' },
  { route: '/(tabs)/expense', title: '万能支出', icon: 'card' },
  { route: '/(tabs)/achievements', title: '勋章墙', icon: 'trophy' },
];

/** 底部快捷入口 2 个 */
const BOTTOM_ENTRIES: { route: string; title: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { route: '/(tabs)/calendar', title: '日历', icon: 'calendar' },
  { route: '/(tabs)/leave', title: '假期管理', icon: 'calendar-outline' },
];

export default function MoreScreen() {
  const router = useRouter();
  const [todayYangmaoAmount, setTodayYangmaoAmount] = useState(0);
  const [todayCalories, setTodayCalories] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  const loadToday = useCallback(async () => {
    const [start, end] = getTodayRange();
    const records = await getRecordsInRange(start, end);
    const amount = records.filter((r) => YANGMAO_CATS.includes(r.category)).reduce((a, r) => a + r.amount, 0);
    const calories = records
      .filter((r) => ['coffee', 'snack', 'drink'].includes(r.category))
      .reduce((a, r) => a + (r.calories ?? 0), 0);
    setTodayYangmaoAmount(amount);
    setTodayCalories(calories);
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadToday();
    }, [loadToday])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadToday();
    setRefreshing(false);
  }, [loadToday]);

  const topInset = (Constants.statusBarHeight ?? (Platform.OS === 'ios' ? 44 : 24)) + 12;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.content, { paddingTop: topInset }]}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={TOOLBOX_UI.primary} />
      }
    >
      {/* 顶部卡片：今日已薅 */}
      <View style={styles.topCard}>
        <Text style={styles.topCardLabel}>今日已薅</Text>
        <Text style={styles.topCardAmount}>{formatMoney(todayYangmaoAmount)}</Text>
        <View style={styles.topCardCaloriesRow}>
          <Ionicons name="flame" size={16} color={TOOLBOX_UI.primary} />
          <Text style={styles.topCardCalories}>已薅热量 {todayCalories} kcal</Text>
        </View>
      </View>

      <Pressable style={styles.fireEntry} onPress={() => router.push('/(tabs)/fire')}>
        <View style={styles.fireEntryIconWrap} accessibilityLabel="FIRE">
          <Ionicons name="flame" size={26} color={TOOLBOX_UI.primary} />
        </View>
        <View style={styles.fireEntryTextWrap}>
          <Text style={styles.fireEntryTitle}>FIRE 提前退休</Text>
          <Text style={styles.fireEntrySub}>社保测算 · 社平手动填，一键联网可选</Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color={TOOLBOX_UI.secondary} />
      </Pressable>

      {/* 核心功能：3 列 9 格 */}
      <View style={styles.grid}>
        {GRID_ITEMS.map((item) => (
          <Pressable
            key={item.route}
            style={styles.gridItem}
            onPress={() => router.push(item.route as any)}
          >
            <Ionicons name={item.icon} size={26} color={TOOLBOX_UI.primary} />
            <Text style={styles.gridItemText} numberOfLines={2}>{item.title}</Text>
          </Pressable>
        ))}
      </View>

      {/* 底部快捷入口：日历、假期管理 */}
      <View style={styles.bottomRow}>
        {BOTTOM_ENTRIES.map((item) => (
          <Pressable
            key={item.route}
            style={styles.bottomEntry}
            onPress={() => router.push(item.route as any)}
          >
            <Ionicons name={item.icon} size={22} color={TOOLBOX_UI.primary} />
            <Text style={styles.bottomEntryText}>{item.title}</Text>
          </Pressable>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: TOOLBOX_UI.bg },
  content: { padding: 16, paddingBottom: 48 },
  topCard: {
    backgroundColor: TOOLBOX_UI.topCardBg,
    borderRadius: TOOLBOX_UI.topCardRadius,
    padding: TOOLBOX_UI.topCardPadding,
    marginBottom: 16,
  },
  topCardLabel: { fontSize: 16, color: TOOLBOX_UI.cardTitle, marginBottom: 4 },
  topCardAmount: { fontSize: 28, fontWeight: '700', color: TOOLBOX_UI.primary },
  topCardCaloriesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
  },
  topCardCalories: { fontSize: 12, color: TOOLBOX_UI.secondary },
  fireEntry: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: TOOLBOX_UI.topCardBg,
    borderRadius: TOOLBOX_UI.topCardRadius,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#FFE0B2',
  },
  /** 与九宫格一致用矢量图标，避免 emoji/PNG 在部分环境显示为问号 */
  fireEntryIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: '#FFF0E0',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  fireEntryTextWrap: { flex: 1 },
  fireEntryTitle: { fontSize: 16, fontWeight: '700', color: TOOLBOX_UI.pageTitle },
  fireEntrySub: { fontSize: 12, color: TOOLBOX_UI.secondary, marginTop: 4 },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: TOOLBOX_UI.gridGap,
    marginBottom: 16,
  },
  gridItem: {
    width: GRID_ITEM_WIDTH,
    backgroundColor: TOOLBOX_UI.cardBg,
    borderRadius: TOOLBOX_UI.radius,
    padding: 12,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 80,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  gridItemText: { fontSize: 14, color: TOOLBOX_UI.body, marginTop: 6, textAlign: 'center' },
  bottomRow: {
    flexDirection: 'row',
    gap: TOOLBOX_UI.gridGap,
  },
  bottomEntry: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: TOOLBOX_UI.cardBg,
    borderRadius: TOOLBOX_UI.radius,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  bottomEntryText: { fontSize: 16, color: TOOLBOX_UI.body, fontWeight: '500' },
});
