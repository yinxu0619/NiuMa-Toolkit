import React, { useState, useEffect, useRef, useMemo } from 'react';
import { View, Text, Pressable, StyleSheet, Modal, Animated, Easing } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { formatMoney } from '@/lib/format';

const COL = {
  track: '#E5E5E5',
  commute: '#FF7A00',
  mortgage: '#FFB366',
  expense: '#E65C00',
  greenLeft: '#38A169',
  greenRight: '#48BB78',
  red: '#E53E3E',
  gray: '#999999',
  title: '#333333',
  white: '#FFFFFF',
  stampBorder: '#E53E3E',
  stampText: '#E53E3E',
  gold: '#D4AF37',
} as const;

export type IncomeCoverageModuleProps = {
  commute: number;
  mortgage: number;
  lunch: number;
  expense: number;
  coverageEarned: number;
  /** 未覆盖 / 已覆盖 状态文案（父组件随机） */
  statusRedCopy: string;
  statusGreenCopy: string;
  /** 当日已达成覆盖后固定印章文案；未达成时为 null */
  stampText: string | null;
  /** 当前是否数值上已覆盖（用于进度与颜色） */
  isCovered: boolean;
  onPressNavigate: () => void;
};

/** 计算填充在各区间的长度（占目标总额 0~1 比例） */
function fillParts(
  fillRatio: number,
  c1: number,
  c2: number
): { f1: number; f2: number; f3: number } {
  const f1 = Math.max(0, Math.min(fillRatio, c1));
  const f2 = Math.max(0, Math.min(fillRatio, c2) - Math.min(fillRatio, c1));
  const f3 = Math.max(0, fillRatio - Math.min(fillRatio, c2));
  return { f1, f2, f3 };
}

