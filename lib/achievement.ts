/** 根据摸鱼时长（秒）返回成就文案 */
export function getMoyuAchievement(durationSeconds: number): string {
  const m = durationSeconds / 60;
  if (m < 1) return '摸鱼新手';
  if (m < 5) return '摸鱼入门选手';
  if (m < 15) return '摸鱼达人';
  if (m < 30) return '摸鱼王者';
  if (m < 60) return '摸鱼天尊';
  return '摸鱼传说';
}
