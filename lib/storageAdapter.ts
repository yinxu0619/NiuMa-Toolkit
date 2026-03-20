/**
 * 存储适配层：Expo 用 AsyncStorage，微信小程序用 wx.getStorageSync 等。
 * 应用启动时必须调用 setStorageAdapter 注入实现，否则 storage 会抛错。
 */

export interface IStorageAdapter {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

let adapter: IStorageAdapter | null = null;

export function setStorageAdapter(a: IStorageAdapter): void {
  adapter = a;
}

export function getStorageAdapter(): IStorageAdapter {
  if (adapter == null) {
    throw new Error('Storage adapter not set. Call setStorageAdapter() at app startup (Expo: _layout.tsx, 小程序: app.js).');
  }
  return adapter;
}
