// utils/config.js - 共享常量配置

// ===== 证照相关 =====
// 第五套：纯 Unicode 几何符号，扁平一致，无平台差异

const COLOR_MAP = {
  '▣': '#6366F1', '◈': '#10B981', '▸': '#F59E0B', '◆': '#8B9CF7',
  '◉': '#EF4444', '▤': '#F59E0B', '⬡': '#10B981', '◉': '#1E293B',
  '▥': '#EA580C', '△': '#14B8A6', '⬢': '#2563EB', '⚡': '#DC2626',
  '★': '#8B5CF6', '◎': '#64748B', '●': '#8e8e93',
};

const EMOJI_RULES = [
  [['身份证', 'ID', '居民'], '▣'],
  [['护照', 'passport'], '◈'],
  [['驾照', '驾驶证', '行驶证', '机动车'], '▸'],
  [['毕业', '学位', '学历'], '◆'],
  [['社保', '医保', '社保卡'], '◉'],
  [['营业执照', '执照', '经营'], '▤'],
  [['健康', '体检', '健康证'], '⬡'],
  [['保险', '保单'], '◉'],
  [['房产', '不动产', '房屋'], '▥'],
  [['签证', 'visa', '出境'], '△'],
  [['海员', '适任', '船员'], '⬢'],
  [['特种', '操作', '安全'], '⚡'],
  [['资格', '执业', '从业'], '★'],
  [['发票', '票据', '收据'], '◎'],
];

function guessEmoji(name) {
  if (!name) return '●';
  for (const [keys, emoji] of EMOJI_RULES) {
    if (keys.some(k => name.includes(k))) return emoji;
  }
  return '●';
}

function getColor(emoji) {
  return COLOR_MAP[emoji] || '#8e8e93';
}

// ===== 事件分类配置 =====
// 第五套：纯几何符号

const DEFAULT_CATEGORIES = [
  { id: 'work',     name: '工作',   color: '#DC2626', icon: '⬢' },
  { id: 'vacation', name: '休假',   color: '#059669', icon: '◎' },
  { id: 'exam',     name: '考试',   color: '#6366F1', icon: '◆' },
  { id: 'personal', name: '个人',   color: '#D97706', icon: '◉' },
  { id: 'cert',     name: '证照',   color: '#8B5CF6', icon: '▣' },
];

const CATEGORY_STORAGE_KEY = 'event_categories_v1';

function getCategories() {
  try {
    const stored = wx.getStorageSync(CATEGORY_STORAGE_KEY);
    if (stored && Array.isArray(stored) && stored.length > 0) return stored;
  } catch (e) { console.warn('读取分类失败', e); }
  saveCategories(DEFAULT_CATEGORIES);
  return DEFAULT_CATEGORIES.slice();
}

function saveCategories(list) {
  try { wx.setStorageSync(CATEGORY_STORAGE_KEY, list); }
  catch (e) { console.error('保存分类失败', e); }
}

function addCategory(cat) {
  const list = getCategories();
  let id = cat.id || ('cat_' + Date.now());
  while (list.find(c => c.id === id)) {
    id = 'cat_' + Date.now() + Math.floor(Math.random() * 1000);
  }
  const newCat = { id, name: cat.name || '新分类', color: cat.color || '#6366F1', icon: cat.icon || '●' };
  list.push(newCat);
  saveCategories(list);
  return newCat;
}

function updateCategory(id, updates) {
  const list = getCategories();
  const idx = list.findIndex(c => c.id === id);
  if (idx < 0) return null;
  list[idx] = Object.assign({}, list[idx], updates);
  saveCategories(list);
  return list[idx];
}

function deleteCategory(id) {
  const list = getCategories();
  const idx = list.findIndex(c => c.id === id);
  if (idx < 0) return false;
  list.splice(idx, 1);
  saveCategories(list);
  return true;
}

function resetCategories() {
  saveCategories(DEFAULT_CATEGORIES.slice());
  return DEFAULT_CATEGORIES.slice();
}

function getCategoryColor(catId, list) {
  const cats = list || getCategories();
  const cat = cats.find(c => c.id === catId);
  return cat ? cat.color : '#6366F1';
}

function getCategoryName(catId, list) {
  const cats = list || getCategories();
  const cat = cats.find(c => c.id === catId);
  return cat ? cat.name : '未分类';
}

const COLOR_PALETTE = [
  '#DC2626', '#EA580C', '#D97706', '#CA8A04', '#65A30D',
  '#059669', '#0D9488', '#0891B2', '#2563EB', '#6366F1',
  '#7C3AED', '#A855F7', '#D946EF', '#DB2777', '#E11D48',
  '#78716C', '#64748B', '#475569', '#334155', '#1F2937',
];

/**
 * 第五套图标：纯 Unicode 几何形状，30个
 * 风格统一扁平，无 emoji 平台差异
 */
const EMOJI_OPTIONS = [
  '⬢', '◎', '◆', '◉', '▣',
  '▤', '◈', '▸', '▥', '⬡',
  '△', '★', '⚡', '⬟', '▦',
  '◇', '○', '□', '▵', '⬒',
  '⬔', '▹', '⬕', '◬', '◎',
  '✦', '⬖', '▻', '◧', '⬗',
];

module.exports = {
  COLOR_MAP, EMOJI_RULES, guessEmoji, getColor,
  DEFAULT_CATEGORIES, COLOR_PALETTE, EMOJI_OPTIONS,
  getCategories, saveCategories,
  addCategory, updateCategory, deleteCategory, resetCategories,
  getCategoryColor, getCategoryName,
};
