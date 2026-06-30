// pages/category-manage/category-manage.js
const config = require('../../utils/config');

Page({
  data: {
    categories: [],
    editing: null,
    isNew: false,
    colorPalette: config.COLOR_PALETTE,
    showColor: false,
    autoCreate: false,
  },

  onLoad(options) {
    if (options.action === 'new') {
      this.setData({ autoCreate: true });
    }
    this.refreshList();
  },

  onShow() {
    this.refreshList();
  },

  refreshList() {
    const list = config.getCategories();
    this.setData({ categories: list });
    if (this.data.autoCreate) {
      this.setData({ autoCreate: false });
      this.onAdd();
    }
  },

  onAdd() {
    this.setData({
      editing: { id: '', name: '', color: '#6366F1' },
      isNew: true,
      showColor: false,
    });
  },

  onEdit(e) {
    const id = e.currentTarget.dataset.id;
    const cat = this.data.categories.find(c => c.id === id);
    if (!cat) return;
    this.setData({
      editing: Object.assign({}, cat),
      isNew: false,
      showColor: false,
    });
  },

  onNameInput(e) {
    this.setData({ 'editing.name': e.detail.value });
  },

  onColorSelect(e) {
    this.setData({ 'editing.color': e.currentTarget.dataset.color, showColor: false });
  },

  onColorHexInput(e) {
    this.setData({ 'editing.color': e.detail.value });
  },

  toggleColorPicker() {
    this.setData({ showColor: !this.data.showColor });
  },

  onCancelEdit() {
    this.setData({ editing: null, isNew: false });
  },

  onSaveEdit() {
    const ed = this.data.editing;
    if (!ed || !ed.name || !ed.name.trim()) {
      wx.showToast({ title: '请输入分类名称', icon: 'none' });
      return;
    }
    let newId = null;
    if (this.data.isNew) {
      const newCat = config.addCategory({ name: ed.name.trim(), color: ed.color });
      newId = newCat.id;
      wx.showToast({ title: '已添加', icon: 'success' });
    } else {
      config.updateCategory(ed.id, { name: ed.name.trim(), color: ed.color });
      wx.showToast({ title: '已更新', icon: 'success' });
    }
    this.setData({ editing: null, isNew: false });
    this.refreshList();

    if (newId) {
      setTimeout(() => {
        wx.navigateBack({
          success: () => {
            const pages = getCurrentPages();
            const eventForm = pages[pages.length - 1];
            if (eventForm && eventForm.selectNewCategory) {
              eventForm.selectNewCategory(newId);
            }
          },
        });
      }, 500);
    }
  },

  onDelete(e) {
    const id = e.currentTarget.dataset.id;
    const name = e.currentTarget.dataset.name;
    wx.showModal({
      title: '删除分类',
      content: '确定删除「' + name + '」分类吗？该分类下已有事件会变成「未分类」。',
      confirmColor: '#DC2626',
      success: (res) => {
        if (res.confirm) {
          config.deleteCategory(id);
          wx.showToast({ title: '已删除', icon: 'success' });
          this.refreshList();
        }
      },
    });
  },

  onReset() {
    wx.showModal({
      title: '重置分类',
      content: '确定恢复为默认分类吗？自定义分类会被删除。',
      confirmColor: '#DC2626',
      success: (res) => {
        if (res.confirm) {
          config.resetCategories();
          wx.showToast({ title: '已重置', icon: 'success' });
          this.refreshList();
        }
      },
    });
  },

  onBack() {
    wx.navigateBack();
  },
});
