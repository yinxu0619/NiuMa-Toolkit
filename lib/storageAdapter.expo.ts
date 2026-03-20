/**
 * Expo/React Native 存储实现，使用 AsyncStorage。
 * 在 app/_layout.tsx 里调用 initExpoStorageAdapter() 即可。
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { setStorageAdapter, type IStorageAdapter } from './storageAdapter';

const expoAdapter: IStorageAdapter = {
  getItem: (key: string) => AsyncStorage.getItem(key),
  setItem: (key: string, value: string) => AsyncStorage.setItem(key, value),
  removeItem: (key: string) => AsyncStorage.removeItem(key),
};

export function initExpoStorageAdapter(): void {
  setStorageAdapter(expoAdapter);
}
