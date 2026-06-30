// pages/event-form/event-form.js
const db = require('../../utils/db');
const { getCategories, getCategoryColor } = require('../../utils/config');

Page({
  data: {
    mode: 'add',   // add | edit
    eventId: '',
    saving: false,
    deleting: false,
    categories: [],
    formData: {
      title: '',
      categoryId: '',
      color: '#F25C5C',
      startDate: '',
      endDate: '',
      isAllDay: true,
      remark: '',
      relatedCertId: '',
    },
    certList: [],
    certIndex: -1,
  },

  onLoad(options) {
    const isEdit = !!options.id;
    const defaultDate = options.date || this.todayStr();
    this.setData({
      mode: isEdit ? 'edit' : 'add',
      eventId: options.id || '',
      'formData.startDate': defaultDate,
      'formData.endDate': defaultDate,
      'formData.startWeekday': getWeekdayText(defaultDate),
      'formData.endWeekday': getWeekdayText(defaultDate),
    });
    wx.setNavigationBarTitle({ title: isEdit ? '编辑事件' : '添加事件' });
    this.refreshCategories();
    this.loadCerts();
    if (isEdit) this.loadEvent(options.id);
  },

  onShow() {
    // 从分类管理页返回时刷新
    this.refreshCategories();
  },

  todayStr() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  },

  /** 重新加载分类列表 */
  refreshCategories() {
    const cats = getCategories();
    const cur = this.data.formData.categoryId;
    let catId = cur;
    if (!catId && cats.length > 0) catId = cats[0].id;
    this.setData({
      categories: cats,
      'formData.categoryId': catId,
    });
  },

  async loadCerts() {
    try {
      const list = await db.getCertList();
      this.setData({ certList: list });
      if (this.data.formData.relatedCertId) {
        const idx = list.findIndex(c => c._id === this.data.formData.relatedCertId);
        if (idx >= 0) this.setData({ certIndex: idx });
      }
    } catch (err) { console.error('加载证照失败', err); }
  },

  async loadEvent(id) {
    try {
      const res = await wx.cloud.database().collection('events').doc(id).get();
      const evt = res.data;
      // 优先用 events 自带的 categoryName/Icon（兼容旧数据）
      this.setData({
        formData: {
          title: evt.title || '',
          categoryId: evt.categoryId || '',
          color: evt.color || getCategoryColor(evt.categoryId),
          startDate: evt.startDate || '',
          endDate: evt.endDate || '',
          startWeekday: getWeekdayText(evt.startDate),
          endWeekday: getWeekdayText(evt.endDate),
          isAllDay: evt.isAllDay !== false,
          remark: evt.remark || '',
          relatedCertId: evt.relatedCertId || '',
        },
      });
    } catch (err) {
      wx.showToast({ title: '加载失败', icon: 'none' });
    }
  },

  // ========== 输入处理 ==========

  /** 接收分类管理页新建的分类 ID，自动选中 */
  selectNewCategory(newCatId) {
    this.refreshCategories();
    this.setData({ 'formData.categoryId': newCatId });
    wx.showToast({ title: '已选中新分类', icon: 'success', duration: 1200 });
  },

  onTitleInput(e) {
    this.setData({ 'formData.title': e.detail.value });
  },

  onRemarkInput(e) {
    this.setData({ 'formData.remark': e.detail.value });
  },

  selectCategory(e) {
    const catId = e.currentTarget.dataset.id;
    const cat = this.data.categories.find(c => c.id === catId);
    this.setData({
      'formData.categoryId': catId,
      'formData.color': cat ? cat.color : '#5B6EF5',
    });
  },

  onStartDateChange(e) {
    const v = e.detail.value;
    this.setData({
      'formData.startDate': v,
      'formData.startWeekday': getWeekdayText(v),
    });
    if (!this.data.formData.endDate || this.data.formData.endDate < v) {
      this.setData({
        'formData.endDate': v,
        'formData.endWeekday': getWeekdayText(v),
      });
    }
  },

  onEndDateChange(e) {
    const v = e.detail.value;
    if (this.data.formData.startDate && v < this.data.formData.startDate) {
      wx.showToast({ title: '结束日不能早于开始日', icon: 'none' });
      return;
    }
    this.setData({
      'formData.endDate': v,
      'formData.endWeekday': getWeekdayText(v),
    });
  },

  toggleAllDay() {
    this.setData({ 'formData.isAllDay': !this.data.formData.isAllDay });
  },

  onCertChange(e) {
    const idx = parseInt(e.detail.value);
    const certId = this.data.certList[idx]?._id || '';
    this.setData({ 'formData.relatedCertId': certId, certIndex: idx });
  },

  /** 取消关联证照 */
  onClearCert() {
    this.setData({
      'formData.relatedCertId': '',
      certIndex: -1,
    });
    wx.showToast({ title: '已取消关联', icon: 'none' });
  },

  // ========== 分类管理 ==========

  /** 跳转到分类管理页 */
  goManageCategories() {
    wx.navigateTo({ url: '/pages/category-manage/category-manage' });
  },

  /**
   * 快速新建分类（跳转到分类管理页，进入新建模式）
   * 分类管理页里可以选择名称、颜色、emoji
   */
  quickAddCategory() {
    wx.navigateTo({ url: '/pages/category-manage/category-manage?action=new' });
  },

  // ========== 保存 / 删除 ==========

  async onSave() {
    const { formData, mode, eventId, categories } = this.data;
    if (!formData.title.trim()) {
      wx.showToast({ title: '请输入事件标题', icon: 'none' });
      return;
    }
    if (!formData.startDate) {
      wx.showToast({ title: '请选择开始日期', icon: 'none' });
      return;
    }
    if (!formData.endDate) formData.endDate = formData.startDate;
    if (!formData.categoryId && categories.length > 0) {
      formData.categoryId = categories[0].id;
    }

    this.setData({ saving: true });
    wx.showLoading({ title: '保存中...' });

    try {
      const cat = categories.find(c => c.id === formData.categoryId);
      const data = {
        title: formData.title.trim(),
        categoryId: formData.categoryId,
        categoryName: cat ? cat.name : '',
        // 颜色自动跟分类走
        color: cat ? cat.color : '#5B6EF5',
        startDate: formData.startDate,
        endDate: formData.endDate,
        isAllDay: formData.isAllDay,
        remark: formData.remark,
        relatedCertId: formData.relatedCertId || '',
      };

      if (mode === 'edit') {
        await db.updateEvent(eventId, data);
        wx.hideLoading();
        wx.showToast({ title: '更新成功', icon: 'success' });
      } else {
        await db.addEvent(data);
        wx.hideLoading();
        wx.showToast({ title: '添加成功', icon: 'success' });
      }

      setTimeout(() => {
        wx.navigateBack();
      }, 500);
    } catch (err) {
      wx.hideLoading();
      wx.showToast({ title: '保存失败', icon: 'none' });
      this.setData({ saving: false });
    }
  },

  onDelete() {
    wx.showModal({
      title: '确认删除',
      content: '确定删除该事件吗？',
      confirmColor: '#F25C5C',
      success: async (res) => {
        if (res.confirm) {
          this.setData({ deleting: true });
          try {
            await db.deleteEvent(this.data.eventId);
            wx.showToast({ title: '已删除', icon: 'success' });
            setTimeout(() => wx.navigateBack(), 500);
          } catch (err) {
            wx.showToast({ title: '删除失败', icon: 'none' });
            this.setData({ deleting: false });
          }
        }
      },
    });
  },
});

// ===== 工具函数 =====

const WEEKDAY_NAMES = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

/**
 * 根据日期字符串 YYYY-MM-DD 返回星期文本
 */
function getWeekdayText(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr.replace(/-/g, '/'));
  if (isNaN(d.getTime())) return '';
  return WEEKDAY_NAMES[d.getDay()];
}
