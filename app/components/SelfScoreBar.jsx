// 自分の操作パネル（画面下・ホストと参加者 共通）
//   上段：自分の得点を大きく・順位と「あと何問」・チーム・元に戻す・メニュー（名前・観戦）
//   下段：ルール時は大きな「正答 / 誤答」と小さな「勝ち抜け / 脱落」（休み中は「問題を進める」）、自由計算は得点ボタン。
//   観戦中は「参加する」だけ

import { useContext, useEffect, useRef, useState } from 'react';
import { RoomContext } from '../context.js';
import { myStanding, scoreText } from '../lib/ranking.js';
import { isRuleMode, playerState, progressHint, winRanks } from '../lib/rules.js';
import { playSound } from '../lib/sound.js';
import { CheckCircle, Edit2, Eye, HelpCircle, MoreHorizontal, RotateCcw, SkipForward, Trophy, Users, XCircle } from '../ui/icons.jsx';
import { useAsk } from '../ui/dialogs.jsx';
import { Button, IconButton, Sheet, SheetItem } from '../ui/primitives.jsx';
import { useChangeKey } from './PlayerList.jsx';
import { FreeControls, SimpleButtons } from './ScoreControls.jsx';
import { HelpSheet } from './HelpSheet.jsx';
import { TeamButton, TeamChoices } from './Teams.jsx';

// ルール時：大きな「正答 / 誤答」。休み中は「問題を進める」に替わる。終わった人はボタンを止める
const AnswerButtons = ({ st, onAnswer, onDeclare, onAdvance }) => {
  const { confirm } = useAsk();
  const done = st.kind === 'win' || st.kind === 'lose';
  const note = '間違えたら「元に戻す」で取り消せます。';
  return (
    <div className="flex flex-col gap-2">
      {st.kind === 'rest' ? (
        <>
          <div className="text-center text-sm font-bold text-info-ink bg-info-soft rounded-xl py-1.5" data-rest>
            休み中（あと{st.restLeft}問）・問題が進んだら押す
          </div>
          <Button variant="info" className="w-full py-3.5 text-xl" onClick={onAdvance}>
            <SkipForward size={24} /> 問題を進める
          </Button>
        </>
      ) : (
        <div className="flex gap-3">
          <Button variant="ok" className="flex-1 py-3.5 text-xl" disabled={done} onClick={() => onAnswer('correct')}>
            <CheckCircle size={26} /> 正答
          </Button>
          <Button variant="ng" className="flex-1 py-3.5 text-xl" disabled={done} onClick={() => onAnswer('wrong')}>
            <XCircle size={26} /> 誤答
          </Button>
        </div>
      )}
      {done && (
        <div
          className={`text-center text-sm font-bold rounded-xl py-1.5 ${st.kind === 'win' ? 'bg-ok-soft text-ok-ink' : 'bg-sunken text-ink-2'}`}
        >
          {st.kind === 'win' ? '勝ち抜けました！' : '脱落しました'}（間違えたら「元に戻す」）
        </div>
      )}
      {!done && (
        <div className="flex justify-center gap-2" data-declare>
          <button
            onClick={async () => (await confirm('勝ち抜けにしますか？', { ok: '勝ち抜け', note })) && onDeclare('win')}
            className="px-3 py-1 rounded-full text-xs font-bold bg-ok-soft text-ok-ink border border-ok/30 flex items-center gap-1 hover:border-ok"
          >
            <Trophy size={12} /> 勝ち抜け
          </button>
          <button
            onClick={async () => (await confirm('脱落にしますか？', { ok: '脱落', danger: true, note })) && onDeclare('lose')}
            className="px-3 py-1 rounded-full text-xs font-bold bg-sunken text-ink-2 border border-line flex items-center gap-1 hover:border-ink-3"
          >
            <XCircle size={12} /> 脱落
          </button>
        </div>
      )}
    </div>
  );
};

