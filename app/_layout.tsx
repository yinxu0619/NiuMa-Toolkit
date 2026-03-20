import { useEffect, useState, useCallback } from 'react';
import { View, Image, Text, Pressable, StyleSheet } from 'react-native';
import { Stack } from 'expo-router';
import { initExpoStorageAdapter } from '@/lib/storageAdapter.expo';
import { SalaryProvider } from '@/contexts/SalaryContext';
import { ToastProvider } from '@/contexts/ToastContext';
import { setFirstLaunchTimeIfNeeded, getShouldShowSplashToday, setSplashShownToday } from '@/lib/storage';
import { seedHolidayDatesIfEmpty } from '@/lib/holidays';

// Expo 端：注入 AsyncStorage，小程序端在 app.js 里注入 wx 存储
initExpoStorageAdapter();

// 开屏图：assets/splash-icon.png
const SPLASH_IMAGE = require('../assets/splash-icon.png');

function FirstSplashOverlay({ onFinish }: { onFinish: () => void }) {
  const [countdown, setCountdown] = useState(3);

  useEffect(() => {
    if (countdown <= 0) {
      onFinish();
      return;
    }
    const t = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown, onFinish]);

  return (
    <View style={styles.overlay}>
      <Image source={SPLASH_IMAGE} style={styles.image} resizeMode="cover" />
      <View style={styles.bottom}>
        <Pressable style={styles.skipBtn} onPress={onFinish}>
          <Text style={styles.skipText}>跳过 {countdown}s</Text>
        </Pressable>
        {countdown > 0 && (
          <Text style={styles.countdownText}>{countdown}</Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#fef3c7',
    zIndex: 9999,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  bottom: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 48,
    alignItems: 'center',
    gap: 16,
  },
  skipBtn: {
    paddingVertical: 10,
    paddingHorizontal: 24,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.2)',
  },
  skipText: {
    fontSize: 15,
    color: '#1f2937',
    fontWeight: '600',
  },
  countdownText: {
    fontSize: 14,
    color: 'rgba(0,0,0,0.5)',
  },
});

export default function RootLayout() {
  const [showFirstSplash, setShowFirstSplash] = useState<boolean | null>(null);

  useEffect(() => {
    setFirstLaunchTimeIfNeeded();
    seedHolidayDatesIfEmpty();
  }, []);

  useEffect(() => {
    getShouldShowSplashToday().then((shouldShow) => {
      setShowFirstSplash(shouldShow);
    });
  }, []);

  const handleSplashFinish = useCallback(async () => {
    await setSplashShownToday();
    setShowFirstSplash(false);
  }, []);

  return (
    <SalaryProvider>
      <ToastProvider>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(tabs)" />
        </Stack>
        {showFirstSplash === true && (
          <FirstSplashOverlay onFinish={handleSplashFinish} />
        )}
      </ToastProvider>
    </SalaryProvider>
  );
}
