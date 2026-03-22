/**
 * 应用内打包的社平参考表（与 data/social_avg_salary.json 同源）。
 * 联网失败时「获取」按钮仍可从本地表填入，避免 GitHub Raw 不可达时完全不可用。
 */
import bundled from '../data/social_avg_salary.json';

const TABLE = bundled as Record<string, number>;

export function lookupBundledSocialAvg(province: string, city: string): number | null {
  const key = `${province}|${city}`;
  const v = TABLE[key];
  if (typeof v !== 'number' || !Number.isFinite(v) || v <= 0) return null;
  return Math.round(v);
}
