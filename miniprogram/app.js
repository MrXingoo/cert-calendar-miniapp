// app.js - 应用入口
App({
  onLaunch() {
    // 初始化云开发
    if (!wx.cloud) {
      console.error('请使用 2.2.3 以上的基础库');
      return;
    }
    wx.cloud.init({
      env: 'cloud1-d2giyw4idd29474cd',
      traceUser: true,
    });

  },

  globalData: {
    userInfo: null,
    openid: null,
    isLoggedIn: false,
  },
});
