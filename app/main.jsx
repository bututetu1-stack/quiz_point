// エントリーポイント：データ層を用意して App を描画
// window.__QP_ADAPTER__ が設定されていればそれを使う（テスト・スクリーンショット用のメモリ実装）

import { createRoot } from 'react-dom/client';
import { App } from './App.jsx';
import { firebaseConfig } from './data/config.js';
import { createFirebaseAdapter } from './data/firebaseAdapter.js';
import { createStore } from './data/store.js';
import { applyTheme, loadTheme, watchSystemTheme } from './lib/theme.js';

applyTheme(loadTheme());
watchSystemTheme();

const adapter = window.__QP_ADAPTER__ || createFirebaseAdapter(firebaseConfig);
createRoot(document.getElementById('root')).render(<App store={createStore(adapter)} />);
