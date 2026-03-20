import React, { useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, ScrollView, Alert } from 'react-native';
import { ResultModal } from '@/components/ResultModal';
import { AchievementUnlockModal } from '@/components/AchievementUnlockModal';
import { formatMoney } from '@/lib/format';
import { addRecord, loadTimeConfig } from '@/lib/storage';
import { getCurrentPeriod } from '@/lib/workTime';
import { checkAndUnlockAchievements } from '@/lib/achievementUnlock';
import { useToast } from '@/contexts/ToastContext';
import { useSalary } from '@/contexts/SalaryContext';
import { hourlyWage } from '@/lib/salary';
import { pickMeeting } from '@/constants/copy';
import type { UnlockedAchievement } from '@/lib/achievementUnlock';
import { COLORS } from '@/constants/theme';

function getMeetingLevel(teamTotal: number): string {
  if (teamTotal < 100) return '轻度摸鱼会';
  if (teamTotal < 300) return '中度浪费会';
  if (teamTotal < 500) return '重度坐牢会';
  return '史诗级亏钱大会';
}

export default function MeetingScreen() {
  const { config } = useSalary();
  const toast = useToast();
  const [minutes, setMinutes] = useState('');
  const [people, setPeople] = useState('');
  const [showResult, setShowResult] = useState(false);
  const [personalEarned, setPersonalEarned] = useState(0);
  const [bossLoss, setBossLoss] = useState(0);
  const [level, setLevel] = useState('');
  const [unlockAchievement, setUnlockAchievement] = useState<UnlockedAchievement | null>(null);

  const hourly = config ? hourlyWage(config) : 0;
  const mins = parseFloat(minutes) || 0;
  const count = Math.max(1, parseInt(people, 10) || 1);
  const personal = hourly * (mins / 60);
  const teamTotal = personal * count;

  const handleCalc = async () => {
    if (!config?.monthly_salary) {
      Alert.alert('请先配置薪资', '在「设置」中填写月薪后再用。');
      return;
    }
    if (mins <= 0) {
      Alert.alert('提示', '请输入会议时长（分钟）');
      return;
    }
    const time = await loadTimeConfig();
    if (time) {
      const period = getCurrentPeriod(time);
      if (period === 'lunch' || period === 'after_work') toast.show('现在摸鱼白摸哦～');
    }
    const myEarned = hourly * (mins / 60);
    const total = myEarned * count;
    setPersonalEarned(myEarned);
    setBossLoss(total);
    setLevel(getMeetingLevel(total));
    setShowResult(true);
    await addRecord({
      category: 'meeting',
      amount: myEarned,
      label: `${Math.round(mins)} 分钟无效会议`,
      content: `${Math.round(mins)} 分钟无效会议`,
      bossLoss: total,
    });
    const newly = await checkAndUnlockAchievements();
    if (newly.length > 0) setUnlockAchievement(newly[0]);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.hint}>按你的时薪 × 会议时长 × 人数，算老板血亏多少</Text>
      <Text style={styles.label}>会议时长（分钟）</Text>
      <TextInput
        style={styles.input}
        value={minutes}
        onChangeText={setMinutes}
        keyboardType="number-pad"
        placeholder="30"
        placeholderTextColor={COLORS.gray}
      />
      <Text style={styles.label}>参会人数</Text>
      <TextInput
        style={styles.input}
        value={people}
        onChangeText={setPeople}
        keyboardType="number-pad"
        placeholder="5"
        placeholderTextColor={COLORS.gray}
      />
      {hourly > 0 && (
        <View style={styles.preview}>
          <Text style={styles.previewText}>你赚：{formatMoney(personal)}</Text>
          <Text style={styles.previewText}>老板血亏：{formatMoney(teamTotal)}（{level}）</Text>
        </View>
      )}
      <Pressable
        style={[styles.btn, (!config?.monthly_salary || mins <= 0) && styles.btnDisabled]}
        onPress={handleCalc}
        disabled={!config?.monthly_salary || mins <= 0}
      >
        <Text style={styles.btnText}>记一笔</Text>
      </Pressable>
      <ResultModal
        visible={showResult}
        line1={`本次会议：你赚了 ${formatMoney(personalEarned)}`}
        line2={`老板血亏：${formatMoney(bossLoss)}（${level}）`}
        line3={pickMeeting()}
        onClose={() => setShowResult(false)}
        shareMessage={`无效会议：我赚了 ${formatMoney(personalEarned)}，老板血亏 ${formatMoney(bossLoss)}（${level}）`}
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
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { padding: 24, paddingBottom: 48 },
  title: { fontSize: 20, color: COLORS.text, marginBottom: 8 },
  hint: { fontSize: 14, color: COLORS.gray, marginBottom: 24 },
  label: { fontSize: 16, color: COLORS.gray, marginBottom: 8 },
  input: {
    backgroundColor: COLORS.card,
    borderRadius: 12,
    padding: 16,
    fontSize: 18,
    color: COLORS.text,
    marginBottom: 20,
  },
  preview: { marginBottom: 20, padding: 12, backgroundColor: COLORS.card, borderRadius: 12 },
  previewText: { fontSize: 15, color: COLORS.text, marginBottom: 4 },
  btn: { backgroundColor: COLORS.primary, paddingVertical: 16, borderRadius: 12, alignItems: 'center' },
  btnDisabled: { opacity: 0.5 },
  btnText: { fontSize: 18, fontWeight: '600', color: COLORS.onAccent },
});
