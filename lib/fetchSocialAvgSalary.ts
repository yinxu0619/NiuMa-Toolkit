/**
 * 主动获取社平工资：点击按钮时先尝试联网拉 GitHub Raw；
 * 失败或远程无该城市键时，降级为应用内打包表（与节假日「失败可继续用」一致）。
 */
import { lookupBundledSocialAvg } from '@/lib/socialAvgBundled';

const FETCH_TIMEOUT_MS = 10_000;

/** 与 README 仓库一致；有网时优先用远程最新表 */
export const SOCIAL_AVG_SALARY_JSON_URL =
  'https://raw.githubusercontent.com/yinxu0619/NiuMa-Toolkit/main/data/social_avg_salary.json';

export type SocialSalaryFetchResult = {
  annualYuan: number;
  /** true：来自本次联网；false：来自本地打包表（网络失败或远程无该键） */
  fromRemote: boolean;
};

/**
 * 按「省|市」取上年社平（元/年）。
 * 远程成功 → 用远程；否则用本地打包表；仍无则抛错。
 */
export async function fetchSocialAvgSalaryForCity(province: string, city: string): Promise<SocialSalaryFetchResult> {
  const key = `${province}|${city}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(SOCIAL_AVG_SALARY_JSON_URL, {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    });
    if (res.ok) {
      const data = (await res.json()) as Record<string, number>;
      const v = data[key];
      if (typeof v === 'number' && Number.isFinite(v) && v > 0) {
        return { annualYuan: Math.round(v), fromRemote: true };
      }
    }
  } catch {
    /* 网络失败、超时、解析错误等，走本地表 */
  } finally {
    clearTimeout(timer);
  }

  const local = lookupBundledSocialAvg(province, city);
  if (local != null) {
    return { annualYuan: local, fromRemote: false };
  }
  throw new Error('暂无该城市数据');
}
