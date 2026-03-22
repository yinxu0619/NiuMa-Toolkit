/**
 * 联网更新医保参保地系数表（与社平拉取一致：先远程，失败用本地打包表）
 * 国内 GitHub Raw 常不可用，故依次尝试多个地址。
 */
import type { MedicalRegionCoeff } from '@/lib/medicalRegionCoefficients';
import { setRemoteMedicalCoefficients } from '@/lib/medicalRegionCoefficients';

const FETCH_TIMEOUT_MS = 10_000;

const PATH = 'data/medical_region_coefficients.json';

/** 与仓库一致；若 fork 了项目，可改此处或优先使用第二镜像 */
const MEDICAL_REGION_COEFF_URLS = [
  `https://raw.githubusercontent.com/yinxu0619/NiuMa-Toolkit/main/${PATH}`,
  `https://cdn.jsdelivr.net/gh/yinxu0619/NiuMa-Toolkit@main/${PATH}`,
] as const;

/** @deprecated 使用 MEDICAL_REGION_COEFF_URLS */
export const MEDICAL_REGION_COEFF_JSON_URL = MEDICAL_REGION_COEFF_URLS[0];

export type MedicalCoeffFetchResult = {
  /** 本次是否成功从网络拉取并写入会话内覆盖表 */
  fromRemote: boolean;
};

function normalizeTable(raw: unknown): Record<string, MedicalRegionCoeff> | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const out: Record<string, MedicalRegionCoeff> = {};
  for (const [k, v] of Object.entries(o)) {
    if (k === 'default' || !v || typeof v !== 'object') continue;
    const row = v as Record<string, unknown>;
    const m = row.maleRetireYears;
    const f = row.femaleRetireYears;
    const mode = row.flexibleMedicalBaseMode;
    if (
      typeof m === 'number' &&
      typeof f === 'number' &&
      (mode === 'fixed_100' || mode === 'range_60_300')
    ) {
      out[k] = {
        maleRetireYears: Math.round(m),
        femaleRetireYears: Math.round(f),
        flexibleMedicalBaseMode: mode,
      };
    }
  }
  const def = o.default as Record<string, unknown> | undefined;
  if (def && typeof def.maleRetireYears === 'number') {
    const m = Math.round(def.maleRetireYears as number);
    const f =
      typeof def.femaleRetireYears === 'number' && Number.isFinite(def.femaleRetireYears)
        ? Math.round(def.femaleRetireYears as number)
        : m;
    out.default = {
      maleRetireYears: m,
      femaleRetireYears: f,
      flexibleMedicalBaseMode:
        def.flexibleMedicalBaseMode === 'fixed_100' ? 'fixed_100' : 'range_60_300',
    };
  }
  return Object.keys(out).length ? out : null;
}

async function tryFetchOne(url: string): Promise<Record<string, MedicalRegionCoeff> | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) return null;
    const data = await res.json();
    return normalizeTable(data);
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * 依次尝试多个镜像；均失败时返回 fromRemote:false，测算仍用 App 内打包表。
 */
export async function fetchMedicalRegionCoefficientsFromRemote(): Promise<MedicalCoeffFetchResult> {
  for (const url of MEDICAL_REGION_COEFF_URLS) {
    const table = await tryFetchOne(url);
    if (table) {
      setRemoteMedicalCoefficients(table);
      return { fromRemote: true };
    }
  }
  return { fromRemote: false };
}
