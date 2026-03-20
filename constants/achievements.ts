/** 勋章 id，与解锁条件一一对应 */
export type AchievementId =
  | 'toilet_king'
  | 'bailan_master'
  | 'moyu_peak'
  | 'coffee_king'
  | 'snack_champ'
  | 'charge_master'
  | 'meeting_prisoner'
  | 'epic_meeting'
  | 'offwork_3'
  | 'offwork_7'
  | 'offwork_30'
  | 'commute_blood'
  | 'commute_win'
  | 'moyu_lucky'
  | 'full_master';

export interface AchievementDef {
  id: AchievementId;
  title: string;
  desc: string;
  icon: string; // 图标名，用于展示
}

export const ACHIEVEMENTS: AchievementDef[] = [
  { id: 'toilet_king', title: '带薪如厕王者', desc: '厕所是我家，赚钱靠大家', icon: 'toilet' },
  { id: 'bailan_master', title: '职业摆烂大师', desc: '只要我摆得够快，工作就追不上我', icon: 'bed' },
  { id: 'moyu_peak', title: '摸鱼时长巅峰', desc: '合法摸鱼，老板含泪买单', icon: 'time' },
  { id: 'coffee_king', title: '咖啡续命王者', desc: '公司咖啡，我的生命源泉', icon: 'cafe' },
  { id: 'snack_champ', title: '零食扫荡冠军', desc: '公司下午茶，养活我全家', icon: 'nutrition' },
  { id: 'charge_master', title: '电力白嫖专家', desc: '公司电费，不薅白不薅', icon: 'battery-charging' },
  { id: 'meeting_prisoner', title: '会议坐牢专业户', desc: '主打带薪坐牢，绝不发言', icon: 'people' },
  { id: 'epic_meeting', title: '史诗级亏钱大会见证官', desc: '全场我最闲，老板烧钱我看戏', icon: 'flame' },
  { id: 'offwork_3', title: '到点跑路达人', desc: '下班不积极，思想有问题', icon: 'exit' },
  { id: 'offwork_7', title: '拒绝内卷模范', desc: '到点关机，下班无罪', icon: 'shield-checkmark' },
  { id: 'offwork_30', title: '天选打工人', desc: '卷王退散，准时下班第一人', icon: 'star' },
  { id: 'commute_blood', title: '通勤血亏选手', desc: '上班先亏 50 块，为爱发电', icon: 'car' },
  { id: 'commute_win', title: '同城躺赢赢家', desc: '上班近 = 多摸 1 小时鱼', icon: 'home' },
  { id: 'moyu_lucky', title: '摸鱼锦鲤附体', desc: '天天摸鱼，天天开心', icon: 'fish' },
  { id: 'full_master', title: '打工人满级大佬', desc: '打工界天花板，全成就达成', icon: 'trophy' },
];

export const ACHIEVEMENT_COUNT = ACHIEVEMENTS.length;
