import React, { useState, useEffect } from 'react';
import { View, Text, Pressable, StyleSheet, Alert, TextInput } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { addRecord, getOffworkTime, setOffworkTime } from '@/lib/storage';
import { checkAndUnlockAchievements } from '@/lib/achievementUnlock';
import { AchievementUnlockModal } from '@/components/AchievementUnlockModal';
import type { UnlockedAchievement } from '@/lib/achievementUnlock';
import { COLORS } from '@/constants/theme';

function parseTime(s: string): { h: number; m: number } {
  const [h, m] = s.split(':').map((x) => parseInt(x, 10) || 0);
  return { h: h ?? 18, m: m ?? 0 };
}

function formatTwo(n: number) {
  return String(n).padStart(2, '0');
}

export default function OffworkScreen() {
  const [timeStr, setTimeStr] = useState('18:00');
  const [countdown, setCountdown] = useState({ h: 0, m: 0, s: 0 });
  const [hasNotified, setHasNotified] = useState(false);
  const [unlockAchievement, setUnlockAchievement] = useState<UnlockedAchievement | null>(null);

  useFocusEffect(
    React.useCallback(() => {
      getOffworkTime().then(setTimeStr);
    }, [])
  );

  useEffect(() => {
    const tick = () => {
      const now = new Date();
      const { h: offH, m: offM } = parseTime(timeStr);
      let end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), offH, offM, 0, 0);
      if (end <= now) end.setDate(end.getDate() + 1);
      const diff = Math.max(0, Math.floor((end.getTime() - now.getTime()) / 1000));
      const h = Math.floor(diff / 3600);
      const m = Math.floor((diff % 3600) / 60);
      const s = diff % 60;
      setCountdown({ h, m, s });
      if (diff === 0 && !hasNotified) {
        setHasNotified(true);
        Alert.alert('到点走人！', '拒绝内卷！');
      }
      if (diff > 0) setHasNotified(false);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [timeStr, hasNotified]);

  const handleSaveTime = async () => {
    const match = /^(\d{1,2}):(\d{2})$/.exec(timeStr);
    if (match) {
      await setOffworkTime(timeStr);
    }
  };

  const handleRecordOffwork = async () => {
    await addRecord({
      category: 'offwork',
      amount: 0,
      label: '今日准点下班',
      content: '今日准点下班',
    });
    Alert.alert('已记录', '今日准点跑路 +1');
    const newly = await checkAndUnlockAchievements();
    if (newly.length > 0) setUnlockAchievement(newly[0]);
  };

  return (
    <View style={styles.container}>
      <View style={styles.timeRow}>
        <Text style={styles.label}>下班时间</Text>
        <TextInput
          style={styles.timeInput}
          value={timeStr}
          onChangeText={setTimeStr}
          placeholder="18:00"
          placeholderTextColor={COLORS.gray}
          onBlur={handleSaveTime}
        />
      </View>
      <View style={styles.countdownBox}>
        <Text style={styles.countdownLabel}>距离下班还有</Text>
        <Text style={styles.countdownValue}>
          {formatTwo(countdown.h)}:{formatTwo(countdown.m)}:{formatTwo(countdown.s)}
        </Text>
      </View>
      <Pressable style={styles.recordBtn} onPress={handleRecordOffwork}>
        <Text style={styles.recordBtnText}>准点下班 · 记一笔</Text>
      </Pressable>
      <AchievementUnlockModal
        visible={unlockAchievement != null}
        achievement={unlockAchievement}
        onClose={() => setUnlockAchievement(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background, padding: 24 },
  title: { fontSize: 20, color: COLORS.text, marginBottom: 24 },
  timeRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 32 },
  label: { fontSize: 16, color: COLORS.gray, marginRight: 12 },
  timeInput: {
    backgroundColor: COLORS.card,
    borderRadius: 12,
    padding: 12,
    fontSize: 18,
    color: COLORS.text,
    minWidth: 80,
  },
  countdownBox: { alignItems: 'center', marginBottom: 40 },
  countdownLabel: { fontSize: 16, color: COLORS.gray, marginBottom: 8 },
  countdownValue: { fontSize: 42, fontWeight: '700', color: COLORS.primary, fontVariant: ['tabular-nums'] },
  recordBtn: {
    backgroundColor: COLORS.primary,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  recordBtnText: { fontSize: 18, fontWeight: '600', color: COLORS.onAccent },
});
