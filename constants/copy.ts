/** 打工人解压骚话库，弹窗随机抽取 1 条，纯本地 */

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

/** 下班按钮骚话，每次进今日页随机一条 */
export function pickOffworkButton(): string {
  return pick([
    '今天这个 b 班就上到这了',
    '提桶跑路',
    '到点跑路，拒绝内卷',
    '下班打卡 · 下钟',
    '不干了，跑路',
    '到点收工',
    '今日打工已结束，请刷卡',
    '跑路按钮',
  ]);
}

/** 已超过下班时间时的按钮骚话（加班了） */
export function pickOvertimeButtonCopy(): string {
  return pick([
    '今天加班了，记一笔',
    '说好的下班呢？记加班',
    '又加班了，选有偿还是白嫖',
    '加班狗实锤，点我记一笔',
    '加班了，薅回来还是认命',
    '超时了，记有偿/无偿',
  ]);
}

/** 停止加班按钮骚话 */
export function pickStopOvertimeCopy(): string {
  return pick([
    '不干了，收工！',
    '到点收工，结算！',
    '加班结束，记一笔',
    '收工了，算钱！',
    '今天就到这，结算',
  ]);
}

/** 加班结算弹窗标题骚话 */
export function pickOvertimeSettleCopy(): string {
  return pick([
    '加班辛苦了，结算一下',
    '薅到多少算多少～',
    '加班费/白嫖时长确认',
    '收工！记一笔',
  ]);
}

/** 无偿加班进行中提示（被老板白嫖中） */
export const OVERTIME_UNPAID_HINT = '被老板白嫖中';

/** 加班条目编辑保存后的骚话 */
export function pickOvertimeEditSaveCopy(): string {
  return pick([
    '改好了，账已更新～',
    '加班记录已修正！',
    '改完收工，数据已同步',
    '已更新，打工人账本不能错！',
  ]);
}

/** 加班条目删除时的骚话 */
export function pickOvertimeEditDeleteCopy(): string {
  return pick([
    '这条加班记录没了～',
    '已删，当没加过这场班',
    '记录已抹掉，下次记得记',
  ]);
}

/** 统计里删除「今日已薅」条目的骚话 */
export function pickYangmaoDeleteCopy(): string {
  return pick([
    '你以为删了就不承认了么',
    '妹说就是零卡',
    '凉的就是热量低',
    '删了也算薅过，心里有数',
    '掩耳盗铃式删记录～',
  ]);
}

/** 设置里开启「996/007 牛马」时的弹窗 */
export function pickNuclearNiumaEnable(): { title: string; message: string } {
  return pick([
    {
      title: '核动力牛马模式',
      message: '反应堆点火成功。月薪仍按计薪天数摊，但「周末 / 下一工作日」跟你的排班走，卷王请选对档位。',
    },
    {
      title: '⚠️ 核动力已并网',
      message: '检测到高强度牛马。排班一保存，今日页就按你的班表算休息还是上班～',
    },
    {
      title: '007 预备役',
      message: '老板看了都流泪。选好 996/大小周/全勤，咱们按表办事。',
    },
    {
      title: '卷王认证',
      message: '双休？那是什么。选排班吧，系统给你算下一班几时上。',
    },
  ]);
}

/** 纯周末（非法定假、无年假病假）：首页状态卡主文案——月薪÷22 不算双休，不展示「今日已薅」 */
export function pickWeekendEarnedLabel(): string {
  return pick([
    '双休不算发薪日',
    '月薪÷22，周末别碰瓷',
    '今天没有 b 班费',
    '躺平，工资工作日再算',
    '周末白嫖自己的命，不算钱',
    '双休是法定的，日薪不是按天发',
    '牛马周末关机，工资条周一见',
    '今日零元购·班',
  ]);
}

/** 今日病假：首页「爽摸」卡主标题（病假不算薅老板，算养伤回血） */
export function pickSickLeaveShuangmoTitle(): string {
  return pick([
    '牛马养伤中，摸一会儿怎么了',
    '哪有牛马一直跑，今天缓缓',
    '带薪回血模式，这是应得的',
    '病了躺平也是合同里写的',
    '养伤充电中，工资照样到账～',
    '机器都要保养，何况牛马',
  ]);
}

/** 今日病假：爽摸卡底部说明 */
export function pickSickLeaveShuangmoFootnote(): string {
  return pick([
    '病假是权益，跟薅公司零食不是一回事～',
    '不算薅羊毛，算你应得的那份',
    '带薪病假：合法回血，别内疚',
    '真·劳动所得，不是薅老板',
  ]);
}

/** 假期页：病假已休金额下方小字 */
export function pickSickLeaveEarnedHint(): string {
  return pick([
    '哪有牛马一直跑，歇口气天经地义',
    '这钱是你应得的，不算薅到老板',
    '养伤也要吃饭，带薪理所应当',
    '病假不是薅羊毛，是福利该用就用',
  ]);
}

/** 关闭房贷模式时的确认骚话 */
export function pickMortgageOffCopy(): string {
  return pick([
    '无债一身轻！年纪轻轻就摆脱了束缚～',
    '不背房贷的人生，呼吸都是自由的！',
    '关掉房贷，灵魂都轻了三斤！',
    '从此只给老板打工，不帮银行打工～',
    '无债一身轻，摸鱼摸得理直气壮！',
    '年纪轻轻就摆脱了房贷束缚，羡慕了！',
    '关掉房贷模式，今日起只算自己的账～',
  ]);
}

