// 得点操作（モード切替と得点ボタン）

import { CheckCircle, XCircle } from '../ui/icons.jsx';
import { Button } from '../ui/primitives.jsx';

export const ModeBar = ({ mode, setMode, calcOp, setCalcOp, calcVal, setCalcVal, oxPoint, setOxPoint }) => (
  <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
    <div className="flex flex-wrap gap-1 bg-slate-100 p-1 rounded-2xl">
      {[
        ['ox', '〇✕'],
        ['plus', '加点のみ'],
        ['calc', '自由計算'],
        ['quick', 'クイック'],
      ].map(([k, l]) => (
        <button
          key={k}
          onClick={() => setMode(k)}
          className={`px-3 py-1.5 rounded-xl text-sm font-bold transition-colors ${mode === k ? 'bg-white shadow-sm text-amber-600' : 'text-slate-400 hover:text-slate-600'}`}
        >
          {l}
        </button>
      ))}
    </div>
    {mode === 'calc' ? (
      <div className="flex items-center gap-2 bg-slate-100 p-1.5 rounded-2xl">
        <select
          value={calcOp}
          onChange={(e) => setCalcOp(e.target.value)}
          className="bg-white text-slate-800 text-lg font-bold p-2 rounded-xl outline-none text-center"
        >
          <option value="×">×</option>
          <option value="÷">÷</option>
          <option value="+">＋</option>
          <option value="-">−</option>
        </select>
        <input
          type="text"
          inputMode="decimal"
          value={calcVal}
          onChange={(e) => setCalcVal(e.target.value)}
          placeholder="値"
          className="bg-white text-slate-800 text-lg font-bold p-2 w-20 rounded-xl outline-none text-center"
        />
      </div>
    ) : mode === 'quick' ? (
      <span className="text-slate-400 text-sm px-1">下のボタンで ＋1〜＋5 / −1</span>
    ) : (
      <div className="flex items-center gap-2 bg-slate-100 p-1.5 rounded-2xl">
        <span className="text-slate-400 text-xs font-bold pl-1">{mode === 'plus' ? '加点' : '規定点'}</span>
        <input
          type="text"
          inputMode="decimal"
          value={oxPoint}
          onChange={(e) => setOxPoint(e.target.value)}
          className="bg-white text-amber-600 text-lg font-bold p-2 w-16 rounded-xl outline-none text-center"
        />
      </div>
    )}
  </div>
);

// 行内・自分バー共用の得点ボタン群。onAct(operator, valueStr)
export const ScorerButtons = ({ mode, config, onAct, big }) => {
  const sz = big ? 24 : 22;
  const oxCls = big ? 'flex-1 py-3 text-xl' : 'px-4 py-2.5';
  const smCls = big ? 'flex-1 py-3' : 'px-3 py-2.5';
  if (mode === 'simple') {
    return (
      <>
        <Button onClick={() => onAct('maru')} variant="green" className={oxCls}>
          <CheckCircle size={sz} />
        </Button>
        <Button onClick={() => onAct('batsu')} variant="danger" className={oxCls}>
          <XCircle size={sz} />
        </Button>
      </>
    );
  }
  if (mode === 'calc') {
    const internal = config.op === '×' ? '*' : config.op === '÷' ? '/' : config.op;
    return (
      <Button
        onClick={() => onAct(internal, config.val)}
        variant="blue"
        className={`${big ? 'flex-1 py-3 text-xl' : 'px-4 py-2.5'} whitespace-nowrap`}
      >
        {config.op}
        {config.val}
      </Button>
    );
  }
  if (mode === 'plus') {
    return (
      <Button
        onClick={() => onAct('+', config.pt)}
        variant="green"
        className={`${big ? 'flex-1 py-3 text-xl' : 'px-4 py-2.5'} whitespace-nowrap`}
      >
        <CheckCircle size={sz} />
        {' ＋'}
        {config.pt}
      </Button>
    );
  }
  if (mode === 'quick') {
    return (
      <>
        {(config.quick || []).map((n) => (
          <Button key={n} onClick={() => onAct('+', String(n))} variant="primary" className={smCls}>
            ＋{n}
          </Button>
        ))}
        <Button onClick={() => onAct('-', '1')} variant="danger" className={smCls}>
          −1
        </Button>
      </>
    );
  }
  // ox
  return (
    <>
      <Button onClick={() => onAct('+', config.pt)} variant="green" className={oxCls}>
        <CheckCircle size={sz} />
      </Button>
      <Button onClick={() => onAct('-', config.pt)} variant="danger" className={oxCls}>
        <XCircle size={sz} />
      </Button>
    </>
  );
};
