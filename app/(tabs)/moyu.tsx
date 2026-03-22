import React, { useState, useRef, useEffect, useCallback, type ReactNode } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ScrollView,
  Alert,
  Platform,
  Image,
  Animated,
  Easing,
  Modal,
  Vibration,
  type TextStyle,
} from 'react-native';
import Constants from 'expo-constants';
import { useFocusEffect } from '@react-navigation/native';
import { formatMoney, formatDurationHHMMSSWithMs, formatDuration } from '@/lib/format';
import { addRecord, loadTimeConfig, loadLeaveMarks, getHolidaySyncEnabled, loadHolidayDates, loadNiumaConfig } from '@/lib/storage';
import { getCurrentPeriod } from '@/lib/workTime';
import { isRestDay } from '@/lib/holidays';
import { useSalary } from '@/contexts/SalaryContext';
import { useToast } from '@/contexts/ToastContext';
import { MOYU_TYPE_LABELS, type MoyuType } from '@/types';
import { ResultModal } from '@/components/ResultModal';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/** 带薪摸鱼：边缘柔光向内渗透，色相慢速渐变（无跑马条，不挡点击） */
const DISCO_COLORS = ['#FF7A00', '#FF6B9D', '#FF4081', '#B388FF', '#7C4DFF', '#4FC3F7', '#00BCD4', '#FFD54F', '#FFCA28', '#FF7A00'] as const;
const DISCO_LEN = DISCO_COLORS.length;

/** 多节点插值，相邻色更接近，过渡更细腻 */
function discoColorChain(phase: Animated.Value, start: number) {
  const n = 10;
  const inputRange = Array.from({ length: n + 1 }, (_, i) => i / n);
  const outputRange = inputRange.map((_, i) => DISCO_COLORS[(start + i) % DISCO_LEN]);
  return phase.interpolate({ inputRange, outputRange });
}

function DiscoScreenEdges({ active }: { active: boolean }) {
  const phase = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!active) {
      phase.stopAnimation();
      phase.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.timing(phase, {
        toValue: 1,
        duration: 9000,
        easing: Easing.linear,
        useNativeDriver: false,
      })
    );
    loop.start();
    return () => {
      loop.stop();
      phase.setValue(0);
    };
  }, [active, phase]);

  const topC = discoColorChain(phase, 0);
  const rightC = discoColorChain(phase, 2);
  const bottomC = discoColorChain(phase, 4);
  const leftC = discoColorChain(phase, 6);
  /** 近似正弦呼吸，幅度收敛，更柔和 */
  const breathe = phase.interpolate({
    inputRange: [0, 0.125, 0.25, 0.375, 0.5, 0.625, 0.75, 0.875, 1],
    outputRange: [0.58, 0.66, 0.74, 0.8, 0.74, 0.66, 0.58, 0.64, 0.58],
  });

  if (!active) return null;

  const b = (k: number) => Animated.multiply(breathe, k);

  return (
    <View style={discoStyles.wrap} pointerEvents="none">
      {/* 向内柔光（多层叠化，边缘略实、向内渐隐） */}
      <Animated.View style={[discoStyles.glowTop, { backgroundColor: topC, opacity: b(0.14) }]} />
      <Animated.View style={[discoStyles.glowTopDeep, { backgroundColor: topC, opacity: b(0.075) }]} />
      <Animated.View style={[discoStyles.glowBottom, { backgroundColor: bottomC, opacity: b(0.14) }]} />
      <Animated.View style={[discoStyles.glowBottomDeep, { backgroundColor: bottomC, opacity: b(0.075) }]} />
      <Animated.View style={[discoStyles.glowLeft, { backgroundColor: leftC, opacity: b(0.12) }]} />
      <Animated.View style={[discoStyles.glowLeftDeep, { backgroundColor: leftC, opacity: b(0.062) }]} />
      <Animated.View style={[discoStyles.glowRight, { backgroundColor: rightC, opacity: b(0.12) }]} />
      <Animated.View style={[discoStyles.glowRightDeep, { backgroundColor: rightC, opacity: b(0.062) }]} />

      {/* 细边线（低对比，不抢眼） */}
      <Animated.View style={[discoStyles.edgeTop, { backgroundColor: topC, opacity: b(0.42) }]} />
      <Animated.View style={[discoStyles.edgeRight, { backgroundColor: rightC, opacity: b(0.42) }]} />
      <Animated.View style={[discoStyles.edgeBottom, { backgroundColor: bottomC, opacity: b(0.42) }]} />
      <Animated.View style={[discoStyles.edgeLeft, { backgroundColor: leftC, opacity: b(0.42) }]} />

      {/* 细阶梯渗透：带更窄、层次更多，模拟平滑晕染 */}
      <Animated.View style={[discoStyles.penTop1, { backgroundColor: topC, opacity: b(0.09) }]} />
      <Animated.View style={[discoStyles.penTop2, { backgroundColor: topC, opacity: b(0.072) }]} />
      <Animated.View style={[discoStyles.penTop3, { backgroundColor: topC, opacity: b(0.056) }]} />
      <Animated.View style={[discoStyles.penTop4, { backgroundColor: topC, opacity: b(0.041) }]} />
      <Animated.View style={[discoStyles.penTop5, { backgroundColor: topC, opacity: b(0.028) }]} />
      <Animated.View style={[discoStyles.penTop6, { backgroundColor: topC, opacity: b(0.016) }]} />
      <Animated.View style={[discoStyles.penBottom1, { backgroundColor: bottomC, opacity: b(0.09) }]} />
      <Animated.View style={[discoStyles.penBottom2, { backgroundColor: bottomC, opacity: b(0.072) }]} />
      <Animated.View style={[discoStyles.penBottom3, { backgroundColor: bottomC, opacity: b(0.056) }]} />
      <Animated.View style={[discoStyles.penBottom4, { backgroundColor: bottomC, opacity: b(0.041) }]} />
      <Animated.View style={[discoStyles.penBottom5, { backgroundColor: bottomC, opacity: b(0.028) }]} />
      <Animated.View style={[discoStyles.penBottom6, { backgroundColor: bottomC, opacity: b(0.016) }]} />
      <Animated.View style={[discoStyles.penLeft1, { backgroundColor: leftC, opacity: b(0.078) }]} />
      <Animated.View style={[discoStyles.penLeft2, { backgroundColor: leftC, opacity: b(0.062) }]} />
      <Animated.View style={[discoStyles.penLeft3, { backgroundColor: leftC, opacity: b(0.048) }]} />
      <Animated.View style={[discoStyles.penLeft4, { backgroundColor: leftC, opacity: b(0.034) }]} />
      <Animated.View style={[discoStyles.penLeft5, { backgroundColor: leftC, opacity: b(0.022) }]} />
      <Animated.View style={[discoStyles.penLeft6, { backgroundColor: leftC, opacity: b(0.012) }]} />
      <Animated.View style={[discoStyles.penRight1, { backgroundColor: rightC, opacity: b(0.078) }]} />
      <Animated.View style={[discoStyles.penRight2, { backgroundColor: rightC, opacity: b(0.062) }]} />
      <Animated.View style={[discoStyles.penRight3, { backgroundColor: rightC, opacity: b(0.048) }]} />
      <Animated.View style={[discoStyles.penRight4, { backgroundColor: rightC, opacity: b(0.034) }]} />
      <Animated.View style={[discoStyles.penRight5, { backgroundColor: rightC, opacity: b(0.022) }]} />
      <Animated.View style={[discoStyles.penRight6, { backgroundColor: rightC, opacity: b(0.012) }]} />
    </View>
  );
}

