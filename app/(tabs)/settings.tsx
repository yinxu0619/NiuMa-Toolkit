import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ScrollView,
  Alert,
  Switch,
  Linking,
  Platform,
  RefreshControl,
  Modal,
} from 'react-native';
import Constants from 'expo-constants';
import { useFocusEffect } from '@react-navigation/native';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Ionicons } from '@expo/vector-icons';
import {
  loadSalaryConfig,
  saveSalaryConfig,
  clearAllData,
  loadRecords,
  loadTimeConfig,
  saveTimeConfig,
  loadVacationConfig,
  saveVacationConfig,
  loadPersonalConfig,
  savePersonalConfig,
  loadNiumaConfig,
  saveNiumaConfig,
  saveHolidayDates,
  setHolidayLastSyncAt,
  setHolidaySyncEnabled,
} from '@/lib/storage';
import { fetchHolidayDatesWithFallback } from '@/lib/holidays';
import { hourlyWageFromTime } from '@/lib/salary';
import { effectiveHoursPerDay } from '@/lib/workTime';
import { useSalary } from '@/contexts/SalaryContext';
import { useToast } from '@/contexts/ToastContext';
import { DEFAULT_WORK_DAYS } from '@/constants/theme';
import { formatMoney, formatHoursToChinese } from '@/lib/format';
import { mondayOfWeek } from '@/lib/niumaSchedule';
import { formatLocalDateKey } from '@/lib/today';
import type { NiumaScheduleMode } from '@/types';
import { pickNuclearNiumaEnable } from '@/constants/copy';

const SETTINGS_UI = {
  bg: '#FFFFFF',
  primary: '#FF7A00',
  cardBg: '#FFFFFF',
  topCardBg: '#FFF9E6',
  border: '#E5E5E5',
  borderFocus: '#FF7A00',
  text: '#333333',
  textSecondary: '#999999',
  radius: 12,
  radiusInput: 8,
  padding: 16,
  gap: 12,
} as const;

const NIUMA_MODE_ROWS: { mode: NiumaScheduleMode; title: string; subtitle: string }[] = [
  { mode: '996_sat', title: '996 · 周六上班', subtitle: '周一～周六，周日休' },
  { mode: '996_sun', title: '996 · 周日上班', subtitle: '周一～周五 + 周日，周六休' },
  { mode: 'alternate_weeks', title: '大小周', subtitle: '大周周六上班，小周双休' },
  { mode: 'all_week', title: '007 · 一周七天', subtitle: '无休（法定假日仍按同步表）' },
];

