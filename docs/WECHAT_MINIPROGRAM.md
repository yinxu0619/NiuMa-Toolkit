# 微信小程序接入说明（wechat-support）

本仓库已做**存储适配**，核心逻辑（types、lib、constants、storage）可在微信小程序里复用，只需在小程序端注入 wx 的存储实现即可。

---

## 一、你这边要改的

### 1. 小程序项目里注入存储适配器

在**小程序入口**（如 `app.js` 或 `app.ts`）**最先**执行里注册 wx 存储，再加载任何用到 `@/lib/storage` 的页面/逻辑：

```js
// app.js（微信小程序入口）
const { setStorageAdapter } = require('./lib/storageAdapter'); // 或你拷贝过去的路径

const wxStorage = {
  getItem(key) {
    return Promise.resolve(wx.getStorageSync(key) ?? null);
  },
  setItem(key, value) {
    return new Promise((resolve, reject) => {
      wx.setStorage({ key, data: value, success: resolve, fail: reject });
    });
  },
  removeItem(key) {
    return new Promise((resolve, reject) => {
      wx.removeStorage({ key, success: resolve, fail: reject });
    });
  },
};

setStorageAdapter(wxStorage);
```

如果用 **Taro**，在 `app.tsx` 里同样在最早时机（如 `componentWillMount` 或顶层）调用一次 `setStorageAdapter(wxStorage)`，实现方式同上（`Taro.getStorageSync` / `Taro.setStorage` 等）。

---

### 2. 复用哪些代码（拷贝或 monorepo 引用）

以下目录/文件**无 React Native / Expo 依赖**，可整份拷贝到小程序项目，或通过 monorepo 子包引用：

| 路径 | 说明 |
|------|------|
| `types/index.ts` | 类型定义（RecordEntry、TimeConfig、SalaryConfig 等） |
| `constants/theme.ts` | 主题色、DEFAULT_WORK_DAYS 等 |
| `constants/copy.ts` | 骚话文案（pickOffworkButton、pickMortgageDone 等） |
| `constants/achievements.ts` | 勋章配置（若小程序要做勋章） |
| `lib/format.ts` | formatMoney、formatDuration 等 |
| `lib/salary.ts` | 时薪/秒薪计算（依赖 types、workTime） |
| `lib/workTime.ts` | 上下班/午休时段、workedSecondsToday 等 |
| `lib/mortgage.ts` | 月供/日供、还款进度（getRepaymentProgress） |
| `lib/holidays.ts` | 法定假日、fetchHolidayDatesFromRemote、isTodayHoliday 等 |
| `lib/retirement.ts` | 退休倒计时 |
| `lib/today.ts` | getTodayRange 等 |
| `lib/storageAdapter.ts` | **仅此文件**：接口 + setStorageAdapter / getStorageAdapter |
| `lib/storage.ts` | 所有 load/save（loadSalaryConfig、loadRecords、addRecord 等） |

**不要拷贝**：

- `lib/storageAdapter.expo.ts`（仅 Expo 用，依赖 AsyncStorage）
- `app/`、`contexts/`、`components/`（RN/Expo 组件，需用小程序/Taro 重写页面）

拷贝后注意：

- 小程序若不用 TypeScript，可只拷 `.ts` 后改成 `.js` 或用 Taro/小程序自带的 ts 支持。
- 路径别名：把 `@/types`、`@/lib`、`@/constants` 在小程序里配成对应目录（或改成相对路径）。

---

### 3. 小程序端怎么用

- **配置**：调用 `loadSalaryConfig()`、`loadTimeConfig()`、`loadVacationConfig()` 等，和 Expo 端一致；数据会存在 wx 的本地存储里。
- **记录**：`addRecord()`、`getRecordsInRange()`、`loadRecords()` 等照常使用。
- **计算**：`secondWageWithTime()`、`workedSecondsToday()`、`getNextHoliday()`、`getRepaymentProgress()` 等纯函数直接调。

页面和交互用**小程序原生或 Taro** 自己写，只复用上面的类型、常量和 lib 里的逻辑即可。

---

## 二、Expo 端（本仓库）已做的兼容

- **`lib/storageAdapter.ts`**：定义 `IStorageAdapter`（getItem/setItem/removeItem），以及 `setStorageAdapter` / `getStorageAdapter`。
- **`lib/storage.ts`**：不再直接依赖 `AsyncStorage`，全部改为通过 `getStorageAdapter()` 读写。
- **`lib/storageAdapter.expo.ts`**：用 AsyncStorage 实现上述接口，在 **`app/_layout.tsx`** 里调用 `initExpoStorageAdapter()`，在进入任何页面之前完成注入。

这样同一套 `lib/storage.ts` 和业务逻辑在 Expo 和微信小程序里都能用，只是**存储实现**在两端各注一次即可。

---

## 三、建议的小程序目录结构（参考）

```
miniprogram/
  app.js          # 里面对 setStorageAdapter(wxStorage) 一次
  lib/            # 从本仓库拷贝 types、constants、lib（不含 storageAdapter.expo）
  pages/          # 你自己用 wxml 或 Taro 写的页面
  ...
```

若用 **Taro**，可把 `lib`、`types`、`constants` 放到 `src` 下，在 `src/app.tsx` 里注入 wx 存储适配器，页面里 `import { loadSalaryConfig, ... } from '@/lib/storage'` 等与 Expo 一致。

---

## 四、数据 key 一致

两边用同一套 key（如 `dgrtoolbox_records`、`niuma_time` 等），这样若以后做「导出/导入」或同步，数据格式一致。key 都定义在 `lib/storage.ts` 里，无需在小程序里再写一遍。

---

总结：**你只需在小程序入口注册一次 wx 的存储适配器，并复用本仓库的 types、constants、lib（含 storageAdapter 与 storage），页面和 UI 按小程序/Taro 重做即可。**
