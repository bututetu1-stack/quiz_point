// 明るい／暗い の切替ボタン（自動 → 明るい → 暗い → 自動 …）

import { useState } from 'react';
import { loadTheme, nextTheme, saveTheme, THEME_LABEL } from '../lib/theme.js';
import { Moon, Sun, SunMoon } from '../ui/icons.jsx';
import { IconButton } from '../ui/primitives.jsx';

export const ThemeButton = ({ className = '' }) => {
  const [pref, setPref] = useState(loadTheme);
  const Icon = pref === 'light' ? Sun : pref === 'dark' ? Moon : SunMoon;
  return (
    <IconButton
      label={`表示：${THEME_LABEL[pref]}（押すと切り替え）`}
      className={className}
      data-theme-button={pref}
      onClick={() => {
        const n = nextTheme(pref);
        setPref(n);
        saveTheme(n);
      }}
    >
      <Icon size={20} />
    </IconButton>
  );
};
