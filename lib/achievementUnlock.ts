import { loadRecords, getFirstLaunchTime, setFirstLaunchTimeIfNeeded, addRecord } from '@/lib/storage';
import { getUnlockedAchievementIds } from '@/lib/achievementCheck';
import type { AchievementId } from '@/constants/achievements';
import { ACHIEVEMENTS } from '@/constants/achievements';

export interface UnlockedAchievement {
  id: AchievementId;
  title: string;
  desc: string;
  icon: string;
}

/** 检查并解锁新勋章，返回本次新解锁的列表（并已写入存储） */
export async function checkAndUnlockAchievements(): Promise<UnlockedAchievement[]> {
  await setFirstLaunchTimeIfNeeded();
  const records = await loadRecords();
  const firstLaunch = await getFirstLaunchTime();
  const alreadySet = new Set(
    records.filter((r) => r.category === 'achievement').map((r) => r.label ?? r.title) as AchievementId[]
  );
  const newlyIds = getUnlockedAchievementIds(
    { records, firstLaunchTime: firstLaunch },
    alreadySet
  );
  const result: UnlockedAchievement[] = [];
  for (const id of newlyIds) {
    const def = ACHIEVEMENTS.find((a) => a.id === id);
    if (!def) continue;
    await addRecord({
      category: 'achievement',
      amount: 0,
      label: id,
      title: def.title,
      desc: def.desc,
      icon: def.icon,
    });
    result.push({ id: def.id, title: def.title, desc: def.desc, icon: def.icon });
  }
  return result;
}

/** 已解锁的勋章 id 列表（从记录读取） */
export async function getUnlockedIds(): Promise<Set<AchievementId>> {
  const records = await loadRecords();
  const ids = records
    .filter((r) => r.category === 'achievement')
    .map((r) => (r.label ?? r.title ?? '') as AchievementId)
    .filter(Boolean);
  return new Set(ids);
}
