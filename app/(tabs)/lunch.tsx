import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ScrollView,
  Platform,
  Alert,
  Modal,
  TouchableOpacity,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { ResultModal } from '@/components/ResultModal';
import { formatMoney } from '@/lib/format';
import { addRecord, getRecordsInRange, deleteRecord, updateRecord } from '@/lib/storage';
import { getTodayRange } from '@/lib/today';
import { pickLunch } from '@/constants/copy';
import { TOOLBOX_UI } from '@/constants/toolboxUI';
import Constants from 'expo-constants';
import { Ionicons } from '@expo/vector-icons';
import type { RecordEntry } from '@/types';

const PRESET_MENU = [
  { name: '外卖盖饭', price: 25 },
  { name: '食堂套餐', price: 18 },
  { name: '拉面', price: 28 },
  { name: '轻食沙拉', price: 35 },
  { name: '麻辣烫', price: 22 },
  { name: '黄焖鸡', price: 26 },
  { name: '饺子', price: 20 },
  { name: '汉堡套餐', price: 32 },
  { name: '自选快餐', price: 24 },
];

export default function LunchScreen() {
  const [customName, setCustomName] = useState('');
  const [customPrice, setCustomPrice] = useState('');
  const [todayTotal, setTodayTotal] = useState(0);
  const [todayList, setTodayList] = useState<RecordEntry[]>([]);
  const [showResult, setShowResult] = useState(false);
  const [lastCopy, setLastCopy] = useState('');
  const [lastAmount, setLastAmount] = useState(0);
  const [lastName, setLastName] = useState('');
  const [editRecord, setEditRecord] = useState<RecordEntry | null>(null);
  const [editName, setEditName] = useState('');
  const [editAmount, setEditAmount] = useState('');
  const [editTime, setEditTime] = useState('');
  /** 随机预览：未确认前不写库 */
  const [randomModalVisible, setRandomModalVisible] = useState(false);
  const [randomPick, setRandomPick] = useState<{ name: string; price: number } | null>(null);

  const fetchToday = useCallback(async () => {
    const [start, end] = getTodayRange();
    const records = await getRecordsInRange(start, end);
    const lunchRecords = records
      .filter((r) => r.category === 'lunch')
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    setTodayList(lunchRecords);
    setTodayTotal(lunchRecords.reduce((a, r) => a + Math.abs(r.amount), 0));
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchToday();
    }, [fetchToday])
  );

  const handlePreset = useCallback(async (name: string, price: number) => {
    await addRecord({
      category: 'lunch',
      amount: -price,
      label: name,
      content: name,
    });
    setLastCopy(pickLunch());
    setLastAmount(price);
    setLastName(name);
    setShowResult(true);
    await fetchToday();
  }, [fetchToday]);

  const rollRandomPick = useCallback(() => {
    const item = PRESET_MENU[Math.floor(Math.random() * PRESET_MENU.length)];
    setRandomPick({ name: item.name, price: item.price });
  }, []);

  const openRandomModal = useCallback(() => {
    const item = PRESET_MENU[Math.floor(Math.random() * PRESET_MENU.length)];
    setRandomPick({ name: item.name, price: item.price });
    setRandomModalVisible(true);
  }, []);

  const confirmRandomPick = useCallback(async () => {
    if (!randomPick) return;
    const { name, price } = randomPick;
    setRandomModalVisible(false);
    setRandomPick(null);
    await handlePreset(name, price);
  }, [randomPick, handlePreset]);

  const dismissRandomModal = useCallback(() => {
    setRandomModalVisible(false);
    setRandomPick(null);
  }, []);

  const handleCustom = async () => {
    const name = customName.trim() || '午饭';
    const price = parseFloat(customPrice) || 0;
    if (price <= 0) return;
    await addRecord({
      category: 'lunch',
      amount: -price,
      label: name,
      content: name,
    });
    setLastCopy(pickLunch());
    setLastAmount(price);
    setLastName(name);
    setShowResult(true);
    setCustomName('');
    setCustomPrice('');
    await fetchToday();
  };

  const openEdit = (r: RecordEntry) => {
    setEditRecord(r);
    setEditName(r.label || r.content || '午饭');
    setEditAmount(String(Math.abs(r.amount)));
    const d = new Date(r.createdAt);
    setEditTime(
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
    );
  };

  const saveEdit = async () => {
    if (!editRecord) return;
    const name = editName.trim() || '午饭';
    const price = parseFloat(editAmount) || 0;
    if (price <= 0) {
      Alert.alert('提示', '请输入有效金额');
      return;
    }
    let createdAt = editRecord.createdAt;
    const t = editTime.trim();
    if (t) {
      const parsed = new Date(t.replace(' ', 'T'));
      if (!isNaN(parsed.getTime())) createdAt = parsed.toISOString();
    }
    await updateRecord(editRecord.id, {
      amount: -price,
      label: name,
      content: name,
      createdAt,
    });
    setEditRecord(null);
    await fetchToday();
  };

  const handleDelete = (r: RecordEntry) => {
    Alert.alert('确定删除该午饭记录？', `${r.label || '午饭'} ${formatMoney(Math.abs(r.amount))}`, [
      { text: '取消', style: 'cancel' },
      {
        text: '删除',
        style: 'destructive',
        onPress: () => {
          setTodayList((prev) => prev.filter((x) => x.id !== r.id));
          deleteRecord(r.id).then(() => fetchToday()).catch(() => fetchToday());
        },
      },
    ]);
  };

  const topInset = (Constants.statusBarHeight ?? (Platform.OS === 'ios' ? 44 : 24)) + 12;
  return (
    <ScrollView style={styles.container} contentContainerStyle={[styles.content, { paddingTop: topInset }]}>
      <Text style={styles.hint}>打工人干饭魂！干饭不积极，思想有问题！</Text>
      <Pressable style={styles.randomBtn} onPress={openRandomModal}>
        <View style={styles.randomBtnRow}>
          <Ionicons name="shuffle-outline" size={22} color="#fff" style={styles.randomBtnIcon} />
          <Text style={styles.randomBtnText}>随机推荐</Text>
        </View>
      </Pressable>
      <Text style={styles.sectionLabel}>今日午饭支出</Text>
      <View style={styles.todayBar}>
        <Text style={styles.todayValue}>{formatMoney(todayTotal)}</Text>
      </View>

      <Text style={styles.sectionLabel}>今日午饭记录</Text>
      {todayList.length === 0 ? (
        <Text style={styles.emptyList}>暂无记录，随机或快捷记一笔吧～</Text>
      ) : (
        todayList.map((r) => (
          <View key={r.id} style={styles.listRow}>
            <View style={styles.listRowMain}>
              <Text style={styles.listName}>{r.label || r.content || '午饭'}</Text>
              <Text style={styles.listAmount}>{formatMoney(Math.abs(r.amount))}</Text>
              <Text style={styles.listTime}>
                {new Date(r.createdAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
              </Text>
            </View>
            <View style={styles.listActions}>
              <TouchableOpacity onPress={() => openEdit(r)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Text style={styles.linkBtn}>编辑</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => handleDelete(r)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Text style={styles.deleteBtn}>删除</Text>
              </TouchableOpacity>
            </View>
          </View>
        ))
      )}

      <Text style={styles.sectionLabel}>快捷选菜</Text>
      <View style={styles.presetGrid}>
        {PRESET_MENU.map((item) => (
          <Pressable
            key={item.name}
            style={styles.presetItem}
            onPress={() => handlePreset(item.name, item.price)}
          >
            <Text style={styles.presetName}>{item.name}</Text>
            <Text style={styles.presetPrice}>{formatMoney(item.price)}</Text>
          </Pressable>
        ))}
      </View>
      <Text style={styles.sectionLabel}>自定义</Text>
      <TextInput
        style={styles.input}
        value={customName}
        onChangeText={setCustomName}
        placeholder="菜品名称"
        placeholderTextColor={TOOLBOX_UI.secondary}
      />
      <TextInput
        style={styles.input}
        value={customPrice}
        onChangeText={setCustomPrice}
        keyboardType="decimal-pad"
        placeholder="金额（元）"
        placeholderTextColor={TOOLBOX_UI.secondary}
      />
      <Pressable
        style={[styles.btn, (parseFloat(customPrice) || 0) <= 0 && styles.btnDisabled]}
        onPress={handleCustom}
        disabled={(parseFloat(customPrice) || 0) <= 0}
      >
        <Text style={styles.btnText}>记一笔</Text>
      </Pressable>

      <Modal visible={randomModalVisible} transparent animationType="fade" onRequestClose={dismissRandomModal}>
        <Pressable style={styles.modalOverlay} onPress={dismissRandomModal}>
          <Pressable style={styles.randomModalCard} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.randomModalTitle}>今日吃啥？</Text>
            <Text style={styles.randomModalHint}>先瞅一眼，不满意再 roll～</Text>
            {randomPick && (
              <View style={styles.randomPickBox}>
                <Text style={styles.randomPickName}>{randomPick.name}</Text>
                <Text style={styles.randomPickPrice}>{formatMoney(randomPick.price)}</Text>
              </View>
            )}
            <Pressable style={styles.randomBtnReroll} onPress={rollRandomPick}>
              <View style={styles.randomModalBtnRow}>
                <Ionicons name="shuffle-outline" size={20} color={TOOLBOX_UI.primary} style={styles.randomBtnIconSm} />
                <Text style={styles.randomBtnRerollText}>再 roll 一把</Text>
              </View>
            </Pressable>
            <Pressable style={styles.randomBtnConfirm} onPress={() => void confirmRandomPick()}>
              <Text style={styles.randomBtnConfirmText}>就他了</Text>
            </Pressable>
            <Pressable style={styles.randomBtnThink} onPress={dismissRandomModal}>
              <Text style={styles.randomBtnThinkText}>容我想想</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={editRecord != null} transparent animationType="fade">
        <Pressable style={styles.modalOverlay} onPress={() => setEditRecord(null)}>
          <Pressable style={styles.modalCard} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.modalTitle}>编辑午饭</Text>
            <Text style={styles.modalLabel}>名称</Text>
            <TextInput
              style={styles.input}
              value={editName}
              onChangeText={setEditName}
              placeholder="菜品名称"
              placeholderTextColor={TOOLBOX_UI.secondary}
            />
            <Text style={styles.modalLabel}>金额（元）</Text>
            <TextInput
              style={styles.input}
              value={editAmount}
              onChangeText={setEditAmount}
              keyboardType="decimal-pad"
              placeholder="金额"
              placeholderTextColor={TOOLBOX_UI.secondary}
            />
            <Text style={styles.modalLabel}>时间（可选）</Text>
            <TextInput
              style={styles.input}
              value={editTime}
              onChangeText={setEditTime}
              placeholder="YYYY-MM-DD HH:mm"
              placeholderTextColor={TOOLBOX_UI.secondary}
            />
            <View style={styles.modalBtns}>
              <Pressable style={styles.modalCancel} onPress={() => setEditRecord(null)}>
                <Text style={styles.modalCancelText}>取消</Text>
              </Pressable>
              <Pressable style={styles.modalSave} onPress={saveEdit}>
                <Text style={styles.modalSaveText}>保存</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <ResultModal
        visible={showResult}
        line1={lastCopy}
        line2={`${lastName} ${formatMoney(lastAmount)}`}
        line3="已记入今日午饭支出"
        onClose={() => setShowResult(false)}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: TOOLBOX_UI.bg },
  content: { padding: TOOLBOX_UI.padding, paddingBottom: 48 },
  hint: { fontSize: 14, color: TOOLBOX_UI.cardTitle, marginBottom: 24 },
  randomBtn: {
    backgroundColor: TOOLBOX_UI.primary,
    paddingVertical: 16,
    borderRadius: TOOLBOX_UI.radius,
    alignItems: 'center',
    marginBottom: 24,
  },
  randomBtnRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  randomBtnIcon: { marginRight: 8 },
  randomBtnIconSm: { marginRight: 8 },
  randomModalBtnRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  randomBtnText: { fontSize: 18, fontWeight: '600', color: '#fff' },
  sectionLabel: { fontSize: 16, color: TOOLBOX_UI.cardTitle, marginBottom: 12 },
  todayBar: { backgroundColor: TOOLBOX_UI.topCardBg, padding: TOOLBOX_UI.padding, borderRadius: TOOLBOX_UI.radius, marginBottom: 20 },
  todayValue: { fontSize: 22, fontWeight: '700', color: TOOLBOX_UI.danger },
  emptyList: { fontSize: 14, color: TOOLBOX_UI.secondary, marginBottom: 16 },
  listRow: {
    backgroundColor: TOOLBOX_UI.cardBg,
    borderRadius: TOOLBOX_UI.radius,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E5E5E5',
  },
  listRowMain: { marginBottom: 8 },
  listName: { fontSize: 15, fontWeight: '600', color: TOOLBOX_UI.body },
  listAmount: { fontSize: 16, fontWeight: '700', color: TOOLBOX_UI.danger, marginTop: 4 },
  listTime: { fontSize: 12, color: TOOLBOX_UI.secondary, marginTop: 2 },
  listActions: { flexDirection: 'row', gap: 16 },
  linkBtn: { fontSize: 14, color: TOOLBOX_UI.primary, fontWeight: '600' },
  deleteBtn: { fontSize: 14, color: TOOLBOX_UI.danger, fontWeight: '600' },
  presetGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 24 },
  presetItem: {
    backgroundColor: TOOLBOX_UI.cardBg,
    padding: 14,
    borderRadius: TOOLBOX_UI.radius,
    minWidth: '30%',
  },
  presetName: { fontSize: 15, color: TOOLBOX_UI.body, fontWeight: '600' },
  presetPrice: { fontSize: 14, color: TOOLBOX_UI.secondary, marginTop: 4 },
  input: {
    backgroundColor: TOOLBOX_UI.cardBg,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E5E5',
    padding: 14,
    fontSize: 16,
    color: TOOLBOX_UI.body,
    marginBottom: 12,
  },
  btn: { backgroundColor: TOOLBOX_UI.primary, paddingVertical: 16, borderRadius: TOOLBOX_UI.radius, alignItems: 'center' },
  btnDisabled: { opacity: 0.5 },
  btnText: { fontSize: 18, fontWeight: '600', color: '#fff' },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    padding: 24,
  },
  modalCard: {
    backgroundColor: TOOLBOX_UI.bg,
    borderRadius: TOOLBOX_UI.radius,
    padding: 20,
  },
  modalTitle: { fontSize: 18, fontWeight: '700', color: TOOLBOX_UI.pageTitle, marginBottom: 12 },
  modalLabel: { fontSize: 13, color: TOOLBOX_UI.cardTitle, marginBottom: 4 },
  modalBtns: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12, marginTop: 8 },
  modalCancel: { paddingVertical: 12, paddingHorizontal: 16 },
  modalCancelText: { fontSize: 16, color: TOOLBOX_UI.secondary },
  modalSave: { backgroundColor: TOOLBOX_UI.primary, paddingVertical: 12, paddingHorizontal: 24, borderRadius: TOOLBOX_UI.radius },
  modalSaveText: { fontSize: 16, fontWeight: '600', color: '#fff' },
  randomModalCard: {
    backgroundColor: TOOLBOX_UI.bg,
    borderRadius: TOOLBOX_UI.topCardRadius,
    padding: 22,
    borderWidth: 1,
    borderColor: '#F0E6D8',
  },
  randomModalTitle: { fontSize: 20, fontWeight: '700', color: TOOLBOX_UI.pageTitle, textAlign: 'center', marginBottom: 6 },
  randomModalHint: { fontSize: 13, color: TOOLBOX_UI.secondary, textAlign: 'center', marginBottom: 18 },
  randomPickBox: {
    backgroundColor: TOOLBOX_UI.topCardBg,
    borderRadius: TOOLBOX_UI.radius,
    padding: 20,
    alignItems: 'center',
    marginBottom: 16,
  },
  randomPickName: { fontSize: 22, fontWeight: '700', color: TOOLBOX_UI.body, marginBottom: 8 },
  randomPickPrice: { fontSize: 18, fontWeight: '600', color: TOOLBOX_UI.primary },
  randomBtnReroll: {
    backgroundColor: '#FFF4E6',
    paddingVertical: 14,
    borderRadius: TOOLBOX_UI.radius,
    alignItems: 'center',
    marginBottom: 10,
    borderWidth: 1,
    borderColor: TOOLBOX_UI.primary,
  },
  randomBtnRerollText: { fontSize: 16, fontWeight: '700', color: TOOLBOX_UI.primary },
  randomBtnConfirm: {
    backgroundColor: TOOLBOX_UI.primary,
    paddingVertical: 14,
    borderRadius: TOOLBOX_UI.radius,
    alignItems: 'center',
    marginBottom: 10,
  },
  randomBtnConfirmText: { fontSize: 16, fontWeight: '700', color: '#fff' },
  randomBtnThink: { paddingVertical: 12, alignItems: 'center' },
  randomBtnThinkText: { fontSize: 15, color: TOOLBOX_UI.secondary, fontWeight: '500' },
});
