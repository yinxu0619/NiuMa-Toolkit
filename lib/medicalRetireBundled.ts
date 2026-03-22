/**
 * 应用内打包的职工医保退休缴费年限参考（年），与 data/medical_retire_years.json 同源。
 */
import bundled from '../data/medical_retire_years.json';

const TABLE = bundled as Record<string, number>;

export function lookupBundledMedicalRetireYears(province: string, city: string): number | null {
  const key = `${province}|${city}`;
  const v = TABLE[key];
  if (typeof v !== 'number' || !Number.isFinite(v) || v <= 0) return null;
  return Math.round(v);
}
