// 自分の得点だけを操作する下部バー（ホスト・参加者 共通）

import { useEffect, useRef, useState } from 'react';
import { ModeBar, ScorerButtons } from './ScoreControls.jsx';
import { TeamPicker } from './Teams.jsx';
import { isRuleMode, playerState, progressHint } from '../lib/rules.js';
import { formatScoreStr, QUICK_PRESETS } from '../lib/score.js';
import { CheckCircle, RotateCcw, XCircle } from '../ui/icons.jsx';
import { Button } from '../ui/primitives.jsx';

// ルール時：大きな「正解 / 誤答」だけ。答えられない状態ならボタンを止めて理由を出す
const AnswerButtons = ({ state, myPlayer, onOp }) => {
  const st = playerState(myPlayer, state.q || 1);
  const blocked = st.kind !== 'play';
  const msg =
    st.kind === 'win'
      ? '勝ち抜けました！'
      : st.kind === 'lose'
        ? '失格になりました'
        : st.kind === 'rest'
          ? `休み中です（あと${st.restLeft}問）`
          : null;
  const answer = (result) => onOp('answer', { playerId: myPlayer.id, result });
  return (
    <div className="flex flex-col gap-2">
      {msg && <div className="text-center text-sm font-bold text-slate-500 bg-slate-100 rounded-xl py-1.5">{msg}</div>}
      <div className="flex gap-3">
        <Button variant="green" className="flex-1 py-4 text-xl" disabled={blocked} onClick={() => answer('correct')}>
          <CheckCircle size={26} /> 正解
        </Button>
        <Button variant="danger" className="flex-1 py-4 text-xl" disabled={blocked} onClick={() => answer('wrong')}>
          <XCircle size={26} /> 誤答
        </Button>
      </div>
    </div>
  );
};

export const SelfScoreBar = ({ state, myPlayer, onOp }) => {
  const [mode, setMode] = useState('ox');
  const [calcOp, setCalcOp] = useState('×');
  const [calcVal, setCalcVal] = useState('2');
  const [oxPoint, setOxPoint] = useState('1');
  const rule = isRuleMode(state.rule);
  const simple = state.scoreMode === 'simple';
  const barRef = useRef(null);
  // バーの高さを CSS 変数に入れ、画面の下余白に使う（ランキングの末尾が隠れないように）
  useEffect(() => {
    const el = barRef.current;
    const root = document.documentElement;
    if (!el || typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(() => root.style.setProperty('--selfbar-h', `${el.offsetHeight + 16}px`));
    ro.observe(el);
    return () => {
      ro.disconnect();
      root.style.removeProperty('--selfbar-h');
    };
  }, [!!myPlayer]);
  if (!myPlayer) return null;
  const selfAct = (op, val) => {
    if (op === 'maru' || op === 'batsu')
      onOp(op, {
        playerId: myPlayer.id,
      });
    else
      onOp('score', {
        playerId: myPlayer.id,
        operator: op,
        valueStr: val,
      });
  };
  return (
    <div ref={barRef} className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 p-3 shadow-[0_-8px_30px_rgba(0,0,0,0.08)] z-30">
      <div className="max-w-3xl mx-auto">
        <TeamPicker state={state} myPlayer={myPlayer} onOp={onOp} />
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="min-w-0">
            <div className="text-sm font-bold text-amber-600 truncate">あなた（{myPlayer.name}）の得点</div>
            {rule && (
              <div className="text-xs font-bold text-slate-500 truncate">
                {formatScoreStr(myPlayer.score)}点・<span className="text-emerald-600">〇{myPlayer.maru || 0}</span>{' '}
                <span className="text-rose-500">✕{myPlayer.batsu || 0}</span>
                {!myPlayer.status && progressHint(state.rule, myPlayer) && <span className="ml-1 text-slate-400">{progressHint(state.rule, myPlayer)}</span>}
              </div>
            )}
          </div>
          <Button
            variant="ghost"
            className="bg-slate-100 text-slate-600 text-xs px-3 py-1.5 whitespace-nowrap shrink-0"
            onClick={() => onOp('undo', { playerId: myPlayer.id })}
          >
            <RotateCcw size={14} /> 1つ戻す
          </Button>
        </div>
        {rule ? (
          <AnswerButtons state={state} myPlayer={myPlayer} onOp={onOp} />
        ) : simple ? (
          <div className="flex gap-3">
            <ScorerButtons mode="simple" config={{}} onAct={selfAct} big={true} />
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <ModeBar
              mode={mode}
              setMode={setMode}
              calcOp={calcOp}
              setCalcOp={setCalcOp}
              calcVal={calcVal}
              setCalcVal={setCalcVal}
              oxPoint={oxPoint}
              setOxPoint={setOxPoint}
            />
            <div className="flex gap-2">
              <ScorerButtons
                mode={mode}
                config={{
                  op: calcOp,
                  val: calcVal,
                  pt: oxPoint,
                  quick: QUICK_PRESETS,
                }}
                onAct={selfAct}
                big={true}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
