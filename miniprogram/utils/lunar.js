// utils/lunar.js - 轻量农历转换（1900-2100）
// 数据来源：公历转农历算法，压缩存储

const lunarInfo = [
  0x04bd8,0x04ae0,0x0a570,0x054d5,0x0d260,0x0d950,0x16554,0x056a0,0x09ad0,0x055d2,
  0x04ae0,0x0a5b6,0x0a4d0,0x0d250,0x1d255,0x0b540,0x0d6a0,0x0ada2,0x095b0,0x14977,
  0x04970,0x0a4b0,0x0b4b5,0x06a50,0x06d40,0x1ab54,0x02b60,0x09570,0x052f2,0x04970,
  0x06566,0x0d4a0,0x0ea50,0x06e95,0x05ad0,0x02b60,0x186e3,0x092e0,0x1c8d7,0x0c950,
  0x0d4a0,0x1d8a6,0x0b550,0x056a0,0x1a5b4,0x025d0,0x092d0,0x0d2b2,0x0a950,0x0b557,
  0x06ca0,0x0b550,0x15355,0x04da0,0x0a5b0,0x14573,0x052b0,0x0a9a8,0x0e950,0x06aa0,
  0x0aea6,0x0ab50,0x04b60,0x0aae4,0x0a570,0x05260,0x0f263,0x0d950,0x05b57,0x056a0,
  0x096d0,0x04dd5,0x04ad0,0x0a4d0,0x0d4d4,0x0d250,0x0d558,0x0b540,0x0b6a0,0x195a6,
  0x095b0,0x049b0,0x0a974,0x0a4b0,0x0b27a,0x06a50,0x06d40,0x0af46,0x0ab60,0x09570,
  0x04af5,0x04970,0x064b0,0x074a3,0x0ea50,0x06b58,0x05ac0,0x0ab60,0x096d5,0x092e0,
  0x0c960,0x0d954,0x0d4a0,0x0da50,0x07552,0x056a0,0x0abb7,0x025d0,0x092d0,0x0cab5,
  0x0a950,0x0b4a0,0x0baa4,0x0ad50,0x055d9,0x04ba0,0x0a5b0,0x15176,0x052b0,0x0a930,
  0x07954,0x06aa0,0x0ad50,0x05b52,0x04b60,0x0a6e6,0x0a4e0,0x0d260,0x0ea65,0x0d530,
  0x05aa0,0x076a3,0x096d0,0x04afb,0x04ad0,0x0a4d0,0x1d0b6,0x0d250,0x0d520,0x0dd45,
  0x0b5a0,0x056d0,0x055b2,0x049b0,0x0a577,0x0a4b0,0x0aa50,0x1b255,0x06d20,0x0ada0,
  0x14b63,0x09370,0x049f8,0x04970,0x064b0,0x168a6,0x0ea50,0x06b20,0x1a6c4,0x0aae0,
  0x092e0,0x0d2e3,0x0c960,0x0d557,0x0d4a0,0x0da50,0x05d55,0x056a0,0x0a6d0,0x055d4,
  0x052d0,0x0a9b8,0x0a950,0x0b4a0,0x0b6a6,0x0ad50,0x055a0,0x0aba4,0x0a5b0,0x052b0,
  0x0b273,0x06930,0x07337,0x06aa0,0x0ad50,0x14b55,0x04b60,0x0a570,0x054e4,0x0d160,
  0x0e968,0x0d520,0x0daa0,0x16aa6,0x056d0,0x04ae0,0x0a9d4,0x0a4d0,0x0d150,0x0f252,
  0x0d520
];

const Gan  = ['甲','乙','丙','丁','戊','己','庚','辛','壬','癸'];
const Zhi  = ['子','丑','寅','卯','辰','巳','午','未','申','酉','戌','亥'];
const Animals = ['鼠','牛','虎','兔','龙','蛇','马','羊','猴','鸡','狗','猪'];
const lunarMonthName = ['正','二','三','四','五','六','七','八','九','十','冬','腊'];
const lunarDayName = [
  '初一','初二','初三','初四','初五','初六','初七','初八','初九','初十',
  '十一','十二','十三','十四','十五','十六','十七','十八','十九','二十',
  '廿一','廿二','廿三','廿四','廿五','廿六','廿七','廿八','廿九','三十'
];

