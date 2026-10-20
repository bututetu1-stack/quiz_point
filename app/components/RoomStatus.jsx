// 部屋の状況（ヘッダーの中）：いまのルール（押すと説明）と問題番号。ホストは Q の横の ▶ で次の問題へ進める

import { normalizeRule, ruleDetails, ruleLabel, RULE_TYPES } from '../lib/rules.js';
import { ChevronRight, Zap } from '../ui/icons.jsx';
import { Sheet } from '../ui/primitives.jsx';

export const RoomStatus = ({ state, onNextQ, onShowRule }) => {
  const label = ruleLabel(state.rule);
  return (
    <div className="flex-1 min-w-0 flex items-center gap-1.5" data-room-status>
      <button
        onClick={onShowRule}
        className="hidden min-[360px]:block min-w-0 truncate text-sm font-black text-brand-ink hover:underline underline-offset-2 py-1.5"
        title={`${label}（押すと説明）`}
      >
        {label}
      </button>
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

// いまのルールの説明（全員が見られる）
export const RuleInfoSheet = ({ state, open, onClose }) => {
  const rule = normalizeRule(state.rule);
  const def = RULE_TYPES.find((d) => d.type === rule.type);
  const details = ruleDetails(rule);
  return (
    <Sheet open={open} onClose={onClose} title="いまのルール">
      <div className="px-1 pb-1" data-rule-info>
        <div className="flex items-center gap-2 text-2xl font-black text-brand-ink">
          <Zap size={22} /> {ruleLabel(rule)}
        </div>
        <p className="text-sm text-ink-2 leading-relaxed mt-2">{def.desc}</p>
        {details.length > 0 && (
          <dl className="mt-3 rounded-xl bg-sunken divide-y divide-line">
            {details.map((d) => (
              <div key={d.label} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                <dt className="text-ink-2 font-bold min-w-0">{d.label}</dt>
                <dd className="text-ink font-black tabular-nums shrink-0">{d.value}</dd>
              </div>
            ))}
          </dl>
        )}
        <p className="text-xs text-ink-3 mt-3">いまの問題：Q{state.q || 1}。ルールはホストが変えられます（変えると全員の得点と問題番号がリセット）。</p>
      </div>
    </Sheet>
  );
};
