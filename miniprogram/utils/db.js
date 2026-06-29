// utils/db.js - 数据库操作封装
const db = wx.cloud.database();
const _ = db.command;

// ===== 证照操作 =====

/**
 * 获取证照列表
 * @param {number} warnDays - 即将到期天数（可选，服务端筛选）
 */
function getCertList(tagId, warnDays) {
  const collection = db.collection('certificates');

  if (warnDays && warnDays > 0) {
    const now = new Date();
    const maxDate = new Date(now.getTime() + warnDays * 86400000);
    const nowStr = formatDateStr(now);
    const maxStr = formatDateStr(maxDate);

    // 只用日期筛选（避免 neq 操作符低效），客户端再过滤 isPermanent
    return collection
      .where(_.and([
        { expireDate: _.gte(nowStr) },
        { expireDate: _.lte(maxStr) },
      ]))
      .orderBy('updateTime', 'desc')
      .limit(100)
      .get()
      .then(res => res.data.filter(c => !c.isPermanent));
  }

  return collection.orderBy('updateTime', 'desc').limit(100).get()
    .then(res => res.data)
    .catch(err => {
      console.error('getCertList 失败：', err);
      return [];
    });
}

function getCertDetail(id) {
  return db.collection('certificates').doc(id).get();
}

function addCert(data) {
  return db.collection('certificates').add({
    data: {
      ...data,
      currentVersion: 1,
      tags: data.tags || [],
      createTime: db.serverDate(),
      updateTime: db.serverDate(),
    },
  });
}

function updateCert(id, oldData, newData) {
  const changes = [];
  const fields = {
    name: '名称', obtainDate: '取证日期', expireDate: '到期日期',
    isPermanent: '永久有效', remark: '备注',
  };

  for (const [key, label] of Object.entries(fields)) {
    if (key === 'isPermanent') {
      if (oldData.isPermanent !== newData.isPermanent)
        changes.push({
          field: label,
          old: oldData.isPermanent ? '是' : '否',
          new: newData.isPermanent ? '是' : '否',
        });
    } else {
      const ov = oldData[key] || '', nv = newData[key] || '';
      if (ov !== nv) changes.push({ field: label, old: ov || '(空)', new: nv || '(空)' });
    }
  }

  const oc = (oldData.images || []).length, nc = (newData.images || []).length;
  if (oc !== nc) changes.push({ field: '图片', old: oc + '张', new: nc + '张' });

  const ver = (oldData.currentVersion || 1) + 1;
  if (changes.length > 0) {
    db.collection('cert_history').add({
      data: {
        certId: id, version: ver,
        snapshot: { ...oldData },
        changes, createTime: db.serverDate(),
      },
    });
  }

  // 清理被移除的旧图片
  const oldImages = oldData.images || [];
  const newImages = newData.images || [];
  const removedImages = oldImages.filter(img => !newImages.includes(img));
  if (removedImages.length > 0) {
    wx.cloud.deleteFile({ fileList: removedImages }).catch(err => {
      console.warn('清理旧图片失败:', err);
    });
  }

  return db.collection('certificates').doc(id).update({
    data: { ...newData, currentVersion: ver, updateTime: db.serverDate() },
  });
}

/**
 * 删除证照（含图片和历史清理）
 */
async function deleteCert(id) {
  // 先获取证照数据，拿到关联图片
  let images = [];
  try {
    const certRes = await db.collection('certificates').doc(id).get();
    images = certRes.data.images || [];
  } catch (e) {
    console.warn('获取证照数据失败:', e);
  }

  // 删除云存储图片
  if (images.length > 0) {
    wx.cloud.deleteFile({ fileList: images }).catch(err => {
      console.warn('删除图片失败:', err);
    });
  }

  // 删除历史记录
  db.collection('cert_history').where({ certId: id }).remove();

  // 删除证照
  return db.collection('certificates').doc(id).remove();
}

/**
 * 获取统计（优化：只做 count + 一次列表查询）
 */
async function getCertStats(warnDays) {
  const days = warnDays || 30;
  try {
    const countRes = await db.collection('certificates').count();
    const warnList = await getCertList(null, days);
    return { total: countRes.total, warn: warnList.length };
  } catch (err) {
    console.error('getCertStats 失败：', err);
    return { total: 0, warn: 0 };
  }
}

// ===== 日程事件操作 =====

/**
 * 获取事件列表（按月份，含跨月事件）
 * 只按 startDate 单字段查询，不依赖复合索引
 */
function getEventList(year, month) {
  // 查询范围：上月1号 → 下月1号（覆盖跨月事件）
  const d = new Date(year, month - 1, 1);
  const y = d.getFullYear(), m = d.getMonth(); // 0=Jan
  const startOfPrev = formatDateStr(new Date(y, m - 1, 1));
  const startOfNextTwo = formatDateStr(new Date(y, m + 2, 1));

  return db.collection('events')
    .where({
      startDate: _.and([_.gte(startOfPrev), _.lt(startOfNextTwo)]),
    })
    .orderBy('startDate', 'asc')
    .limit(300)
    .get()
    .then(res => {
      // 客户端过滤：只保留真正覆盖当月的事件
      const soM = formatDateStr(new Date(y, m, 1));
      const eoM = formatDateStr(new Date(y, m + 1, 0));
      return res.data.filter(evt => {
        const end = evt.endDate || evt.startDate;
        return end >= soM && evt.startDate <= eoM;
      });
    })
    .catch(err => {
      if (err.message && err.message.indexOf('collection not exist') >= 0) {
        console.warn('events 集合尚未创建，请在云控制台创建');
        return [];
      }
      console.error('getEventList 失败：', err);
      return [];
    });
}

/**
 * 获取某日期的事件（用于点击日期时弹窗查看）
 * 查询范围：前后 30 天，避免全量扫描
 */
function getEventsByDate(dateStr) {
  const target = new Date(dateStr);
  const rStart = formatDateStr(new Date(target.getTime() - 30 * 86400000));
  const rEnd   = formatDateStr(new Date(target.getTime() + 30 * 86400000));

  return db.collection('events')
    .where({
      startDate: _.and([_.gte(rStart), _.lt(rEnd)]),
    })
    .orderBy('startDate', 'asc')
    .limit(100)
    .get()
    .then(res => {
      return res.data.filter(evt => {
        const end = evt.endDate || evt.startDate;
        return evt.startDate <= dateStr && end >= dateStr;
      });
    })
    .catch(err => {
      console.error('getEventsByDate 失败：', err);
      return [];
    });
}

/**
 * 添加事件
 */
function addEvent(data) {
  return db.collection('events').add({
    data: {
      ...data,
      createTime: db.serverDate(),
      updateTime: db.serverDate(),
    },
  });
}

/**
 * 更新事件
 */
function updateEvent(id, data) {
  return db.collection('events').doc(id).update({
    data: { ...data, updateTime: db.serverDate() },
  });
}

/**
 * 删除事件
 */
function deleteEvent(id) {
  return db.collection('events').doc(id).remove();
}

// ===== 历史记录 =====

function getHistory(certId) {
  return db.collection('cert_history')
    .where({ certId })
    .orderBy('version', 'desc')
    .limit(50)
    .get();
}

// ===== 工具函数 =====

function formatDateStr(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

module.exports = {
  getCertList, getCertDetail, addCert, updateCert, deleteCert, getCertStats,
  getEventList, getEventsByDate, addEvent, updateEvent, deleteEvent,
  getHistory,
  formatDateStr,
};
