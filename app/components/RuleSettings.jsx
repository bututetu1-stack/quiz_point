// ホスト用：ルールの選択・パラメータ設定と、問題番号の進行

import { useState } from 'react';
import { normalizeRule, RULE_GROUPS, RULE_TYPES, ruleLabel, ruleSummary } from '../lib/rules.js';
import { ChevronLeft, ChevronRight, Zap } from '../ui/icons.jsx';
import { useAsk } from '../ui/dialogs.jsx';
import { Button, Section, Seg } from '../ui/primitives.jsx';

// N〇M✕ のよく使う設定（「誤答2休」は Tokuten の M〇N休）
const NOMX_PRESETS = [
  ['〇✕カウント', { win: 0, lose: 0, rest: 0 }],
  ['誤答2休', { win: 0, lose: 0, rest: 2 }],
  ['7〇3✕', { win: 7, lose: 3, rest: 0 }],
  ['5〇3✕', { win: 5, lose: 3, rest: 0 }],
  ['10〇5✕', { win: 10, lose: 5, rest: 0 }],
];

const NumberField = ({ label, value, min, max, onChange }) => (
  <label className="flex items-center justify-between gap-3 text-sm font-bold text-ink-2">
    <span className="min-w-0">{label}</span>
    <input
      type="number"
      inputMode="numeric"
      min={min}
      max={max}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-20 shrink-0 bg-sunken rounded-xl px-3 py-2 text-right text-base font-black text-ink outline-none focus:ring-2 focus:ring-brand/40"
    />
  </label>
);

