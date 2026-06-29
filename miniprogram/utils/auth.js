// utils/auth.js - 登录鉴权工具
const app = getApp();

const TOKEN_KEY = 'login_token';
const TOKEN_TIME_KEY = 'login_time';
const TOKEN_EXPIRE_MS = 7 * 24 * 60 * 60 * 1000; // 7天过期

/**
 * 微信登录，获取 openid
 * 优先用本地缓存，其次用云函数 login，最后 fallback 到 cloud.getWXContext
 * @returns {Promise<string>} openid
 */
function login() {
  // 1. 本地已有缓存，直接返回
  const cached = wx.getStorageSync('openid');
  const loginTime = wx.getStorageSync(TOKEN_TIME_KEY);
  if (cached && loginTime && (Date.now() - loginTime < TOKEN_EXPIRE_MS)) {
    app.globalData.openid = cached;
    app.globalData.isLoggedIn = true;
    return Promise.resolve(cached);
  }

  // 2. 尝试云函数登录（带超时保护，3 秒内无响应则走本地 fallback）
  let resolved = false;
  return new Promise((resolve) => {
    // 超时保护：3 秒后若云函数无响应，走本地 fallback
    const timeoutId = setTimeout(() => {
      if (resolved) return;
      resolved = true;
      console.warn('login 云函数超时，使用本地标识');
      const fallbackId = _getFallbackId();
      _setLogin(fallbackId);
      resolve(fallbackId);
    }, 3000);

    wx.cloud.callFunction({
      name: 'login',
      success: res => {
        if (resolved) return;
        resolved = true;
        clearTimeout(timeoutId);
        const openid = res.result && res.result.openid;
        if (openid) {
          _setLogin(openid);
          resolve(openid);
        } else {
          const fallbackId = _getFallbackId();
          _setLogin(fallbackId);
          resolve(fallbackId);
        }
      },
      fail: () => {
        if (resolved) return;
        resolved = true;
        clearTimeout(timeoutId);
        console.warn('login 云函数不可用，使用本地标识');
        const fallbackId = _getFallbackId();
        _setLogin(fallbackId);
        resolve(fallbackId);
      },
    });
  });
}

/**
 * 检查登录态，未登录或过期则跳转登录页
 */
function checkLogin() {
  const openid = wx.getStorageSync('openid');
  const loginTime = wx.getStorageSync(TOKEN_TIME_KEY);

  if (!openid || !loginTime || (Date.now() - loginTime > TOKEN_EXPIRE_MS)) {
    clearLogin();
    wx.redirectTo({ url: '/pages/login/login' });
    return false;
  }

  if (!app.globalData.openid) {
    app.globalData.openid = openid;
    app.globalData.isLoggedIn = true;
  }
  return true;
}

/**
 * 清除登录态
 */
function clearLogin() {
  app.globalData.openid = null;
  app.globalData.isLoggedIn = false;
  wx.removeStorageSync('openid');
  wx.removeStorageSync(TOKEN_TIME_KEY);
}

function getOpenid() {
  return app.globalData.openid || wx.getStorageSync('openid');
}

function getUserAvatar() {
  return app.globalData.avatarUrl || wx.getStorageSync('avatarUrl') || '';
}

function setUserAvatar(url) {
  app.globalData.avatarUrl = url;
  wx.setStorageSync('avatarUrl', url);
}

// ===== 内部 =====

function _setLogin(openid) {
  app.globalData.openid = openid;
  app.globalData.isLoggedIn = true;
  wx.setStorageSync('openid', openid);
  wx.setStorageSync(TOKEN_TIME_KEY, Date.now());
}

function _getFallbackId() {
  // 用设备信息生成一个稳定标识，作为无云函数时的 openid
  let id = wx.getStorageSync('_fallback_openid');
  if (!id) {
    try {
      const sys = wx.getSystemInfoSync();
      id = 'local_' + (sys.model || '') + '_' + Date.now();
      // 取 hash 防止过长
      id = 'local_' + _simpleHash(id);
    } catch (e) {
      id = 'local_' + Date.now();
    }
    wx.setStorageSync('_fallback_openid', id);
  }
  return id;
}

function _simpleHash(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
  }
  return Math.abs(hash).toString(36);
}

module.exports = { login, checkLogin, clearLogin, getOpenid, getUserAvatar, setUserAvatar };
