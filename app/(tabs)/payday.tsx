import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { getPaydayDay, setPaydayDay } from '@/lib/storage';
import { COLORS } from '@/constants/theme';

const COPY = [
  '再撑一下，马上回血',
  '发薪前的每一秒都是摸鱼',
  '钱包在召唤',
  '坚持就是胜利',
];

function formatTwo(n: number) {
  return String(Math.floor(n)).padStart(2, '0');
}

export default function PaydayScreen() {
  const [day, setDay] = useState('15');
  const [countdown, setCountdown] = useState({ d: 0, h: 0, m: 0 });
  const [copyIndex, setCopyIndex] = useState(0);

  useFocusEffect(
    React.useCallback(() => {
      getPaydayDay().then((d) => setDay(String(d)));
    }, [])
  );

  useEffect(() => {
    const tick = () => {
      const d = Math.max(1, Math.min(28, parseInt(day, 10) || 15));
      const now = new Date();
      let next = new Date(now.getFullYear(), now.getMonth(), d, 0, 0, 0, 0);
      if (next <= now) next = new Date(now.getFullYear(), now.getMonth() + 1, d, 0, 0, 0, 0);
      const diff = Math.max(0, next.getTime() - now.getTime());
      const totalSec = Math.floor(diff / 1000);
      const days = Math.floor(totalSec / 86400);
      const h = Math.floor((totalSec % 86400) / 3600);
      const m = Math.floor((totalSec % 3600) / 60);
      setCountdown({ d: days, h, m });
    };
    tick();
    const id = setInterval(tick, 60000);
    return () => clearInterval(id);
  }, [day]);

  useEffect(() => {
    const id = setInterval(() => setCopyIndex((i) => (i + 1) % COPY.length), 4000);
    return () => clearInterval(id);
  }, []);

  const handleSave = async () => {
    const n = parseInt(day, 10);
    if (n >= 1 && n <= 28) await setPaydayDay(n);
  };

  return (
    <View style={styles.container}>
      <View style={styles.row}>
        <Text style={styles.label}>每月几号发薪</Text>
        <TextInput
          style={styles.input}
          value={day}
          onChangeText={setDay}
          keyboardType="number-pad"
          onBlur={handleSave}
          placeholder="15"
          placeholderTextColor={COLORS.gray}
        />
      </View>
      <View style={styles.countdownBox}>
        <Text style={styles.countdownLabel}>距离发薪日</Text>
        <Text style={styles.countdownValue}>
          {countdown.d} 天 {countdown.h} 时 {countdown.m} 分
        </Text>
      </View>
      <Text style={styles.copy}>{COPY[copyIndex]}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background, padding: 24 },
  title: { fontSize: 20, color: COLORS.text, marginBottom: 24 },
  row: { flexDirection: 'row', alignItems: 'center', marginBottom: 32 },
  label: { fontSize: 16, color: COLORS.gray, marginRight: 12 },
  input: {
    backgroundColor: COLORS.card,
    borderRadius: 12,
    padding: 12,
    fontSize: 18,
    color: COLORS.text,
    width: 60,
    textAlign: 'center',
  },
  countdownBox: { alignItems: 'center', marginBottom: 24 },
  countdownLabel: { fontSize: 16, color: COLORS.gray, marginBottom: 8 },
  countdownValue: { fontSize: 24, fontWeight: '700', color: COLORS.primary },
  copy: { fontSize: 16, color: COLORS.gray, textAlign: 'center' },
});
