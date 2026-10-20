// 自分の得点だけを操作する下部バー（ホスト・参加者 共通）

import { useState } from 'react';
import { ModeBar, ScorerButtons } from './ScoreControls.jsx';
import { TeamPicker } from './Teams.jsx';
import { QUICK_PRESETS } from '../lib/score.js';
import { RotateCcw } from '../ui/icons.jsx';
import { Button } from '../ui/primitives.jsx';

export const SelfScoreBar = ({ state, myPlayer, onOp }) => {
  const [mode, setMode] = useState('ox');
  const [calcOp, setCalcOp] = useState('×');
  const [calcVal, setCalcVal] = useState('2');
  const [oxPoint, setOxPoint] = useState('1');
  const simple = state.scoreMode === 'simple';
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
    <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 p-3 shadow-[0_-8px_30px_rgba(0,0,0,0.08)] z-30">
      <div className="max-w-3xl mx-auto">
        <TeamPicker state={state} myPlayer={myPlayer} onOp={onOp} />
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-bold text-amber-600">あなた（{myPlayer.name}）の得点</span>
          <Button
            variant="ghost"
            className="bg-slate-100 text-slate-600 text-xs px-3 py-1.5"
            onClick={() =>
              onOp('undo', {
                playerId: myPlayer.id,
              })
            }
          >
            <RotateCcw size={14} />
            {' 1つ戻す'}
          </Button>
        </div>
        {simple ? (
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
