import React from 'react';
import {
  Modal,
  View,
  Text,
  Pressable,
  StyleSheet,
  Share,
  Platform,
} from 'react-native';
import { COLORS } from '@/constants/theme';

interface ResultModalProps {
  visible: boolean;
  /** 第一行：本次带薪摸鱼时长 */
  line1: string;
  /** 第二行：合法赚回老板金额 */
  line2: string;
  /** 第三行：摸鱼成就 */
  line3: string;
  onClose: () => void;
  /** 一键保存图片：先做分享文案，后续可接截图 */
  onSaveImage?: () => void;
  shareMessage?: string;
}

export function ResultModal({
  visible,
  line1,
  line2,
  line3,
  onClose,
  onSaveImage,
  shareMessage,
}: ResultModalProps) {
  const handleSave = async () => {
    if (onSaveImage) {
      onSaveImage();
      return;
    }
    const msg = shareMessage || `${line1}\n${line2}\n${line3}`;
    try {
      await Share.share({
        message: msg,
        title: '摸鱼成果',
        ...(Platform.OS === 'ios' && { dialogTitle: '保存或分享' }),
      });
    } catch {
      // ignore
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.card} onPress={(e) => e.stopPropagation()}>
          <Text style={styles.line1}>{line1}</Text>
          <Text style={styles.line2}>{line2}</Text>
          <Text style={styles.line3}>{line3}</Text>
          <View style={styles.buttons}>
            <Pressable style={[styles.btn, styles.btnSave]} onPress={handleSave}>
              <Text style={styles.btnSaveText}>一键保存图片</Text>
            </Pressable>
            <Pressable style={[styles.btn, styles.btnClose]} onPress={onClose}>
              <Text style={styles.btnCloseText}>关闭</Text>
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
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  card: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 24,
    minWidth: 280,
    alignItems: 'center',
  },
  line1: { fontSize: 15, color: COLORS.gray, marginBottom: 8, textAlign: 'center' },
  line2: { fontSize: 22, fontWeight: '700', color: COLORS.primary, marginBottom: 8, textAlign: 'center' },
  line3: { fontSize: 16, color: COLORS.text, marginBottom: 24, textAlign: 'center' },
  buttons: { flexDirection: 'row', gap: 12 },
  btn: { paddingVertical: 12, paddingHorizontal: 20, borderRadius: 12 },
  btnSave: { backgroundColor: COLORS.primary },
  btnSaveText: { color: COLORS.onAccent, fontWeight: '600', fontSize: 15 },
  btnClose: { backgroundColor: 'transparent', borderWidth: 1, borderColor: COLORS.gray },
  btnCloseText: { color: COLORS.gray, fontWeight: '600', fontSize: 15 },
});
