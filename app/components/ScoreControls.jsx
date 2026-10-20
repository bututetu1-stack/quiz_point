// 自由計算の得点操作：1 段の切替（〇✕／加点のみ／自由計算／クイック）と、その下の 1 段（値の入力＋ボタン）
// onAct(operator, valueStr)。operator は '+' '-' '*' '/'、Simple は 'maru' / 'batsu'

import { useState } from 'react';
import { CheckCircle, XCircle } from '../ui/icons.jsx';
import { Button, Seg } from '../ui/primitives.jsx';

const MODES = [
  ['ox', '〇✕'],
  ['plus', '加点のみ'],
  ['calc', '自由計算'],
  ['quick', 'クイック'],
];
const OPS = { '×': '*', '÷': '/', '+': '+', '-': '-' };

const SmallInput = ({ label, value, onChange, className = '' }) => (
  <label className={`shrink-0 flex flex-col items-center justify-center bg-sunken rounded-xl px-2 ${className}`}>
    <span className="text-[0.6875rem] font-bold text-ink-3 leading-3">{label}</span>
    <input
      type="text"
      inputMode="decimal"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-12 bg-transparent text-center text-lg font-black text-brand-ink outline-none"
    />
  </label>
);

// 〇/✖ Simple：〇✕の数だけを数える
export const SimpleButtons = ({ onAct }) => (
  <div className="flex gap-3">
    <Button variant="ok" className="flex-1 py-3.5 text-xl" onClick={() => onAct('maru')} data-act="maru" aria-label="〇">
      <CheckCircle size={26} /> 〇
    </Button>
    <Button variant="ng" className="flex-1 py-3.5 text-xl" onClick={() => onAct('batsu')} data-act="batsu" aria-label="✕">
      <XCircle size={26} /> ✕
    </Button>
  </div>
);

export const FreeControls = ({ onAct }) => {
  const [mode, setMode] = useState('ox');
  const [op, setOp] = useState('×');
  const [val, setVal] = useState('2');
  const [pt, setPt] = useState('1');
  const big = 'flex-1 py-3 text-xl whitespace-nowrap';
  return (
    <div className="flex flex-col gap-2">
      <Seg value={mode} onChange={setMode} options={MODES} small />
      <div className="flex gap-2 items-stretch">
        {mode === 'ox' && (
          <>
            <SmallInput label="規定点" value={pt} onChange={setPt} />
            <Button variant="ok" className={big} onClick={() => onAct('+', pt)} data-act="plus">
              <CheckCircle size={24} /> ＋{pt}
            </Button>
            <Button variant="ng" className={big} onClick={() => onAct('-', pt)} data-act="minus">
              <XCircle size={24} /> −{pt}
            </Button>
          </>
        )}
        {mode === 'plus' && (
          <>
            <SmallInput label="加点" value={pt} onChange={setPt} />
            <Button variant="ok" className={big} onClick={() => onAct('+', pt)} data-act="plus">
              <CheckCircle size={24} /> ＋{pt}
            </Button>
          </>
        )}
        {mode === 'calc' && (
          <>
            <label className="shrink-0 flex items-center bg-sunken rounded-xl px-1">
              <select
                value={op}
                onChange={(e) => setOp(e.target.value)}
                className="bg-transparent text-xl font-black text-ink outline-none px-2"
                aria-label="計算の種類"
              >
                <option value="×">×</option>
                <option value="÷">÷</option>
                <option value="+">＋</option>
                <option value="-">−</option>
              </select>
            </label>
            <SmallInput label="値" value={val} onChange={setVal} />
            <Button variant="info" className={big} onClick={() => onAct(OPS[op], val)} data-act="calc">
              {op}
              {val}
            </Button>
          </>
        )}
        {mode === 'quick' && (
          <>
            {[1, 2, 3, 4, 5].map((n) => (
              <Button
                key={n}
                variant="primary"
                className="flex-1 min-w-0 px-0 py-3 text-base"
                onClick={() => onAct('+', String(n))}
                data-act={`plus${n}`}
              >
                ＋{n}
              </Button>
            ))}
            <Button variant="ng" className="flex-1 min-w-0 px-0 py-3 text-base" onClick={() => onAct('-', '1')} data-act="minus1">
              −1
            </Button>
          </>
        )}
      </div>
    </div>
  );
};
