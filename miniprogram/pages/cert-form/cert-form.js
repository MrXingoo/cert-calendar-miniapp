// pages/cert-form/cert-form.js
const db = require('../../utils/db');
const { guessEmoji } = require('../../utils/config');

Page({
  data: {
    mode: 'add',        // add | edit
    certId: '',
    editData: null,
    dirty: false,
    uploading: false,
    uploadProgress: 0,
    saving: false,
    // 下拉相关
    allCerts: [],
    filteredCerts: [],
    showNameDropdown: false,
    dupCert: null,
    formData: {
      name: '',
      obtainDate: '',
      expireDate: '',
      isPermanent: false,
      images: [],
      remark: '',
    },
  },

  async onLoad(options) {
    const isEdit = !!options.id;
    this.setData({ mode: isEdit ? 'edit' : 'add', certId: options.id || '' });
    wx.setNavigationBarTitle({ title: isEdit ? '更新证照' : '添加证照' });

    await this.loadAllCerts();
    if (isEdit) await this.loadCertData(options.id);
  },

  onShow() {
    if (this.data.mode === 'add' && !this.data.dirty && !this.data.formData.name) {
      this.resetForm();
    }
  },

  onBackPress() {
    if (this.data.dirty) {
      wx.showModal({
        title: '提示', content: '表单已修改，确定放弃吗？',
        confirmText: '放弃', confirmColor: '#F25C5C',
        success: res => { if (res.confirm) wx.navigateBack(); },
      });
      return true;
    }
  },

  async loadAllCerts() {
    try {
      const list = await db.getCertList();
      this.setData({ allCerts: list });
    } catch (err) {
      console.error('加载证照列表失败:', err);
    }
  },

  onNameInput(e) {
    const name = e.detail.value;
    this.setData({ 'formData.name': name, dirty: true });
    this.filterCerts(name);
    this.checkDup(name);
  },

  onNameFocus() {
    this.filterCerts(this.data.formData.name);
  },

  onNameBlur() {
    setTimeout(() => {
      this.setData({ showNameDropdown: false });
    }, 200);
  },

  filterCerts(keyword) {
    if (!keyword || !keyword.trim()) {
      this.setData({ filteredCerts: this.data.allCerts.slice(0, 10), showNameDropdown: this.data.allCerts.length > 0 });
      return;
    }
    const kw = keyword.trim().toLowerCase();
    const filtered = this.data.allCerts.filter(c => c.name.toLowerCase().includes(kw)).slice(0, 10);
    this.setData({ filteredCerts: filtered, showNameDropdown: filtered.length > 0 });
  },

  checkDup(name) {
    if (!name || !name.trim()) {
      this.setData({ dupCert: null });
      return;
    }
    const dup = this.data.allCerts.find(c => c.name === name.trim() && c._id !== this.data.certId);
    this.setData({ dupCert: dup || null });
  },

  selectCert(e) {
    const id = e.currentTarget.dataset.id;
    const cert = this.data.allCerts.find(c => c._id === id);
    if (!cert) return;

    this.setData({
      mode: 'edit',
      certId: cert._id,
      editData: cert,
      dirty: false,
      showNameDropdown: false,
      dupCert: null,
      formData: {
        name: cert.name || '',
        obtainDate: cert.obtainDate || '',
        expireDate: cert.expireDate || '',
        isPermanent: cert.isPermanent || false,
        images: cert.images || [],
        remark: cert.remark || '',
      },
    });
    wx.setNavigationBarTitle({ title: '更新证照' });
    wx.showToast({ title: '已选择该证照', icon: 'none' });
  },

  async loadCertData(id) {
    try {
      const res = await db.getCertDetail(id);
      const cert = res.data;
      this.setData({
        editData: cert, dirty: false,
        formData: {
          name: cert.name || '', obtainDate: cert.obtainDate || '',
          expireDate: cert.expireDate || '', isPermanent: cert.isPermanent || false,
          images: cert.images || [], remark: cert.remark || '',
        },
      });
    } catch (err) {
      wx.showToast({ title: '加载失败', icon: 'none' });
    }
  },

  resetForm() {
    this.setData({
      dirty: false, dupCert: null,
      formData: { name: '', obtainDate: '', expireDate: '', isPermanent: false, images: [], remark: '' },
    });
  },

  onInput(e) {
    this.setData({ ['formData.' + e.currentTarget.dataset.field]: e.detail.value, dirty: true });
  },

  onDateChange(e) {
    const field = e.currentTarget.dataset.field;
    const value = e.detail.value;

    // 日期校验：到期日不能早于取证日
    if (field === 'expireDate' && this.data.formData.obtainDate && value < this.data.formData.obtainDate) {
      wx.showToast({ title: '到期日不能早于取证日', icon: 'none' });
      return;
    }
    if (field === 'obtainDate' && this.data.formData.expireDate && value > this.data.formData.expireDate) {
      wx.showToast({ title: '取证日不能晚于到期日', icon: 'none' });
      return;
    }

    this.setData({ ['formData.' + field]: value, dirty: true });
  },

  togglePermanent() {
    const p = !this.data.formData.isPermanent;
    this.setData({
      'formData.isPermanent': p,
      'formData.expireDate': p ? '' : this.data.formData.expireDate,
      dirty: true,
    });
  },

  chooseImage() {
    const remaining = 3 - this.data.formData.images.length;
    if (remaining <= 0) return;
    wx.chooseMedia({
      count: remaining, mediaType: ['image'], sourceType: ['album', 'camera'],
      success: async res => {
        this.setData({ uploading: true, uploadProgress: 0 });
        const uploaded = [];
        for (let i = 0; i < res.tempFiles.length; i++) {
          let success = false;
          for (let retry = 0; retry < 3 && !success; retry++) {
            try {
              const compressed = await wx.compressImage({ src: res.tempFiles[i].tempFilePath, quality: 70 });
              const ext = compressed.tempFilePath.split('.').pop() || 'jpg';
              const path = `certs/${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;
              const r = await wx.cloud.uploadFile({ cloudPath: path, filePath: compressed.tempFilePath });
              uploaded.push(r.fileID);
              success = true;
            } catch (err) {
              console.error(`上传失败 (第${retry + 1}次):`, err);
              if (retry < 2) await new Promise(r => setTimeout(r, 1000));
            }
          }
          if (!success) wx.showToast({ title: '部分图片上传失败', icon: 'none' });
          this.setData({ uploadProgress: Math.round(((i + 1) / res.tempFiles.length) * 100) });
        }
        this.setData({ 'formData.images': [...this.data.formData.images, ...uploaded], uploading: false, dirty: true });
      },
    });
  },

  removeImage(e) {
    const imgs = [...this.data.formData.images];
    imgs.splice(e.currentTarget.dataset.index, 1);
    this.setData({ 'formData.images': imgs, dirty: true });
  },

  async onSave() {
    const { formData, mode, certId, editData, dupCert } = this.data;
    if (!formData.name.trim()) { wx.showToast({ title: '请输入证照名称', icon: 'none' }); return; }
    if (this.data.uploading) { wx.showToast({ title: '图片上传中', icon: 'none' }); return; }

    let finalMode = mode;
    let finalId = certId;
    let finalEditData = editData;

    if (mode === 'add' && dupCert) {
      finalMode = 'edit';
      finalId = dupCert._id;
      finalEditData = dupCert;
    }

    this.setData({ saving: true });
    wx.showLoading({ title: '保存中...' });

    try {
      const emoji = finalMode === 'edit' ? (finalEditData.emoji || guessEmoji(formData.name)) : guessEmoji(formData.name);
      const data = { ...formData, name: formData.name.trim(), emoji };

      if (finalMode === 'edit') {
        await db.updateCert(finalId, finalEditData, data);
        wx.showToast({ title: '更新成功', icon: 'success' });
      } else {
        await db.addCert(data);
        wx.showToast({ title: '添加成功', icon: 'success' });
      }

      this.setData({ dirty: false });
      setTimeout(() => { this.resetForm(); wx.navigateBack(); }, 500);
    } catch (err) {
      wx.showToast({ title: '保存失败', icon: 'none' });
    } finally {
      wx.hideLoading();
      this.setData({ saving: false });
    }
  },
});