// 押したときの振動（効果音 ON・対応端末のみ）
const buzz = (on, pattern) => {
  try {
    if (on && typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(pattern);
  } catch {
    // 振動できなくても続ける
  }
};

// 順位まわりの短い文（見出しと、その下の細かい情報）
const describe = (state, me, rule, st) => {
  const s = myStanding(state, me);
  let head = '';
  if (st.kind === 'win') head = `勝ち抜け ${winRanks(state.players)[me.id] || ''}位`;
  else if (st.kind === 'lose') head = '脱落';
  else if (s && s.rank) head = !s.gap && s.tie ? 'いまトップタイ' : s.rank === 1 ? 'いまトップ！' : `いま${s.rank}位`;
  const parts = [];
  if (rule) parts.push(`〇${me.maru || 0} ✕${me.batsu || 0}`);
  if (rule && !me.status) {
    const h = progressHint(state.rule, me);
    if (h) parts.push(h);
  }
  if (s && s.gap > 0) parts.push(`1位まで${s.gap}`);
  return { head, detail: parts.join('・') };
};

// withAside：PC で右に管理パネルがある画面（ホスト）。パネルの中身を左の列にそろえる
export const SelfScoreBar = ({ state, myPlayer, onOp, withAside = false }) => {
  const { soundOn } = useContext(RoomContext);
  const [sheet, setSheet] = useState(null); // 'menu' | 'team' | 'help'
  const busy = useRef({ key: null, until: 0 });
  const { prompt } = useAsk();
  const rule = isRuleMode(state.rule);
  const simple = state.scoreMode === 'simple';
  const barRef = useRef(null);
  const text = myPlayer ? scoreText(state, myPlayer) : '';
  const flash = useChangeKey(text);
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
  const st = rule ? playerState(myPlayer, state.q || 1) : { kind: 'play' };
  const { head, detail } = describe(state, myPlayer, rule, st);
  const team = state.teams.find((t) => t.id === myPlayer.teamId);
  const selfAct = (op, val) => {
    playSound(op === 'batsu' || op === '-' ? 'wrong' : 'pop', soundOn);
    if (op === 'maru' || op === 'batsu') onOp(op, me);
    else onOp('score', { ...me, operator: op, valueStr: val });
  };
  const rename = async () => {
    const n = await prompt('あなたの新しい名前', myPlayer.name, { title: '名前を変える' });
    if (n) {
      onOp('renamePlayer', { ...me, name: n });
      try {
        localStorage.setItem('playerName', n);
      } catch {
        // 保存できなくても続ける
      }
    }
  };
  const close = () => setSheet(null);
  // 同じボタンは、送っている間と直後 0.4 秒は受け付けない（興奮して二度押ししても 1 回だけ。別のボタンはすぐ押せる）
  const once = async (key, fn) => {
    const b = busy.current;
    if (b.key === key && Date.now() < b.until) return;
    busy.current = { key, until: Infinity };
    try {
      await fn();
    } finally {
      if (busy.current.key === key) busy.current = { key, until: Date.now() + 400 };
    }
  };
  return (
    <>
      <div
        ref={barRef}
        data-selfbar
        className="fixed bottom-0 inset-x-0 z-30 bg-card/95 backdrop-blur border-t border-line shadow-up short:top-0 short:left-auto short:w-80 short:border-t-0 short:border-l short:overflow-y-auto short:flex short:flex-col short:justify-center"
      >
        <div
          className={`w-full max-w-3xl mx-auto px-3 pt-2.5 pb-[max(0.75rem,env(safe-area-inset-bottom))] flex flex-col gap-2.5 ${withAside ? 'lg:max-w-5xl lg:pl-4 lg:pr-[22.5rem]' : ''}`}
        >
          {myPlayer.spectator ? (
            <div className="flex items-center justify-between gap-3" data-spectating>
              <div className="min-w-0 leading-tight">
                <div className="text-sm font-bold text-ink truncate">あなた（{myPlayer.name}）</div>
                <div className="text-xs text-ink-3 flex items-center gap-1">
                  <Eye size={12} /> 観戦中（ランキングには出ません）
                </div>
              </div>
              <Button className="px-5 py-2.5 text-sm shrink-0" onClick={() => onOp('setSpectator', { ...me, on: false })}>
                参加する
              </Button>
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-end gap-x-2 gap-y-1.5">
                <div className="flex items-center gap-2.5 min-w-[6rem] flex-1 short:basis-full" aria-live="polite" aria-atomic="true">
                  <span
                    key={flash}
                    data-my-score
                    className={`text-[2rem] leading-none font-black tabular-nums tracking-tight text-ink ${flash ? 'motion-safe:animate-pop' : ''}`}
                  >
                    {text}
                  </span>
                  <div className="min-w-0 leading-tight">
                    <span className="sr-only">あなた（{myPlayer.name}）</span>
                    <div className="text-sm font-black text-brand-ink truncate" aria-hidden={!head}>
                      {head || myPlayer.name}
                    </div>
                    <div className="text-xs text-ink-3 truncate mt-0.5" data-standing>
                      {detail || ' '}
                    </div>
                  </div>
                </div>
                <TeamButton state={state} myPlayer={myPlayer} onOpen={() => setSheet('team')} />
                <Button
                  variant="soft"
                  className="px-2.5 py-2 text-xs shrink-0"
                  onClick={() => onOp('undo', me)}
                  title="元に戻す（自分の直前の操作）"
                >
                  <RotateCcw size={16} />
                  <span className="hidden min-[360px]:inline">元に戻す</span>
                </Button>
                <IconButton label="メニュー" className="bg-sunken shrink-0" onClick={() => setSheet('menu')}>
                  <MoreHorizontal size={18} />
                </IconButton>
              </div>
              {rule &&
                st.kind === 'play' &&
                !(myPlayer.rec && (myPlayer.rec.o || myPlayer.rec.x)) &&
                !(myPlayer.maru || myPlayer.batsu) && (
                  <p className="text-center text-xs font-bold text-ink-2 -mb-1" data-first-tip>
                    早押しで答えたら、正解なら「正答」・不正解なら「誤答」を押します
                  </p>
                )}
              {rule ? (
                <AnswerButtons
                  st={st}
                  onAnswer={(result) =>
                    once(`answer-${result}`, () => {
                      playSound(result === 'correct' ? 'correct' : 'wrong', soundOn);
                      buzz(soundOn, result === 'correct' ? 20 : [30, 40, 30]);
                      return onOp('answer', { ...me, result });
                    })
                  }
                  onDeclare={(status) =>
                    once(`declare-${status}`, () => {
                      if (status === 'win') playSound('correct', soundOn);
                      return onOp('declare', { ...me, status });
                    })
                  }
                  onAdvance={() =>
                    once('advance', () => {
                      playSound('pop', soundOn);
                      return onOp('advanceSelf', me);
                    })
                  }
                />
              ) : simple ? (
                <SimpleButtons onAct={selfAct} />
              ) : (
                <FreeControls onAct={selfAct} />
              )}
            </>
          )}
        </div>
      </div>
      <Sheet open={sheet === 'menu'} onClose={close} title={`メニュー（${myPlayer.name}）`}>
        {state.teams.length > 0 && (
          <SheetItem icon={<Users size={18} />} hint={team ? `いま：${team.name}` : 'まだ選んでいません'} onClick={() => setSheet('team')}>
            チームを選ぶ
          </SheetItem>
        )}
        <SheetItem
          icon={<Edit2 size={18} />}
          onClick={() => {
            close();
            rename();
          }}
        >
          名前を変える
        </SheetItem>
        <SheetItem
          icon={<Eye size={18} />}
          hint="ランキングから外れ、見るだけになります（いつでも戻せます）"
          onClick={() => {
            close();
            onOp('setSpectator', { ...me, on: true });
          }}
        >
          観戦にする
        </SheetItem>
        <SheetItem icon={<HelpCircle size={18} />} onClick={() => setSheet('help')}>
          使い方
        </SheetItem>
      </Sheet>
      <HelpSheet open={sheet === 'help'} onClose={close} />
      <Sheet open={sheet === 'team'} onClose={close} title="チームを選ぶ">
        <TeamChoices state={state} myPlayer={myPlayer} onOp={onOp} onDone={close} />
      </Sheet>
    </>
  );
};
