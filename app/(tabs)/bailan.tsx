import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Alert,
  ScrollView,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { ResultModal } from '@/components/ResultModal';
import { AchievementUnlockModal } from '@/components/AchievementUnlockModal';
import { formatMoney, formatDuration, formatDurationHHMMSSWithMs } from '@/lib/format';
import { addRecord, getRecordsInRange, loadTimeConfig } from '@/lib/storage';
import { getCurrentPeriod } from '@/lib/workTime';
import { checkAndUnlockAchievements } from '@/lib/achievementUnlock';
import { useToast } from '@/contexts/ToastContext';
import type { UnlockedAchievement } from '@/lib/achievementUnlock';
import { useSalary } from '@/contexts/SalaryContext';
import { getMoyuAchievement } from '@/lib/achievement';
import { COLORS } from '@/constants/theme';
import type { BailanScene } from '@/types';

const BAILAN_SCENES: BailanScene[] = [
  '无脑发呆',
  '带薪刷手机',
  '带薪聊天',
  '假装思考',
  '坐等下班',
  '带薪摸鱼喝水',
  '通用摆烂',
];

function getLast7DaysRange(): [Date, Date] {
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  const start = new Date(end);
  start.setDate(start.getDate() - 6);
  start.setHours(0, 0, 0, 0);
  return [start, end];
}

