// pages/index/index.js
const { checkLogin, getUserAvatar, setUserAvatar } = require('../../utils/auth');
const db = require('../../utils/db');
const { getCertStatus } = require('../../utils/date');
const { getColor } = require('../../utils/config');

const WARN_DAYS_KEY = 'warn_days';

Page({
  data: {
    stats: { total: 0, warn: 0 },
    certList: [],
    filterStatus: 'all',
    filterText: '',
    loading: true,
    avatarUrl: '',
    showDropdown: false,
    warnDays: 30,
    warnOptions: [
      { value: 30, label: '1个月内' },
      { value: 60, label: '2个月内' },
      { value: 90, label: '3个月内' },
      { value: 180, label: '半年内' },
      { value: 365, label: '一年内' },
    ],
    keyword: '',
    statusBarHeight: 44,
  },

  onLoad() {
    const sys = wx.getWindowInfo();
    this.setData({ statusBarHeight: sys.statusBarHeight || 44 });
  },

  onShow() {
    if (!checkLogin()) return;
    this.setData({ avatarUrl: getUserAvatar() });

    // 恢复上次选择的 warnDays
    const saved = wx.getStorageSync(WARN_DAYS_KEY);
    if (saved) this.setData({ warnDays: saved });

    this.loadData();
  },

  // 下拉刷新
  onPullDownRefresh() {
    this.loadData().finally(() => wx.stopPullDownRefresh());
  },

  async loadData() {
    this.setData({ loading: true });
    try {
      const stats = await db.getCertStats(this.data.warnDays);
      this.setData({ stats });
      await this.loadCertList();
    } catch (err) {
      console.error('加载失败：', err);
    } finally {
      this.setData({ loading: false });
    }
  },

  async loadCertList() {
    const { filterStatus, warnDays, keyword } = this.data;
    try {
      let list = await db.getCertList(
        null,
        filterStatus === 'warn' ? warnDays : null
      );

      // 关键词搜索
      if (keyword && keyword.trim()) {
        const kw = keyword.trim().toLowerCase();
        list = list.filter(c => c.name.toLowerCase().includes(kw));
      }

      list = list.map(cert => ({
        ...cert,
        _status: getCertStatus(cert, warnDays),
        _color: getColor(cert.emoji),
      }));

      this.setData({ certList: list });
    } catch (err) {
      console.error('加载列表失败：', err);
    }
  },

  // 搜索
  onSearchInput(e) {
    this.setData({ keyword: e.detail.value });
    this.loadCertList();
  },

  clearSearch() {
    this.setData({ keyword: '' });
    this.loadCertList();
  },

  onFilterTap() {
    this.setData({ filterStatus: 'all', filterText: '', showDropdown: false });
    this.loadCertList();
  },

  onWarnCardTap() {
    if (this.data.filterStatus === 'warn') {
      this.setData({ showDropdown: !this.data.showDropdown });
    } else {
      this.setData({ filterStatus: 'warn', showDropdown: false });
      this.updateFilterText();
      this.loadCertList();
    }
  },

  selectDays(e) {
    const days = parseInt(e.currentTarget.dataset.days);
    this.setData({ warnDays: days, filterStatus: 'warn', showDropdown: false });
    wx.setStorageSync(WARN_DAYS_KEY, days);
    this.updateFilterText();
    this.loadData();
  },

  closeDropdown() {
    this.setData({ showDropdown: false });
  },

  updateFilterText() {
    const label = this.data.warnOptions.find(o => o.value === this.data.warnDays)?.label || '';
    this.setData({ filterText: '即将到期：' + label });
  },

  clearFilter() {
    this.setData({ filterStatus: 'all', filterText: '', showDropdown: false });
    this.loadCertList();
  },

  goDetail(e) {
    wx.navigateTo({ url: '/pages/detail/detail?id=' + e.currentTarget.dataset.id });
  },

  goAdd() {
    wx.navigateTo({ url: '/pages/cert-form/cert-form' });
  },

  onChooseAvatar(e) {
    const url = e.detail.avatarUrl;
    if (url) {
      this.setData({ avatarUrl: url });
      setUserAvatar(url);
    }
  },
});
