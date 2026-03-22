import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ScrollView,
  Platform,
  Modal,
  FlatList,
  ActivityIndicator,
  KeyboardAvoidingView,
  AppState,
  type AppStateStatus,
} from 'react-native';
import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { TOOLBOX_UI } from '@/constants/toolboxUI';
import { CHINA_REGIONS, getCitiesForProvince } from '@/constants/chinaRegions';
import { loadPersonalConfig, loadFireConfig, saveFireConfig } from '@/lib/storage';
import { fetchSocialAvgSalaryForCity } from '@/lib/fetchSocialAvgSalary';
import { fetchMedicalRegionCoefficientsFromRemote } from '@/lib/fetchMedicalRegionCoefficients';
import { getMedicalRegionCoeff, getRequiredRetireYearsForGender } from '@/lib/medicalRegionCoefficients';
import {
  computeFireMetrics,
  computeQuitFireResult,
  clampRetireAge,
  clampHistoricalBaseRatioPercent,
  clampFutureBaseRatioPercent,
  FIRE_RETIRE_AGE_MIN,
  FIRE_RETIRE_AGE_MAX,
  parseSocialAvgAnnual,
  getCurrentAgeYears,
  monthsFromNowToRetirement,
  monthlyContributionBase,
  monthlySocialPayment,
} from '@/lib/fireCalculations';
import {
  computeMedicalMetrics,
  medicalInsuranceMonthlyPremium,
  parseResidentMedicalAnnual,
} from '@/lib/fireMedicalCalculations';
import { formatRetirementFromSeconds } from '@/lib/retirement';
import { formatMoney } from '@/lib/format';
import { useToast } from '@/contexts/ToastContext';
import type { FireConfig, FutureContributionSegment } from '@/types';

function CollapsibleCard({
  title,
  subtitle,
  expanded,
  onToggle,
  children,
}: {
  title: string;
  subtitle?: string;
  expanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.card}>
      <Pressable style={styles.collapsibleHeader} onPress={onToggle}>
        <View style={{ flex: 1, paddingRight: 8 }}>
          <Text style={styles.cardTitle}>{title}</Text>
          {subtitle ? <Text style={styles.hint}>{subtitle}</Text> : null}
        </View>
        <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={22} color={TOOLBOX_UI.primary} />
      </Pressable>
      {expanded ? <View style={styles.collapsibleInner}>{children}</View> : null}
    </View>
  );
}