export default function BailanScreen() {
  const { salaryPerSecond, config } = useSalary();
  const toast = useToast();
  const [scene, setScene] = useState<BailanScene>('通用摆烂');
  const [running, setRunning] = useState(false);
  const [paused, setPaused] = useState(false);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [showResult, setShowResult] = useState(false);
  const [lastEarned, setLastEarned] = useState(0);
  const [lastDuration, setLastDuration] = useState(0);
  const [lastAchievement, setLastAchievement] = useState('');
  const [historyTotal, setHistoryTotal] = useState(0);
  const [historyAmount, setHistoryAmount] = useState(0);
  const [unlockAchievement, setUnlockAchievement] = useState<UnlockedAchievement | null>(null);
  const startMsRef = useRef(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const ticking = running && !paused;

  /** 按整分钟计费，薅羊毛爽感 */
  const earnedByFullMinutes = (ms: number) => {
    const fullMinutes = Math.floor(ms / 60000);
    return fullMinutes * (salaryPerSecond * 60);
  };

  useEffect(() => {
    if (!ticking) return;
    startMsRef.current = Date.now() - elapsedMs;
    intervalRef.current = setInterval(() => {
      setElapsedMs(Date.now() - startMsRef.current);
    }, 50);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [ticking]);

  const loadHistory = async () => {
    const [start, end] = getLast7DaysRange();
    const records = await getRecordsInRange(start, end);
    const bailanOnly = records.filter((r) => r.category === 'bailan');
    const totalSec = bailanOnly.reduce((a, r) => a + (r.durationSeconds ?? 0), 0);
    const totalAmt = bailanOnly.reduce((a, r) => a + r.amount, 0);
    setHistoryTotal(totalSec);
    setHistoryAmount(totalAmt);
  };

  useFocusEffect(
    React.useCallback(() => {
      loadHistory();
    }, [])
  );

  const currentEarned = earnedByFullMinutes(elapsedMs);

  const handleStart = async () => {
    if (salaryPerSecond <= 0) {
      Alert.alert('请先配置薪资', '在「设置」中填写月薪后即可使用。');
      return;
    }
    const time = await loadTimeConfig();
    if (time) {
      const period = getCurrentPeriod(time);
      if (period === 'lunch' || period === 'after_work') toast.show('现在摸鱼白摸哦～');
    }
    setRunning(true);
    setPaused(false);
    setElapsedMs(0);
  };

  const handlePause = () => {
    setPaused(true);
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  };

  const handleResume = () => {
    setPaused(false);
  };

  const handleEnd = async () => {
    if (!running) return;
    setRunning(false);
    setPaused(false);
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    const durationSeconds = Math.floor(elapsedMs / 1000);
    const earned = earnedByFullMinutes(elapsedMs);
    setLastEarned(earned);
    setLastDuration(durationSeconds);
    setLastAchievement(getMoyuAchievement(durationSeconds));
    setShowResult(true);
    if (earned > 0) {
      await addRecord({
        category: 'bailan',
        amount: earned,
        durationSeconds,
        label: scene,
      });
      const newly = await checkAndUnlockAchievements();
      if (newly.length > 0) setUnlockAchievement(newly[0]);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {!config?.monthly_salary ? (
        <Text style={styles.hint}>请在「设置」中配置月薪后使用</Text>
      ) : null}
      <Text style={styles.sectionLabel}>摆烂场景</Text>
      <View style={styles.sceneRow}>
        {BAILAN_SCENES.map((s) => (
          <Pressable
            key={s}
            style={[styles.sceneChip, scene === s && styles.sceneChipSelected]}
            onPress={() => setScene(s)}
          >
            <Text style={[styles.sceneText, scene === s && styles.sceneTextSelected]} numberOfLines={1}>{s}</Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.timerSection}>
        <Text style={styles.timeText}>已摆烂：{formatDurationHHMMSSWithMs(elapsedMs)}</Text>
        <Text style={styles.moneyHint}>已赚（按整分钟计）</Text>
        <Text style={styles.moneyText}>{formatMoney(currentEarned)}</Text>
      </View>

      <View style={styles.buttons}>
        {!running ? (
          <Pressable style={[styles.btn, styles.btnStart]} onPress={handleStart}>
            <Text style={styles.btnText}>开始摆烂</Text>
          </Pressable>
        ) : (
          <View style={styles.buttonRow}>
            {paused ? (
              <Pressable style={[styles.btn, styles.btnResume]} onPress={handleResume}>
                <Text style={styles.btnText}>继续摆烂</Text>
              </Pressable>
            ) : (
              <Pressable style={[styles.btn, styles.btnPause]} onPress={handlePause}>
                <Text style={styles.btnText}>暂停摆烂</Text>
              </Pressable>
            )}
            <Pressable style={[styles.btn, styles.btnEnd]} onPress={handleEnd}>
              <Text style={styles.btnText}>结束摆烂</Text>
            </Pressable>
          </View>
        )}
      </View>

      <Text style={styles.sectionLabel}>近 7 天摆烂</Text>
      <View style={styles.historyCard}>
        <Text style={styles.historyText}>累计时长：{formatDuration(historyTotal)}</Text>
        <Text style={styles.historyText}>累计赚回：{formatMoney(historyAmount)}</Text>
      </View>

      <ResultModal
        visible={showResult}
        line1={`本次带薪摸鱼时长：${formatDuration(lastDuration)}`}
        line2={`合法赚回老板：${formatMoney(lastEarned)}`}
        line3={`摸鱼成就：${lastAchievement}`}
        onClose={() => setShowResult(false)}
        shareMessage={`本次摆烂时长：${formatDuration(lastDuration)}\n合法赚回老板：${formatMoney(lastEarned)}\n摸鱼成就：${lastAchievement}`}
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
  hint: { fontSize: 14, color: COLORS.gray, marginBottom: 12, textAlign: 'center' },
  sectionLabel: { fontSize: 16, color: COLORS.gray, marginBottom: 12 },
  sceneRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 24 },
  sceneChip: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: COLORS.card,
  },
  sceneChipSelected: { backgroundColor: COLORS.primary },
  sceneText: { fontSize: 13, color: COLORS.text },
  sceneTextSelected: { color: COLORS.onAccent, fontWeight: '600' },
  timerSection: { alignItems: 'center', marginBottom: 32 },
  timeText: { fontSize: 24, fontWeight: '700', color: COLORS.primary, fontVariant: ['tabular-nums'], letterSpacing: 1 },
  moneyHint: { fontSize: 12, color: COLORS.gray, marginTop: 8 },
  moneyText: { fontSize: 22, fontWeight: '700', color: COLORS.text, marginTop: 4, fontVariant: ['tabular-nums'] },
  buttons: { alignItems: 'center', marginBottom: 32 },
  buttonRow: { flexDirection: 'row', gap: 12 },
  btn: { paddingVertical: 14, paddingHorizontal: 24, borderRadius: 12, alignItems: 'center' },
  btnStart: { backgroundColor: COLORS.danger, minWidth: 160 },
  btnPause: { backgroundColor: COLORS.primary },
  btnResume: { backgroundColor: COLORS.success },
  btnEnd: { backgroundColor: COLORS.danger },
  btnText: { fontSize: 16, fontWeight: '600', color: COLORS.onAccent },
  historyCard: {
    backgroundColor: COLORS.card,
    borderRadius: 12,
    padding: 16,
    gap: 8,
  },
  historyText: { fontSize: 15, color: COLORS.text },
});
