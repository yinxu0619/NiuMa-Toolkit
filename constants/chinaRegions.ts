/**
 * 全国省级行政区 + 主要城市（本地写死，不联网）
 * 用于 FIRE 参保地二级选择；展示名与社平 JSON 的 key 需一致
 */
export type ChinaRegion = { province: string; cities: string[] };

export const CHINA_REGIONS: ChinaRegion[] = [
  { province: '北京市', cities: ['北京市'] },
  { province: '天津市', cities: ['天津市'] },
  { province: '河北省', cities: ['石家庄市', '唐山市', '秦皇岛市', '邯郸市', '保定市', '廊坊市'] },
  { province: '山西省', cities: ['太原市', '大同市', '阳泉市', '长治市', '晋城市'] },
  { province: '内蒙古自治区', cities: ['呼和浩特市', '包头市', '赤峰市', '鄂尔多斯市'] },
  { province: '辽宁省', cities: ['沈阳市', '大连市', '鞍山市', '抚顺市', '锦州市'] },
  { province: '吉林省', cities: ['长春市', '吉林市', '四平市', '通化市'] },
  { province: '黑龙江省', cities: ['哈尔滨市', '齐齐哈尔市', '大庆市', '牡丹江市'] },
  { province: '上海市', cities: ['上海市'] },
  { province: '江苏省', cities: ['南京市', '无锡市', '徐州市', '常州市', '苏州市', '南通市'] },
  { province: '浙江省', cities: ['杭州市', '宁波市', '温州市', '嘉兴市', '绍兴市', '台州市'] },
  { province: '安徽省', cities: ['合肥市', '芜湖市', '蚌埠市', '阜阳市', '滁州市'] },
  { province: '福建省', cities: ['福州市', '厦门市', '泉州市', '漳州市', '莆田市'] },
  { province: '江西省', cities: ['南昌市', '九江市', '赣州市', '上饶市', '宜春市'] },
  { province: '山东省', cities: ['济南市', '青岛市', '烟台市', '潍坊市', '临沂市', '淄博市'] },
  { province: '河南省', cities: ['郑州市', '洛阳市', '开封市', '新乡市', '南阳市'] },
  { province: '湖北省', cities: ['武汉市', '宜昌市', '襄阳市', '荆州市', '黄冈市'] },
  { province: '湖南省', cities: ['长沙市', '株洲市', '湘潭市', '衡阳市', '岳阳市'] },
  { province: '广东省', cities: ['广州市', '深圳市', '珠海市', '佛山市', '东莞市', '中山市', '惠州市'] },
  { province: '广西壮族自治区', cities: ['南宁市', '柳州市', '桂林市', '北海市', '玉林市'] },
  { province: '海南省', cities: ['海口市', '三亚市', '儋州市'] },
  { province: '重庆市', cities: ['重庆市'] },
  { province: '四川省', cities: ['成都市', '绵阳市', '德阳市', '南充市', '宜宾市'] },
  { province: '贵州省', cities: ['贵阳市', '遵义市', '六盘水市'] },
  { province: '云南省', cities: ['昆明市', '曲靖市', '大理白族自治州'] },
  { province: '西藏自治区', cities: ['拉萨市', '日喀则市'] },
  { province: '陕西省', cities: ['西安市', '咸阳市', '宝鸡市', '榆林市'] },
  { province: '甘肃省', cities: ['兰州市', '天水市', '庆阳市'] },
  { province: '青海省', cities: ['西宁市', '海东市'] },
  { province: '宁夏回族自治区', cities: ['银川市', '石嘴山市', '吴忠市'] },
  { province: '新疆维吾尔自治区', cities: ['乌鲁木齐市', '克拉玛依市', '昌吉回族自治州'] },
];

export function getCitiesForProvince(province: string): string[] {
  return CHINA_REGIONS.find((r) => r.province === province)?.cities ?? [];
}
