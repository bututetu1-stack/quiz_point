// 自分の得点だけを操作する下部バー（ホスト・参加者 共通）
// ルール系は「正答 / 誤答」と小さな「勝ち抜け / 脱落」、休み中は「問題を進める」。自由計算はモード切替と得点ボタン。
// 観戦中は「参加する」だけ

import { useContext, useEffect, useRef, useState } from 'react';
import { RoomContext } from '../context.js';
import { myStanding } from '../lib/ranking.js';
import { isRuleMode, playerState, progressHint } from '../lib/rules.js';
import { formatScoreStr, QUICK_PRESETS } from '../lib/score.js';
import { playSound } from '../lib/sound.js';
import { CheckCircle, Edit2, Eye, RotateCcw, SkipForward, Trophy, XCircle } from '../ui/icons.jsx';
import { Button } from '../ui/primitives.jsx';
import { ModeBar, ScorerButtons } from './ScoreControls.jsx';
import { TeamButton, TeamChoices } from './Teams.jsx';

// ルール時：大きな「正答 / 誤答」。休み中は「問題を進める」に替わる。終わった人はボタンを止めて理由を出す
const AnswerButtons = ({ state, myPlayer, onAnswer, onDeclare, onAdvance }) => {
  const st = playerState(myPlayer, state.q || 1);
  const done = st.kind === 'win' || st.kind === 'lose';
  return (
    <div className="flex flex-col gap-2">
      {done && (
        <div className="text-center text-sm font-bold text-slate-500 bg-slate-100 rounded-xl py-1.5">
          {st.kind === 'win' ? '勝ち抜けました！' : '脱落しました'}
        </div>
      )}
      {st.kind === 'rest' ? (
        <>
          <div className="text-center text-sm font-bold text-sky-700 bg-sky-100 rounded-xl py-1.5" data-rest>
            休み中（あと{st.restLeft}問）・問題が進んだら押す
          </div>
          <Button variant="blue" className="w-full py-4 text-xl" onClick={onAdvance}>
            <SkipForward size={24} /> 問題を進める
          </Button>
        </>
      ) : (
        <div className="flex gap-3">
          <Button variant="green" className="flex-1 py-4 text-xl" disabled={done} onClick={() => onAnswer('correct')}>
            <CheckCircle size={26} /> 正答
          </Button>
          <Button variant="danger" className="flex-1 py-4 text-xl" disabled={done} onClick={() => onAnswer('wrong')}>
            <XCircle size={26} /> 誤答
          </Button>
        </div>
      )}
      {!done && (
        <div className="flex justify-center gap-2" data-declare>
          <button
            onClick={() => window.confirm('勝ち抜けにしますか？（「元に戻す」で取り消せます）') && onDeclare('win')}
            className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1"
          >
            <Trophy size={12} /> 勝ち抜け
          </button>
          <button
            onClick={() => window.confirm('脱落にしますか？（「元に戻す」で取り消せます）') && onDeclare('lose')}
            className="px-3 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-500 border border-slate-200 flex items-center gap-1"
          >
            <XCircle size={12} /> 脱落
          </button>
        </div>
      )}
    </div>
  );
};

// いまの順位と「1位まであと何点」
const standingText = (state, me) => {
  const s = myStanding(state, me);
  if (!s || !s.rank) return '';
  if (me.status) return `${s.rank}位`;
  if (s.gap > 0) return `いま${s.rank}位・1位まであと${s.gap}`;
  return s.rank === 1 ? 'いまトップ！' : `いま${s.rank}位`;
};

