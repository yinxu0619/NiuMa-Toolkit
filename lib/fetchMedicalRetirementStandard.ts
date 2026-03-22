/**
 * 获取当地职工医保退休需缴满年限（年）：点击按钮时先联网拉 GitHub Raw；
 * 失败或无该城市键时降级为应用内打包表；仍无则返回默认值 25。
 */
import { lookupBundledMedicalRetireYears } from '@/lib/medicalRetireBundled';

const FETCH_TIMEOUT_MS = 10_000;

export const MEDICAL_RETIRE_YEARS_JSON_URL =
  'https://raw.githubusercontent.com/yinxu0619/NiuMa-Toolkit/main/data/medical_retire_years.json';

export const DEFAULT_MEDICAL_RETIRE_YEARS = 25;

export type MedicalRetireFetchResult = {
  years: number;
  /** true：来自本次联网；false：来自本地打包表或默认值 */
  fromRemote: boolean;
};

export async function fetchMedicalRetireYearsForCity(province: string, city: string): Promise<MedicalRetireFetchResult> {
  const key = `${province}|${city}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(MEDICAL_RETIRE_YEARS_JSON_URL, {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    });
    if (res.ok) {
      const data = (await res.json()) as Record<string, number>;
      const v = data[key];
      if (typeof v === 'number' && Number.isFinite(v) && v > 0) {
        return { years: Math.round(v), fromRemote: true };
      }
    }
  } catch {
    /* 网络失败等，走本地表 */
  } finally {
    clearTimeout(timer);
  }

  const local = lookupBundledMedicalRetireYears(province, city);
  if (local != null) {
    return { years: local, fromRemote: false };
  }
  return { years: DEFAULT_MEDICAL_RETIRE_YEARS, fromRemote: false };
}
