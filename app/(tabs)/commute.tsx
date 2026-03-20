import React, { useState, useCallback } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, ScrollView, Alert, Platform } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { formatMoney } from '@/lib/format';
import { addRecord, getCommuteMonthlyBudget, setCommuteMonthlyBudget } from '@/lib/storage';
import { checkAndUnlockAchievements } from '@/lib/achievementUnlock';
import { AchievementUnlockModal } from '@/components/AchievementUnlockModal';
import type { UnlockedAchievement } from '@/lib/achievementUnlock';
import { TOOLBOX_UI } from '@/constants/toolboxUI';
import Constants from 'expo-constants';

const WORK_DAYS = 22;

export default function CommuteScreen() {
  const [monthlyBudget, setMonthlyBudget] = useState('');
  const [tempAmount, setTempAmount] = useState('');
  const [unlockAchievement, setUnlockAchievement] = useState<UnlockedAchievement | null>(null);

  useFocusEffect(
    useCallback(() => {
      getCommuteMonthlyBudget().then((v) => setMonthlyBudget(v > 0 ? String(v) : ''));
    }, [])
  );

  const monthly = parseFloat(monthlyBudget) || 0;
  const dailyFromBudget = monthly > 0 ? monthly / WORK_DAYS : 0;

  const handleSaveMonthly = async () => {
    const v = parseFloat(monthlyBudget) || 0;
    if (v < 0) {
      Alert.alert('提示', '请输入有效的月度通勤费（元）');
      return;
    }
    await setCommuteMonthlyBudget(v);
    Alert.alert('已保存', v > 0 ? `月度通勤费 ${formatMoney(v)}，日均约 ${formatMoney(v / WORK_DAYS)}` : '已清空');
  };

  const handleAddTemp = async () => {
    const amount = parseFloat(tempAmount) || 0;
    if (amount <= 0) {
      Alert.alert('提示', '请输入临时通勤费用（元）');
      return;
    }
    await addRecord({
      category: 'commute',
      amount: -amount,
      label: '临时通勤',
      content: '临时通勤',
    });
    setTempAmount('');
    const newly = await checkAndUnlockAchievements();
    if (newly.length > 0) setUnlockAchievement(newly[0]);
    Alert.alert('已记录', `临时通勤 ${formatMoney(amount)} 已记入今日成本`);
  };

  const styles = makeStyles();
  const topInset = (Constants.statusBarHeight ?? (Platform.OS === 'ios' ? 44 : 24)) + 12;

  return (
    <ScrollView style={styles.container} contentContainerStyle={[styles.content, { paddingTop: topInset }]}>
      <Text style={styles.hint}>月度通勤费会按 22 个工作日自动摊到每天；临时外出可记一笔。</Text>

      <Text style={styles.sectionLabel}>月度通勤费用（元）</Text>
      <Text style={styles.sectionHint}>如地铁月卡、月均交通费，支持折扣后金额</Text>
      <TextInput
        style={styles.input}
        value={monthlyBudget}
        onChangeText={setMonthlyBudget}
        keyboardType="decimal-pad"
        placeholder="例如 200"
        placeholderTextColor={TOOLBOX_UI.secondary}
      />
      <Pressable style={styles.saveBtn} onPress={handleSaveMonthly}>
        <Text style={styles.saveBtnText}>保存</Text>
      </Pressable>
      {dailyFromBudget > 0 && (
        <View style={styles.card}>
          <Text style={styles.cardLabel}>日均摊（÷22）</Text>
          <Text style={styles.cardValue}>{formatMoney(dailyFromBudget)}</Text>
        </View>
      )}

      <Text style={[styles.sectionLabel, { marginTop: 24 }]}>临时通勤费用</Text>
      <Text style={styles.sectionHint}>外出打车、临时出行等，记入当日成本</Text>
      <TextInput
        style={styles.input}
        value={tempAmount}
        onChangeText={setTempAmount}
        keyboardType="decimal-pad"
        placeholder="金额（元）"
        placeholderTextColor={TOOLBOX_UI.secondary}
      />
      <Pressable
        style={[styles.addBtn, !tempAmount.trim() && styles.addBtnDisabled]}
        onPress={handleAddTemp}
        disabled={!tempAmount.trim()}
      >
        <Text style={styles.addBtnText}>记一笔临时通勤</Text>
      </Pressable>

      <AchievementUnlockModal
        visible={unlockAchievement != null}
        achievement={unlockAchievement}
        onClose={() => setUnlockAchievement(null)}
      />
    </ScrollView>
  );
}

const makeStyles = () =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: TOOLBOX_UI.bg },
    content: { padding: TOOLBOX_UI.padding, paddingBottom: 48 },
    title: { fontSize: 20, color: TOOLBOX_UI.pageTitle, marginBottom: 8 },
    hint: { fontSize: 14, color: TOOLBOX_UI.cardTitle, marginBottom: 24 },
    sectionLabel: { fontSize: 16, color: TOOLBOX_UI.cardTitle, marginBottom: 4 },
    sectionHint: { fontSize: 12, color: TOOLBOX_UI.secondary, marginBottom: 12 },
    input: {
      backgroundColor: TOOLBOX_UI.cardBg,
      borderRadius: TOOLBOX_UI.radius,
      padding: 16,
      fontSize: 18,
      color: TOOLBOX_UI.body,
      marginBottom: 12,
    },
    saveBtn: {
      alignSelf: 'flex-start',
      backgroundColor: TOOLBOX_UI.primary,
      paddingVertical: 10,
      paddingHorizontal: 20,
      borderRadius: TOOLBOX_UI.radius,
      marginBottom: 16,
    },
    saveBtnText: { fontSize: 16, fontWeight: '600', color: '#fff' },
    card: {
      backgroundColor: TOOLBOX_UI.topCardBg,
      borderRadius: TOOLBOX_UI.radius,
      padding: 16,
      marginBottom: 12,
    },
    cardLabel: { fontSize: 14, color: TOOLBOX_UI.cardTitle, marginBottom: 4 },
    cardValue: { fontSize: 22, fontWeight: '700', color: TOOLBOX_UI.danger },
    addBtn: {
      backgroundColor: TOOLBOX_UI.primary,
      paddingVertical: 14,
      borderRadius: TOOLBOX_UI.radius,
      alignItems: 'center',
      marginTop: 8,
    },
    addBtnDisabled: { opacity: 0.5 },
    addBtnText: { fontSize: 16, fontWeight: '600', color: '#fff' },
  });