export function pickMortgageDone(): string {
  return pick([
    '今日房贷已还清！剩下的时间纯赚，放心摸鱼！',
    '房贷搞定！打工人今日任务完成，下班自由！',
    '成功上岸！今天的债还清了，快乐属于我！',
    '房贷清零！接下来每一秒都是赚老板的钱！',
    '无债一身轻！摸鱼都比平时香十倍！',
    '今日 KPI：还清房贷√ 剩余时间：摆烂√',
    '房贷已落地，打工变摸鱼，快乐不缺席！',
    '终于不用还债啦！今天是自由的打工人！',
    '房贷搞定！老板的工资，先还我的债！',
    '胜利时刻！今日房贷清零，继续薅秃公司！',
  ]);
}

/** 日历里法定假日格子底下骚话 */
export function pickHolidayCellCopy(): string {
  return pick([
    '赚麻了',
    '带薪放假，血赚',
    '躺着拿日薪',
    '法定带薪，爽',
    '休息还发钱',
  ]);
}

/** 删除支出时的确认骚话（弹窗标题） */
export function pickExpenseDeleteCopy(): string {
  return pick([
    '找到老板报销了？',
    '这笔不算了？',
    '要删掉这条，确定吗？',
    '删了可就没了哦～',
    '钱要回来了？删掉当没花过？',
    '这条支出不认了？',
    '确定要抹掉这条黑历史？',
    '删了可找不回来咯～',
  ]);
}

export function pickExpense(): string {
  return pick([
    '今日白干！打工人打工魂，打工都是人上人（倒贴版）',
    '客户喝过最苦的咖啡，是你自费买的单',
    '职场人情债，全靠工资埋，今日收益清零！',
    '花钱维系关系，用命赚取工资，太难了！',
    '又是倒贴的一天，打工不仅没赚钱，还倒贴！',
    '这班非上不可吗？钱没赚到，先花一堆',
    '含泪记账，打工人的体面，都是自费撑的',
    '工资没到手，支出先到位，纯纯大冤种',
    '职场社交费，打工人的隐形枷锁',
    '今日收益：负数！打工 = 倒贴，鉴定完毕',
    '钱没赚多少，人情花不少，这班谁爱卷谁卷',
    '自费请客，带薪难过，今日白打工',
  ]);
}

export function pickBalanceWin(): string {
  return pick([
    '今日血赚！薅羊毛 + 工资完胜所有支出！',
    '打工人天花板！今天不仅没白干，还赚麻了！',
    '赢麻了！收入碾压支出，快乐起飞！',
    '今日赢家！薅公司的钱，覆盖所有开销！',
    '打工致富不是梦，今日净赚美滋滋！',
  ]);
}

export function pickBalanceFlat(): string {
  return pick([
    '今日保本！不赚不亏，平安下班！',
    '打工人平衡术，收支刚刚好！',
    '不赚不赔，平凡的一天，平安就好！',
    '稳如老狗，今日收支持平，下班！',
    '勉强保本，没倒贴就是胜利！',
  ]);
}

/** 今日结余骚话：正数 / 负数 */
export function getTodayBalanceCopy(balance: number): string {
  if (balance > 0) return pick(['今天没白干～', '今日小赚，可以加个鸡腿', '净结余为正，打工人胜利', '没倒贴就是赢！']);
  if (balance < 0) return pick(['欠钱上班，你可真行', '今日倒贴，打工还债', '越上越欠，绝了', '上班还倒贴钱，服了']);
  return '不赚不亏，平安下班';
}

/** 已薅热量骚话：热量高时提醒 */
export function getCaloriesCopy(calories: number): string {
  if (calories <= 0) return '';
  if (calories >= 600) return pick(['小薅怡情，大薅长肉～', '薅得有点多，明天少吃点？', '热量爆表，运动安排上']);
  if (calories >= 400) return '薅得挺香，注意别长肉～';
  return '';
}

/** 统计页今日净结余底下骚话：按「已赚是否覆盖固定支出」选，确定性（不每秒随机） */
export function getReportBalanceCopy(earned: number, fixed: number): string {
  if (fixed <= 0) return '今日无固定支出，赚的都是自己的～';
  if (earned >= fixed) return '牛棚还清了，剩下的都是饭钱～';
  return '牛棚还没还清，还得赚个饭钱';
}

export function pickBalanceLose(): string {
  return pick([
    '今日白干！不仅没赚钱，还倒贴上班！',
    '打工还债的一天，何时是个头啊！',
    '今日收益：负数，纯纯大冤种打工人',
    '上班倒贴钱，这班是非上不可吗？',
    '今日亏损达成，含泪继续搬砖',
  ]);
}

export function pickLunch(): string {
  return pick([
    '干饭不积极，思想有问题！干饭人冲！',
    '吃饱才有力气摸鱼，午饭必须吃好！',
    '干饭回血，打工不累，快乐干饭！',
    '人间干饭魂，打工也能很开心！',
    '午饭选好，摸鱼没烦恼！',
    '干饭是打工人最后的倔强！',
  ]);
}

export function pickCharge(): string {
  return pick([
    '白嫖公司电费，不薅白不薅！',
    '手机满电，钱包回血，薅电成功！',
    '又薅到公司的电，血赚不亏！',
    '充电五分钟，薅电两小时！',
    '公司电费，我的专属充电宝！',
  ]);
}

export function pickMeeting(): string {
  return pick([
    '带薪坐牢达成，老板烧钱我摸鱼！',
    '无效会议一小时，带薪摸鱼美滋滋！',
    '老板亏钱，我赚钱，会议真香！',
    '主打一个带薪发呆，会议与我无关！',
  ]);
}
