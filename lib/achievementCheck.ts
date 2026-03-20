import type { RecordEntry } from '@/types';
import type { AchievementId } from '@/constants/achievements';

function toDateKey(d: Date) {
  return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
}

function getDayRange(date: Date): [Date, Date] {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  const end = new Date(date);
  end.setHours(23, 59, 59, 999);
  return [start, end];
}

function recordsInDay(records: RecordEntry[], date: Date): RecordEntry[] {
  const [start, end] = getDayRange(date);
  const tStart = start.getTime();
  const tEnd = end.getTime();
  return records.filter((r) => {
    const t = new Date(r.createdAt).getTime();
    return t >= tStart && t <= tEnd;
  });
}

/** 连续 N 天有 offwork 记录 */
function consecutiveOffworkDays(records: RecordEntry[], n: number): boolean {
  const offwork = records.filter((r) => r.category === 'offwork');
  if (offwork.length < n) return false;
  const dates = [...new Set(offwork.map((r) => toDateKey(new Date(r.createdAt))))].sort((a, b) => b - a);
  let streak = 0;
  let expect = dates[0];
  for (const d of dates) {
    if (d === expect) {
      streak++;
      expect = d - 1;
      if (streak >= n) return true;
    } else {
      streak = 1;
      expect = d - 1;
    }
  }
  return streak >= n;
}

export interface CheckInput {
  records: RecordEntry[];
  firstLaunchTime: number | null;
  /** 当前每日通勤分钟（单程），用于 通勤血亏/同城躺赢；若未提供则用 commute 记录推算 */
  commuteMinutesOneWay?: number;
}

/** 返回当前应解锁的勋章 id 列表（不包含已写入 achievement 记录的） */
export function getUnlockedAchievementIds(
  input: CheckInput,
  alreadyUnlocked: Set<AchievementId>
): AchievementId[] {
  const { records, firstLaunchTime } = input;
  const unlocked: AchievementId[] = [];
  const today = new Date();
  const todayRecords = recordsInDay(records, today);

  const toiletTodaySec = todayRecords
    .filter((r) => r.category === 'toilet')
    .reduce((a, r) => a + (r.durationSeconds ?? 0), 0);
  const bailanTodaySec = todayRecords
    .filter((r) => r.category === 'bailan')
    .reduce((a, r) => a + (r.durationSeconds ?? 0), 0);

  const totalToiletBailanSec = records
    .filter((r) => r.category === 'toilet' || r.category === 'bailan')
    .reduce((a, r) => a + (r.durationSeconds ?? 0), 0);

  const coffeeCount = records.filter((r) => r.category === 'coffee').length;
  const snackCount = records.filter((r) => r.category === 'snack').length;
  const chargeCount = records.filter((r) => r.category === 'charge').length;
  const meetingCount = records.filter((r) => r.category === 'meeting').length;
  const meetingMaxBossLoss = Math.max(
    0,
    ...records.filter((r) => r.category === 'meeting').map((r) => r.bossLoss ?? 0)
  );

  const commuteRecords = records.filter((r) => r.category === 'commute');
  const commuteMaxAbs = commuteRecords.length
    ? Math.max(...commuteRecords.map((r) => Math.abs(r.amount)))
    : 0;

  if (!alreadyUnlocked.has('toilet_king') && toiletTodaySec >= 3600) unlocked.push('toilet_king');
  if (!alreadyUnlocked.has('bailan_master') && bailanTodaySec >= 10800) unlocked.push('bailan_master');
  if (!alreadyUnlocked.has('moyu_peak') && totalToiletBailanSec >= 86400) unlocked.push('moyu_peak');
  if (!alreadyUnlocked.has('coffee_king') && coffeeCount >= 30) unlocked.push('coffee_king');
  if (!alreadyUnlocked.has('snack_champ') && snackCount >= 50) unlocked.push('snack_champ');
  if (!alreadyUnlocked.has('charge_master') && chargeCount >= 100) unlocked.push('charge_master');
  if (!alreadyUnlocked.has('meeting_prisoner') && meetingCount >= 10) unlocked.push('meeting_prisoner');
  if (!alreadyUnlocked.has('epic_meeting') && meetingMaxBossLoss >= 500) unlocked.push('epic_meeting');
  if (!alreadyUnlocked.has('offwork_3') && consecutiveOffworkDays(records, 3)) unlocked.push('offwork_3');
  if (!alreadyUnlocked.has('offwork_7') && consecutiveOffworkDays(records, 7)) unlocked.push('offwork_7');
  if (!alreadyUnlocked.has('offwork_30') && consecutiveOffworkDays(records, 30)) unlocked.push('offwork_30');
  if (!alreadyUnlocked.has('commute_blood') && commuteMaxAbs >= 50) unlocked.push('commute_blood');
  if (!alreadyUnlocked.has('commute_win') && commuteRecords.length > 0 && commuteMaxAbs <= 25) unlocked.push('commute_win');
  if (!alreadyUnlocked.has('moyu_lucky') && firstLaunchTime != null && (Date.now() - firstLaunchTime) >= 30 * 86400 * 1000) unlocked.push('moyu_lucky');

  const achievementCount = records.filter((r) => r.category === 'achievement').length;
  if (!alreadyUnlocked.has('full_master') && achievementCount >= 14) unlocked.push('full_master');

  return unlocked;
}
