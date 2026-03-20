import React, { useState, useCallback } from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView, Share, Platform } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { ACHIEVEMENTS, ACHIEVEMENT_COUNT } from '@/constants/achievements';
import { getUnlockedIds } from '@/lib/achievementUnlock';
import type { AchievementId } from '@/constants/achievements';
import { TOOLBOX_UI } from '@/constants/toolboxUI';
import Constants from 'expo-constants';

const ICON_MAP: Record<string, keyof typeof Ionicons.glyphMap> = {
  toilet: 'time',
  bed: 'bed',
  time: 'time',
  cafe: 'cafe',
  nutrition: 'nutrition',
  'battery-charging': 'battery-charging',
  people: 'people',
  flame: 'flame',
  exit: 'exit-outline',
  'shield-checkmark': 'shield-checkmark',
  star: 'star',
  car: 'car',
  home: 'home',
  fish: 'fish',
  trophy: 'trophy',
};

export default function AchievementsScreen() {
  const [unlocked, setUnlocked] = useState<Set<AchievementId>>(new Set());

  useFocusEffect(
    useCallback(() => {
      getUnlockedIds().then(setUnlocked);
    }, [])
  );

  const handleShareWall = () => {
    const list = ACHIEVEMENTS.filter((a) => unlocked.has(a.id))
      .map((a) => `${a.title}：${a.desc}`)
      .join('\n');
    Share.share({ message: `摸鱼勋章墙（${unlocked.size}/${ACHIEVEMENT_COUNT}）\n\n${list}`, title: '勋章墙' });
  };

  const topInset = (Constants.statusBarHeight ?? (Platform.OS === 'ios' ? 44 : 24)) + 12;
  return (
    <ScrollView style={styles.container} contentContainerStyle={[styles.content, { paddingTop: topInset }]}>
      <View style={styles.header}>
        <Text style={styles.subtitle}>已解锁 {unlocked.size} / {ACHIEVEMENT_COUNT} 枚</Text>
        <Pressable style={styles.shareWallBtn} onPress={handleShareWall}>
          <Text style={styles.shareWallBtnText}>一键分享勋章墙</Text>
        </Pressable>
      </View>
      <View style={styles.grid}>
        {ACHIEVEMENTS.map((a) => {
          const isUnlocked = unlocked.has(a.id);
          const iconName = ICON_MAP[a.icon] || 'medal';
          return (
            <View key={a.id} style={[styles.card, !isUnlocked && styles.cardLocked]}>
              <View style={[styles.iconWrap, !isUnlocked && styles.iconWrapLocked]}>
                <Ionicons name={iconName} size={32} color={isUnlocked ? TOOLBOX_UI.primary : TOOLBOX_UI.secondary} />
              </View>
              <Text style={[styles.cardTitle, !isUnlocked && styles.cardTitleLocked]} numberOfLines={1}>
                {a.title}
              </Text>
              <Text style={[styles.cardDesc, !isUnlocked && styles.cardDescLocked]} numberOfLines={2}>
                {a.desc}
              </Text>
              {!isUnlocked && <Text style={styles.lockedLabel}>未解锁</Text>}
            </View>
          );
        })}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: TOOLBOX_UI.bg },
  content: { padding: TOOLBOX_UI.padding, paddingBottom: 48 },
  header: { marginBottom: 24 },
  title: { fontSize: 22, fontWeight: '700', color: TOOLBOX_UI.pageTitle, marginBottom: 4 },
  subtitle: { fontSize: 16, color: TOOLBOX_UI.cardTitle, marginBottom: 16 },
  shareWallBtn: {
    alignSelf: 'flex-start',
    backgroundColor: TOOLBOX_UI.primary,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: TOOLBOX_UI.radius,
  },
  shareWallBtnText: { color: '#fff', fontWeight: '600', fontSize: 14 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  card: {
    width: '47%',
    backgroundColor: TOOLBOX_UI.cardBg,
    borderRadius: TOOLBOX_UI.topCardRadius,
    padding: 16,
    borderWidth: 1,
    borderColor: TOOLBOX_UI.primary,
  },
  cardLocked: { borderColor: 'transparent', opacity: 0.75 },
  iconWrap: { marginBottom: 8 },
  iconWrapLocked: { opacity: 0.5 },
  cardTitle: { fontSize: 15, fontWeight: '600', color: TOOLBOX_UI.body, marginBottom: 4 },
  cardTitleLocked: { color: TOOLBOX_UI.secondary },
  cardDesc: { fontSize: 12, color: TOOLBOX_UI.secondary },
  cardDescLocked: { color: TOOLBOX_UI.secondary, opacity: 0.8 },
  lockedLabel: { fontSize: 11, color: TOOLBOX_UI.secondary, marginTop: 6 },
});