export default function FireScreen() {
  const router = useRouter();
  const toast = useToast();
  const [birthDate, setBirthDate] = useState<string | null>(null);
  const [cfg, setCfg] = useState<FireConfig>(() => ({
    paidYears: 0,
    paidMonths: 0,
    province: '北京市',
    city: '北京市',
    targetRetireAge: 60,
    paymentType: 'flexible',
    baseRatioPercent: 60,
    historicalBaseRatioPercent: 100,
    futureBaseRatioPercent: 60,
    socialAvgAnnual: '',
    personalAccountBalance: '0',
    medicalInsuranceType: 'employee',
    medicalPaidYears: 0,
    medicalPaidMonths: 0,
    medicalRetireRequiredYears: '25',
    residentMedicalAnnualYuan: '380',
    medicalGender: 'male',
    futureSegmentsEnabled: false,
    futureSegments: [],
  }));
  const [provinceModal, setProvinceModal] = useState(false);
  const [cityModal, setCityModal] = useState(false);
  const [fetchingSalary, setFetchingSalary] = useState(false);
  const [fetchingMedical, setFetchingMedical] = useState(false);
  const [advancedSegmentExpanded, setAdvancedSegmentExpanded] = useState(true);
  /** 折叠 */
  const [secOpen, setSecOpen] = useState({
    basic: true,
    pension: true,
    medical: false,
    salary: false,
    results: true,
  });
  /** 「老子不干了」速算 */
  const [quitOpen, setQuitOpen] = useState(false);
  const [quitMedType, setQuitMedType] = useState<'employee' | 'resident'>('employee');
  const loadedRef = useRef(false);

  const load = useCallback(async () => {
    const [p, f] = await Promise.all([loadPersonalConfig(), loadFireConfig()]);
    setBirthDate(p?.birthDate ?? null);
    setCfg(f);
    loadedRef.current = true;
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  /** 从设置改完生日返回、或切回 App 时重新读个人配置，避免倒计时/年龄不刷新 */
  useEffect(() => {
    const sub = AppState.addEventListener('change', (next: AppStateStatus) => {
      if (next === 'active') load();
    });
    return () => sub.remove();
  }, [load]);

  useEffect(() => {
    if (!loadedRef.current) return;
    saveFireConfig(cfg).catch(() => {});
  }, [cfg]);

  const computed = useMemo(() => computeFireMetrics(cfg, birthDate), [cfg, birthDate]);
  const medicalComputed = useMemo(() => computeMedicalMetrics(cfg, birthDate), [cfg, birthDate]);
  const currentAgeYears = useMemo(() => getCurrentAgeYears(birthDate), [birthDate]);
  const regionCoeff = useMemo(() => getMedicalRegionCoeff(cfg.province, cfg.city), [cfg.province, cfg.city]);
  const monthsToRetire = useMemo(
    () => monthsFromNowToRetirement(birthDate, cfg.targetRetireAge),
    [birthDate, cfg.targetRetireAge]
  );

  const quitResult = useMemo(() => {
    const social = parseSocialAvgAnnual(cfg.socialAvgAnnual);
    let med = 0;
    if (quitMedType === 'resident') {
      med = parseResidentMedicalAnnual(cfg.residentMedicalAnnualYuan ?? '380') / 12;
    } else if (social > 0) {
      med = medicalInsuranceMonthlyPremium(social, 60, 'flexible', regionCoeff);
    }
    return computeQuitFireResult(cfg, birthDate, med);
  }, [cfg, birthDate, quitMedType, regionCoeff]);

  const cities = useMemo(() => getCitiesForProvince(cfg.province), [cfg.province]);

  const setField = <K extends keyof FireConfig>(k: K, v: FireConfig[K]) => {
    setCfg((prev) => ({ ...prev, [k]: v }));
  };

  const onRetireAgeBlur = () => {
    const n = Math.max(0, parseInt(String(cfg.targetRetireAge), 10) || 60);
    const c = clampRetireAge(n);
    if (n !== c) {
      toast.show(`请输入 ${FIRE_RETIRE_AGE_MIN}–${FIRE_RETIRE_AGE_MAX} 岁`);
    }
    setField('targetRetireAge', c);
  };

  const onPaidMonthsBlur = () => {
    let m = Math.floor(parseInt(String(cfg.paidMonths), 10) || 0);
    if (m < 0) m = 0;
    if (m > 11) m = 11;
    setField('paidMonths', m);
  };

  const onHistoricalBaseBlur = () => {
    const c = clampHistoricalBaseRatioPercent(parseFloat(String(cfg.historicalBaseRatioPercent)) || 100);
    setField('historicalBaseRatioPercent', c);
  };

  const onFutureBaseBlur = () => {
    const c = clampFutureBaseRatioPercent(parseFloat(String(cfg.futureBaseRatioPercent)) || 0);
    /** 与旧字段 baseRatioPercent 对齐，便于兼容导出/老逻辑 */
    setCfg((prev) => ({ ...prev, futureBaseRatioPercent: c, baseRatioPercent: c }));
  };

  const onMedicalPaidMonthsBlur = () => {
    let m = Math.floor(parseInt(String(cfg.medicalPaidMonths), 10) || 0);
    if (m < 0) m = 0;
    if (m > 11) m = 11;
    setField('medicalPaidMonths', m);
  };

  const onMedicalRetireYearsBlur = () => {
    let y = Math.round(parseFloat(String(cfg.medicalRetireRequiredYears)) || 25);
    if (y < 1) y = 1;
    if (y > 50) y = 50;
    setField('medicalRetireRequiredYears', String(y));
  };

  const applyMedicalYearsFromRegion = useCallback(
    (patch: Partial<FireConfig>) => {
      setCfg((prev) => {
        const next = { ...prev, ...patch } as FireConfig;
        const coeff = getMedicalRegionCoeff(next.province, next.city);
        const y = getRequiredRetireYearsForGender(coeff, next.medicalGender ?? 'male');
        return { ...next, medicalRetireRequiredYears: String(y) };
      });
    },
    []
  );

  const handleFetchMedicalCoefficients = async () => {
    if (fetchingMedical) return;
    setFetchingMedical(true);
    try {
      const res = await fetchMedicalRegionCoefficientsFromRemote();
      const coeff = getMedicalRegionCoeff(cfg.province, cfg.city);
      const y = getRequiredRetireYearsForGender(coeff, cfg.medicalGender ?? 'male');
      setField('medicalRetireRequiredYears', String(y));
      if (res.fromRemote) {
        toast.show('已从网络更新医保系数库');
      } else {
        /** 非异常：国内常连不上 GitHub；已尝试镜像，仍失败则用打包表 */
        toast.show('已同步本地参保地系数，测算不受影响');
      }
    } catch {
      const coeff = getMedicalRegionCoeff(cfg.province, cfg.city);
      const y = getRequiredRetireYearsForGender(coeff, cfg.medicalGender ?? 'male');
      setField('medicalRetireRequiredYears', String(y));
      toast.show('已按本机参保地规则填入年限');
    } finally {
      setFetchingMedical(false);
    }
  };

  const toggleSec = (k: keyof typeof secOpen) => {
    setSecOpen((s) => ({ ...s, [k]: !s[k] }));
  };

  const updateFutureSegment = (index: number, patch: Partial<FutureContributionSegment>) => {
    setCfg((prev) => {
      const list = [...(prev.futureSegments ?? [])];
      if (!list[index]) return prev;
      list[index] = { ...list[index], ...patch };
      return { ...prev, futureSegments: list };
    });
  };

  const addFutureSegment = () => {
    setCfg((prev) => {
      const ratio = prev.futureBaseRatioPercent ?? 60;
      const next = [...(prev.futureSegments ?? []), { months: 12, baseRatioPercent: ratio }];
      return { ...prev, futureSegments: next, futureSegmentsEnabled: true };
    });
  };

  const removeFutureSegment = (index: number) => {
    setCfg((prev) => {
      const next = (prev.futureSegments ?? []).filter((_, i) => i !== index);
      return { ...prev, futureSegments: next, futureSegmentsEnabled: next.length > 0 };
    });
  };

  const handleFetchSalary = async () => {
    if (fetchingSalary) return;
    setFetchingSalary(true);
    try {
      const { annualYuan, fromRemote } = await fetchSocialAvgSalaryForCity(cfg.province, cfg.city);
      setField('socialAvgAnnual', String(annualYuan));
      if (fromRemote) {
        toast.show(`已填入社平工资 ${annualYuan} 元/年（可再改）`);
      } else {
        toast.show(
          `已填入本地参考社平 ${annualYuan} 元/年（网络不可用或远程未更新，可再改）`
        );
      }
    } catch {
      toast.show('获取失败，请手动填写当地社平工资');
    } finally {
      setFetchingSalary(false);
    }
  };

  const topInset = (Constants.statusBarHeight ?? (Platform.OS === 'ios' ? 44 : 24)) + 8;

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 64 : 0}
    >
      <ScrollView
        style={styles.container}
        contentContainerStyle={[styles.content, { paddingTop: topInset }]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.headerRow}>
          <Pressable onPress={() => router.back()} hitSlop={12} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={24} color={TOOLBOX_UI.primary} />
          </Pressable>
          <Text style={styles.headerTitle}>🔥 FIRE 提前退休计算器</Text>
          <View style={{ width: 32 }} />
        </View>

        {/* ===== 老子不干了 速算 ===== */}
        <Pressable
          style={[styles.card, styles.quitBtnCard]}
          onPress={() => setQuitOpen((p) => !p)}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Ionicons name="exit-outline" size={22} color="#fff" style={{ marginRight: 8 }} />
            <Text style={styles.quitBtnText}>老子不干了！速算辞职成本</Text>
          </View>
          <Ionicons name={quitOpen ? 'chevron-up' : 'chevron-down'} size={20} color="#fff" />
        </Pressable>

        {quitOpen ? (
          <View style={[styles.card, { borderColor: '#E65100', borderWidth: 1.5 }]}>
            <Text style={[styles.cardTitle, { color: '#E65100' }]}>
              辞职后自缴社保 / 医保速算
            </Text>

            {/* ① 缴费身份强提示 */}
            <View style={styles.quitWarnBox}>
              <Ionicons name="warning" size={16} color="#D32F2F" style={{ marginRight: 6, marginTop: 1 }} />
              <Text style={styles.quitWarnText}>
                重要说明：辞职后按「灵活就业」身份自缴，养老 20% + 医保费用全由个人承担，无单位缴费；{'\n'}
                历史高基数仅影响退休养老金，不影响当前自缴金额
              </Text>
            </View>

            {/* ② 当前未来缴费基数档位展示 */}
            <Text style={styles.quitBaseHint}>
              当前未来缴费基数：60%（灵活就业最低档）
            </Text>
            <Text style={[styles.hint, { marginTop: 0, marginBottom: 12 }]}>
              可在下方 FIRE 主配置修改未来基数，0% = 停缴 FIRE
            </Text>

            {/* 医保类型选择 */}
            <Text style={styles.label}>辞职后医保方式</Text>
            <View style={{ flexDirection: 'row', gap: 10, marginBottom: 4 }}>
              <Pressable
                style={[
                  styles.quitMedOption,
                  quitMedType === 'employee' && styles.quitMedOptionActive,
                ]}
                onPress={() => setQuitMedType('employee')}
              >
                <Text
                  style={[
                    styles.quitMedOptionText,
                    quitMedType === 'employee' && styles.quitMedOptionTextActive,
                  ]}
                >
                  灵活就业职工医保
                </Text>
              </Pressable>
              <Pressable
                style={[
                  styles.quitMedOption,
                  quitMedType === 'resident' && styles.quitMedOptionActive,
                ]}
                onPress={() => setQuitMedType('resident')}
              >
                <Text
                  style={[
                    styles.quitMedOptionText,
                    quitMedType === 'resident' && styles.quitMedOptionTextActive,
                  ]}
                >
                  城乡居民医保
                </Text>
              </Pressable>
            </View>

            {/* ④ 医保类型详细说明 */}
            {quitMedType === 'employee' ? (
              <Text style={styles.quitMedHint}>
                灵活就业职工医保，按月按基数缴费
                {regionCoeff.flexibleMedicalBaseMode === 'fixed_100'
                  ? `（${cfg.city || cfg.province}固定 100% 社平）`
                  : ''}
                ，满足年限可退休免缴，有个人账户
              </Text>
            ) : (
              <Text style={styles.quitMedHint}>
                居民医保为按年缴费的普惠型医保，{new Date().getFullYear()} 年全国个人缴费 {cfg.residentMedicalAnnualYuan || '380'} 元/年，折算每月{' '}
                {formatMoney(parseResidentMedicalAnnual(cfg.residentMedicalAnnualYuan ?? '380') / 12)}；
                无退休免缴，需终身缴费，报销比例低于职工医保，无个人账户
              </Text>
            )}

            {parseSocialAvgAnnual(cfg.socialAvgAnnual) <= 0 ? (
              <Text style={[styles.hint, { color: '#D32F2F', marginTop: 8, marginBottom: 8 }]}>
                请先填写社平工资，否则无法计算
              </Text>
            ) : null}

            {/* 结果 */}
            <View style={[styles.quitResultGrid, { marginTop: 8 }]}>
              <View style={styles.quitResultItem}>
                <Text style={styles.quitResultLabel}>每月养老（灵活就业 60%）</Text>
                <Text style={styles.quitResultValue}>{formatMoney(quitResult.monthlyPension)}</Text>
              </View>

              {/* ③ 3 倍基数参考值 */}
              {parseSocialAvgAnnual(cfg.socialAvgAnnual) > 0 ? (
                <Text style={styles.quitRefHint}>
                  若按 3 倍社平缴灵活就业养老：
                  {formatMoney(monthlySocialPayment(monthlyContributionBase(parseSocialAvgAnnual(cfg.socialAvgAnnual), 300), 'flexible'))}
                  /月（纯养老）{'\n'}
                  对应在职职工 3 倍个人缴费：
                  {formatMoney(monthlySocialPayment(monthlyContributionBase(parseSocialAvgAnnual(cfg.socialAvgAnnual), 300), 'employee'))}
                  /月（8%，含单位缴费总约{' '}
                  {formatMoney(monthlyContributionBase(parseSocialAvgAnnual(cfg.socialAvgAnnual), 300) * 0.24)}
                  /月）
                </Text>
              ) : null}

              <View style={styles.quitResultItem}>
                <Text style={styles.quitResultLabel}>
                  每月医保{quitMedType === 'resident' ? '（居民）' : '（职工）'}
                </Text>
                <Text style={styles.quitResultValue}>{formatMoney(quitResult.monthlyMedical)}</Text>
              </View>
              <View style={[styles.quitResultItem, styles.quitResultItemTotal]}>
                <Text style={[styles.quitResultLabel, { fontWeight: '700' }]}>每月合计</Text>
                <Text style={[styles.quitResultValue, { fontSize: 20 }]}>
                  {formatMoney(quitResult.monthlyTotal)}
                </Text>
              </View>
              <View style={styles.quitResultItem}>
                <Text style={[styles.quitResultLabel, { fontWeight: '700' }]}>每天成本</Text>
                <Text style={[styles.quitResultValue, { fontSize: 20 }]}>
                  {formatMoney(quitResult.dailyTotal)}
                </Text>
              </View>
            </View>

            <View style={styles.quitDivider} />

            <Text style={[styles.quitResultLabel, { fontWeight: '700', marginBottom: 6 }]}>
              退休后每月养老金
            </Text>
            <Text style={[styles.resultValue, { fontSize: 24, marginBottom: 4 }]}>
              {formatMoney(quitResult.retireMonthlyPension)}
            </Text>
            <Text style={styles.hint}>
              基础养老金 {formatMoney(quitResult.retireBasic)} + 个账养老金 {formatMoney(quitResult.retirePersonal)}
            </Text>
            <Text style={styles.hint}>
              加权缴费指数 {quitResult.weightedIndex.toFixed(4)}
              {'  '}距退休 {Math.floor(quitResult.monthsToRetire / 12)} 年 {quitResult.monthsToRetire % 12} 月
            </Text>

            <View style={styles.quitDivider} />
            <Text style={[styles.hint, { color: '#666' }]}>
              以上按灵活就业、养老 60%（最低档）基数测算；退休金受历史缴费基数加权影响，已考虑在内
            </Text>
          </View>
        ) : null}

        {/* 卡片 1：基础信息 */}
        <CollapsibleCard
          title="基础信息"
          subtitle="出生日期与「设置」同步；无定位，参保地仅手动选择"
          expanded={secOpen.basic}
          onToggle={() => toggleSec('basic')}
        >
          <Text style={styles.label}>出生日期</Text>
          <View style={styles.readonlyBox}>
            <Text style={styles.readonlyText}>
              {birthDate && /^\d{4}-\d{2}-\d{2}$/.test(birthDate) ? birthDate : '请先在「设置」填写生日'}
            </Text>
          </View>

          <Text style={styles.label}>当前年龄</Text>
          <View style={styles.readonlyBox}>
            <Text style={styles.readonlyText}>{currentAgeYears != null ? `${currentAgeYears} 岁` : '—'}</Text>
          </View>

          <Text style={styles.label}>目标退休年龄</Text>
          <TextInput
            style={styles.input}
            value={String(cfg.targetRetireAge)}
            onChangeText={(t) => setField('targetRetireAge', parseInt(t.replace(/\D/g, ''), 10) || 60)}
            onBlur={onRetireAgeBlur}
            keyboardType="number-pad"
            placeholder="60"
            placeholderTextColor={TOOLBOX_UI.secondary}
          />
          <Text style={styles.footHint}>范围 {FIRE_RETIRE_AGE_MIN}～{FIRE_RETIRE_AGE_MAX} 岁，修改后下方测算会刷新</Text>

          <Text style={styles.label}>参保所在地</Text>
          <Pressable style={styles.selectRow} onPress={() => setProvinceModal(true)}>
            <Text style={styles.selectText}>{cfg.province}</Text>
            <Ionicons name="chevron-back" size={18} color={TOOLBOX_UI.secondary} style={{ transform: [{ rotate: '-90deg' }] }} />
          </Pressable>
          <Pressable style={styles.selectRow} onPress={() => setCityModal(true)}>
            <Text style={styles.selectText}>{cfg.city}</Text>
            <Ionicons name="chevron-back" size={18} color={TOOLBOX_UI.secondary} style={{ transform: [{ rotate: '-90deg' }] }} />
          </Pressable>
        </CollapsibleCard>

        {/* 卡片 2：养老保险精准配置 */}
        <CollapsibleCard
          title="养老保险精准配置"
          subtitle="养老单独核算（不含医保）；历史高基数 + 未来 0% = FIRE 停缴，按全国唯一公式加权"
          expanded={secOpen.pension}
          onToggle={() => toggleSec('pension')}
        >
          <View style={styles.prominentWarn}>
            <Ionicons name="warning" size={22} color="#E65100" style={{ marginRight: 8, marginTop: 2 }} />
            <Text style={styles.prominentWarnText}>
              历史基数 = 过去已缴年限的平均比例（决定退休养老金）；{'\n'}
              未来基数 = 从现在到退休的比例（0%=FIRE 停缴，不再交钱）
            </Text>
          </View>

          <Text style={styles.label}>已缴养老年限（累计）</Text>
          <View style={styles.row2}>
            <View style={styles.row2Item}>
              <TextInput
                style={styles.input}
                value={String(cfg.paidYears)}
                onChangeText={(t) => setField('paidYears', Math.max(0, parseInt(t.replace(/\D/g, ''), 10) || 0))}
                keyboardType="number-pad"
                placeholder="0"
                placeholderTextColor={TOOLBOX_UI.secondary}
              />
              <Text style={styles.unit}>年</Text>
            </View>
            <View style={styles.row2Item}>
              <TextInput
                style={styles.input}
                value={String(cfg.paidMonths)}
                onChangeText={(t) => setField('paidMonths', Math.min(11, Math.max(0, parseInt(t.replace(/\D/g, ''), 10) || 0)))}
                onBlur={onPaidMonthsBlur}
                keyboardType="number-pad"
                placeholder="0"
                placeholderTextColor={TOOLBOX_UI.secondary}
              />
              <Text style={styles.unit}>月</Text>
            </View>
          </View>

          <Text style={styles.label}>养老金个人账户余额（元）</Text>
          <TextInput
            style={styles.input}
            value={cfg.personalAccountBalance}
            onChangeText={(t) => {
              const cleaned = t.replace(/[^\d.]/g, '');
              const dot = cleaned.indexOf('.');
              const next =
                dot === -1
                  ? cleaned
                  : `${cleaned.slice(0, dot + 1)}${cleaned.slice(dot + 1).replace(/\./g, '')}`;
              setField('personalAccountBalance', next);
            }}
            keyboardType="decimal-pad"
            placeholder="0"
            placeholderTextColor={TOOLBOX_UI.secondary}
          />
          <Text style={styles.footHint}>
            养老金个人账户里「已累计」金额，社保 / 医保 APP 可查；支持小数，默认 0
          </Text>
          <View style={styles.personalPaidStrip}>
            <Text style={styles.personalPaidStripLabel}>个账已缴（元）</Text>
            <Text style={styles.personalPaidStripValue}>
              {formatMoney(computed.personalAccountPaidYuan)}
            </Text>
          </View>
          <Text style={styles.personalPaidStripFoot}>
            与输入框一致；下方「退休养老金」卡片显示退休时个账预计总额
          </Text>

          <Text style={styles.label}>历史平均缴费基数（社平的 {cfg.historicalBaseRatioPercent}%）</Text>
          <TextInput
            style={styles.input}
            value={String(cfg.historicalBaseRatioPercent)}
            onChangeText={(t) =>
              setField('historicalBaseRatioPercent', parseFloat(t.replace(/[^\d.]/g, '')) || 0)
            }
            onBlur={onHistoricalBaseBlur}
            keyboardType="decimal-pad"
            placeholder="100"
            placeholderTextColor={TOOLBOX_UI.secondary}
          />
          <Text style={styles.footHint}>范围 60%～300%（如过去按 3 倍缴则填 300%）</Text>

          <View style={styles.historicalPayStrip}>
            <Text style={styles.historicalPayLabel}>历史每月养老缴费（按你填的历史基数）</Text>
            <Text style={styles.historicalPayValue}>
              {parseSocialAvgAnnual(cfg.socialAvgAnnual) > 0
                ? `${formatMoney(computed.historicalMonthlySocialPayYuan)}（纯养老，不含医保）`
                : '—（请先填写下方社平工资）'}
            </Text>
          </View>

          <Text style={styles.label}>
            {cfg.futureSegmentsEnabled
              ? `默认 / 补全用未来基数（社平的 ${cfg.futureBaseRatioPercent}%）`
              : `未来缴费基数（社平的 ${cfg.futureBaseRatioPercent}%）`}
          </Text>
          <TextInput
            style={styles.input}
            value={String(cfg.futureBaseRatioPercent)}
            onChangeText={(t) =>
              setField('futureBaseRatioPercent', parseFloat(t.replace(/[^\d.]/g, '')) || 0)
            }
            onBlur={onFutureBaseBlur}
            keyboardType="decimal-pad"
            placeholder="60"
            placeholderTextColor={TOOLBOX_UI.secondary}
          />
          <Text style={styles.footHint}>
            {cfg.futureSegmentsEnabled
              ? '分段开启时：各段月数之和不足「距退休月数」时自动用本比例补一段；未启用分段时与旧版一致'
              : '范围 0%～300%；0% = 停缴（FIRE），未来养老/医保缴费均按 0 计'}
          </Text>
          {computed.futureBaseIsFireStop ? (
            <Text style={styles.hintGreen}>✅ FIRE 停缴模式生效，未来不再缴纳社保 / 医保</Text>
          ) : null}

          <Text style={styles.label}>缴费身份</Text>
          <View style={styles.radioRow}>
            <Pressable
              style={[styles.radioChip, cfg.paymentType === 'flexible' && styles.radioChipOn]}
              onPress={() => setField('paymentType', 'flexible')}
            >
              <Text style={[styles.radioText, cfg.paymentType === 'flexible' && styles.radioTextOn]}>灵活就业</Text>
            </Pressable>
            <Pressable
              style={[styles.radioChip, cfg.paymentType === 'employee' && styles.radioChipOn]}
              onPress={() => setField('paymentType', 'employee')}
            >
              <Text style={[styles.radioText, cfg.paymentType === 'employee' && styles.radioTextOn]}>在职职工</Text>
            </Pressable>
          </View>

          <Pressable
            style={styles.advancedToggle}
            onPress={() => setAdvancedSegmentExpanded((v) => !v)}
          >
            <Text style={styles.advancedToggleText}>高级分段缴费（从现在到退休分段设基数）</Text>
            <Ionicons
              name={advancedSegmentExpanded ? 'chevron-up' : 'chevron-down'}
              size={20}
              color={TOOLBOX_UI.primary}
            />
          </Pressable>
          {advancedSegmentExpanded ? (
            <View style={styles.segmentPanel}>
              <View style={styles.segmentRow}>
                <Text style={styles.segmentLabel}>启用未来分段</Text>
                <Pressable
                  style={[styles.segmentSwitch, cfg.futureSegmentsEnabled && styles.segmentSwitchOn]}
                  onPress={() => {
                    const on = !cfg.futureSegmentsEnabled;
                    if (on && (!cfg.futureSegments || cfg.futureSegments.length === 0)) {
                      const m = Math.max(1, monthsToRetire);
                      setCfg((p) => ({
                        ...p,
                        futureSegmentsEnabled: true,
                        futureSegments: [{ months: m, baseRatioPercent: p.futureBaseRatioPercent ?? 60 }],
                      }));
                    } else {
                      setField('futureSegmentsEnabled', on);
                    }
                  }}
                >
                  <Text style={[styles.segmentSwitchText, cfg.futureSegmentsEnabled && styles.segmentSwitchTextOn]}>
                    {cfg.futureSegmentsEnabled ? '开' : '关'}
                  </Text>
                </Pressable>
              </View>
              <Text style={styles.footHint}>
                距目标退休剩余约 {monthsToRetire} 个月（与生日、目标年龄联动）。各段月数之和可小于该值，系统将自动补一段。
              </Text>
              {cfg.futureSegmentsEnabled ? (
                <>
                  {(cfg.futureSegments ?? []).map((seg, idx) => (
                    <View key={idx} style={styles.segmentItem}>
                      <Text style={styles.segmentItemTitle}>第 {idx + 1} 段</Text>
                      <View style={styles.row2}>
                        <View style={styles.row2Item}>
                          <Text style={styles.segmentFieldLabel}>月数</Text>
                          <TextInput
                            style={styles.input}
                            value={String(seg.months)}
                            onChangeText={(t) =>
                              updateFutureSegment(idx, {
                                months: Math.max(0, parseInt(t.replace(/\D/g, ''), 10) || 0),
                              })
                            }
                            keyboardType="number-pad"
                            placeholder="0"
                            placeholderTextColor={TOOLBOX_UI.secondary}
                          />
                        </View>
                        <View style={styles.row2Item}>
                          <Text style={styles.segmentFieldLabel}>基数%</Text>
                          <TextInput
                            style={styles.input}
                            value={String(seg.baseRatioPercent)}
                            onChangeText={(t) =>
                              updateFutureSegment(idx, {
                                baseRatioPercent: parseFloat(t.replace(/[^\d.]/g, '')) || 0,
                              })
                            }
                            onBlur={() => {
                              const c = clampFutureBaseRatioPercent(
                                parseFloat(String(cfg.futureSegments?.[idx]?.baseRatioPercent)) || 0
                              );
                              updateFutureSegment(idx, { baseRatioPercent: c });
                            }}
                            keyboardType="decimal-pad"
                            placeholder="60"
                            placeholderTextColor={TOOLBOX_UI.secondary}
                          />
                        </View>
                      </View>
                      {(cfg.futureSegments?.length ?? 0) > 1 ? (
                        <Pressable onPress={() => removeFutureSegment(idx)} style={styles.segmentRemove}>
                          <Text style={styles.segmentRemoveText}>删除本段</Text>
                        </Pressable>
                      ) : null}
                    </View>
                  ))}
                  <Pressable style={styles.segmentAddBtn} onPress={addFutureSegment}>
                    <Text style={styles.segmentAddBtnText}>+ 添加一段</Text>
                  </Pressable>
                  {computed.futureSegmentsMode ? (
                    <Text style={styles.footHint}>
                      已启用分段：养老金加权指数、个账进账、未来月缴均为各段加权结果。
                    </Text>
                  ) : null}
                </>
              ) : null}
            </View>
          ) : null}
        </CollapsibleCard>

        {/* 卡片 3：医疗保险智能配置 */}
        <CollapsibleCard
          title="医疗保险智能配置"
          subtitle="内置全国省市系数；仅点击下方按钮时联网更新系数库"
          expanded={secOpen.medical}
          onToggle={() => toggleSec('medical')}
        >

          <Text style={styles.label}>医保参保类型</Text>
          <View style={styles.radioRow}>
            <Pressable
              style={[styles.radioChip, cfg.medicalInsuranceType === 'employee' && styles.radioChipOn]}
              onPress={() => setField('medicalInsuranceType', 'employee')}
            >
              <Text
                style={[styles.radioText, cfg.medicalInsuranceType === 'employee' && styles.radioTextOn]}
              >
                职工医保
              </Text>
            </Pressable>
            <Pressable
              style={[styles.radioChip, cfg.medicalInsuranceType === 'resident' && styles.radioChipOn]}
              onPress={() => setField('medicalInsuranceType', 'resident')}
            >
              <Text
                style={[styles.radioText, cfg.medicalInsuranceType === 'resident' && styles.radioTextOn]}
              >
                城乡居民医保
              </Text>
            </Pressable>
          </View>

          <Text style={styles.label}>已缴医保累计年限</Text>
          <View style={styles.row2}>
            <View style={styles.row2Item}>
              <TextInput
                style={styles.input}
                value={String(cfg.medicalPaidYears)}
                onChangeText={(t) =>
                  setField('medicalPaidYears', Math.max(0, parseInt(t.replace(/\D/g, ''), 10) || 0))
                }
                keyboardType="number-pad"
                placeholder="0"
                placeholderTextColor={TOOLBOX_UI.secondary}
              />
              <Text style={styles.unit}>年</Text>
            </View>
            <View style={styles.row2Item}>
              <TextInput
                style={styles.input}
                value={String(cfg.medicalPaidMonths)}
                onChangeText={(t) =>
                  setField(
                    'medicalPaidMonths',
                    Math.min(11, Math.max(0, parseInt(t.replace(/\D/g, ''), 10) || 0))
                  )
                }
                onBlur={onMedicalPaidMonthsBlur}
                keyboardType="number-pad"
                placeholder="0"
                placeholderTextColor={TOOLBOX_UI.secondary}
              />
              <Text style={styles.unit}>月</Text>
            </View>
          </View>
          <Text style={styles.footHint}>社保 / 医保 APP 可查实际累计</Text>

          {cfg.medicalInsuranceType === 'employee' ? (
            <>
              <Text style={styles.label}>医保退休年限核算性别</Text>
              <View style={styles.radioRow}>
                <Pressable
                  style={[styles.radioChip, cfg.medicalGender === 'male' && styles.radioChipOn]}
                  onPress={() => applyMedicalYearsFromRegion({ medicalGender: 'male' })}
                >
                  <Text style={[styles.radioText, cfg.medicalGender === 'male' && styles.radioTextOn]}>男</Text>
                </Pressable>
                <Pressable
                  style={[styles.radioChip, cfg.medicalGender === 'female' && styles.radioChipOn]}
                  onPress={() => applyMedicalYearsFromRegion({ medicalGender: 'female' })}
                >
                  <Text style={[styles.radioText, cfg.medicalGender === 'female' && styles.radioTextOn]}>女</Text>
                </Pressable>
              </View>
              <Text style={styles.footHint}>
                参保地参考：男 {regionCoeff.maleRetireYears} 年 / 女 {regionCoeff.femaleRetireYears} 年（切换省市或性别会自动填入下方年限，可再改）
              </Text>

              <Text style={styles.label}>医保退休缴费年限（缴满 · 年）</Text>
              <TextInput
                style={styles.input}
                value={cfg.medicalRetireRequiredYears}
                onChangeText={(t) => setField('medicalRetireRequiredYears', t.replace(/[^\d.]/g, ''))}
                onBlur={onMedicalRetireYearsBlur}
                keyboardType="decimal-pad"
                placeholder="25"
                placeholderTextColor={TOOLBOX_UI.secondary}
              />
              <Text style={styles.footHint}>按参保地自动建议，可手动修改</Text>

              <View style={styles.readonlyBox}>
                <Text style={styles.readonlyLabel}>医保缴费基数规则（按参保地）</Text>
                <Text style={styles.readonlyText}>{medicalComputed.medicalBaseRuleHint}</Text>
                {cfg.medicalInsuranceType === 'employee' &&
                medicalComputed.effectiveMedicalBaseRatioPercent > 0 ? (
                  <Text style={[styles.readonlyText, { marginTop: 6 }]}>
                    当前用于估算的医保基数比例：{medicalComputed.effectiveMedicalBaseRatioPercent}% 社平
                  </Text>
                ) : null}
              </View>
              {medicalComputed.regionHintRed ? (
                <Text style={styles.hintRed}>{medicalComputed.regionHintRed}</Text>
              ) : null}

              <Pressable
                style={[styles.primaryBtn, fetchingMedical && styles.primaryBtnDisabled]}
                onPress={handleFetchMedicalCoefficients}
                disabled={fetchingMedical}
              >
                {fetchingMedical ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.primaryBtnText}>更新当地医保系数</Text>
                )}
              </Pressable>
              <Text style={styles.footHint}>仅主动联网；失败时使用 App 内置系数，不影响测算</Text>
            </>
          ) : (
            <>
              <Text style={styles.label}>居民医保年缴费（元）</Text>
              <TextInput
                style={styles.input}
                value={cfg.residentMedicalAnnualYuan}
                onChangeText={(t) => setField('residentMedicalAnnualYuan', t.replace(/[^\d.]/g, ''))}
                keyboardType="decimal-pad"
                placeholder="380"
                placeholderTextColor={TOOLBOX_UI.secondary}
              />
              <Text style={styles.footHint}>默认 380 元/年（各地不同，可手改）；折算月/日成本见下方结果</Text>
            </>
          )}
        </CollapsibleCard>

        {/* 卡片 4：缴费配置（社平） */}
        <CollapsibleCard
          title="缴费配置（社平）"
          subtitle="缴费基数比例请在上方「养老保险精准配置」中设置历史 / 未来"
          expanded={secOpen.salary}
          onToggle={() => toggleSec('salary')}
        >

          <Text style={styles.label}>当地年均社平工资（元/年）</Text>
          <TextInput
            style={styles.input}
            value={cfg.socialAvgAnnual}
            onChangeText={(t) => setField('socialAvgAnnual', t.replace(/[^\d.]/g, ''))}
            keyboardType="decimal-pad"
            placeholder="手动填写或点击下方获取"
            placeholderTextColor={TOOLBOX_UI.secondary}
          />
          <Pressable
            style={[styles.primaryBtn, fetchingSalary && styles.primaryBtnDisabled]}
            onPress={handleFetchSalary}
            disabled={fetchingSalary}
          >
            {fetchingSalary ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.primaryBtnText}>获取当地社平工资</Text>
            )}
          </Pressable>
          <Text style={styles.footHint}>
            仅主动点击时联网；远程失败时自动使用 App 内参考表，仍无数据可手填
          </Text>
        </CollapsibleCard>

        <View style={{ marginBottom: TOOLBOX_UI.gridGap }}>
          <View style={styles.card}>
            <Pressable style={styles.collapsibleHeader} onPress={() => toggleSec('results')}>
              <View style={{ flex: 1, paddingRight: 8 }}>
                <Text style={styles.cardTitle}>测算结果</Text>
                <Text style={styles.hint}>养老金、月缴、倒计时与达标状态</Text>
              </View>
              <Ionicons
                name={secOpen.results ? 'chevron-up' : 'chevron-down'}
                size={22}
                color={TOOLBOX_UI.primary}
              />
            </Pressable>
          </View>
          {secOpen.results ? (
            <>
        {/* 卡片 5：退休养老金（精准，纯养老） */}
        <View style={[styles.card, styles.cardResultFollow]}>
          <Text style={styles.cardTitle}>退休养老金（精准）</Text>
          <Text style={styles.hint}>全国统一公式，不含医保；个账养老金折算当前按 60 岁计发月数 139（与目标退休年龄展示独立）</Text>

          <View style={styles.weightedIndexBlock}>
            <Text style={styles.resultLabel}>加权平均缴费指数</Text>
            <Text style={styles.weightedIndexHero}>
              {parseSocialAvgAnnual(cfg.socialAvgAnnual) > 0
                ? computed.weightedAverageContributionIndex.toFixed(2)
                : '—'}
            </Text>
            <Text style={styles.resultSubHint}>
              历史高基数 + 未来低基数（或停缴）的加权平均值，直接决定基础养老金高低
            </Text>
          </View>

          <View style={styles.resultBlock}>
            <Text style={styles.resultLabel}>每月总养老金</Text>
            <Text style={styles.resultValue}>
              {parseSocialAvgAnnual(cfg.socialAvgAnnual) > 0 ? formatMoney(computed.estimatedMonthlyPension) : '—'}
            </Text>
          </View>
          <View style={styles.resultBlock}>
            <Text style={styles.resultLabel}>基础养老金（月）· 个人账户养老金（月）</Text>
            <Text style={styles.resultValue}>
              {parseSocialAvgAnnual(cfg.socialAvgAnnual) > 0
                ? `${formatMoney(computed.basicPensionMonthly)} · ${formatMoney(computed.personalPensionMonthly)}`
                : '— · —'}
            </Text>
          </View>
          <View style={styles.resultBlock}>
            <Text style={styles.resultLabel}>个账已缴（元）· 预计退休时个账总额（元）</Text>
            <Text style={styles.resultValue}>
              {formatMoney(computed.personalAccountPaidYuan)} · {formatMoney(computed.personalAccountTotalAtRetireYuan)}
            </Text>
          </View>
        </View>

        {/* 卡片 6：每月缴费（养老 / 医保严格分开） */}
        <View style={[styles.card, styles.cardResultFollow]}>
          <Text style={styles.cardTitle}>每月缴费</Text>
          <Text style={styles.hint}>
            {medicalComputed.futurePayHintLine ||
              '养老缴费与医保缴费分开计算、分开展示，不合并'}
          </Text>

          {computed.futureBaseIsFireStop ? (
            <Text style={styles.hintGreen}>
              ✅ FIRE 停缴生效，未来零成本（养老 / 医保均为 ¥0.00）
            </Text>
          ) : (
            <Text style={styles.resultSubHint}>未来缴费（从现在到目标退休），与历史缴费无关</Text>
          )}

          <View style={styles.resultBlock}>
            <Text style={styles.resultLabel}>每月养老缴费（未来 · 纯养老，不含医保）</Text>
            <Text style={styles.resultValue}>
              {parseSocialAvgAnnual(cfg.socialAvgAnnual) > 0 ? formatMoney(computed.monthlyPay) : '—'}
            </Text>
          </View>
          <View style={styles.resultBlock}>
            <Text style={styles.resultLabel}>每月医保缴费（未来）</Text>
            <Text style={styles.resultValue}>{formatMoney(medicalComputed.monthlyMedicalPay)}</Text>
            <Text style={styles.resultValueSmall}>{medicalComputed.retireMedicalBenefitLine}</Text>
          </View>
          <View style={styles.resultBlock}>
            <Text style={styles.resultLabel}>每日养老成本 · 每日医保成本（未来）</Text>
            <Text style={styles.resultValue}>
              {parseSocialAvgAnnual(cfg.socialAvgAnnual) > 0
                ? `${formatMoney(computed.dailyPay)} · ${formatMoney(medicalComputed.dailyMedicalPay)}`
                : `— · ${formatMoney(medicalComputed.dailyMedicalPay)}`}
            </Text>
            <Text style={styles.resultSubHint}>
              {cfg.medicalInsuranceType === 'resident'
                ? '居民医保：停缴模式下未来按 0 计'
                : '职工医保需填社平；与历史缴费分开'}
            </Text>
          </View>
          {medicalComputed.regionHintRed ? <Text style={styles.hintRed}>{medicalComputed.regionHintRed}</Text> : null}
        </View>

        {/* 卡片 7：缴费倒计时 */}
        <View style={[styles.card, styles.cardResultFollow]}>
          <Text style={styles.cardTitle}>缴费倒计时</Text>
          <Text style={styles.hint}>距目标退休年龄的剩余月数用于估算未来缴费</Text>

          {birthDate && computed.fireSecondsRemaining != null ? (
            <View style={styles.resultBlock}>
              <Text style={styles.resultLabel}>FIRE 目标退休倒计时</Text>
              <Text style={styles.resultValue}>
                {computed.fireSecondsRemaining <= 0
                  ? '已到目标退休年龄'
                  : formatRetirementFromSeconds(computed.fireSecondsRemaining)}
              </Text>
            </View>
          ) : (
            <Text style={styles.footHint}>填写生日后可显示倒计时</Text>
          )}

          <View style={styles.resultBlock}>
            <Text style={styles.resultLabel}>
              {computed.fifteenYearMet ? '最低缴费年限（养老 15 年）' : '剩余需缴养老（补足 15 年）'}
            </Text>
            {computed.fifteenYearMet ? (
              <>
                <Text style={styles.resultValue}>已满足</Text>
                <Text style={styles.resultSubHint}>若继续缴，月缴见「每月缴费」</Text>
              </>
            ) : (
              <Text style={styles.resultValue}>
                {computed.needMonthsFor15} 个月 · 约 {formatMoney(computed.remainingCostFor15)}
              </Text>
            )}
          </View>

          <View style={styles.resultBlock}>
            <Text style={styles.resultLabel}>剩余医保缴费时间（至目标退休）</Text>
            <Text style={styles.resultValue}>
              约 {medicalComputed.remainingMonthsToRetirement} 个月 · 预估总费用约{' '}
              {formatMoney(medicalComputed.remainingTotalMedicalCost)}
            </Text>
            <Text style={styles.resultSubHint}>月缴费×剩余月数；居民医保为持续参保的区间估算</Text>
          </View>

          <View style={styles.resultBlock}>
            <Text style={styles.resultLabel}>总需缴费金额（分开列示）</Text>
            <Text style={styles.resultValueSmall}>
              养老（至退休）：{' '}
              {parseSocialAvgAnnual(cfg.socialAvgAnnual) > 0
                ? formatMoney(computed.futurePensionTotalContributionEstimate)
                : '—'}
            </Text>
            <Text style={[styles.resultValueSmall, { marginTop: 6 }]}>
              医保（至退休）： {formatMoney(medicalComputed.remainingTotalMedicalCost)}
            </Text>
          </View>
        </View>

        {/* 卡片 8：达标状态 */}
        <View style={[styles.card, styles.cardResultFollow]}>
          <Text style={styles.cardTitle}>达标状态</Text>

          <View style={[styles.badge, computed.fifteenYearMet ? styles.badgeOk : styles.badgeWarn]}>
            <Text style={styles.badgeText}>
              【养老】
              {computed.fifteenYearMet
                ? '已缴满 15 年最低年限（可自愿多缴）'
                : `距 15 年还差 ${computed.needMonthsFor15} 个月`}
            </Text>
          </View>

          {cfg.medicalInsuranceType === 'resident' ? (
            <View style={[styles.badge, styles.badgeWarn]}>
              <Text style={styles.badgeText}>
                【医保】{medicalComputed.residentStatusLine}。{medicalComputed.residentDetailLine}
              </Text>
            </View>
          ) : medicalComputed.employeeMet ? (
            <View style={[styles.badge, styles.badgeOk]}>
              <Text style={styles.badgeText}>【医保】{medicalComputed.employeeStatusLine}</Text>
              <Text style={[styles.badgeText, { marginTop: 6 }]}>{medicalComputed.employeeDetailLine}</Text>
            </View>
          ) : (
            <View style={[styles.badge, styles.badgeWarn]}>
              <Text style={styles.badgeText}>【医保】{medicalComputed.employeeStatusLine}</Text>
              <Text style={[styles.badgeText, { marginTop: 6 }]}>{medicalComputed.employeeDetailLine}</Text>
            </View>
          )}
        </View>
            </>
          ) : null}
        </View>
      </ScrollView>

      <Modal visible={provinceModal} transparent animationType="fade">
        <Pressable style={styles.modalOverlay} onPress={() => setProvinceModal(false)}>
          <Pressable style={styles.modalCard} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.modalTitle}>选择省份</Text>
            <FlatList
              data={CHINA_REGIONS}
              keyExtractor={(item) => item.province}
              style={{ maxHeight: 360 }}
              renderItem={({ item }) => (
                <Pressable
                  style={styles.modalRow}
                  onPress={() => {
                    const cs = item.cities;
                    const nextCity = cs.includes(cfg.city) ? cfg.city : cs[0];
                    applyMedicalYearsFromRegion({ province: item.province, city: nextCity });
                    setProvinceModal(false);
                  }}
                >
                  <Text style={styles.modalRowText}>{item.province}</Text>
                </Pressable>
              )}
            />
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={cityModal} transparent animationType="fade">
        <Pressable style={styles.modalOverlay} onPress={() => setCityModal(false)}>
          <Pressable style={styles.modalCard} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.modalTitle}>选择城市</Text>
            <FlatList
              data={cities}
              keyExtractor={(c) => c}
              style={{ maxHeight: 360 }}
              renderItem={({ item }) => (
                <Pressable
                  style={styles.modalRow}
                  onPress={() => {
                    applyMedicalYearsFromRegion({ city: item });
                    setCityModal(false);
                  }}
                >
                  <Text style={styles.modalRowText}>{item}</Text>
                </Pressable>
              )}
            />
          </Pressable>
        </Pressable>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: TOOLBOX_UI.bg },
  container: { flex: 1 },
  content: { padding: TOOLBOX_UI.padding, paddingBottom: 48 },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  backBtn: { padding: 4 },
  headerTitle: { fontSize: 18, fontWeight: '700', color: TOOLBOX_UI.pageTitle },
  card: {
    backgroundColor: TOOLBOX_UI.cardBg,
    borderRadius: TOOLBOX_UI.radius,
    padding: TOOLBOX_UI.padding,
    marginBottom: TOOLBOX_UI.gridGap,
    borderWidth: 1,
    borderColor: '#EEEEEE',
  },
  advancedToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
    paddingVertical: 10,
    paddingHorizontal: 4,
  },
  advancedToggleText: { fontSize: 14, fontWeight: '600', color: TOOLBOX_UI.body },
  weightedIndexBlock: {
    marginTop: 4,
    marginBottom: 8,
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#EEEEEE',
  },
  weightedIndexHero: {
    fontSize: 32,
    fontWeight: '800',
    color: TOOLBOX_UI.primary,
    marginTop: 6,
    letterSpacing: 0.5,
  },
  cardTitle: { fontSize: 16, fontWeight: '700', color: TOOLBOX_UI.cardTitle, marginBottom: 4 },
  prominentWarn: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: 8,
    marginBottom: 12,
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: 10,
    backgroundColor: '#FFF8E6',
    borderWidth: 1,
    borderColor: '#FFD699',
  },
  prominentWarnText: {
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
    color: '#333333',
    lineHeight: 24,
  },
  collapsibleHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingBottom: 4,
  },
  collapsibleInner: {
    marginTop: 4,
  },
  cardResultFollow: {
    marginTop: 12,
  },
  segmentPanel: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#EEEEEE',
  },
  segmentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  segmentLabel: { fontSize: 14, fontWeight: '600', color: TOOLBOX_UI.body },
  segmentSwitch: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E5E5',
    backgroundColor: '#FAFAFA',
  },
  segmentSwitchOn: {
    borderColor: TOOLBOX_UI.primary,
    backgroundColor: '#FFF5EB',
  },
  segmentSwitchText: { fontSize: 14, color: TOOLBOX_UI.secondary },
  segmentSwitchTextOn: { color: TOOLBOX_UI.primary, fontWeight: '700' },
  segmentItem: {
    marginTop: 12,
    padding: 12,
    borderRadius: 8,
    backgroundColor: '#FAFAFA',
    borderWidth: 1,
    borderColor: '#EEEEEE',
  },
  segmentItemTitle: { fontSize: 13, fontWeight: '600', color: TOOLBOX_UI.body, marginBottom: 8 },
  segmentFieldLabel: { fontSize: 11, color: TOOLBOX_UI.secondary, marginBottom: 4 },
  segmentRemove: { marginTop: 8, alignSelf: 'flex-end' },
  segmentRemoveText: { fontSize: 13, color: TOOLBOX_UI.danger },
  segmentAddBtn: {
    marginTop: 12,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: TOOLBOX_UI.primary,
    backgroundColor: '#FFFBF7',
  },
  segmentAddBtnText: { fontSize: 14, fontWeight: '600', color: TOOLBOX_UI.primary },
  historicalPayStrip: {
    marginTop: 4,
    marginBottom: 8,
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#EEEEEE',
  },
  historicalPayLabel: { fontSize: 12, color: TOOLBOX_UI.secondary, marginBottom: 6 },
  historicalPayValue: { fontSize: 18, fontWeight: '700', color: TOOLBOX_UI.primary },
  hint: { fontSize: 12, color: TOOLBOX_UI.secondary, marginBottom: 10 },
  label: { fontSize: 14, color: TOOLBOX_UI.body, marginBottom: 6, marginTop: 8 },
  footHint: { fontSize: 12, color: TOOLBOX_UI.secondary, marginTop: 6 },
  personalPaidStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 10,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#FFF5EB',
    borderWidth: 1,
    borderColor: '#FFE0B2',
  },
  personalPaidStripLabel: { fontSize: 14, fontWeight: '600', color: TOOLBOX_UI.body },
  personalPaidStripValue: { fontSize: 18, fontWeight: '700', color: TOOLBOX_UI.primary },
  personalPaidStripFoot: {
    fontSize: 11,
    color: TOOLBOX_UI.secondary,
    marginTop: 6,
    lineHeight: 16,
  },
  input: {
    borderWidth: 1,
    borderColor: '#E5E5E5',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: TOOLBOX_UI.body,
    minHeight: 44,
  },
  readonlyBox: {
    borderWidth: 1,
    borderColor: '#E5E5E5',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: '#FAFAFA',
  },
  readonlyLabel: { fontSize: 12, color: TOOLBOX_UI.secondary, marginBottom: 6 },
  readonlyText: { fontSize: 15, color: TOOLBOX_UI.secondary },
  hintRed: { fontSize: 12, color: TOOLBOX_UI.danger, marginTop: 10, lineHeight: 18 },
  hintGreen: { fontSize: 12, color: '#2E7D32', marginTop: 10, lineHeight: 18 },
  row2: { flexDirection: 'row', gap: 10 },
  row2Item: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6 },
  unit: { fontSize: 14, color: TOOLBOX_UI.body },
  selectRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#E5E5E5',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    marginBottom: 8,
  },
  selectText: { fontSize: 15, color: TOOLBOX_UI.body, flex: 1 },
  radioRow: { flexDirection: 'row', gap: 10, marginTop: 4 },
  radioChip: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E5E5',
    alignItems: 'center',
  },
  radioChipOn: { borderColor: TOOLBOX_UI.primary, backgroundColor: '#FFF5EB' },
  radioText: { fontSize: 14, color: TOOLBOX_UI.body },
  radioTextOn: { color: TOOLBOX_UI.primary, fontWeight: '600' },
  primaryBtn: {
    backgroundColor: TOOLBOX_UI.primary,
    paddingVertical: 14,
    borderRadius: TOOLBOX_UI.radius,
    alignItems: 'center',
    marginTop: 12,
  },
  primaryBtnDisabled: { opacity: 0.7 },
  primaryBtnText: { fontSize: 14, fontWeight: '700', color: '#fff' },
  resultBlock: { marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#E5E5E5' },
  resultLabel: { fontSize: 12, color: TOOLBOX_UI.secondary },
  resultValue: { fontSize: 18, fontWeight: '700', color: TOOLBOX_UI.primary, marginTop: 4 },
  resultValueSmall: { fontSize: 14, fontWeight: '600', color: TOOLBOX_UI.body, marginTop: 6, lineHeight: 22 },
  resultSubHint: { fontSize: 11, color: TOOLBOX_UI.secondary, marginTop: 4, lineHeight: 16 },
  badge: { marginTop: 14, padding: 12, borderRadius: 8 },
  badgeOk: { backgroundColor: '#E6FFFA' },
  badgeWarn: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#FFE0B2' },
  badgeText: { fontSize: 13, color: TOOLBOX_UI.body, lineHeight: 20 },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    padding: 24,
  },
  modalCard: {
    backgroundColor: '#fff',
    borderRadius: TOOLBOX_UI.radius,
    padding: 16,
    maxHeight: '80%',
  },
  modalTitle: { fontSize: 16, fontWeight: '700', color: TOOLBOX_UI.body, marginBottom: 8 },
  modalRow: { paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#EEE' },
  modalRowText: { fontSize: 15, color: TOOLBOX_UI.body },
  quitBtnCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#E65100',
    paddingVertical: 16,
    paddingHorizontal: 18,
  },
  quitBtnText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#fff',
  },
  quitMedOption: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E5E5',
    alignItems: 'center',
    backgroundColor: '#FAFAFA',
  },
  quitMedOptionActive: {
    borderColor: '#E65100',
    backgroundColor: '#FFF3E0',
  },
  quitMedOptionText: {
    fontSize: 14,
    color: TOOLBOX_UI.body,
  },
  quitMedOptionTextActive: {
    color: '#E65100',
    fontWeight: '700',
  },
  quitResultGrid: {
    gap: 8,
    marginBottom: 4,
  },
  quitResultItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  quitResultLabel: {
    fontSize: 14,
    color: TOOLBOX_UI.body,
  },
  quitResultValue: {
    fontSize: 16,
    fontWeight: '700',
    color: TOOLBOX_UI.primary,
  },
  quitDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#eee',
    marginVertical: 14,
  },
  quitWarnBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#FFF5F5',
    borderRadius: 8,
    padding: 10,
    marginTop: 8,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#FFCDD2',
  },
  quitWarnText: {
    flex: 1,
    fontSize: 13,
    color: '#D32F2F',
    lineHeight: 20,
  },
  quitBaseHint: {
    fontSize: 14,
    fontWeight: '700',
    color: '#E65100',
    marginBottom: 4,
  },
  quitMedHint: {
    fontSize: 13,
    color: '#D32F2F',
    lineHeight: 20,
    marginTop: 6,
    marginBottom: 8,
  },
  quitRefHint: {
    fontSize: 12,
    color: '#888',
    lineHeight: 18,
    marginTop: 2,
    marginBottom: 6,
  },
  quitResultItemTotal: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#eee',
    paddingTop: 10,
    marginTop: 4,
  },
});