const discoStyles = StyleSheet.create({
  /** 必须低于主内容区，否则弹出的金额气泡会被染色层盖住 */
  wrap: { ...StyleSheet.absoluteFillObject, zIndex: 0 },
  edgeTop: { position: 'absolute', top: 0, left: 0, right: 0, height: 3 },
  edgeBottom: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 3 },
  edgeLeft: { position: 'absolute', top: 0, bottom: 0, left: 0, width: 3 },
  edgeRight: { position: 'absolute', top: 0, bottom: 0, right: 0, width: 3 },
  glowTop: { position: 'absolute', top: 0, left: 0, right: 0, height: 88 },
  glowTopDeep: { position: 'absolute', top: 0, left: 0, right: 0, height: 140 },
  glowBottom: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 88 },
  glowBottomDeep: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 140 },
  glowLeft: { position: 'absolute', top: 0, bottom: 0, left: 0, width: 56 },
  glowLeftDeep: { position: 'absolute', top: 0, bottom: 0, left: 0, width: 102 },
  glowRight: { position: 'absolute', top: 0, bottom: 0, right: 0, width: 56 },
  glowRightDeep: { position: 'absolute', top: 0, bottom: 0, right: 0, width: 102 },
  penTop1: { position: 'absolute', top: 3, left: 0, right: 0, height: 12 },
  penTop2: { position: 'absolute', top: 15, left: 0, right: 0, height: 13 },
  penTop3: { position: 'absolute', top: 28, left: 0, right: 0, height: 15 },
  penTop4: { position: 'absolute', top: 43, left: 0, right: 0, height: 16 },
  penTop5: { position: 'absolute', top: 59, left: 0, right: 0, height: 17 },
  penTop6: { position: 'absolute', top: 76, left: 0, right: 0, height: 18 },
  penBottom1: { position: 'absolute', bottom: 3, left: 0, right: 0, height: 12 },
  penBottom2: { position: 'absolute', bottom: 15, left: 0, right: 0, height: 13 },
  penBottom3: { position: 'absolute', bottom: 28, left: 0, right: 0, height: 15 },
  penBottom4: { position: 'absolute', bottom: 43, left: 0, right: 0, height: 16 },
  penBottom5: { position: 'absolute', bottom: 59, left: 0, right: 0, height: 17 },
  penBottom6: { position: 'absolute', bottom: 76, left: 0, right: 0, height: 18 },
  penLeft1: { position: 'absolute', top: 0, bottom: 0, left: 3, width: 12 },
  penLeft2: { position: 'absolute', top: 0, bottom: 0, left: 15, width: 13 },
  penLeft3: { position: 'absolute', top: 0, bottom: 0, left: 28, width: 15 },
  penLeft4: { position: 'absolute', top: 0, bottom: 0, left: 43, width: 16 },
  penLeft5: { position: 'absolute', top: 0, bottom: 0, left: 59, width: 17 },
  penLeft6: { position: 'absolute', top: 0, bottom: 0, left: 76, width: 18 },
  penRight1: { position: 'absolute', top: 0, bottom: 0, right: 3, width: 12 },
  penRight2: { position: 'absolute', top: 0, bottom: 0, right: 15, width: 13 },
  penRight3: { position: 'absolute', top: 0, bottom: 0, right: 28, width: 15 },
  penRight4: { position: 'absolute', top: 0, bottom: 0, right: 43, width: 16 },
  penRight5: { position: 'absolute', top: 0, bottom: 0, right: 59, width: 17 },
  penRight6: { position: 'absolute', top: 0, bottom: 0, right: 76, width: 18 },
});

const MOYU_UI = {
  bg: '#FFFFFF',
  primary: '#FF7A00',
  cardBg: '#FFF9E6',
  danger: '#E53E3E',
  text: '#333333',
  textSecondary: '#999999',
  border: '#E5E5E5',
  radius: 12,
  radiusChip: 8,
} as const;

/** 档位/点按飘字：相对猫爪区顶部锚定，盖在猫爪图之上（避免 bottom 算到收益区被挡住） */
const MOYU_FLOAT_LAYER_TOP = 4;

