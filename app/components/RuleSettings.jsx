// ホスト用：ルールの選択・パラメータ設定と、問題番号の進行

import { useState } from 'react';
import { normalizeRule, RULE_TYPES, ruleLabel } from '../lib/rules.js';
import { Zap } from '../ui/icons.jsx';
import { Button, Card, Seg } from '../ui/primitives.jsx';

// N〇M✕ のよく使う設定
const NOMX_PRESETS = [
  ['〇✕カウント', { win: 0, lose: 0 }],
  ['7〇3✕', { win: 7, lose: 3 }],
  ['5〇3✕', { win: 5, lose: 3 }],
  ['10〇5✕', { win: 10, lose: 5 }],
];

const NumberField = ({ label, value, min, max, onChange }) => (
  <label className="flex items-center justify-between gap-3 text-sm font-bold text-slate-600">
    <span className="min-w-0">{label}</span>
    <input
      type="number"
      inputMode="numeric"
      min={min}
      max={max}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-20 shrink-0 bg-slate-100 rounded-xl px-3 py-2 text-right text-base font-black text-slate-800 outline-none focus:ring-2 focus:ring-amber-300"
    />
  </label>
);

const RuleEditor = ({ current, onApply, onCancel }) => {
  const [draft, setDraft] = useState(current);
  const def = RULE_TYPES.find((d) => d.type === draft.type);
  const set = (patch) => setDraft((d) => ({ ...d, ...patch }));
  const pick = (type) => setDraft(normalizeRule({ type }));
  const apply = () => {
    const rule = normalizeRule(draft);
    if (window.confirm(`ルールを「${ruleLabel(rule)}」にします。\n全員の得点・状態と問題番号はリセットされます。よろしいですか？`)) onApply(rule);
  };
  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-2">
        {RULE_TYPES.map((d) => (
          <button
            key={d.type}
            onClick={() => pick(d.type)}
            className={`rounded-2xl px-3 py-2.5 text-sm font-black border-2 transition-colors ${
              draft.type === d.type ? 'border-amber-400 bg-amber-50 text-amber-700' : 'border-slate-200 bg-white text-slate-600 hover:border-amber-200'
            }`}
          >
            {d.label}
          </button>
        ))}
      </div>
      <p className="text-xs text-slate-500 leading-relaxed">{def.desc}</p>
      {draft.type === 'nomx' && (
        <div className="flex flex-wrap gap-1.5">
          {NOMX_PRESETS.map(([label, patch]) => (
            <button
              key={label}
              onClick={() => set(patch)}
              className={`px-3 py-1 rounded-full text-xs font-bold border ${
                draft.win === patch.win && draft.lose === patch.lose ? 'bg-amber-400 text-white border-amber-400' : 'bg-white text-slate-500 border-slate-200'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      )}
      {def.params.map((p) =>
        p.bool ? (
          <label key={p.key} className="flex items-center justify-between gap-3 text-sm font-bold text-slate-600">
            <span>{p.label}</span>
            <input type="checkbox" checked={!!draft[p.key]} onChange={(e) => set({ [p.key]: e.target.checked })} className="w-5 h-5 accent-amber-500" />
          </label>
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
  const def = RULE_TYPES.find((d) => d.type === rule.type);
  return (
    <Card className="p-5 flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-black text-slate-700 flex items-center gap-2">
          <Zap size={18} /> ルール
        </h3>
        {!editing && (
          <Button variant="secondary" className="px-3 py-1.5 text-xs" onClick={() => setEditing(true)}>
            変更する
          </Button>
        )}
      </div>
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
        <>
          <div className="text-2xl font-black text-amber-600">{ruleLabel(rule)}</div>
          <p className="text-xs text-slate-500 leading-relaxed">{def.desc}</p>
          {rule.type === 'free' && (
            <>
              <div>
                <label className="text-xs font-bold text-slate-400 block mb-1">得点モード</label>
                <Seg
                  value={state.scoreMode || 'addsub'}
                  onChange={(k) => onOp('setScoreMode', { mode: k })}
                  options={[
                    ['addsub', '＋/− 数値'],
                    ['simple', '〇/✖ Simple', 'text-emerald-600'],
                  ]}
                />
              </div>
              {state.scoreMode !== 'simple' && (
                <div>
                  <label className="text-xs font-bold text-slate-400 block mb-1">チーム得点計算</label>
                  <Seg
                    value={state.teamMode || 'product'}
                    onChange={(k) => onOp('setTeamMode', { mode: k })}
                    options={[
                      ['sum', '和 (＋)', 'text-blue-600'],
                      ['product', '積 (×)', 'text-rose-600'],
                    ]}
                  />
                </div>
              )}
            </>
          )}
        </>
      )}
    </Card>
  );
};

// 問題番号の進行（休みのカウントとグラフの横軸に使う）
export const ProgressCard = ({ state, onOp }) => (
  <Card className="p-5 flex items-center gap-3">
    <div className="flex-1 min-w-0">
      <div className="text-xs font-bold text-slate-400">いまの問題</div>
      <div className="text-4xl font-black text-slate-800 tracking-tight">Q{state.q || 1}</div>
    </div>
    <Button variant="secondary" className="px-3 py-3" onClick={() => onOp('nextQ', { delta: -1 })} disabled={(state.q || 1) <= 1} title="1問戻す">
      ◀
    </Button>
    <Button className="px-4 py-3 text-base" onClick={() => onOp('nextQ', { delta: 1 })}>
      次の問題 ▶
    </Button>
  </Card>
);
