import React, { useState, useCallback } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, ScrollView, Alert, Platform } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { ResultModal } from '@/components/ResultModal';
import { formatMoney } from '@/lib/format';
import { addRecord, loadRecords, loadChargeConfig, saveChargeConfig } from '@/lib/storage';
import { getTodayRange } from '@/lib/today';
import { getRecordsInRange } from '@/lib/storage';
import { pickCharge } from '@/constants/copy';
import { TOOLBOX_UI } from '@/constants/toolboxUI';
import Constants from 'expo-constants';

const VOLTAGE = 3.7; // 手机电池典型电压 V

/** 单次充电成本 元 = (mAh/1000)*3.7/1000 * pricePerKwh */
function chargeCostYuan(mah: number, pricePerKwh: number): number {
  const wh = (mah / 1000) * VOLTAGE;
  return (wh / 1000) * pricePerKwh;
}

/** 等价 10000mAh 充电宝个数（按容量比） */
function equivPowerBank10000(mah: number): number {
  return mah / 10000;
}

function equivPowerBank20000(mah: number): number {
  return mah / 20000;
}

export default function ChargeScreen() {
  const [batteryMah, setBatteryMah] = useState('');
  const [pricePerKwh, setPricePerKwh] = useState('');
  const [todayTotal, setTodayTotal] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [showResult, setShowResult] = useState(false);
  const [lastAmount, setLastAmount] = useState(0);
  const [lastCopy, setLastCopy] = useState('');
  const [saved, setSaved] = useState(false);

  const loadConfig = useCallback(async () => {
    const c = await loadChargeConfig();
    if (c) {
      setBatteryMah(String(c.batteryMah));
      setPricePerKwh(String(c.pricePerKwh));
      setSaved(true);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadConfig();
      (async () => {
        const [start, end] = getTodayRange();
        const records = await getRecordsInRange(start, end);
        const chargeRecords = records.filter((r) => r.category === 'charge');
        setTodayTotal(chargeRecords.reduce((a, r) => a + r.amount, 0));
        const all = await loadRecords();
        setTotalCount(all.filter((r) => r.category === 'charge').length);
      })();
    }, [loadConfig])
  );

  const mah = parseFloat(batteryMah) || 0;
  const price = parseFloat(pricePerKwh) || 0;
  const costOne = chargeCostYuan(mah, price);
  const equiv10 = equivPowerBank10000(mah);
  const equiv20 = equivPowerBank20000(mah);

  const handleSaveConfig = async () => {
    if (mah <= 0 || price <= 0) {
      Alert.alert('提示', '请填写电池容量(mAh)和市电单价(元/kWh)');
      return;
    }
    await saveChargeConfig({ batteryMah: mah, pricePerKwh: price });
    setSaved(true);
    Alert.alert('已保存', '配置已保存，可开始记充电次数');
  };

  const handleRecordCharge = async () => {
    if (mah <= 0 || price <= 0) {
      Alert.alert('请先保存配置', '填写电池容量和市电单价并点击保存');
      return;
    }
    const all = await loadRecords();
    const chargeRecords = all.filter((r) => r.category === 'charge');
    const count = chargeRecords.length + 1;
    const amount = costOne;
    const content = `第 ${count} 次充电，约等价 ${equiv10.toFixed(1)} 个 10000mAh / ${equiv20.toFixed(1)} 个 20000mAh 充电宝`;
    await addRecord({
      category: 'charge',
      amount,
      label: content,
      content,
    });
    setLastAmount(amount);
    setLastCopy(pickCharge());
    setShowResult(true);
    setTotalCount(count);
    setTodayTotal((t) => t + amount);
  };

  const topInset = (Constants.statusBarHeight ?? (Platform.OS === 'ios' ? 44 : 24)) + 12;
  return (
    <ScrollView style={styles.container} contentContainerStyle={[styles.content, { paddingTop: topInset }]}>
      <Text style={styles.hint}>薅公司电费，换算成充电宝数量</Text>
      <Text style={styles.label}>手机电池容量 (mAh)</Text>
      <TextInput
        style={styles.input}
        value={batteryMah}
        onChangeText={setBatteryMah}
        keyboardType="number-pad"
        placeholder="4000"
        placeholderTextColor={TOOLBOX_UI.secondary}
      />
      <Text style={styles.label}>市电单价 (元/kWh)</Text>
      <TextInput
        style={styles.input}
        value={pricePerKwh}
        onChangeText={setPricePerKwh}
        keyboardType="decimal-pad"
        placeholder="0.6"
        placeholderTextColor={TOOLBOX_UI.secondary}
      />
      <Pressable style={styles.configBtn} onPress={handleSaveConfig}>
        <Text style={styles.configBtnText}>{saved ? '更新配置' : '保存配置'}</Text>
      </Pressable>

      {costOne > 0 && (
        <View style={styles.preview}>
          <Text style={styles.previewText}>单次充电约薅：{formatMoney(costOne)}</Text>
          <Text style={styles.previewText}>约等价 {equiv10.toFixed(1)} 个 10000mAh / {equiv20.toFixed(1)} 个 20000mAh 充电宝</Text>
        </View>
      )}

      <View style={styles.todayBar}>
        <Text style={styles.todayLabel}>今日薅电费</Text>
        <Text style={styles.todayValue}>{formatMoney(todayTotal)}</Text>
      </View>
      <Text style={styles.meta}>累计充电 {totalCount} 次</Text>

      <Pressable
        style={[styles.btn, (mah <= 0 || price <= 0) && styles.btnDisabled]}
        onPress={handleRecordCharge}
        disabled={mah <= 0 || price <= 0}
      >
        <Text style={styles.btnText}>记一次充电</Text>
      </Pressable>

      <ResultModal
        visible={showResult}
        line1={lastCopy}
        line2={`本次薅电费 ${formatMoney(lastAmount)}`}
        line3={`累计已薅 ${formatMoney(todayTotal)}（今日）`}
        onClose={() => setShowResult(false)}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: TOOLBOX_UI.bg },
  content: { padding: TOOLBOX_UI.padding, paddingBottom: 48 },
  title: { fontSize: 20, color: TOOLBOX_UI.pageTitle, marginBottom: 8 },
  hint: { fontSize: 14, color: TOOLBOX_UI.cardTitle, marginBottom: 24 },
  label: { fontSize: 16, color: TOOLBOX_UI.cardTitle, marginBottom: 8 },
  input: {
    backgroundColor: TOOLBOX_UI.cardBg,
    borderRadius: TOOLBOX_UI.radius,
    padding: 16,
    fontSize: 18,
    color: TOOLBOX_UI.body,
    marginBottom: 16,
  },
  configBtn: {
    alignSelf: 'flex-start',
    backgroundColor: TOOLBOX_UI.cardBg,
    borderWidth: 1,
    borderColor: TOOLBOX_UI.secondary,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: TOOLBOX_UI.radius,
    marginBottom: 24,
  },
  configBtnText: { color: TOOLBOX_UI.body, fontWeight: '600' },
  preview: { backgroundColor: TOOLBOX_UI.topCardBg, borderRadius: TOOLBOX_UI.radius, padding: 16, marginBottom: 16 },
  previewText: { fontSize: 15, color: TOOLBOX_UI.body, marginBottom: 4 },
  todayBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: TOOLBOX_UI.topCardBg,
    padding: TOOLBOX_UI.topCardPadding,
    borderRadius: TOOLBOX_UI.topCardRadius,
    marginBottom: 8,
  },
  todayLabel: { fontSize: 16, color: TOOLBOX_UI.cardTitle },
  todayValue: { fontSize: 24, fontWeight: '700', color: TOOLBOX_UI.primary },
  meta: { fontSize: 14, color: TOOLBOX_UI.secondary, marginBottom: 24 },
  btn: { backgroundColor: TOOLBOX_UI.primary, paddingVertical: 16, borderRadius: TOOLBOX_UI.radius, alignItems: 'center' },
  btnDisabled: { opacity: 0.5 },
  btnText: { fontSize: 18, fontWeight: '600', color: '#fff' },
});
