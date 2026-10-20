// 明るい／暗い の切り替え。設定は 'auto'（OS に合わせる）・'light'・'dark' の3つで、localStorage に保存する。
// 実際の配色は <html data-theme="light|dark"> で決まる（app/styles.css）

const KEY = 'qp_theme';
const media = () => (typeof window !== 'undefined' && window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null);

export const THEME_LABEL = { auto: '自動（OS に合わせる）', light: '明るい', dark: '暗い' };
export const nextTheme = (t) => (t === 'auto' ? 'light' : t === 'light' ? 'dark' : 'auto');

export const loadTheme = () => {
  try {
    const v = localStorage.getItem(KEY);
    return v === 'light' || v === 'dark' ? v : 'auto';
  } catch {
    return 'auto';
  }
};

export const applyTheme = (pref) => {
  const m = media();
  const dark = pref === 'dark' || (pref === 'auto' && !!m && m.matches);
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
};

export const saveTheme = (pref) => {
  try {
    if (pref === 'auto') localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, pref);
  } catch {
    // 保存できなくても切り替えは効かせる
  }
  applyTheme(pref);
};

// 「自動」のとき、OS の設定が変わったら追従する
export const watchSystemTheme = () => {
  const m = media();
  if (!m) return;
  const on = () => applyTheme(loadTheme());
  if (m.addEventListener) m.addEventListener('change', on);
  else if (m.addListener) m.addListener(on);
};
