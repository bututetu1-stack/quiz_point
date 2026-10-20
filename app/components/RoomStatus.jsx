// 部屋の状況（ヘッダーの中）：いまのルールと問題番号。ホストは Q の横の ▶ で次の問題へ進める

import { ruleLabel } from '../lib/rules.js';
import { ChevronRight } from '../ui/icons.jsx';

export const RoomStatus = ({ state, onNextQ }) => {
  const label = ruleLabel(state.rule);
  return (
    <div className="flex-1 min-w-0 flex items-center gap-1.5" data-room-status>
      <span className="hidden min-[360px]:block min-w-0 truncate text-sm font-black text-brand-ink" title={label}>
        {label}
      </span>
      <span className="shrink-0 inline-flex items-stretch rounded-full bg-ink text-card text-xs font-black tabular-nums overflow-hidden">
        <span className="px-2.5 py-1">Q{state.q || 1}</span>
        {onNextQ && (
          <button onClick={onNextQ} className="pl-1.5 pr-2 border-l border-card/25 hover:bg-ink-2 flex items-center" aria-label="次の問題へ" title="次の問題へ">
            <ChevronRight size={14} />
          </button>
        )}
      </span>
    </div>
  );
};
