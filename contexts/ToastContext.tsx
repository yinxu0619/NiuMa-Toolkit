import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';

type ToastContextValue = {
  show: (message: string) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

const TOAST_DURATION = 2200;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [message, setMessage] = useState<string | null>(null);
  const opacity = React.useRef(new Animated.Value(0)).current;

  const show = useCallback((msg: string) => {
    setMessage(msg);
  }, []);

  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => setMessage(null), TOAST_DURATION);
    return () => clearTimeout(timer);
  }, [message]);

  useEffect(() => {
    if (!message) {
      opacity.setValue(0);
      return;
    }
    Animated.sequence([
      Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
      Animated.delay(TOAST_DURATION - 400),
      Animated.timing(opacity, { toValue: 0, duration: 200, useNativeDriver: true }),
    ]).start();
  }, [message, opacity]);

  return (
    <ToastContext.Provider value={{ show }}>
      <View style={styles.wrap}>
        {children}
        {message != null && (
          <Animated.View style={[styles.toast, { opacity }]} pointerEvents="none">
            <Text style={styles.toastText}>{message}</Text>
          </Animated.View>
        )}
      </View>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) return { show: () => {} };
  return ctx;
}

const styles = StyleSheet.create({
  wrap: { flex: 1 },
  toast: {
    position: 'absolute',
    top: 56,
    left: 20,
    right: 20,
    alignItems: 'center',
    zIndex: 9999,
  },
  toastText: {
    backgroundColor: 'rgba(0,0,0,0.78)',
    color: '#fff',
    fontSize: 14,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    overflow: 'hidden',
  },
});