function lYearDays(y) {
  let sum = 348;
  for (let i = 0x8000; i > 0x8; i >>= 1) sum += (lunarInfo[y - 1900] & i) ? 1 : 0;
  return sum + leapDays(y);
}
function leapMonth(y) { return lunarInfo[y - 1900] & 0xf; }
function leapDays(y) {
  if (leapMonth(y)) return (lunarInfo[y - 1900] & 0x10000) ? 30 : 29;
  return 0;
}
function monthDays(y, m) { return (lunarInfo[y - 1900] & (0x10000 >> m)) ? 30 : 29; }

/**
 * 公历转农历
 * @param {number} y 年
 * @param {number} m 月 (1-12)
 * @param {number} d 日
 * @returns {{ year, month, day, isLeap, yearCyl, monCyl, dayCyl }}
 */
function solar2lunar(y, m, d) {
  if (y < 1900 || y > 2100) return null;

  let offset = 0;
  const baseDate = new Date(1900, 0, 31);
  const objDate  = new Date(y, m - 1, d);
  offset = Math.floor((objDate - baseDate) / 86400000);

  let lunarY = 1900, lunarM = 1, lunarD = 1, isLeap = false;
  let isAdd = false;
  let daysInYear;

  for (let i = 1900; i < 2101 && offset > 0; i++) {
    daysInYear = lYearDays(i);
    offset -= daysInYear;
    lunarY = i;
  }
  if (offset < 0) { offset += daysInYear; lunarY--; }

  const leap = leapMonth(lunarY);
  for (let i = 1; i < 13 && offset > 0; i++) {
    if (leap > 0 && i === (leap + 1) && !isAdd) { --i; isAdd = true; }
    const daysInMonth = isAdd ? (leapDays(lunarY) || 29) : monthDays(lunarY, i);
    if (offset < daysInMonth) break;
    offset -= daysInMonth;
    if (isAdd && i === (leap + 1)) isAdd = false;
    lunarM++;
  }

  if (offset === 0 && leap > 0 && lunarM === (leap + 1)) {
    if (isAdd) { isAdd = false; lunarM--; }
    else { isAdd = true; }
  }
  if (offset < 0) { offset += daysInMonth; --lunarM; }

  lunarD = offset + 1;
  if (isAdd) isLeap = true;

  return {
    year: lunarY,
    month: lunarM,
    day: lunarD,
    isLeap,
    yearCyl: (lunarY - 4) % 10,   // 天干索引
    monCyl:  (lunarY - 1900) * 12 + lunarM + 11,
    dayCyl:  Math.floor((Date.UTC(y, m - 1, d) / 86400000) + 25567 + 10),
    ganZhiYear:  Gan[(lunarY - 4) % 10] + Zhi[(lunarY - 4) % 12],
    animal:       Animals[(lunarY - 4) % 12],
    monthStr: (isLeap ? '闰' : '') + lunarMonthName[lunarM - 1] + '月',
    dayStr:  lunarDayName[lunarD - 1],
  };
}

// 法定节假日 & 重要节日
const HOLIDAYS = {
  '01-01': '元旦', '02-14': '情人节', '03-08': '妇女节',
  '03-12': '植树节', '04-01': '愚人节', '05-01': '劳动节',
  '05-04': '青年节', '06-01': '儿童节', '07-01': '建党节',
  '08-01': '建军节', '09-10': '教师节', '10-01': '国庆节',
  '10-31': '万圣节', '12-25': '圣诞节',
};

// 农历节日 → 需每年计算，简化为公历近似
const SOLAR_TERMS = {}; // 暂略，v1 不显示节气

/**
 * 获取某天的完整日期信息
 * @param {number} year
 * @param {number} month (1-12)
 * @param {number} day
 * @returns {{ solar: string, lunar: string, holiday: string, isToday: boolean }}
 */
function getDateInfo(year, month, day) {
  const lunar = solar2lunar(year, month, day);
  const today = new Date();
  const isToday = today.getFullYear() === year &&
                   today.getMonth() + 1 === month &&
                   today.getDate() === day;

  const mStr = String(month).padStart(2, '0');
  const dStr = String(day).padStart(2, '0');
  const holiday = HOLIDAYS[`${mStr}-${dStr}`] || '';

  let lunarText = '';
  if (lunar) {
    // 初一显示月份，其余显示日期
    lunarText = lunar.day === 1 ? lunar.monthStr : lunar.dayStr;
  }

  return {
    fullDate: `${year}-${mStr}-${dStr}`,
    year, month, day,
    lunarText,
    lunarMonthText: lunar ? lunar.monthStr : '',
    ganZhiYear: lunar ? lunar.ganZhiYear : '',
    animal: lunar ? lunar.animal : '',
    holiday,
    isToday,
  };
}

module.exports = { solar2lunar, getDateInfo, lunarDayName, lunarMonthName };