export const SelfScoreBar = ({ state, myPlayer, onOp }) => {
  const { soundOn } = useContext(RoomContext);
  const [mode, setMode] = useState('ox');
  const [calcOp, setCalcOp] = useState('×');
  const [calcVal, setCalcVal] = useState('2');
  const [oxPoint, setOxPoint] = useState('1');
  const [teamOpen, setTeamOpen] = useState(false);
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
  const me = { playerId: myPlayer.id };
  const selfAct = (op, val) => {
    playSound(op === 'batsu' || op === '-' ? 'wrong' : 'pop', soundOn);
    if (op === 'maru' || op === 'batsu') onOp(op, me);
    else onOp('score', { ...me, operator: op, valueStr: val });
  };
  const onAnswer = (result) => {
    playSound(result === 'correct' ? 'correct' : 'wrong', soundOn);
    onOp('answer', { ...me, result });
  };
  const rename = () => {
    const n = window.prompt('あなたの名前', myPlayer.name);
    if (n && n.trim()) {
      onOp('renamePlayer', { ...me, name: n.trim() });
      try {
        localStorage.setItem('playerName', n.trim());
      } catch {
        // 保存できなくても続ける
      }
    }
  };
  const nameButton = (
    <button onClick={rename} className="flex items-center gap-1 text-sm font-bold text-amber-600 max-w-full" title="名前を変える">
      <span className="truncate">あなた（{myPlayer.name}）</span>
      <Edit2 size={12} className="shrink-0 opacity-60" />
    </button>
  );
  const standing = standingText(state, myPlayer);
  return (
    <div ref={barRef} className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 p-3 shadow-[0_-8px_30px_rgba(0,0,0,0.08)] z-30">
      {myPlayer.spectator ? (
        <div className="max-w-3xl mx-auto flex items-center justify-between gap-3" data-spectating>
          <div className="min-w-0">
            {nameButton}
            <div className="text-xs font-bold text-slate-500 flex items-center gap-1">
              <Eye size={12} /> 観戦中（ランキングには出ません）
            </div>
          </div>
          <Button className="px-5 py-2.5 text-sm shrink-0" onClick={() => onOp('setSpectator', { ...me, on: false })}>
            参加する
          </Button>
        </div>
      ) : (
        <div className="max-w-3xl mx-auto">
          <div className="flex items-center justify-between gap-2 mb-2">
            <div className="min-w-0">
              {nameButton}
              <div className="text-xs font-bold text-slate-500 truncate" data-standing>
                {rule && (
                  <>
                    {formatScoreStr(myPlayer.score)}点・<span className="text-emerald-600">〇{myPlayer.maru || 0}</span>{' '}
                    <span className="text-rose-500">✕{myPlayer.batsu || 0}</span>
                    {!myPlayer.status && progressHint(state.rule, myPlayer) && (
                      <span className="ml-1 text-slate-400">{progressHint(state.rule, myPlayer)}</span>
                    )}
                    {standing && <span className="ml-1 text-slate-400">／{standing}</span>}
                  </>
                )}
                {!rule && standing}
              </div>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <TeamButton state={state} myPlayer={myPlayer} open={teamOpen} onToggle={() => setTeamOpen(!teamOpen)} />
              <Button
                variant="ghost"
                className="bg-slate-100 text-slate-600 text-xs px-2.5 py-1.5 whitespace-nowrap"
                title="観戦にする（ランキングから外れて見るだけになる）"
                aria-label="観戦にする"
                onClick={() => window.confirm('観戦にしますか？ランキングから外れ、見るだけになります（いつでも参加に戻せます）') && onOp('setSpectator', { ...me, on: true })}
              >
                <Eye size={14} /> <span className="hidden sm:inline">観戦</span>
              </Button>
              <Button variant="ghost" className="bg-slate-100 text-slate-600 text-xs px-3 py-1.5 whitespace-nowrap" onClick={() => onOp('undo', me)}>
                <RotateCcw size={14} /> 元に戻す
              </Button>
            </div>
          </div>
          {teamOpen && <TeamChoices state={state} myPlayer={myPlayer} onOp={onOp} onDone={() => setTeamOpen(false)} />}
          {rule ? (
            <AnswerButtons
              state={state}
              myPlayer={myPlayer}
              onAnswer={onAnswer}
              onDeclare={(status) => {
                if (status === 'win') playSound('correct', soundOn);
                onOp('declare', { ...me, status });
              }}
              onAdvance={() => {
                playSound('pop', soundOn);
                onOp('advanceSelf', me);
              }}
            />
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
                <ScorerButtons mode={mode} config={{ op: calcOp, val: calcVal, pt: oxPoint, quick: QUICK_PRESETS }} onAct={selfAct} big={true} />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