export function IncomeCoverageModule({
  commute,
  mortgage,
  lunch,
  expense,
  coverageEarned,
  statusRedCopy,
  statusGreenCopy,
  stampText,
  isCovered,
  onPressNavigate,
}: IncomeCoverageModuleProps) {
  const [detailOpen, setDetailOpen] = useState(false);
  const stampOpacity = useRef(new Animated.Value(0)).current;
  const stampScale = useRef(new Animated.Value(0.4)).current;
  const stampAnimatedForRef = useRef<string | null>(null);

  const lunchExpense = lunch + expense;
  const totalTarget = commute + mortgage + lunchExpense;

  const { fillRatio, c1, c2 } = useMemo(() => {
    if (totalTarget <= 0) {
      return { fillRatio: 0, c1: 0, c2: 0 };
    }
    const r = Math.min(1, coverageEarned / totalTarget);
    return {
      fillRatio: r,
      c1: commute / totalTarget,
      c2: (commute + mortgage) / totalTarget,
    };
  }, [totalTarget, coverageEarned, commute, mortgage, lunchExpense]);

  const covered = isCovered;

  const { f1, f2, f3 } = useMemo(() => fillParts(fillRatio, c1, c2), [fillRatio, c1, c2]);

  useEffect(() => {
    if (!stampText) {
      stampAnimatedForRef.current = null;
      stampOpacity.setValue(0);
      stampScale.setValue(0.35);
      return;
    }
    if (!covered) return;

    if (stampAnimatedForRef.current === stampText) {
      stampOpacity.setValue(1);
      stampScale.setValue(1);
      return;
    }
    stampAnimatedForRef.current = stampText;
    stampOpacity.setValue(0);
    stampScale.setValue(0.35);
    Animated.parallel([
      Animated.timing(stampOpacity, {
        toValue: 1,
        duration: 420,
        useNativeDriver: true,
        easing: Easing.out(Easing.cubic),
      }),
      Animated.spring(stampScale, {
        toValue: 1,
        useNativeDriver: true,
        friction: 6,
        tension: 80,
      }),
    ]).start();
  }, [covered, stampText, stampOpacity, stampScale]);

  if (totalTarget <= 0) {
    return null;
  }

  const showSegments = !covered;
  const line1Left = c1 * 100;
  const line2Left = c2 * 100;

  return (
    <View style={styles.card}>
      <Text style={styles.moduleTitle}>收入覆盖</Text>

      <View style={styles.statusRow}>
        {covered ? (
          <>
            <Ionicons name="checkmark-circle" size={20} color={COL.greenLeft} style={styles.statusIcon} />
            <Ionicons name="paw" size={22} color={COL.gold} style={styles.pawBadge} />
            <Text style={[styles.statusText, styles.statusTextGreen]} numberOfLines={2}>
              {statusGreenCopy}
            </Text>
          </>
        ) : (
          <>
            <Ionicons name="close-circle" size={20} color={COL.red} style={styles.statusIcon} />
            <Text style={[styles.statusText, styles.statusTextRed]} numberOfLines={2}>
              {statusRedCopy}
            </Text>
          </>
        )}
      </View>

      <Text style={styles.subLine}>
        今日实际收入 {formatMoney(coverageEarned)} / 需覆盖 {formatMoney(totalTarget)}
      </Text>

      <Pressable
        onPress={onPressNavigate}
        onLongPress={() => setDetailOpen(true)}
        delayLongPress={380}
        style={styles.barPress}
      >
        {/* 外层留高 + 不裁剪，印章叠在进度条正中，避免被 track 的 overflow 切掉 */}
        <View style={styles.barSection}>
          <View style={styles.trackClip}>
            {covered ? (
              <View style={styles.trackFilledGreen}>
                <View style={[styles.greenHalf, { backgroundColor: COL.greenLeft }]} />
                <View style={[styles.greenHalf, { backgroundColor: COL.greenRight }]} />
              </View>
            ) : (
              <>
                <View style={styles.trackBg} />
                {fillRatio > 0 && (
                  <View style={[styles.fillLayer, { width: `${fillRatio * 100}%` }]}>
                    <View style={styles.fillRow}>
                      {commute > 0 && f1 > 0 && (
                        <View style={{ flex: f1, backgroundColor: COL.commute, minWidth: 0 }} />
                      )}
                      {mortgage > 0 && f2 > 0 && (
                        <View style={{ flex: f2, backgroundColor: COL.mortgage, minWidth: 0 }} />
                      )}
                      {lunchExpense > 0 && f3 > 0 && (
                        <View style={{ flex: f3, backgroundColor: COL.expense, minWidth: 0 }} />
                      )}
                    </View>
                  </View>
                )}
                {showSegments && commute > 0 && c1 > 0 && c1 < 1 && (
                  <View style={[styles.segLine, { left: `${line1Left}%` }]} />
                )}
                {showSegments && mortgage > 0 && c2 > c1 && c2 < 1 && (
                  <View style={[styles.segLine, { left: `${line2Left}%` }]} />
                )}
              </>
            )}
          </View>

          {covered && stampText ? (
            <Animated.View
              pointerEvents="none"
              style={[
                styles.stampOverlay,
                {
                  opacity: stampOpacity,
                  transform: [{ scale: stampScale }, { rotate: '-36deg' }],
                },
              ]}
            >
              <View style={styles.stampCircle}>
                <Text style={styles.stampText} numberOfLines={2}>
                  {stampText}
                </Text>
              </View>
            </Animated.View>
          ) : null}
        </View>
      </Pressable>

      <Text style={styles.hintTap}>轻点看统计 · 长按分段明细</Text>

      <Modal visible={detailOpen} transparent animationType="fade" onRequestClose={() => setDetailOpen(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setDetailOpen(false)}>
          <Pressable style={styles.modalCard} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.modalTitle}>今日需覆盖构成</Text>
            <Text style={styles.modalLine}>通勤 {formatMoney(commute)}</Text>
            <Text style={styles.modalLine}>房贷 {formatMoney(mortgage)}</Text>
            <Text style={styles.modalLine}>午饭 {formatMoney(lunch)}</Text>
            <Text style={styles.modalLine}>万能支出 {formatMoney(expense)}</Text>
            <Text style={styles.modalTotal}>合计 {formatMoney(totalTarget)}</Text>
            <Pressable style={styles.modalBtn} onPress={() => setDetailOpen(false)}>
              <Text style={styles.modalBtnText}>知道了</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: COL.white,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    overflow: 'visible',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  moduleTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COL.title,
    marginBottom: 10,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 6,
    gap: 6,
    flexWrap: 'wrap',
  },
  statusIcon: { marginTop: 1 },
  pawBadge: { marginTop: 0 },
  statusText: { flex: 1, fontSize: 14, lineHeight: 20, minWidth: 0 },
  statusTextRed: { color: COL.red },
  statusTextGreen: { color: COL.greenLeft },
  subLine: {
    fontSize: 12,
    color: COL.gray,
    marginBottom: 12,
  },
  barPress: { width: '100%', overflow: 'visible' },
  barSection: {
    width: '100%',
    minHeight: 100,
    justifyContent: 'center',
    overflow: 'visible',
    position: 'relative',
  },
  trackClip: {
    height: 12,
    borderRadius: 12,
    backgroundColor: COL.track,
    overflow: 'hidden',
    width: '100%',
    position: 'relative',
  },
  trackBg: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: COL.track,
  },
  trackFilledGreen: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: 'row',
    borderRadius: 12,
    overflow: 'hidden',
  },
  greenHalf: { flex: 1, height: '100%' },
  fillLayer: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    borderRadius: 12,
    overflow: 'hidden',
  },
  fillRow: {
    flex: 1,
    flexDirection: 'row',
    height: '100%',
  },
  segLine: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 1,
    backgroundColor: COL.white,
    marginLeft: -0.5,
    zIndex: 4,
  },
  stampOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 20,
  },
  stampCircle: {
    width: 76,
    height: 76,
    borderRadius: 38,
    borderWidth: 3,
    borderColor: COL.stampBorder,
    backgroundColor: COL.white,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  stampText: {
    fontSize: 11,
    fontWeight: '800',
    color: COL.stampText,
    textAlign: 'center',
    lineHeight: 14,
  },
  hintTap: {
    fontSize: 11,
    color: COL.gray,
    marginTop: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    padding: 24,
  },
  modalCard: {
    backgroundColor: COL.white,
    borderRadius: 12,
    padding: 20,
  },
  modalTitle: { fontSize: 17, fontWeight: '700', color: COL.title, marginBottom: 14 },
  modalLine: { fontSize: 15, color: '#666', marginBottom: 8 },
  modalTotal: { fontSize: 16, fontWeight: '700', color: COL.commute, marginTop: 8, marginBottom: 16 },
  modalBtn: {
    backgroundColor: COL.commute,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  modalBtnText: { color: COL.white, fontWeight: '700', fontSize: 16 },
});
