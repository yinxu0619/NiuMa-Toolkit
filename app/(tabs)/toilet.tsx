import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Alert,
  ScrollView,
} from 'react-native';
import { ResultModal } from '@/components/ResultModal';
import { AchievementUnlockModal } from '@/components/AchievementUnlockModal';
import { formatMoney, formatDuration, formatDurationHHMMSSWithMs } from '@/lib/format';
import { addRecord, loadTimeConfig } from '@/lib/storage';
import { getCurrentPeriod } from '@/lib/workTime';
import { checkAndUnlockAchievements } from '@/lib/achievementUnlock';
import { useToast } from '@/contexts/ToastContext';
import type { UnlockedAchievement } from '@/lib/achievementUnlock';
import { useSalary } from '@/contexts/SalaryContext';
import { getMoyuAchievement } from '@/lib/achievement';
import { COLORS } from '@/constants/theme';

/** 按秒计费，数字一直涨看着爽 */
function earnedBySecond(elapsedMs: number, salaryPerSecond: number): number {
  return (elapsedMs / 1000) * salaryPerSecond;
}

export default function ToiletScreen() {
  const { salaryPerSecond, config } = useSalary();
  const toast = useToast();
  const [running, setRunning] = useState(false);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [showResult, setShowResult] = useState(false);
  const [lastEarned, setLastEarned] = useState(0);
  const [lastDuration, setLastDuration] = useState(0);
  const [lastAchievement, setLastAchievement] = useState('');
  const [unlockAchievement, setUnlockAchievement] = useState<UnlockedAchievement | null>(null);
  const startMsRef = useRef(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!running) return;
    startMsRef.current = Date.now() - elapsedMs;
    intervalRef.current = setInterval(() => {
      setElapsedMs(Date.now() - startMsRef.current);
    }, 50);
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [running]);

  const currentEarned = earnedBySecond(elapsedMs, salaryPerSecond);

  const handleStart = async () => {
    if (salaryPerSecond <= 0) {
      Alert.alert('请先配置薪资', '在「设置」中填写月薪、计薪天数、日工作时长后即可使用。');
      return;
    }
    const time = await loadTimeConfig();
    if (time) {
      const period = getCurrentPeriod(time);
      if (period === 'lunch' || period === 'after_work') toast.show('现在摸鱼白摸哦～');
    }
    setRunning(true);
    setElapsedMs(0);
  };

  const handleStop = async () => {
    if (!running) return;
    setRunning(false);
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    const durationSeconds = Math.floor(elapsedMs / 1000);
    const earned = earnedBySecond(elapsedMs, salaryPerSecond);
    setLastEarned(earned);
    setLastDuration(durationSeconds);
    setLastAchievement(getMoyuAchievement(durationSeconds));
    setShowResult(true);
    if (earned > 0) {
      await addRecord({
        category: 'toilet',
        amount: earned,
        durationSeconds,
        label: '带薪如厕',
      });
      const newly = await checkAndUnlockAchievements();
      if (newly.length > 0) setUnlockAchievement(newly[0]);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {!config?.monthly_salary ? (
        <Text style={styles.hint}>请在「设置」中配置月薪后使用本功能</Text>
      ) : null}

      <View style={styles.timerSection}>
        <Text style={styles.timeLabel}>已耗时</Text>
        <Text style={styles.timeText}>{formatDurationHHMMSSWithMs(elapsedMs)}</Text>
        <Text style={styles.moneyLabel}>已赚（按秒计）</Text>
        <Text style={styles.moneyText}>{formatMoney(currentEarned)}</Text>
      </View>

      <View style={styles.buttons}>
        {!running ? (
          <Pressable style={[styles.btn, styles.btnStart]} onPress={handleStart}>
            <Text style={styles.btnText}>开始计时</Text>
          </Pressable>
        ) : (
          <Pressable style={[styles.btn, styles.btnStop]} onPress={handleStop}>
            <Text style={styles.btnText}>停止计时</Text>
          </Pressable>
        )}
      </View>

      <ResultModal
        visible={showResult}
        line1={`本次带薪如厕时长：${formatDuration(lastDuration)}`}
        line2={`合法赚回老板：${formatMoney(lastEarned)}`}
        line3={`摸鱼成就：${lastAchievement}`}
        onClose={() => setShowResult(false)}
        shareMessage={`本次带薪如厕时长：${formatDuration(lastDuration)}\n合法赚回老板：${formatMoney(lastEarned)}\n摸鱼成就：${lastAchievement}`}
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
  hint: { fontSize: 14, color: COLORS.gray, marginBottom: 16, textAlign: 'center' },
  timerSection: { alignItems: 'center', marginBottom: 40 },
  timeLabel: { fontSize: 14, color: COLORS.gray, marginBottom: 4 },
  timeText: {
    fontSize: 32,
    fontWeight: '700',
    color: COLORS.primary,
    fontVariant: ['tabular-nums'],
    letterSpacing: 1,
  },
  moneyLabel: { fontSize: 14, color: COLORS.gray, marginTop: 20, marginBottom: 4 },
  moneyText: { fontSize: 26, fontWeight: '700', color: COLORS.text, fontVariant: ['tabular-nums'] },
  buttons: { alignItems: 'center' },
  btn: { paddingVertical: 16, paddingHorizontal: 48, borderRadius: 12, minWidth: 160, alignItems: 'center' },
  btnStart: { backgroundColor: COLORS.primary },
  btnStop: { backgroundColor: COLORS.danger },
  btnText: { fontSize: 18, fontWeight: '600', color: COLORS.onAccent },
});
