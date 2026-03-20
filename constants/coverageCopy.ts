/** 首页「收入覆盖」模块骚话（可随时增删） */

function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

/** 未覆盖状态（红） */
export const COVERAGE_RED_LINES = [
  '还得干啊小老弟，离财务自由还差亿点',
  '班没白上，钱没够花，继续熬吧',
  '今日 KPI：覆盖支出，还差亿口气',
  '别摸了，再摸今天的班白干了',
  '房贷还没赚回来，摸鱼有罪！',
] as const;

/** 完全覆盖状态（绿） */
export const COVERAGE_GREEN_LINES = [
  '无债一身轻！今天的班赚够了！',
  '支出全 cover，摸鱼无罪！',
  '今天的 b 班就上到这，老子不伺候了',
  '房贷通勤全搞定，剩下的都是赚的！',
  '打工人胜利！今天可以开摆了！',
] as const;

/** 斜章文案（红章内） */
export const COVERAGE_STAMP_LINES = [
  '今日 b 班就上到这',
  '老子不伺候了',
  '摸鱼自由达成',
  '无债一身轻',
  '打工人胜利',
] as const;

export function pickCoverageRedCopy(): string {
  return pick(COVERAGE_RED_LINES);
}

export function pickCoverageGreenCopy(): string {
  return pick(COVERAGE_GREEN_LINES);
}

export function pickCoverageStampText(): string {
  return pick(COVERAGE_STAMP_LINES);
}

export const COVERAGE_TOAST = '今日支出全 cover！可以开摆了！';