const RuleEditor = ({ current, onApply, onCancel }) => {
  const [draft, setDraft] = useState(current);
  const def = RULE_TYPES.find((d) => d.type === draft.type);
  const set = (patch) => setDraft((d) => ({ ...d, ...patch }));
  const pick = (type) => setDraft(normalizeRule({ type }));
  const { confirm } = useAsk();
  const apply = async () => {
    const rule = normalizeRule(draft);
    if (
      await confirm(`ルールを「${ruleLabel(rule)}」にしますか？`, {
        ok: 'ルールを変える',
        note: '全員の得点・状態と問題番号はリセットされます（記録タブの成績は残ります）。',
      })
    )
      onApply(rule);
  };
  const presetOn = (patch) => Object.entries(patch).every(([k, v]) => Number(draft[k]) === v);
  return (
    <div className="flex flex-col gap-3">
      {RULE_GROUPS.map((g) => (
        <div key={g.key}>
          <div className="text-xs font-bold text-ink-3 mb-1.5">{g.label}</div>
          <div className="grid grid-cols-2 gap-2">
            {RULE_TYPES.filter((d) => d.group === g.key).map((d) => (
              <button
                key={d.type}
                onClick={() => pick(d.type)}
                className={`rounded-2xl px-3 py-2.5 text-sm font-black border-2 transition-colors ${
                  draft.type === d.type
                    ? 'border-brand bg-brand-soft text-brand-ink'
                    : 'border-line bg-card text-ink-2 hover:border-brand/50'
                }`}
              >
                {d.label}
              </button>
            ))}
          </div>
        </div>
      ))}
      <p className="text-xs text-ink-2 leading-relaxed bg-sunken rounded-xl px-3 py-2">{def.desc}</p>
      {draft.type === 'nomx' && (
        <div className="flex flex-wrap gap-1.5">
          {NOMX_PRESETS.map(([label, patch]) => (
            <button
              key={label}
              onClick={() => set(patch)}
              className={`px-3 py-1 rounded-full text-xs font-bold border ${
                presetOn(patch) ? 'bg-brand text-on-brand border-brand' : 'bg-card text-ink-2 border-line hover:border-brand/50'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      )}
      {def.params
        .filter((p) => !p.when || p.when(draft))
        .map((p) =>
          p.bool ? (
            <label key={p.key} className="flex items-center justify-between gap-3 text-sm font-bold text-ink-2">
              <span>{p.label}</span>
              <input
                type="checkbox"
                checked={!!draft[p.key]}
                onChange={(e) => set({ [p.key]: e.target.checked })}
                className="w-6 h-6 accent-amber-500 shrink-0"
              />
            </label>
          ) : p.options ? (
            <div key={p.key}>
              <div className="text-sm font-bold text-ink-2 mb-1">{p.label}</div>
              <Seg value={draft[p.key]} onChange={(k) => set({ [p.key]: k })} options={p.options} />
            </div>
          ) : (
            <NumberField key={p.key} label={p.label} value={draft[p.key]} min={p.min} max={p.max} onChange={(v) => set({ [p.key]: v })} />
          ),
        )}
      <div className="flex gap-2">
        <Button variant="secondary" className="flex-1 py-2.5 text-sm" onClick={onCancel}>
          やめる
        </Button>
        <Button className="flex-[2] py-2.5 text-sm" onClick={apply}>
          このルールで始める
        </Button>
      </div>
    </div>
  );
};

export const RuleCard = ({ state, onOp }) => {
  const [editing, setEditing] = useState(false);
  const rule = normalizeRule(state.rule);
  return (
    <Section
      icon={<Zap size={18} />}
      title="ルール"
      action={
        !editing && (
          <Button variant="secondary" className="px-3 py-1.5 text-xs" onClick={() => setEditing(true)}>
            変更する
          </Button>
        )
      }
    >
      {editing ? (
        <RuleEditor
          current={rule}
          onCancel={() => setEditing(false)}
          onApply={(r) => {
            onOp('setRule', { rule: r });
            setEditing(false);
          }}
        />
      ) : (
        <div className="flex flex-col gap-3">
          <div className="text-2xl font-black text-brand-ink leading-tight">{ruleLabel(rule)}</div>
          <p className="text-xs text-ink-2 leading-relaxed">{ruleSummary(rule)}</p>
          {rule.type === 'free' && (
            <>
              <div>
                <label className="text-xs font-bold text-ink-3 block mb-1">得点モード</label>
                <Seg
                  value={state.scoreMode || 'addsub'}
                  onChange={(k) => onOp('setScoreMode', { mode: k })}
                  options={[
                    ['addsub', '＋/− 数値'],
                    ['simple', '〇/✖ Simple', 'text-ok-ink'],
                  ]}
                />
              </div>
              {state.scoreMode !== 'simple' && (
                <div>
                  <label className="text-xs font-bold text-ink-3 block mb-1">チーム得点計算</label>
                  <Seg
                    value={state.teamMode || 'product'}
                    onChange={(k) => onOp('setTeamMode', { mode: k })}
                    options={[
                      ['sum', '和 (＋)', 'text-info-ink'],
                      ['product', '積 (×)', 'text-ng-ink'],
                    ]}
                  />
                </div>
              )}
            </>
          )}
        </div>
      )}
    </Section>
  );
};

// 問題番号の進行（休みのカウントとグラフの横軸に使う。休み中の人は自分の「問題を進める」でも数えられる）
export const ProgressControls = ({ state, onOp }) => (
  <div className="flex items-center gap-2">
    <div className="flex-1 min-w-0">
      <div className="text-xs font-bold text-ink-3">いまの問題</div>
      <div className="text-4xl font-black text-ink tracking-tight tabular-nums leading-none mt-1">Q{state.q || 1}</div>
    </div>
    <Button
      variant="secondary"
      className="px-2.5 py-3"
      onClick={() => onOp('nextQ', { delta: -1 })}
      disabled={(state.q || 1) <= 1}
      aria-label="1問戻す"
      title="1問戻す"
    >
      <ChevronLeft size={20} />
    </Button>
    <Button variant="info" className="px-4 py-3 text-base" onClick={() => onOp('nextQ', { delta: 1 })}>
      次の問題 <ChevronRight size={18} />
    </Button>
  </div>
);
