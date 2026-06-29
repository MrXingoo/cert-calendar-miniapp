// pages/login/login.js
const { login, setUserAvatar } = require('../../utils/auth');

Page({
  data: {
    loading: false,
    agreed: true,
    avatarUrl: '',
  },

  toggleAgree() {
    this.setData({ agreed: !this.data.agreed });
  },

  showAgreement(e) {
    const type = e.currentTarget.dataset.type;
    wx.showModal({
      title: type === 'user' ? '用户协议' : '隐私政策',
      content: type === 'user'
        ? '本小程序仅用于个人证照管理，数据存储在微信云开发环境中，不会向第三方分享您的任何信息。'
        : '您的证照数据仅存储在您的微信云开发环境中，我们不会收集、存储或分享您的个人信息。',
      showCancel: false,
      confirmText: '我知道了',
    });
  },

  onChooseAvatar(e) {
    const url = e.detail.avatarUrl;
    if (url) {
      this.setData({ avatarUrl: url });
      setUserAvatar(url);
    }
  },

  async onLogin() {
    if (!this.data.agreed) {
      wx.showToast({ title: '请先同意用户协议', icon: 'none' });
      return;
    }

    this.setData({ loading: true });

    try {
      await login();
      wx.showToast({ title: '登录成功', icon: 'success' });

      setTimeout(() => {
        wx.switchTab({ url: '/pages/calendar/calendar' });
      }, 500);
    } catch (err) {
      console.error('登录失败：', err);
      wx.showToast({ title: '登录失败，请重试', icon: 'none' });
    } finally {
      this.setData({ loading: false });
    }
  },
});
