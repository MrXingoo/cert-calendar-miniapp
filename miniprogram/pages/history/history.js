// pages/history/history.js
const db = require('../../utils/db');
const { formatDateTime } = require('../../utils/date');

Page({
  data: {
    certId: '',
    certName: '',
    currentVersion: 1,
    historyList: [],
    loading: true,
  },

  async onLoad(options) {
    this.setData({ certId: options.id });
    await this.loadData();
  },

  async loadData() {
    this.setData({ loading: true });
    try {
      const certRes = await db.getCertDetail(this.data.certId);
      this.setData({
        certName: certRes.data.name,
        currentVersion: certRes.data.currentVersion || 1,
      });

      const histRes = await db.getHistory(this.data.certId);
      const list = histRes.data.map(h => ({
        ...h,
        _time: formatDateTime(h.createTime),
      }));
      this.setData({ historyList: list });
    } catch (err) {
      console.error('加载历史失败：', err);
      wx.showToast({ title: '加载失败', icon: 'none' });
    } finally {
      this.setData({ loading: false });
    }
  },

  goBack() {
    wx.navigateBack();
  },
});