const MOYU_TYPES: MoyuType[] = ['toilet', 'bailan', 'meeting', 'daze'];

const PAW_ICON = require('../../assets/cathand.png');

/** 按秒计费 */
function earnedBySecond(elapsedMs: number, salaryPerSecond: number): number {
  return (elapsedMs / 1000) * salaryPerSecond;
}

const MOYU_COPY: string[] = [
  '这波不亏，老板买单！',
  '带薪摸鱼，合法收入！',
  '时间换钱，摸到就是赚到！',
  '打工人的小确幸～',
  '老板：我裂开。你：我赚了。',
];

function pickCopy(): string {
  return MOYU_COPY[Math.floor(Math.random() * MOYU_COPY.length)];
}

const EARN_THRESHOLDS = [0.1, 1, 5, 10, 20, 50, 100] as const;

/** 带薪计时中：每攒满 1 元整数档弹一次（1、2、3…），本局内递增；上限防止异常金额卡死 */
const MILESTONE_INTEGER_YUAN_CAP = 9999;

function tierForAmount(amount: number): number {
  let t = 0.1;
  for (const x of EARN_THRESHOLDS) {
    if (amount >= x) t = x;
  }
  return t;
}

function milestonePopLabel(threshold: number): string {
  if (threshold >= 1) return `￥${Math.round(threshold)}`;
  return '￥';
}

function milestoneYenFontSize(threshold: number): number {
  if (threshold >= 100) return 28;
  if (threshold >= 50) return 26;
  if (threshold >= 20) return 24;
  if (threshold >= 10) return 23;
  if (threshold >= 5) return 22;
  if (threshold === 1) return 22;
  if (threshold > 1) return 21;
  return 18;
}

type BubbleItem = { id: string; threshold: number; amount: number };

function bubbleDurationMs(threshold: number): number {
  if (threshold <= 0.1) return 1000;
  if (threshold >= 1) return 2900;
  return 1100;
}

/** ≥1 元里程碑：入场 → 停留 → 自然上浮渐隐 */
const BUBBLE_INTRO_MS = 280;
const BUBBLE_HOLD_MS = 1180;
const BUBBLE_FLY_FADE_MS = 1680;

/** 与主收益区一致的暖橙数字 + 白底橙边，保证弹出金额一定能看见 */
const POP_MONEY_TEXT: TextStyle = {
  color: MOYU_UI.primary,
  fontWeight: '900',
  fontVariant: ['tabular-nums'],
  textShadowColor: MOYU_UI.primary,
  textShadowOffset: { width: 0, height: 1 },
  textShadowRadius: 1,
};

function MoneyPopPill({ children, scale = 1 }: { children: ReactNode; scale?: number }) {
  return (
    <View
      style={{
        backgroundColor: '#FFFFFF',
        borderWidth: 2,
        borderColor: MOYU_UI.primary,
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 14,
        shadowColor: MOYU_UI.primary,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.35,
        shadowRadius: 6,
        elevation: 8,
        transform: [{ scale }],
      }}
    >
      {children}
    </View>
  );
}

/** 按住猫爪时的即时「弹钱」反馈（与阈值气泡分开） */
function TapMoneyPop({
  amount,
  swayTx,
  onDone,
}: {
  amount: number;
  swayTx: Animated.AnimatedInterpolation<number>;
  onDone: () => void;
}) {
  const translateY = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(1)).current;
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;
  useEffect(() => {
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: -100,
        duration: 620,
        useNativeDriver: true,
        easing: Easing.out(Easing.quad),
      }),
      Animated.timing(opacity, {
        toValue: 0,
        duration: 620,
        useNativeDriver: true,
      }),
    ]).start(() => onDoneRef.current());
    // 每条弹窗挂载只播一次；勿依赖 onDone 引用
  }, [opacity, translateY]);

  return (
    <Animated.View
      style={{
        position: 'absolute',
        top: MOYU_FLOAT_LAYER_TOP,
        left: 0,
        right: 0,
        alignItems: 'center',
        transform: [{ translateX: swayTx }, { translateY }],
        opacity,
        zIndex: 2000,
        elevation: 28,
      }}
    >
      <MoneyPopPill>
        <Text allowFontScaling={false} style={[POP_MONEY_TEXT, { fontSize: 24 }]}>
          +￥{amount.toFixed(3)}
        </Text>
      </MoneyPopPill>
    </Animated.View>
  );
}

