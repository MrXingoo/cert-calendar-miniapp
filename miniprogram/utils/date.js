// utils/date.js - 日期工具

/**
 * 格式化日期为 YYYY-MM-DD
 */
function formatDate(date) {
  if (!date) return '';
  const d = new Date(date);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * 格式化日期时间为 YYYY-MM-DD HH:mm
 */
function formatDateTime(date) {
  if (!date) return '';
  const d = new Date(date);
  return formatDate(d) + ' ' +
    String(d.getHours()).padStart(2, '0') + ':' +
    String(d.getMinutes()).padStart(2, '0');
}

/**
 * 计算距离到期的天数
 * @returns {number|null} 正数=还有N天到期，负数=已过期N天，null=永久有效或未设置
 */
function daysUntilExpire(expireDate, isPermanent) {
  if (isPermanent || !expireDate) return null;
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const expire = new Date(expireDate);
  expire.setHours(0, 0, 0, 0);
  return Math.ceil((expire - now) / 86400000);
}

/**
 * 获取证照状态
 * @param {object} cert - 证照数据
 * @param {number} [warnDays=30] - 即将到期天数阈值
 * @returns {{ text: string, type: 'normal'|'warn'|'expired' }}
 */
function getCertStatus(cert, warnDays) {
  if (cert.isPermanent) return { text: '永久有效', type: 'normal' };
  if (!cert.expireDate) return { text: '未设置', type: 'normal' };

  const threshold = warnDays || 30;
  const days = daysUntilExpire(cert.expireDate);
  if (days < 0) return { text: '已过期', type: 'expired', countdown: '已过期' + Math.abs(days) + '天' };
  if (days === 0) return { text: '今天到期', type: 'warn', countdown: '今天到期' };
  if (days <= threshold) return { text: days + '天后到期', type: 'warn', countdown: '还有' + days + '天' };
  return { text: '正常', type: 'normal', countdown: '还有' + days + '天' };
}

/**
 * 获取当前时间字符串
 */
function now() {
  return formatDateTime(new Date());
}

module.exports = { formatDate, formatDateTime, daysUntilExpire, getCertStatus, now };
