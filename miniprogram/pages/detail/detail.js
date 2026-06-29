// pages/detail/detail.js
const db = require('../../utils/db');
const { getCertStatus, daysUntilExpire, formatDateTime } = require('../../utils/date');
const { getColor } = require('../../utils/config');

Page({
  data: {
    statusBarHeight: 44,
    certId: '',
    cert: {},
    heroColor: '#5B6EF5',
    countdownText: '',
    countdownLabel: '',
    countdownType: 'safe',
    historyList: [],
    historyPreview: [],
  },

  onLoad(options) {
    const sys = wx.getWindowInfo();
    this.setData({ certId: options.id, statusBarHeight: sys.statusBarHeight || 44 });
  },

  async onShow() {
    await this.loadDetail();
    await this.loadHistory();
  },

  async loadDetail() {
    try {
      const res = await db.getCertDetail(this.data.certId);
      const cert = res.data;

      let countdownText = '', countdownLabel = '', countdownType = 'safe';
      if (cert.isPermanent) {
        countdownText = '∞'; countdownLabel = '永久有效';
      } else if (!cert.expireDate) {
        countdownText = '-'; countdownLabel = '未设置到期日';
      } else {
        const days = daysUntilExpire(cert.expireDate);
        countdownText = Math.abs(days) + '天';
        countdownLabel = days < 0 ? '已过期' : '距离到期';
        countdownType = days < 0 ? 'danger' : days <= 30 ? 'warn' : 'safe';
      }

      this.setData({
        cert,
        heroColor: getColor(cert.emoji),
        countdownText, countdownLabel, countdownType,
      });
    } catch (err) {
      wx.showToast({ title: '加载失败', icon: 'none' });
    }
  },

  async loadHistory() {
    try {
      const res = await db.getHistory(this.data.certId);
      const list = res.data.map(h => ({ ...h, _time: formatDateTime(h.createTime) }));
      this.setData({ historyList: list, historyPreview: list.slice(0, 2) });
    } catch (err) {
      console.error('加载历史失败:', err);
    }
  },

  goBack() { wx.navigateBack(); },

  previewImage(e) {
    wx.previewImage({ current: this.data.cert.images[e.currentTarget.dataset.index], urls: this.data.cert.images });
  },

  goHistory() { wx.navigateTo({ url: '/pages/history/history?id=' + this.data.certId }); },
  onEdit() { wx.navigateTo({ url: '/pages/cert-form/cert-form?id=' + this.data.certId }); },

  onDelete() {
    wx.showModal({
      title: '确认删除', content: '确定删除这个证照吗？历史记录也会一并清除。', confirmColor: '#F25C5C',
      success: async res => {
        if (res.confirm) {
          try {
            await db.deleteCert(this.data.certId);
            wx.showToast({ title: '已删除', icon: 'success' });
            setTimeout(() => wx.navigateBack(), 500);
          } catch (err) { wx.showToast({ title: '删除失败', icon: 'none' }); }
        }
      },
    });
  },
});