/** 整数元里程碑飘字；动效勿依赖 onDone 引用，否则父组件重绘会重置动画 */
function EarnBubble({
  item,
  swayTx,
  onDone,
}: {
  item: BubbleItem;
  swayTx: Animated.AnimatedInterpolation<number>;
  onDone: () => void;
}) {
  const translateY = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(1)).current;
  const popScale = useRef(new Animated.Value(1)).current;
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;
  const { threshold } = item;
  const dur = bubbleDurationMs(threshold);

  useEffect(() => {
    if (threshold >= 1) {
      const fly = threshold >= 50 ? -220 : threshold >= 10 ? -195 : threshold === 1 ? -175 : -185;
      opacity.setValue(0);
      popScale.setValue(0.88);
      translateY.setValue(10);

      Animated.sequence([
        Animated.parallel([
          Animated.timing(popScale, {
            toValue: 1,
            duration: 320,
            useNativeDriver: true,
            easing: Easing.out(Easing.back(1.25)),
          }),
          Animated.timing(opacity, {
            toValue: 1,
            duration: BUBBLE_INTRO_MS,
            useNativeDriver: true,
            easing: Easing.out(Easing.cubic),
          }),
          Animated.timing(translateY, {
            toValue: 0,
            duration: BUBBLE_INTRO_MS + 50,
            useNativeDriver: true,
            easing: Easing.out(Easing.cubic),
          }),
        ]),
        Animated.delay(BUBBLE_HOLD_MS),
        Animated.parallel([
          Animated.timing(translateY, {
            toValue: fly,
            duration: BUBBLE_FLY_FADE_MS,
            useNativeDriver: true,
            easing: Easing.out(Easing.cubic),
          }),
          Animated.timing(opacity, {
            toValue: 0,
            duration: BUBBLE_FLY_FADE_MS,
            useNativeDriver: true,
            easing: Easing.inOut(Easing.quad),
          }),
        ]),
      ]).start(() => onDoneRef.current());
      return;
    }

    popScale.setValue(1);
    translateY.setValue(0);
    opacity.setValue(1);
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: -72,
        duration: dur,
        useNativeDriver: true,
        easing: Easing.out(Easing.quad),
      }),
      Animated.timing(opacity, {
        toValue: 0,
        duration: dur,
        useNativeDriver: true,
      }),
    ]).start(() => onDoneRef.current());
    // 仅依赖本条气泡身份与档位；勿依赖 onDone
  }, [threshold, item.id, dur, opacity, translateY, popScale]);

  const fs = milestoneYenFontSize(threshold);

  return (
    <Animated.View
      style={{
        position: 'absolute',
        top: MOYU_FLOAT_LAYER_TOP,
        left: 0,
        right: 0,
        alignItems: 'center',
        transform: [{ translateX: swayTx }, { translateY }],
        opacity,
        zIndex: 2000,
        elevation: 28,
      }}
    >
      <Animated.View style={{ transform: [{ scale: popScale }] }}>
        <Animated.Text allowFontScaling={false} style={[styles.milestoneYenFloat, { fontSize: fs }]}>
          {milestonePopLabel(threshold)}
        </Animated.Text>
      </Animated.View>
    </Animated.View>
  );
}

