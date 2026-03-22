/**
 * 医保参保地系数：退休年限（男女）、灵活就业医保缴费基数规则
 */
import bundled from '../data/medical_region_coefficients.json';

export type FlexibleMedicalBaseMode = 'fixed_100' | 'range_60_300';

export type MedicalRegionCoeff = {
  maleRetireYears: number;
  femaleRetireYears: number;
  flexibleMedicalBaseMode: FlexibleMedicalBaseMode;
};

const TABLE = bundled as Record<string, MedicalRegionCoeff>;

const FALLBACK: MedicalRegionCoeff = {
  maleRetireYears: 25,
  femaleRetireYears: 25,
  flexibleMedicalBaseMode: 'range_60_300',
};

/** 远程拉取后合并（会话内有效） */
let remoteOverride: Record<string, MedicalRegionCoeff> | null = null;

export function setRemoteMedicalCoefficients(data: Record<string, MedicalRegionCoeff> | null): void {
  remoteOverride = data;
}

export function getMedicalRegionCoeff(province: string, city: string): MedicalRegionCoeff {
  const key = `${province}|${city}`;
  if (remoteOverride && remoteOverride[key]) return remoteOverride[key];
  if (TABLE[key]) return TABLE[key];
  return TABLE.default ?? FALLBACK;
}

export function getRequiredRetireYearsForGender(coeff: MedicalRegionCoeff, gender: 'male' | 'female'): number {
  return gender === 'male' ? coeff.maleRetireYears : coeff.femaleRetireYears;
}
