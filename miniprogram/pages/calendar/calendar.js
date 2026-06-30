// pages/calendar/calendar.js
const dbUtil = require('../../utils/db');
const { getDateInfo } = require('../../utils/lunar');
const { getCategories, getCategoryColor, getCategoryName } = require('../../utils/config');
const { getUserAvatar, setUserAvatar } = require('../../utils/auth');

const STAT_CAT_KEY = 'calendar_stat_categories';

const db = wx.cloud.database();
const _ = db.command;

Page({
  data: {
    currentYear: 2026,
    currentMonth: 6,
    todayStr: '',
    lunarMonthText: '',
    ganZhiYear: '',
    animal: '',
    weeks: [],         // 6×7 日历矩阵
    eventMap: {},      // { 'YYYY-MM-DD': [eventRaw, ...] }
    categories: [],
    showDayEvents: false,
    dayEvents: [],
    dayEventsDate: '',
    dayEventsDateText: '',
    statusBarHeight: 44,
    // 顶部分类统计
    statCat1: '',      // 分类ID
    statCat2: '',
    statDays1: 0,
    statDays2: 0,
    avatarUrl: '',
  },

  onLoad() {
    const sys = wx.getWindowInfo();
    const now = new Date();
    const cats = getCategories();
    // 胶囊按钮右边缘距屏幕右边缘的距离
    const menuRect = wx.getMenuButtonBoundingClientRect();
    const rightPad = sys.screenWidth - menuRect.right + 20;
    // 读取自选分类，默认取前两个
    let saved = [];
    try { saved = wx.getStorageSync(STAT_CAT_KEY) || []; } catch (e) {}
    const statCat1 = saved[0] || (cats[0] && cats[0].id) || '';
    const statCat2 = saved[1] || (cats[1] && cats[1].id) || '';
    this.setData({
      currentYear: now.getFullYear(),
      currentMonth: now.getMonth() + 1,
      todayStr: this.formatDateStr(now),
      statusBarHeight: sys.statusBarHeight || 44,
      headerRightPad: Math.max(rightPad, 16),
      categories: cats,
      statCat1,
      statCat2,
    });
  },

  onShow() {
    this.setData({ avatarUrl: getUserAvatar() });
    // 刷新分类（用户可能在其他页面修改过）
    const cats = getCategories();
    let { statCat1, statCat2 } = this.data;
    // 如果自选的分类已被删除，回退到前两个
    if (!cats.find(c => c.id === statCat1)) statCat1 = cats[0] ? cats[0].id : '';
    if (!cats.find(c => c.id === statCat2)) statCat2 = cats[1] ? cats[1].id : '';
    if (statCat1 === statCat2) statCat2 = cats.find(c => c.id !== statCat1) ? cats.find(c => c.id !== statCat1).id : '';
    this.setData({ categories: cats, statCat1, statCat2 });
    // 先算一次（显示分类名，天数为0或上次值）
    this.calcStatDays();
    this.loadEvents();
  },

  // ========== 日历构建 ==========

  buildCalendar() {
    const { currentYear: y, currentMonth: m } = this.data;
    const firstDay = new Date(y, m - 1, 1).getDay(); // 0=Sun
    const daysInMonth = new Date(y, m, 0).getDate();
    const startWeekday = (firstDay + 6) % 7; // 周一=0

    // 农历月份信息
    const firstDateInfo = getDateInfo(y, m, 1);
    this.setData({
      lunarMonthText: firstDateInfo.lunarMonthText,
      ganZhiYear: firstDateInfo.ganZhiYear,
      animal: firstDateInfo.animal,
    });

    const cells = [];

    // 上月尾部
    const prevMonth = m === 1 ? 12 : m - 1;
    const prevYear = m === 1 ? y - 1 : y;
    const daysInPrev = new Date(prevYear, prevMonth, 0).getDate();
    for (let i = startWeekday - 1; i >= 0; i--) {
      const d = daysInPrev - i;
      const info = getDateInfo(prevYear, prevMonth, d);
      cells.push(Object.assign({}, info, { isCurrentMonth: false, events: [] }));
    }

    // 当月
    for (let d = 1; d <= daysInMonth; d++) {
      const info = getDateInfo(y, m, d);
      cells.push(Object.assign({}, info, { isCurrentMonth: true, events: [] }));
    }

    // 下月头部（凑 42 格 = 6行）
    const nextMonth = m === 12 ? 1 : m + 1;
    const nextYear = m === 12 ? y + 1 : y;
    let nd = 1;
    while (cells.length < 42) {
      const info = getDateInfo(nextYear, nextMonth, nd);
      cells.push(Object.assign({}, info, { isCurrentMonth: false, events: [] }));
      nd++;
    }

    // 匹配事件到日期格子
    const eventMap = this.data.eventMap;
    for (const cell of cells) {
      if (!cell.isCurrentMonth) continue;
      const key = cell.fullDate;
      if (eventMap[key]) {
        cell.events = eventMap[key].map(evt => {
          // 跨天事件标记
          const startStr = evt.startDate;
          const endStr = evt.endDate || evt.startDate;
          const isStart = key === startStr;
          const isEnd = key === endStr;
          const isSingle = startStr === endStr;
          return {
            _id: evt._id,
            title: evt.title,
            color: evt.color || getCategoryColor(evt.categoryId),
            startDate: evt.startDate,
            endDate: evt.endDate,
            isStart,
            isEnd,
            isSingle,
            // 用于 wxss 类名
            position: isSingle ? 'single' : (isStart ? 'start' : (isEnd ? 'end' : 'middle')),
          };
        });
      }
    }

    // 按7切分为 weeks
    const weeks = [];
    for (let i = 0; i < cells.length; i += 7) {
      weeks.push(cells.slice(i, i + 7));
    }

    this.setData({ weeks });
  },

  // ========== 事件加载 ==========

  async loadEvents() {
    const { currentYear: y, currentMonth: m } = this.data;
    // 如果之前已经因为超时失败过，不再重试，直接渲染空日历
    if (this._eventsLoadFailed) {
      this.setData({ eventMap: {} });
      this.buildCalendar();
      return;
    }
    try {
      const list = await dbUtil.getEventList(y, m);
      this._eventsLoadFailed = false;
      this.buildEventMap(list);
    } catch (err) {
      console.error('加载事件失败：', err);
      this._eventsLoadFailed = true;  // 记住失败，下次不再查
      this.setData({ eventMap: {} });
      this.buildCalendar();
    }
  },

  buildEventMap(list) {
    const eventMap = {};
    for (const evt of list) {
      const start = new Date(evt.startDate);
      const end = new Date(evt.endDate || evt.startDate);
      const cur = new Date(start);
      while (cur <= end) {
        const key = this.formatDateStr(cur);
        if (!eventMap[key]) eventMap[key] = [];
        if (!eventMap[key].find(e => e._id === evt._id)) {
          eventMap[key].push(evt);
        }
        cur.setDate(cur.getDate() + 1);
      }
    }
    this.setData({ eventMap });
    this.buildCalendar();
    this.calcStatDays();
  },

  // 计算两个自选分类在本月的天数
  calcStatDays() {
    const { eventMap, currentYear: y, currentMonth: m, statCat1, statCat2, categories } = this.data;
    const daysInMonth = new Date(y, m, 0).getDate();
    let d1 = 0, d2 = 0;
    for (let d = 1; d <= daysInMonth; d++) {
      const key = this.formatDateStr(new Date(y, m - 1, d));
      const evts = eventMap[key];
      if (!evts || !evts.length) continue;
      if (statCat1 && evts.some(e => e.categoryId === statCat1)) d1++;
      if (statCat2 && evts.some(e => e.categoryId === statCat2)) d2++;
    }
    // 生成分类信息（供 wxml 显示）
    const cat1 = categories.find(c => c.id === statCat1) || { name: '未选择', icon: '○', color: '#fff' };
    const cat2 = categories.find(c => c.id === statCat2) || { name: '未选择', icon: '○', color: '#fff' };
    this.setData({
      statDays1: d1,
      statDays2: d2,
      statCat1Info: { name: cat1.name, icon: cat1.icon, color: cat1.color },
      statCat2Info: { name: cat2.name, icon: cat2.icon, color: cat2.color },
    });
  },

  // 点击统计卡片，选择分类
  onStatCatTap(e) {
    const slot = e.currentTarget.dataset.slot; // '1' or '2'
    const cats = this.data.categories;
    const currentId = slot === '1' ? this.data.statCat1 : this.data.statCat2;
    const itemList = cats.map(c => {
      const days = this._countDaysForCat(c.id);
      return `${c.icon} ${c.name}（${days}天）`;
    });
    wx.showActionSheet({
      itemList,
      success: (res) => {
        const selected = cats[res.tapIndex];
        if (!selected) return;
        const key = slot === '1' ? 'statCat1' : 'statCat2';
        const otherId = slot === '1' ? this.data.statCat2 : this.data.statCat1;
        let newId = selected.id;
        if (newId === otherId) {
          const otherKey = slot === '1' ? 'statCat2' : 'statCat1';
          this.setData({ [key]: newId, [otherKey]: currentId });
        } else {
          this.setData({ [key]: newId });
        }
        try {
          wx.setStorageSync(STAT_CAT_KEY, [this.data.statCat1, this.data.statCat2]);
        } catch (e) {}
        this.calcStatDays();
      },
    });
  },

  // 辅助：计算某分类本月天数
  _countDaysForCat(catId) {
    const { eventMap, currentYear: y, currentMonth: m } = this.data;
    const daysInMonth = new Date(y, m, 0).getDate();
    let count = 0;
    for (let d = 1; d <= daysInMonth; d++) {
      const key = this.formatDateStr(new Date(y, m - 1, d));
      const evts = eventMap[key];
      if (evts && evts.some(e => e.categoryId === catId)) count++;
    }
    return count;
  },

  // ========== 月份切换 ==========

  prevMonth() {
    let { currentYear: y, currentMonth: m } = this.data;
    if (m === 1) { y--; m = 12; }
    else m--;
    this.setData({ currentYear: y, currentMonth: m });
    this.loadEvents();
  },

  nextMonth() {
    let { currentYear: y, currentMonth: m } = this.data;
    if (m === 12) { y++; m = 1; }
    else m++;
    this.setData({ currentYear: y, currentMonth: m });
    this.loadEvents();
  },

  goToday() {
    const now = new Date();
    this.setData({
      currentYear: now.getFullYear(),
      currentMonth: now.getMonth() + 1,
    });
    this.loadEvents();
  },

  // ========== 交互 ==========

  onDayTap(e) {
    const date = e.currentTarget.dataset.date;
    if (!date) return;
    const events = this.data.eventMap[date] || [];
    this.setData({
      showDayEvents: true,
      dayEvents: events,
      dayEventsDate: date,
      dayEventsDateText: date,
    });
  },

  onEventTap(e) {
    const id = e.currentTarget.dataset.id;
    if (!id) return;
    this.setData({ showDayEvents: false });
    wx.navigateTo({ url: '/pages/event-form/event-form?id=' + id });
  },

  closeDayEvents() {
    this.setData({ showDayEvents: false, dayEvents: [] });
  },

  onFabTap() {
    this.setData({ showDayEvents: false });
    wx.navigateTo({ url: '/pages/event-form/event-form?date=' + this.data.todayStr });
  },

  onAddEventForDate() {
    const date = this.data.dayEventsDate || this.data.todayStr;
    this.setData({ showDayEvents: false });
    wx.navigateTo({ url: '/pages/event-form/event-form?date=' + date });
  },

  // ========== 工具 ==========

  formatDateStr(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return y + '-' + m + '-' + d;
  },

  onShareAppMessage() {
    return { title: '证照清单 - 月历', path: '/pages/calendar/calendar' };
  },

  onChooseAvatar(e) {
    const url = e.detail.avatarUrl;
    if (url) {
      this.setData({ avatarUrl: url });
      setUserAvatar(url);
    }
  },
});