export default function MoyuScreen() {
  const toast = useToast();
  const insets = useSafeAreaInsets();
  const { salaryPerSecond } = useSalary();

  const [moyuType, setMoyuType] = useState<MoyuType | null>(null);
  const [running, setRunning] = useState(false);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [showResult, setShowResult] = useState(false);
  const [resultLine1, setResultLine1] = useState('');
  const [resultLine2, setResultLine2] = useState('');
  const [resultLine3, setResultLine3] = useState('');
  const [isPaidSession, setIsPaidSession] = useState(true);
  const [showPickTypeModal, setShowPickTypeModal] = useState(false);
  const pendingEndRef = useRef<{ durationSeconds: number; earned: number } | null>(null);
  const [bubbles, setBubbles] = useState<BubbleItem[]>([]);
  const [tapPops, setTapPops] = useState<{ id: string; amount: number }[]>([]);
  const [frozenElapsedMs, setFrozenElapsedMs] = useState(0);
  const [frozenEarned, setFrozenEarned] = useState(0);
  const [frozenWasPaid, setFrozenWasPaid] = useState(true);
  const [showFrozenStats, setShowFrozenStats] = useState(false);
  /** 本局已播报到第几「整元」里程碑（仅带薪计时递增，开局清零） */
  const lastIntegerYuanEmittedRef = useRef(0);
  const salaryPerSecondRef = useRef(salaryPerSecond);
  salaryPerSecondRef.current = salaryPerSecond;

  const startMsRef = useRef(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  /** 开局时是否按带薪计（周末/法定假/请假 = 否） */
  const paidAtStartRef = useRef(false);
  /** 点击猫爪：快速摇一下（替代按下缩小） */
  const pawTapRock = useRef(new Animated.Value(0)).current;
  /** 与弹出金额同频：左-右摇摆（仅带薪计时中） */
  const pawSway = useRef(new Animated.Value(0)).current;
  const heartbeatScale = useRef(new Animated.Value(1)).current;
  const pulseAnimRef = useRef<Animated.CompositeAnimation | null>(null);
  const coinAnims = useRef([...Array(4)].map(() => new Animated.Value(0))).current;

  const [period, setPeriod] = useState<'working' | 'lunch' | 'after_work' | 'before_work'>('working');
  /** 周末 / 法定休 / 年假病假：不按工作日带薪摸鱼 */
  const [isRestDayState, setIsRestDayState] = useState(false);

  const loadPeriod = useCallback(async () => {
    const time = await loadTimeConfig();
    if (time) setPeriod(getCurrentPeriod(time));
    const [marks, holOn, dates, niuma] = await Promise.all([
      loadLeaveMarks(),
      getHolidaySyncEnabled(),
      loadHolidayDates(),
      loadNiumaConfig(),
    ]);
    setIsRestDayState(isRestDay(new Date(), holOn, holOn ? dates : [], marks, niuma));
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadPeriod();
    }, [loadPeriod])
  );
  useEffect(() => {
    const t = setInterval(loadPeriod, 60 * 1000);
    return () => clearInterval(t);
  }, [loadPeriod]);

  const isPaid = running ? isPaidSession : period === 'working' && !isRestDayState;
  const displayEarned = isPaid ? earnedBySecond(elapsedMs, salaryPerSecond) : 0;

  const elapsedDisplayMs = running ? elapsedMs : showFrozenStats ? frozenElapsedMs : 0;
  const earnedDisplay = running
    ? isPaid
      ? displayEarned
      : 0
    : showFrozenStats
      ? frozenEarned
      : 0;
  /** 收益行配色：未开始/未结束过一局前不按「带薪」显示橙色金额 */
  const isPaidForHeroMoney = running ? isPaid : showFrozenStats ? frozenWasPaid : false;

  /** 仅档位变化时重启心跳，避免每 50ms 随金额重启动画 */
  const heartbeatTier = displayEarned >= 10 ? 2 : displayEarned >= 1 ? 1 : 0;

  const removeBubble = useCallback((id: string) => {
    setBubbles((prev) => prev.filter((b) => b.id !== id));
  }, []);

  const removeTapPop = useCallback((id: string) => {
    setTapPops((prev) => prev.filter((p) => p.id !== id));
  }, []);

  useEffect(() => {
    if (!running || !isPaid) return;
    const cap = Math.min(Math.floor(displayEarned + 1e-9), MILESTONE_INTEGER_YUAN_CAP);
    const toAdd: BubbleItem[] = [];
    let vibrateBig = false;
    while (lastIntegerYuanEmittedRef.current < cap) {
      lastIntegerYuanEmittedRef.current += 1;
      const T = lastIntegerYuanEmittedRef.current;
      toAdd.push({
        id: `yen-${T}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        threshold: T,
        amount: displayEarned,
      });
      if (T >= 100) vibrateBig = true;
    }
    if (toAdd.length > 0) {
      setBubbles((prev) => [...prev, ...toAdd]);
      if (vibrateBig && Platform.OS !== 'web') {
        try {
          Vibration.vibrate(100);
        } catch {
          /* ignore */
        }
      }
    }
  }, [displayEarned, running, isPaid]);

  /** 带薪摸鱼：全屏心跳缩放（白摸关闭）；¥1+ 略快、¥10+ 幅度略大 */
  useEffect(() => {
    if (!running || !isPaidSession) {
      pulseAnimRef.current?.stop();
      pulseAnimRef.current = null;
      heartbeatScale.stopAnimation();
      heartbeatScale.setValue(1);
      return;
    }
    const beatMs = heartbeatTier >= 1 ? 800 : 1000;
    const minS = heartbeatTier >= 2 ? 0.975 : 0.98;
    const maxS = heartbeatTier >= 2 ? 1.025 : 1.02;
    pulseAnimRef.current?.stop();
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(heartbeatScale, {
          toValue: maxS,
          duration: beatMs / 2,
          useNativeDriver: true,
          easing: Easing.inOut(Easing.sin),
        }),
        Animated.timing(heartbeatScale, {
          toValue: minS,
          duration: beatMs / 2,
          useNativeDriver: true,
          easing: Easing.inOut(Easing.sin),
        }),
      ])
    );
    pulseAnimRef.current = loop;
    loop.start();
    return () => {
      loop.stop();
      pulseAnimRef.current = null;
      heartbeatScale.setValue(1);
    };
  }, [running, isPaidSession, heartbeatTier, heartbeatScale]);

  const swayTx = pawSway.interpolate({ inputRange: [-1, 1], outputRange: [-8, 8] });
  const swayRot = pawSway.interpolate({ inputRange: [-1, 1], outputRange: ['-6deg', '6deg'] });
  const tapRockRot = pawTapRock.interpolate({
    inputRange: [-1, 0, 1],
    outputRange: ['-16deg', '0deg', '16deg'],
  });

  const runPawTapRock = useCallback(() => {
    pawTapRock.stopAnimation();
    pawTapRock.setValue(0);
    Animated.sequence([
      Animated.timing(pawTapRock, {
        toValue: 1,
        duration: 52,
        useNativeDriver: true,
        easing: Easing.out(Easing.quad),
      }),
      Animated.timing(pawTapRock, {
        toValue: -0.88,
        duration: 62,
        useNativeDriver: true,
        easing: Easing.inOut(Easing.quad),
      }),
      Animated.timing(pawTapRock, {
        toValue: 0.5,
        duration: 50,
        useNativeDriver: true,
        easing: Easing.inOut(Easing.quad),
      }),
      Animated.timing(pawTapRock, {
        toValue: -0.25,
        duration: 44,
        useNativeDriver: true,
        easing: Easing.inOut(Easing.quad),
      }),
      Animated.timing(pawTapRock, {
        toValue: 0,
        duration: 56,
        useNativeDriver: true,
        easing: Easing.out(Easing.quad),
      }),
    ]).start();
  }, [pawTapRock]);

  useEffect(() => {
    if (!running || !isPaidSession) {
      pawSway.stopAnimation();
      pawSway.setValue(0);
      return;
    }
    const swayLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(pawSway, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true,
          easing: Easing.inOut(Easing.sin),
        }),
        Animated.timing(pawSway, {
          toValue: -1,
          duration: 500,
          useNativeDriver: true,
          easing: Easing.inOut(Easing.sin),
        }),
      ])
    );
    swayLoop.start();
    return () => {
      swayLoop.stop();
      pawSway.setValue(0);
    };
  }, [running, isPaidSession, pawSway]);

  useEffect(() => {
    if (!running) return;
    startMsRef.current = Date.now() - elapsedMs;
    intervalRef.current = setInterval(() => {
      setElapsedMs(Date.now() - startMsRef.current);
    }, 50);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [running]);

  useEffect(() => {
    if (!running) return;
    const animations = coinAnims.map((anim, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.timing(anim, {
            toValue: 1,
            duration: 2000 + i * 300,
            useNativeDriver: true,
            easing: Easing.inOut(Easing.ease),
          }),
          Animated.timing(anim, {
            toValue: 0,
            duration: 2000 + i * 300,
            useNativeDriver: true,
          }),
        ])
      )
    );
    animations.forEach((a) => a.start());
    return () => animations.forEach((a) => a.stop());
  }, [running, coinAnims]);

  const handlePawPressIn = () => {
    runPawTapRock();
    // 带薪摸鱼进行中：每次按下猫爪弹一小笔
    if (running && isPaid && salaryPerSecondRef.current > 0) {
      const micro = Math.max(0.001, salaryPerSecondRef.current * 0.15);
      const id = `tap-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      setTapPops((prev) => [...prev.slice(-5), { id, amount: micro }]);
    }
  };

  const handleStart = async () => {
    if (salaryPerSecond <= 0) {
      Alert.alert('请先配置', '在「设置」中填写时间与薪资后再摸～');
      return;
    }
    const time = await loadTimeConfig();
    const [marks, holOn, dates, niuma] = await Promise.all([
      loadLeaveMarks(),
      getHolidaySyncEnabled(),
      loadHolidayDates(),
      loadNiumaConfig(),
    ]);
    const rest = isRestDay(new Date(), holOn, holOn ? dates : [], marks, niuma);
    const p = time ? getCurrentPeriod(time) : 'working';
    const paid = p === 'working' && !rest;
    paidAtStartRef.current = paid;
    setIsPaidSession(paid);
    if (p === 'lunch' || p === 'after_work' || rest) toast.show('现在摸鱼白摸哦～');
    lastIntegerYuanEmittedRef.current = 0;
    setBubbles([]);
    setTapPops([]);
    setShowFrozenStats(false);
    setFrozenElapsedMs(0);
    setFrozenEarned(0);
    setRunning(true);
    setElapsedMs(0);
  };

  const handleEnd = async () => {
    if (!running) return;
    const endElapsed = elapsedMs;
    const wasPaid = paidAtStartRef.current;
    const earned = wasPaid ? earnedBySecond(endElapsed, salaryPerSecond) : 0;
    setFrozenElapsedMs(endElapsed);
    setFrozenEarned(earned);
    setFrozenWasPaid(wasPaid);
    setShowFrozenStats(true);
    pulseAnimRef.current?.stop();
    pulseAnimRef.current = null;
    heartbeatScale.stopAnimation();
    heartbeatScale.setValue(1);
    setRunning(false);
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    const durationSeconds = Math.floor(endElapsed / 1000);
    const type = moyuType;

    if (wasPaid && earned >= 0.01 && lastIntegerYuanEmittedRef.current === 0) {
      const t = tierForAmount(earned);
      setBubbles((prev) => [...prev, { id: `end-${Date.now()}`, threshold: t, amount: earned }]);
      if (t >= 100 && Platform.OS !== 'web') {
        try {
          Vibration.vibrate([0, 120, 60, 120]);
        } catch {
          /* ignore */
        }
      }
    }

    if (!wasPaid) {
      setResultLine1('本次摸鱼未计费');
      setResultLine2('纯放松~');
      setResultLine3('');
      setShowResult(true);
      return;
    }

    if (type == null) {
      pendingEndRef.current = { durationSeconds, earned };
      setShowPickTypeModal(true);
      return;
    }

    await addRecord({
      category: type,
      amount: earned,
      durationSeconds,
      label: MOYU_TYPE_LABELS[type],
      content: MOYU_TYPE_LABELS[type],
    });
    setResultLine1(`${MOYU_TYPE_LABELS[type]} · ${formatDuration(durationSeconds)}`);
    setResultLine2(`赚到 ${formatMoney(earned)}`);
    setResultLine3(pickCopy());
    setShowResult(true);
  };

  const handlePickType = async (pickedType: MoyuType | 'no_record') => {
    const pending = pendingEndRef.current;
    setShowPickTypeModal(false);
    pendingEndRef.current = null;
    if (!pending) return;

    const { durationSeconds, earned } = pending;

    if (pickedType === 'no_record') {
      setResultLine1('本次摸鱼未计费');
      setResultLine2('纯放松~');
      setResultLine3('');
      setShowResult(true);
      return;
    }

    await addRecord({
      category: pickedType,
      amount: earned,
      durationSeconds,
      label: MOYU_TYPE_LABELS[pickedType],
      content: MOYU_TYPE_LABELS[pickedType],
    });
    setResultLine1(`${MOYU_TYPE_LABELS[pickedType]} · ${formatDuration(durationSeconds)}`);
    setResultLine2(`赚到 ${formatMoney(earned)}`);
    setResultLine3(pickCopy());
    setShowResult(true);
  };

  const topInset = (Constants.statusBarHeight ?? (Platform.OS === 'ios' ? 44 : 24)) + 12;
  const pending = pendingEndRef.current;

  const heroIdle = !running && !showFrozenStats;
  const moneyDecimals = running && isPaidForHeroMoney ? 4 : 2;
  const moneyText = `￥${earnedDisplay.toFixed(moneyDecimals)}`;

  const discoActive = running && isPaidSession;

  return (
    <View style={styles.screenRoot}>
      <DiscoScreenEdges active={discoActive} />

      {/* 心跳缩放只带动「标题+状态卡+收益数字」；猫爪、类型 chips、底栏按钮均不跟缩放 */}
      <View style={styles.mainScrollWrap}>
        <ScrollView
          style={styles.container}
          contentContainerStyle={[styles.content, { paddingTop: topInset, paddingBottom: 20 }]}
          showsVerticalScrollIndicator={false}
          removeClippedSubviews={false}
        >
          <Animated.View style={[styles.pulseBlock, { transform: [{ scale: heartbeatScale }] }]}>
            {/* 1. 顶部状态提示卡 */}
            <View style={styles.statusCard}>
              {isPaid ? (
                <View style={styles.statusLine}>
                  <Ionicons name="checkmark-circle" size={20} color="#38A169" />
                  <Text style={styles.statusPaid}>当前摸鱼带薪，实时计算收益</Text>
                </View>
              ) : (
                <View style={styles.statusLine}>
                  <Ionicons name="close-circle-outline" size={20} color="#E53E3E" />
                  <Text style={styles.statusFree}>当前时段摸鱼白摸，不计任何金额</Text>
                </View>
              )}
            </View>
          </Animated.View>

          {/* 2. 猫爪 + 气泡（按钮不缩放） */}
          <View style={styles.pawSection}>
            <Pressable
              style={styles.pawWrap}
              onPressIn={handlePawPressIn}
              onPress={() => {
                if (!running) void handleStart();
              }}
            >
              <Animated.View
                style={{
                  transform: [{ translateX: swayTx }, { rotate: swayRot }],
                }}
              >
                <Animated.View style={[styles.pawContainer, { transform: [{ rotate: tapRockRot }] }]}>
                  <Image source={PAW_ICON} style={styles.pawImage} resizeMode="contain" />
                </Animated.View>
              </Animated.View>
              {running && (
                <View style={styles.coinFloats} pointerEvents="none">
                  {coinAnims.map((anim, i) => (
                    <Animated.Text
                      key={i}
                      style={[
                        styles.coinFloat,
                        i === 0 && styles.coinPos0,
                        i === 1 && styles.coinPos1,
                        i === 2 && styles.coinPos2,
                        i === 3 && styles.coinPos3,
                        {
                          opacity: anim.interpolate({ inputRange: [0, 1], outputRange: [0.2, 0.55] }),
                          transform: [
                            {
                              translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [0, -10] }),
                            },
                          ],
                        },
                      ]}
                    >
                      ￥
                    </Animated.Text>
                  ))}
                </View>
              )}
            </Pressable>

            {/* 紧挨猫爪之上绘制，zIndex/elevation 拉高，避免被爪图挡住 */}
            <View style={styles.bubbleHost} pointerEvents="none">
              {bubbles.map((b) => (
                <EarnBubble
                  key={b.id}
                  item={b}
                  swayTx={swayTx}
                  onDone={() => removeBubble(b.id)}
                />
              ))}
              {tapPops.map((p) => (
                <TapMoneyPop
                  key={p.id}
                  amount={p.amount}
                  swayTx={swayTx}
                  onDone={() => removeTapPop(p.id)}
                />
              ))}
            </View>

            {/* 仅心跳缩放，不与猫爪同左右摇 */}
            <Animated.View
              style={[styles.heroPulseWrap, { transform: [{ scale: heartbeatScale }] }]}
              pointerEvents="none"
            >
              <View style={styles.heroStats}>
                <Text allowFontScaling={false} style={[styles.heroTimer, heroIdle && styles.heroMuted]}>
                  {formatDurationHHMMSSWithMs(elapsedDisplayMs)}
                </Text>
                <Text
                  allowFontScaling={false}
                  style={[
                    styles.heroMoney,
                    (heroIdle || !isPaidForHeroMoney) && styles.heroMoneyMuted,
                  ]}
                >
                  {moneyText}
                </Text>
                {!isPaidForHeroMoney && (running || showFrozenStats) ? (
                  <Text allowFontScaling={false} style={styles.heroWhiteHint}>
                    白摸不计费
                  </Text>
                ) : null}
              </View>
            </Animated.View>
          </View>

          {/* 3. 摸鱼类型选择区（不按钮跟心跳） */}
          <View style={styles.typeGrid}>
            {MOYU_TYPES.map((t) => (
              <Pressable
                key={t}
                style={[styles.chip, moyuType === t && styles.chipSelected]}
                onPress={() => setMoyuType(t)}
              >
                <Text style={[styles.chipText, moyuType === t && styles.chipTextSelected]}>
                  {MOYU_TYPE_LABELS[t]}
                </Text>
              </Pressable>
            ))}
          </View>
        </ScrollView>
      </View>

      {/* 摸完了未选类型：弹窗选类型或白摸不记 */}
      <Modal visible={showPickTypeModal} transparent animationType="fade">
        <Pressable
          style={styles.pickModalOverlay}
          onPress={() => {
            setShowPickTypeModal(false);
            pendingEndRef.current = null;
          }}
        >
          <Pressable style={styles.pickModalCard} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.pickModalTitle}>摸完了，记一笔？</Text>
            {pending && (
              <Text style={styles.pickModalSub}>
                {formatDuration(pending.durationSeconds)} · {formatMoney(pending.earned)}
              </Text>
            )}
            <View style={styles.pickTypeGrid}>
              {MOYU_TYPES.map((t) => (
                <Pressable
                  key={t}
                  style={styles.pickChip}
                  onPress={() => handlePickType(t)}
                >
                  <Text style={styles.pickChipText}>{MOYU_TYPE_LABELS[t]}</Text>
                </Pressable>
              ))}
            </View>
            <Pressable
              style={styles.pickNoRecordBtn}
              onPress={() => handlePickType('no_record')}
            >
              <Text style={styles.pickNoRecordText}>白摸不记</Text>
            </Pressable>
            <Pressable
              style={styles.pickCancelBtn}
              onPress={() => {
                setShowPickTypeModal(false);
                pendingEndRef.current = null;
              }}
            >
              <Text style={styles.pickCancelText}>取消</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      <ResultModal
        visible={showResult}
        line1={resultLine1}
        line2={resultLine2}
        line3={resultLine3}
        onClose={() => {
          setShowResult(false);
          setResultLine1('');
          setResultLine2('');
          setResultLine3('');
        }}
        shareMessage={
          resultLine3
            ? `${resultLine1}\n${resultLine2}\n${resultLine3}`
            : `${resultLine1}\n${resultLine2}`
        }
      />

      {/* 底栏固定：不参与心跳缩放，带薪时仍可见边缘蹦迪光 */}
      <View style={[styles.bottomDock, { paddingBottom: Math.max(insets.bottom, 12) }]}>
        <Pressable style={styles.mainBtn} onPress={running ? handleEnd : handleStart}>
          <Text style={styles.mainBtnText}>{running ? '摸够了' : '开始摸鱼'}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screenRoot: { flex: 1, backgroundColor: MOYU_UI.bg },
  mainScrollWrap: {
    flex: 1,
    minHeight: 0,
    backgroundColor: 'transparent',
    zIndex: 2,
    elevation: 4,
  },
  pulseBlock: { alignSelf: 'stretch', alignItems: 'center', width: '100%' },
  heroPulseWrap: {
    alignSelf: 'stretch',
    alignItems: 'center',
    width: '100%',
    zIndex: 20,
    elevation: 0,
  },
  container: { flex: 1, backgroundColor: 'transparent' },
  content: { padding: 16, alignItems: 'center' },
  bottomDock: {
    paddingHorizontal: 16,
    paddingTop: 12,
    backgroundColor: MOYU_UI.bg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: MOYU_UI.border,
    zIndex: 20,
  },
  statusCard: {
    backgroundColor: MOYU_UI.cardBg,
    borderRadius: MOYU_UI.radius,
    padding: 16,
    alignSelf: 'stretch',
    alignItems: 'center',
    marginBottom: 24,
  },
  statusLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    alignSelf: 'stretch',
    justifyContent: 'center',
  },
  statusPaid: { fontSize: 14, color: MOYU_UI.primary, fontWeight: '600', flexShrink: 1 },
  statusFree: { fontSize: 14, color: MOYU_UI.danger, fontWeight: '700', flexShrink: 1 },
  pawSection: {
    width: '100%',
    alignItems: 'center',
    minHeight: 360,
    position: 'relative',
    marginBottom: 8,
    overflow: 'visible',
  },
  heroStats: {
    alignItems: 'center',
    justifyContent: 'flex-start',
    marginTop: -4,
    marginBottom: 12,
    paddingHorizontal: 8,
    zIndex: 6,
    width: '100%',
  },
  heroTimer: {
    fontSize: 32,
    fontWeight: '800',
    color: MOYU_UI.primary,
    fontVariant: ['tabular-nums'],
    letterSpacing: 0.5,
    includeFontPadding: false,
    textAlign: 'center',
  },
  heroMoney: {
    marginTop: 6,
    fontSize: 40,
    fontWeight: '900',
    color: MOYU_UI.primary,
    fontVariant: ['tabular-nums'],
    letterSpacing: 0,
    includeFontPadding: false,
    textAlign: 'center',
    textShadowColor: MOYU_UI.primary,
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 1,
  },
  heroMuted: {
    color: MOYU_UI.textSecondary,
    textShadowColor: 'transparent',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 0,
  },
  heroMoneyMuted: {
    color: MOYU_UI.textSecondary,
    textShadowColor: 'transparent',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 0,
  },
  heroWhiteHint: {
    marginTop: 6,
    fontSize: 14,
    fontWeight: '600',
    color: MOYU_UI.textSecondary,
    textAlign: 'center',
  },
  bubbleHost: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingTop: 0,
    overflow: 'visible',
    zIndex: 2000,
    elevation: 28,
  },
  pawWrap: {
    width: 160,
    height: 160,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    zIndex: 10,
    elevation: 2,
    overflow: 'visible',
  },
  pawContainer: {
    width: 140,
    height: 140,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pawImage: { width: 120, height: 120 },
  coinFloats: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  coinFloat: {
    position: 'absolute',
    fontSize: 16,
    color: MOYU_UI.primary,
    fontWeight: '700',
  },
  /** 与 coinFloat 同系：盖在猫爪上时加浅描边便于辨认 */
  milestoneYenFloat: {
    color: MOYU_UI.primary,
    fontWeight: '800',
    textAlign: 'center',
    includeFontPadding: false,
    textShadowColor: 'rgba(255,255,255,0.95)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 3,
  },
  coinPos0: { top: 8, left: 20 },
  coinPos1: { top: 20, right: 8 },
  coinPos2: { bottom: 20, left: 20 },
  coinPos3: { top: 20, left: 8 },
  typeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 10,
    marginBottom: 24,
    paddingHorizontal: 8,
  },
  chip: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: MOYU_UI.radiusChip,
    backgroundColor: MOYU_UI.bg,
    borderWidth: 1,
    borderColor: MOYU_UI.border,
    minWidth: '45%',
    alignItems: 'center',
  },
  chipSelected: {
    backgroundColor: MOYU_UI.primary,
    borderColor: MOYU_UI.primary,
  },
  chipText: { fontSize: 14, color: MOYU_UI.text },
  chipTextSelected: { fontSize: 14, color: '#fff', fontWeight: '600' },
  mainBtn: {
    backgroundColor: MOYU_UI.primary,
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: MOYU_UI.radius,
    alignSelf: 'stretch',
    alignItems: 'center',
  },
  mainBtnText: { fontSize: 16, fontWeight: '700', color: '#fff' },
  bottomHint: { fontSize: 12, color: MOYU_UI.textSecondary, marginTop: 12 },
  pickModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  pickModalCard: {
    backgroundColor: MOYU_UI.bg,
    borderRadius: MOYU_UI.radius,
    padding: 20,
    minWidth: 280,
    maxWidth: 340,
  },
  pickModalTitle: { fontSize: 18, fontWeight: '700', color: MOYU_UI.text, marginBottom: 4, textAlign: 'center' },
  pickModalSub: { fontSize: 14, color: MOYU_UI.primary, marginBottom: 16, textAlign: 'center' },
  pickTypeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 16 },
  pickChip: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: MOYU_UI.radiusChip,
    backgroundColor: MOYU_UI.primary,
    minWidth: '47%',
    alignItems: 'center',
  },
  pickChipText: { fontSize: 14, color: '#fff', fontWeight: '600' },
  pickNoRecordBtn: {
    paddingVertical: 12,
    borderRadius: MOYU_UI.radiusChip,
    borderWidth: 1,
    borderColor: MOYU_UI.border,
    alignItems: 'center',
    marginBottom: 8,
  },
  pickNoRecordText: { fontSize: 14, color: MOYU_UI.textSecondary },
  pickCancelBtn: { paddingVertical: 8, alignItems: 'center' },
  pickCancelText: { fontSize: 14, color: MOYU_UI.textSecondary },
});