export default function SettingsScreen() {
  const { config, refresh, setConfig } = useSalary();
  const toast = useToast();

  const [refreshing, setRefreshing] = useState(false);
  const [workStart, setWorkStart] = useState('09:00');
  const [workEnd, setWorkEnd] = useState('18:00');
  const [lunchStart, setLunchStart] = useState('12:00');
  const [lunchEnd, setLunchEnd] = useState('13:00');
  const [lunchEnabled, setLunchEnabled] = useState(true);
  const [monthlySalary, setMonthlySalary] = useState('');
  const [workDays, setWorkDays] = useState('');
  const [annualTotal, setAnnualTotal] = useState('');
  const [sickTotal, setSickTotal] = useState('');
  const [unpaidTotal, setUnpaidTotal] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [holidaySyncing, setHolidaySyncing] = useState(false);
  const [showAboutModal, setShowAboutModal] = useState(false);
  const [focusedField, setFocusedField] = useState<string | null>(null);
  const [niumaEnabled, setNiumaEnabled] = useState(false);
  const [niumaMode, setNiumaMode] = useState<NiumaScheduleMode>('996_sat');
  const [niumaAlternateMonday, setNiumaAlternateMonday] = useState<string | null>(null);
  /** 避免首屏尚未 load 完就用空生日写库 */
  const personalHydratedRef = useRef(false);

  const loadAll = useCallback(async () => {
    const [t, c, v, p, niuma] = await Promise.all([
      loadTimeConfig(),
      loadSalaryConfig(),
      loadVacationConfig(),
      loadPersonalConfig(),
      loadNiumaConfig(),
    ]);
    setWorkStart(t.workStart);
    setWorkEnd(t.workEnd);
    setLunchStart(t.lunchStart);
    setLunchEnd(t.lunchEnd);
    setLunchEnabled(t.lunchEnabled !== false);
    setMonthlySalary(c.monthly_salary ? String(c.monthly_salary) : '');
    setWorkDays(c.work_days ? String(c.work_days) : '');
    setAnnualTotal(String(v.annualLeaveTotal ?? 0));
    setSickTotal(String(v.sickLeaveTotal ?? 0));
    setUnpaidTotal(String(v.unpaidLeaveTotal ?? 0));
    setBirthDate(p?.birthDate ?? '');
    personalHydratedRef.current = true;
    setNiumaEnabled(niuma.enabled);
    setNiumaMode(niuma.mode);
    setNiumaAlternateMonday(niuma.alternateBigWeekMonday ?? null);
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadAll();
    }, [loadAll])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadAll();
    await refresh();
    setRefreshing(false);
  }, [loadAll, refresh]);

  // ---------- 时间配置：失焦即存 ----------
  const saveTime = useCallback(async () => {
    await saveTimeConfig({
      workStart: workStart || '09:00',
      workEnd: workEnd || '18:00',
      lunchStart: lunchStart || '12:00',
      lunchEnd: lunchEnd || '13:00',
      lunchEnabled,
    });
    await refresh();
  }, [workStart, workEnd, lunchStart, lunchEnd, lunchEnabled, refresh]);

  // ---------- 薪资配置：失焦即存 ----------
  const saveSalary = useCallback(async () => {
    const salary = parseFloat(monthlySalary) || 0;
    const days = parseFloat(workDays) || DEFAULT_WORK_DAYS;
    if (salary <= 0) return;
    const time = {
      workStart: workStart || '09:00',
      workEnd: workEnd || '18:00',
      lunchStart: lunchStart || '12:00',
      lunchEnd: lunchEnd || '13:00',
      lunchEnabled,
    };
    const eff = effectiveHoursPerDay(time);
    const next = {
      monthly_salary: salary,
      work_days: days,
      work_hours: eff || 8,
      effective_hours_per_day: eff || undefined,
    };
    await saveSalaryConfig(next);
    setConfig(next);
    await refresh();
  }, [monthlySalary, workDays, workStart, workEnd, lunchStart, lunchEnd, lunchEnabled, setConfig, refresh]);

  // ---------- 假期配置：失焦即存 ----------
  const saveVacation = useCallback(async () => {
    const v = await loadVacationConfig();
    await saveVacationConfig({
      ...v,
      annualLeaveTotal: parseInt(annualTotal, 10) || 0,
      sickLeaveTotal: parseInt(sickTotal, 10) || 0,
      unpaidLeaveTotal: parseInt(unpaidTotal, 10) || 0,
    });
  }, [annualTotal, sickTotal, unpaidTotal]);

  // ---------- 个人信息：失焦即存 ----------
  const savePersonal = useCallback(async () => {
    if (!birthDate.trim()) {
      await savePersonalConfig(null);
      return;
    }
    await savePersonalConfig({ birthDate: birthDate.trim(), retireAge: 60 });
  }, [birthDate]);

  /** 生日一改就落库（防抖），FIRE 等页回到前台或聚焦时能读到最新值 */
  useEffect(() => {
    if (!personalHydratedRef.current) return;
    const t = setTimeout(() => {
      savePersonal();
    }, 450);
    return () => clearTimeout(t);
  }, [birthDate, savePersonal]);

  const persistNiuma = useCallback(
    async (next: { enabled: boolean; mode: NiumaScheduleMode; alternateBigWeekMonday: string | null }) => {
      await saveNiumaConfig({
        enabled: next.enabled,
        mode: next.mode,
        alternateBigWeekMonday: next.mode === 'alternate_weeks' ? next.alternateBigWeekMonday : null,
      });
    },
    []
  );

  const onNiumaToggle = useCallback(
    async (enabled: boolean) => {
      if (enabled) {
        const { title, message } = pickNuclearNiumaEnable();
        Alert.alert(title, message);
        let m = niumaMode;
        let alt = niumaAlternateMonday;
        if (m === 'standard') m = '996_sat';
        if (m === 'alternate_weeks' && !alt) {
          alt = formatLocalDateKey(mondayOfWeek(new Date()));
          setNiumaAlternateMonday(alt);
        }
        setNiumaEnabled(true);
        setNiumaMode(m);
        await persistNiuma({ enabled: true, mode: m, alternateBigWeekMonday: alt });
      } else {
        setNiumaEnabled(false);
        await persistNiuma({ enabled: false, mode: niumaMode, alternateBigWeekMonday: niumaAlternateMonday });
      }
    },
    [niumaMode, niumaAlternateMonday, persistNiuma]
  );

  const onSelectNiumaMode = useCallback(
    async (mode: NiumaScheduleMode) => {
      let alt: string | null = niumaAlternateMonday;
      if (mode === 'alternate_weeks' && !alt) {
        alt = formatLocalDateKey(mondayOfWeek(new Date()));
      }
      if (mode !== 'alternate_weeks') alt = null;
      setNiumaMode(mode);
      setNiumaAlternateMonday(alt);
      if (niumaEnabled) {
        await persistNiuma({ enabled: true, mode, alternateBigWeekMonday: alt });
      }
    },
    [niumaEnabled, niumaAlternateMonday, persistNiuma]
  );

  const onMarkBigWeek = useCallback(async () => {
    const m = mondayOfWeek(new Date());
    const key = formatLocalDateKey(m);
    setNiumaAlternateMonday(key);
    if (niumaEnabled) await persistNiuma({ enabled: true, mode: 'alternate_weeks', alternateBigWeekMonday: key });
  }, [niumaEnabled, persistNiuma]);

  const onMarkSmallWeek = useCallback(async () => {
    const m = mondayOfWeek(new Date());
    m.setDate(m.getDate() - 7);
    const key = formatLocalDateKey(m);
    setNiumaAlternateMonday(key);
    if (niumaEnabled) await persistNiuma({ enabled: true, mode: 'alternate_weeks', alternateBigWeekMonday: key });
  }, [niumaEnabled, persistNiuma]);

  // ---------- 同步节假日 ----------
  const handleHolidaySync = useCallback(async () => {
    if (holidaySyncing) return;
    setHolidaySyncing(true);
    try {
      const { dates, fromRemote } = await fetchHolidayDatesWithFallback();
      await saveHolidayDates(dates);
      const nowIso = new Date().toISOString();
      await setHolidayLastSyncAt(nowIso);
      await setHolidaySyncEnabled(true);
      if (fromRemote) {
        toast.show(`节假日同步成功，共 ${dates.length} 个休息日`);
      } else {
        toast.show('同步失败，已切换为本地假日数据');
      }
    } catch {
      toast.show('同步失败，已切换为本地假日数据');
    } finally {
      setHolidaySyncing(false);
    }
  }, [holidaySyncing, toast]);

  // ---------- 清空所有数据 ----------
  const handleClearAll = useCallback(() => {
    Alert.alert(
      '确定清空所有数据？',
      '此操作不可恢复。将删除：所有记录、房贷、生日、年假/病假、通勤、充电配置、加班状态、FIRE 社保配置、牛马排班等。',
      [
        { text: '取消', style: 'cancel' },
        {
          text: '确定清空',
          style: 'destructive',
          onPress: async () => {
            await clearAllData();
            await refresh();
            toast.show('已清空');
          },
        },
      ]
    );
  }, [refresh, toast]);

  // ---------- 导出 ----------
  const handleExport = useCallback(async () => {
    const records = await loadRecords();
    const header = '分类,金额,描述,时长(秒),时间\n';
    const rows = records
      .map(
        (r) =>
          `${r.category},${r.amount.toFixed(2)},${r.label || ''},${r.durationSeconds ?? ''},${r.createdAt}`
      )
      .join('\n');
    const csv = '\uFEFF' + header + rows;
    const dir = FileSystem.cacheDirectory;
    const path = `${dir}niuma_export_${Date.now()}.csv`;
    await FileSystem.writeAsStringAsync(path, csv, {
      encoding: FileSystem.EncodingType.UTF8,
    });
    const canShare = await Sharing.isAvailableAsync();
    if (canShare) {
      await Sharing.shareAsync(path, { mimeType: 'text/csv', dialogTitle: '导出记录' });
    } else {
      toast.show('导出完成，请从缓存目录查找文件');
    }
  }, [toast]);

  const timeForPreview = { workStart, workEnd, lunchStart, lunchEnd, lunchEnabled };
  const salaryForPreview = {
    monthly_salary: parseFloat(monthlySalary) || 0,
    work_days: parseFloat(workDays) || DEFAULT_WORK_DAYS,
  };
  const effHours = effectiveHoursPerDay(timeForPreview);
  const hourly =
    salaryForPreview.monthly_salary > 0 && effHours > 0
      ? hourlyWageFromTime(salaryForPreview, timeForPreview)
      : 0;
  const secondWage = hourly / 3600;

  const topInset = (Constants.statusBarHeight ?? (Platform.OS === 'ios' ? 44 : 24)) + 12;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.content, { paddingTop: topInset }]}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={SETTINGS_UI.primary} />
      }
    >
      {/* 1. 时间配置 */}
      <View style={[styles.card, styles.cardHighlight]}>
        <Text style={styles.groupTitle}>时间配置</Text>
        <Text style={styles.hint}>设置上下班、午休，自动计算有效工时</Text>
        <View style={styles.timeRow}>
          <Text style={styles.timeLabel}>上班时间</Text>
          <TextInput
            style={[styles.input, focusedField === 'workStart' && styles.inputFocused]}
            value={workStart}
            onChangeText={setWorkStart}
            onFocus={() => setFocusedField('workStart')}
            onBlur={() => { setFocusedField(null); saveTime(); }}
            placeholder="09:00"
            placeholderTextColor={SETTINGS_UI.textSecondary}
          />
        </View>
        <View style={styles.timeRow}>
          <Text style={styles.timeLabel}>下班时间</Text>
          <TextInput
            style={[styles.input, focusedField === 'workEnd' && styles.inputFocused]}
            value={workEnd}
            onChangeText={setWorkEnd}
            onFocus={() => setFocusedField('workEnd')}
            onBlur={() => { setFocusedField(null); saveTime(); }}
            placeholder="18:00"
            placeholderTextColor={SETTINGS_UI.textSecondary}
          />
        </View>
        <View style={styles.timeRow}>
          <Text style={styles.timeLabel}>午休开始</Text>
          <TextInput
            style={[styles.input, focusedField === 'lunchStart' && styles.inputFocused]}
            value={lunchStart}
            onChangeText={setLunchStart}
            onFocus={() => setFocusedField('lunchStart')}
            onBlur={() => { setFocusedField(null); saveTime(); }}
            placeholder="12:00"
            placeholderTextColor={SETTINGS_UI.textSecondary}
          />
        </View>
        <View style={styles.timeRow}>
          <Text style={styles.timeLabel}>午休结束</Text>
          <TextInput
            style={[styles.input, focusedField === 'lunchEnd' && styles.inputFocused]}
            value={lunchEnd}
            onChangeText={setLunchEnd}
            onFocus={() => setFocusedField('lunchEnd')}
            onBlur={() => { setFocusedField(null); saveTime(); }}
            placeholder="13:00"
            placeholderTextColor={SETTINGS_UI.textSecondary}
          />
        </View>
        <View style={styles.switchRow}>
          <Text style={styles.switchLabel}>午休</Text>
          <Switch
            value={lunchEnabled}
            onValueChange={async (v) => {
              setLunchEnabled(v);
              // 必须带 v 写入，勿用 saveTime()：state 未更新时闭包里的 lunchEnabled 仍是旧值，会导致关不掉午休
              await saveTimeConfig({
                workStart: workStart || '09:00',
                workEnd: workEnd || '18:00',
                lunchStart: lunchStart || '12:00',
                lunchEnd: lunchEnd || '13:00',
                lunchEnabled: v,
              });
              await refresh();
            }}
            trackColor={{ false: SETTINGS_UI.border, true: SETTINGS_UI.primary }}
            thumbColor="#fff"
          />
        </View>
        <Text style={styles.footHint}>有效工时 = 下班 - 上班 - 午休时长，用于计算时薪</Text>
      </View>

      {/* 2. 薪资配置 */}
      <View style={styles.card}>
        <Text style={styles.groupTitle}>薪资配置</Text>
        <Text style={styles.hint}>计算时薪、秒薪，全 APP 统一</Text>
        <Text style={styles.label}>月薪（元）</Text>
        <TextInput
          style={[styles.input, focusedField === 'monthlySalary' && styles.inputFocused]}
          value={monthlySalary}
          onChangeText={setMonthlySalary}
          onFocus={() => setFocusedField('monthlySalary')}
          onBlur={() => { setFocusedField(null); saveSalary(); }}
          keyboardType="decimal-pad"
          placeholder="月薪"
          placeholderTextColor={SETTINGS_UI.textSecondary}
        />
        <Text style={styles.label}>月计薪天数</Text>
        <TextInput
          style={[styles.input, focusedField === 'workDays' && styles.inputFocused]}
          value={workDays}
          onChangeText={setWorkDays}
          onFocus={() => setFocusedField('workDays')}
          onBlur={() => { setFocusedField(null); saveSalary(); }}
          keyboardType="decimal-pad"
          placeholder="默认 21.75"
          placeholderTextColor={SETTINGS_UI.textSecondary}
        />
        {effHours > 0 && (
          <View style={styles.previewBlock}>
            <Text style={styles.previewLabel}>每日有效工时</Text>
            <Text style={styles.previewValue}>{formatHoursToChinese(effHours)}</Text>
            <Text style={styles.previewLabel}>时薪</Text>
            <Text style={styles.previewValue}>{formatMoney(hourly)}</Text>
            <Text style={styles.previewLabel}>秒薪</Text>
            <Text style={styles.previewValue}>¥{secondWage.toFixed(4)}</Text>
          </View>
        )}
      </View>

      {/* 3. 假期配置 */}
      <View style={styles.card}>
        <Text style={styles.groupTitle}>假期配置</Text>
        <Text style={styles.hint}>年假、病假剩余天数统计</Text>
        <Text style={styles.label}>总年假天数</Text>
        <TextInput
          style={[styles.input, focusedField === 'annualTotal' && styles.inputFocused]}
          value={annualTotal}
          onChangeText={setAnnualTotal}
          onFocus={() => setFocusedField('annualTotal')}
          onBlur={() => { setFocusedField(null); saveVacation(); }}
          keyboardType="number-pad"
          placeholder="天"
          placeholderTextColor={SETTINGS_UI.textSecondary}
        />
        <Text style={styles.label}>总病假天数</Text>
        <TextInput
          style={[styles.input, focusedField === 'sickTotal' && styles.inputFocused]}
          value={sickTotal}
          onChangeText={setSickTotal}
          onFocus={() => setFocusedField('sickTotal')}
          onBlur={() => { setFocusedField(null); saveVacation(); }}
          keyboardType="number-pad"
          placeholder="天"
          placeholderTextColor={SETTINGS_UI.textSecondary}
        />
        <Text style={styles.footHint}>剩余天数 = 总天数 - 已使用。补记/改日期请到「假期」页或日历长按。</Text>
      </View>

      {/* 4. 个人信息 */}
      <View style={styles.card}>
        <Text style={styles.groupTitle}>个人信息</Text>
        <Text style={styles.hint}>生日 → 计算退休倒计时</Text>
        <Text style={styles.label}>出生日期</Text>
        <TextInput
          style={[styles.input, focusedField === 'birthDate' && styles.inputFocused]}
          value={birthDate}
          onChangeText={setBirthDate}
          onFocus={() => setFocusedField('birthDate')}
          onBlur={() => { setFocusedField(null); savePersonal(); }}
          placeholder="YYYY-MM-DD"
          placeholderTextColor={SETTINGS_UI.textSecondary}
        />
        <Text style={styles.footHint}>用于计算退休倒计时（默认60岁，你说65？你现在还干得动么？）</Text>
      </View>

      {/* 5. 996 / 007 牛马排班 */}
      <View style={{ ...styles.card, backgroundColor: SETTINGS_UI.topCardBg, borderColor: 'transparent' }}>
        <Text style={styles.groupTitle}>996 / 007 牛马排班</Text>
        <Text style={styles.hint}>
          关闭时按标准双休（周一～周五上班）。开启后「今日」休息/上班、下一工作日倒计时跟排班走。
        </Text>
        <View style={styles.switchRow}>
          <View style={{ flex: 1, paddingRight: 8 }}>
            <Text style={styles.switchLabel}>核动力牛马模式</Text>
            <Text style={styles.niumaSubHint}>卷王请选对档位</Text>
          </View>
          <Switch
            value={niumaEnabled}
            onValueChange={onNiumaToggle}
            trackColor={{ false: SETTINGS_UI.border, true: SETTINGS_UI.primary }}
            thumbColor="#fff"
          />
        </View>
        {niumaEnabled ? (
          <>
            <Text style={[styles.label, { marginTop: 12 }]}>排班方式</Text>
            {NIUMA_MODE_ROWS.map((row) => {
              const active = niumaMode === row.mode;
              return (
                <Pressable
                  key={row.mode}
                  style={[styles.niumaModeRow, active && styles.niumaModeRowActive]}
                  onPress={() => onSelectNiumaMode(row.mode)}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.niumaModeTitle, active && styles.niumaModeTitleActive]}>{row.title}</Text>
                    <Text style={styles.niumaModeSub}>{row.subtitle}</Text>
                  </View>
                  {active ? (
                    <Ionicons name="checkmark-circle" size={22} color={SETTINGS_UI.primary} />
                  ) : (
                    <Ionicons name="ellipse-outline" size={22} color={SETTINGS_UI.border} />
                  )}
                </Pressable>
              );
            })}
            {niumaMode === 'alternate_weeks' ? (
              <View style={styles.niumaAlternateBlock}>
                <Text style={styles.footHint}>
                  与「大周」周一相差偶数周 → 大周（周六上班）；奇数周 → 小周。不对时点下面校准：
                </Text>
                <View style={styles.niumaCalRow}>
                  <Pressable style={styles.niumaCalBtn} onPress={onMarkBigWeek}>
                    <Text style={styles.niumaCalBtnText}>本周大周</Text>
                  </Pressable>
                  <Pressable style={styles.niumaCalBtn} onPress={onMarkSmallWeek}>
                    <Text style={styles.niumaCalBtnText}>本周小周</Text>
                  </Pressable>
                </View>
                {niumaAlternateMonday ? (
                  <Text style={styles.niumaAnchorHint}>锚点：{niumaAlternateMonday}（大周周一）</Text>
                ) : null}
              </View>
            ) : null}
          </>
        ) : (
          <Text style={styles.footHint}>关掉就是普通双休，周末不碰瓷日薪～</Text>
        )}
      </View>

      {/* 6. 外观与假日 */}
      <View style={styles.card}>
        <Text style={styles.groupTitle}>假日</Text>
        <Pressable
          style={styles.primaryBtn}
          onPress={handleHolidaySync}
          disabled={holidaySyncing}
        >
          <Text style={styles.primaryBtnText}>
            {holidaySyncing ? '同步中…' : '同步节假日（含调休）'}
          </Text>
        </Pressable>
        <Text style={styles.footHint}>
          同步一把，要不谁知道假日办的老爷们怎么想啊 (
        </Text>
      </View>

      {/* 7. 数据与关于 */}
      <View style={styles.card}>
        <Text style={styles.groupTitle}>数据与关于</Text>
        <Pressable style={styles.row} onPress={handleExport}>
          <Text style={styles.rowText}>导出所有数据（csv/文本）</Text>
          <Ionicons name="chevron-forward" size={20} color={SETTINGS_UI.textSecondary} />
        </Pressable>
        <Pressable style={styles.row} onPress={handleClearAll}>
          <Text style={[styles.rowText, styles.rowDanger]}>清空所有记录</Text>
          <Ionicons name="chevron-forward" size={20} color={SETTINGS_UI.textSecondary} />
        </Pressable>
        <Pressable style={styles.row} onPress={() => setShowAboutModal(true)}>
          <Text style={styles.rowText}>关于牛马工具箱</Text>
          <Ionicons name="chevron-forward" size={20} color={SETTINGS_UI.textSecondary} />
        </Pressable>
        <Pressable
          style={styles.row}
          onPress={() => Linking.openURL('https://github.com/yinxu0619/NiuMa-Toolkit')}
        >
          <Text style={styles.rowText}>GitHub 主页</Text>
          <Ionicons name="chevron-forward" size={20} color={SETTINGS_UI.textSecondary} />
        </Pressable>
      </View>

      <View style={styles.footer}>
        <Text style={styles.footerText}>轻量无广告 · 本地存储 · 开源免费</Text>
        <Text style={styles.footerText}>打工人不为难打工人</Text>
      </View>

      <Modal visible={showAboutModal} transparent animationType="fade">
        <Pressable style={styles.modalOverlay} onPress={() => setShowAboutModal(false)}>
          <Pressable style={styles.modalCard} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.modalTitle}>牛马工具箱</Text>
            <Text style={styles.modalBody}>
              摸鱼、收支、计时数据仅保存在自己手机里，不联网，毕竟你也不想摸鱼被你老板发现吧
            </Text>
            <Text style={styles.modalBody}>
              拒绝内卷，快乐打工。摸鱼无罪，长命百岁！为爱发电请前往 GitHub
            </Text>
            <Pressable
              style={styles.modalBtn}
              onPress={() => {
                setShowAboutModal(false);
                Linking.openURL('https://github.com/yinxu0619/NiuMa-Toolkit');
              }}
            >
              <Text style={styles.modalBtnText}>GitHub: yinxu0619/NiuMa-Toolkit</Text>
            </Pressable>
            <Pressable style={styles.modalClose} onPress={() => setShowAboutModal(false)}>
              <Text style={styles.modalCloseText}>关闭</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: SETTINGS_UI.bg },
  content: { padding: SETTINGS_UI.padding, paddingBottom: 48 },
  card: {
    backgroundColor: SETTINGS_UI.cardBg,
    borderRadius: SETTINGS_UI.radius,
    padding: SETTINGS_UI.padding,
    marginBottom: SETTINGS_UI.gap,
    borderWidth: 1,
    borderColor: SETTINGS_UI.border,
  },
  cardHighlight: {
    backgroundColor: SETTINGS_UI.topCardBg,
    borderColor: 'transparent',
  },
  groupTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: SETTINGS_UI.text,
    marginBottom: 4,
  },
  hint: { fontSize: 12, color: SETTINGS_UI.textSecondary, marginBottom: 12 },
  footHint: { fontSize: 12, color: SETTINGS_UI.textSecondary, marginTop: 8 },
  label: { fontSize: 14, color: SETTINGS_UI.text, marginBottom: 4 },
  input: {
    borderWidth: 1,
    borderColor: SETTINGS_UI.border,
    borderRadius: SETTINGS_UI.radiusInput,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: SETTINGS_UI.text,
    minHeight: 44,
  },
  inputFocused: { borderColor: SETTINGS_UI.borderFocus },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  timeLabel: { fontSize: 14, color: SETTINGS_UI.text, width: 100 },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
    marginBottom: 4,
  },
  switchLabel: { fontSize: 14, color: SETTINGS_UI.text },
  previewBlock: { marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: SETTINGS_UI.border },
  previewLabel: { fontSize: 12, color: SETTINGS_UI.textSecondary, marginTop: 4 },
  previewValue: { fontSize: 18, fontWeight: '700', color: SETTINGS_UI.primary, marginBottom: 2 },
  primaryBtn: {
    backgroundColor: SETTINGS_UI.primary,
    paddingVertical: 14,
    borderRadius: SETTINGS_UI.radius,
    alignItems: 'center',
    marginTop: 12,
  },
  primaryBtnText: { fontSize: 14, fontWeight: '700', color: '#fff' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    minHeight: 48,
    borderBottomWidth: 1,
    borderBottomColor: SETTINGS_UI.border,
  },
  rowText: { fontSize: 14, color: SETTINGS_UI.text },
  rowDanger: { color: '#E53E3E' },
  footer: { marginTop: 24, alignItems: 'center', paddingVertical: 20 },
  footerText: { fontSize: 12, color: SETTINGS_UI.textSecondary, marginBottom: 4 },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalCard: {
    backgroundColor: SETTINGS_UI.cardBg,
    borderRadius: SETTINGS_UI.radius,
    padding: 24,
    minWidth: 280,
    maxWidth: 340,
  },
  modalTitle: { fontSize: 18, fontWeight: '700', color: SETTINGS_UI.text, marginBottom: 12 },
  modalBody: { fontSize: 14, color: SETTINGS_UI.textSecondary, lineHeight: 22, marginBottom: 8 },
  modalBtn: { marginTop: 12, paddingVertical: 12, alignItems: 'center' },
  modalBtnText: { fontSize: 14, fontWeight: '600', color: SETTINGS_UI.primary },
  modalClose: { marginTop: 8, paddingVertical: 8, alignItems: 'center' },
  modalCloseText: { fontSize: 14, color: SETTINGS_UI.textSecondary },
  niumaSubHint: { fontSize: 11, color: SETTINGS_UI.textSecondary, marginTop: 2 },
  niumaModeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    marginBottom: 8,
    borderRadius: SETTINGS_UI.radiusInput,
    borderWidth: 1,
    borderColor: SETTINGS_UI.border,
    backgroundColor: SETTINGS_UI.cardBg,
  },
  niumaModeRowActive: {
    borderColor: SETTINGS_UI.primary,
    backgroundColor: '#FFF5EB',
  },
  niumaModeTitle: { fontSize: 14, fontWeight: '600', color: SETTINGS_UI.text },
  niumaModeTitleActive: { color: SETTINGS_UI.primary },
  niumaModeSub: { fontSize: 12, color: SETTINGS_UI.textSecondary, marginTop: 4 },
  niumaAlternateBlock: { marginTop: 8 },
  niumaCalRow: { flexDirection: 'row', gap: 10, marginTop: 10 },
  niumaCalBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: SETTINGS_UI.radiusInput,
    borderWidth: 1,
    borderColor: SETTINGS_UI.primary,
    alignItems: 'center',
  },
  niumaCalBtnText: { fontSize: 13, fontWeight: '600', color: SETTINGS_UI.primary },
  niumaAnchorHint: { fontSize: 11, color: SETTINGS_UI.textSecondary, marginTop: 8 },
});
