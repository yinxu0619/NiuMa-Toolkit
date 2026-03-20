import React from 'react';
import { Modal, View, Text, Pressable, StyleSheet, Share } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '@/constants/theme';
import type { UnlockedAchievement } from '@/lib/achievementUnlock';

interface Props {
  visible: boolean;
  achievement: UnlockedAchievement | null;
  onClose: () => void;
}

export function AchievementUnlockModal({ visible, achievement, onClose }: Props) {
  if (!achievement) return null;
  const handleShare = () => {
    Share.share({
      message: `解锁勋章：${achievement.title}\n${achievement.desc}`,
      title: achievement.title,
    });
  };
  return (
    <Modal visible={visible} transparent animationType="fade">
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.card} onPress={(e) => e.stopPropagation()}>
          <View style={styles.badge}>
            <Ionicons name="ribbon" size={48} color={COLORS.primary} />
          </View>
          <Text style={styles.title}>{achievement.title}</Text>
          <Text style={styles.desc}>{achievement.desc}</Text>
          <View style={styles.buttons}>
            <Pressable style={styles.shareBtn} onPress={handleShare}>
              <Text style={styles.shareBtnText}>分享勋章</Text>
            </Pressable>
            <Pressable style={styles.closeBtn} onPress={onClose}>
              <Text style={styles.closeBtnText}>关闭</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  card: {
    backgroundColor: COLORS.card,
    borderRadius: 20,
    padding: 28,
    minWidth: 280,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: COLORS.primary,
  },
  badge: { marginBottom: 12, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 20, fontWeight: '700', color: COLORS.primary, marginBottom: 8, textAlign: 'center' },
  desc: { fontSize: 15, color: COLORS.gray, marginBottom: 24, textAlign: 'center' },
  buttons: { flexDirection: 'row', gap: 12 },
  shareBtn: { backgroundColor: COLORS.primary, paddingVertical: 12, paddingHorizontal: 20, borderRadius: 12 },
  shareBtnText: { color: COLORS.onAccent, fontWeight: '600' },
  closeBtn: { paddingVertical: 12, paddingHorizontal: 20, borderRadius: 12, borderWidth: 1, borderColor: COLORS.gray },
  closeBtnText: { color: COLORS.gray, fontWeight: '600' },
});
