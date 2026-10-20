// 部屋の状況：いまのルールと問題番号（全員の画面に表示）

import { ruleLabel } from '../lib/rules.js';

export const RoomStatus = ({ state }) => (
  <div className="flex items-center justify-center gap-2 text-sm font-black" data-room-status>
    <span className="bg-white text-amber-600 px-4 py-1.5 rounded-full shadow-sm border border-amber-100">{ruleLabel(state.rule)}</span>
    <span className="bg-slate-800 text-white px-4 py-1.5 rounded-full shadow-sm">Q{state.q || 1}</span>
  </div>
);
