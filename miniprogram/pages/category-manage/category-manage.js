// pages/category-manage/category-manage.js
const config = require('../../utils/config');

Page({
  data: {
    categories: [],
    editing: null,   // 当前编辑的分类对象（null=未编辑）
    isNew: false,    // 是否是新建
    colorPalette: config.COLOR_PALETTE,
    emojiOptions: config.EMOJI_OPTIONS,
    showEmoji: false,
    showColor: false,
    hasChanges: false,
    autoCreate: false,  // 是否自动打开新建弹层
  },

  onLoad(options) {
    // 如果是 action=new，直接进入新建态
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

    // 首次进入且 autoCreate=true → 自动打开新建弹层
    if (this.data.autoCreate) {
      this.setData({ autoCreate: false });
      this.onAdd();
    }
  },

  // ========== 新建 ==========

  onAdd() {
    this.setData({
      editing: {
        id: '',
        name: '',
        color: '#5B6EF5',
        icon: '●',
      },
      isNew: true,
      showEmoji: false,
      showColor: false,
    });
  },

  // ========== 编辑 ==========

  onEdit(e) {
    const id = e.currentTarget.dataset.id;
    const cat = this.data.categories.find(c => c.id === id);
    if (!cat) return;
    this.setData({
      editing: Object.assign({}, cat),
      isNew: false,
      showEmoji: false,
      showColor: false,
    });
  },

  onNameInput(e) {
    this.setData({ 'editing.name': e.detail.value });
  },

  onColorSelect(e) {
    const color = e.currentTarget.dataset.color;
    this.setData({ 'editing.color': color, showColor: false });
  },

  onColorHexInput(e) {
    this.setData({ 'editing.color': e.detail.value });
  },

  toggleColorPicker() {
    this.setData({ showColor: !this.data.showColor, showEmoji: false });
  },

  onEmojiSelect(e) {
    const icon = e.currentTarget.dataset.icon;
    this.setData({ 'editing.icon': icon, showEmoji: false });
  },

  toggleEmojiPicker() {
    this.setData({ showEmoji: !this.data.showEmoji, showColor: false });
  },

  // ========== 保存 / 取消 ==========

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
      const newCat = config.addCategory({
        name: ed.name.trim(),
        color: ed.color,
        icon: ed.icon,
      });
      newId = newCat.id;
      wx.showToast({ title: '已添加', icon: 'success' });
    } else {
      config.updateCategory(ed.id, {
        name: ed.name.trim(),
        color: ed.color,
        icon: ed.icon,
      });
      wx.showToast({ title: '已更新', icon: 'success' });
    }
    this.setData({ editing: null, isNew: false });
    this.refreshList();

    // 如果是「+ 新建」入口来的（autoCreate 触发的），保存后自动返回
    if (newId) {
      setTimeout(() => {
        wx.navigateBack({
          success: () => {
            // 通过事件通道通知事件编辑页选中新分类
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

  // ========== 删除 ==========

  onDelete(e) {
    const id = e.currentTarget.dataset.id;
    const name = e.currentTarget.dataset.name;
    wx.showModal({
      title: '删除分类',
      content: `确定删除「${name}」分类吗？该分类下已有事件会变成「未分类」。`,
      confirmColor: '#F25C5C',
      success: (res) => {
        if (res.confirm) {
          config.deleteCategory(id);
          wx.showToast({ title: '已删除', icon: 'success' });
          this.refreshList();
        }
      },
    });
  },

  // ========== 重置 ==========

  onReset() {
    wx.showModal({
      title: '重置分类',
      content: '确定恢复为默认分类吗？您自定义的分类会被删除。',
      confirmColor: '#F25C5C',
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
