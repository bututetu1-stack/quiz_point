// 画面：大画面モード（?room=XXXX&view=board）。プロジェクタ用で操作 UI は無い。いつも暗い配色。
// 人数が多くても1画面に収まるよう、幅に合わせて列を増やす

import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { inviteUrl, QrSvg } from '../components/InviteDialog.jsx';
import { teamColor } from '../components/Teams.jsx';
import { WinToast } from '../components/WinToast.jsx';
import { rankPlayers, scoreText } from '../lib/ranking.js';
import { isRuleMode, playerState, ruleLabel, winRanks } from '../lib/rules.js';
import { calcTeamScore, getTeamDisplayScore, parseScoreToNumber } from '../lib/score.js';
import { Crown, Users } from '../ui/icons.jsx';
import { useFlip, useRankUps } from '../ui/motion.js';

const MEDAL = ['bg-medal-1 text-medal-ink', 'bg-medal-2 text-medal-ink', 'bg-medal-3 text-medal-ink'];

// 3 段階の大きさ：1 行の高さ（px のめやす）・列の最小幅（px）・行の間（px）
const LEVELS = [
  ['few', 88, 416, 10],
  ['many', 76, 320, 10],
  ['dense', 64, 240, 8],
];

// 画面の高さに収まるいちばん大きい段階を選ぶ（人数だけで決めると、少なめの人数で下が空く・多めの人数ではみ出す）
const useBoardLevel = (n, listRef) => {
  const [box, setBox] = useState(null);
  useLayoutEffect(() => {
    const update = () => {
      const el = listRef.current;
      if (!el || !el.clientWidth) return;
      const top = el.getBoundingClientRect().top + window.scrollY;
      setBox({ w: el.clientWidth, h: window.innerHeight - top - 24 });
    };
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);
  // 測れないとき（テストなど）は人数だけで決める
  if (!box) return n > 18 ? 'dense' : n > 8 ? 'many' : 'few';
  for (const [name, rowH, minW, gap] of LEVELS) {
    const cols = Math.max(1, Math.floor((box.w + gap) / (minW + gap)));
    const rows = Math.ceil(n / cols);
    if (rows * rowH + (rows - 1) * gap <= box.h) return name;
  }
  return 'dense';
};

const StatusTag = ({ st, rank }) => {
  if (st.kind === 'win')
    return (
      <span className="text-sm font-black text-white bg-emerald-700 rounded-full px-2.5 py-0.5 whitespace-nowrap">勝ち抜け {rank}位</span>
    );
  if (st.kind === 'lose') return <span className="text-sm font-black text-white bg-slate-600 rounded-full px-2.5 py-0.5">脱落</span>;
  if (st.kind === 'rest')
    return (
      <span className="text-sm font-black text-white bg-sky-700 rounded-full px-2.5 py-0.5 whitespace-nowrap">休み {st.restLeft}</span>
    );
  return null;
};

export const BoardView = ({ state, roomId }) => {
  const sorted = useMemo(() => rankPlayers(state), [state.players, state.rule, state.scoreMode]);
  const ranks = useMemo(() => winRanks(state.players), [state.players]);
  const rule = isRuleMode(state.rule);
  const teams = [...state.teams].sort((a, b) => calcTeamScore(b.id, state) - calcTeamScore(a.id, state));
  const q = state.q || 1;
  // 画面に合わせて 3 段階に詰める（プロジェクタでスクロールしなくても全員が入るように）
  const listRef = useRef(null);
  const size = useBoardLevel(sorted.length, listRef);
  const S = {
    few: {
      grid: 'grid-cols-[repeat(auto-fill,minmax(min(100%,26rem),1fr))]',
      row: 'px-4 py-3',
      rank: 'w-14 h-14 text-3xl',
      name: 'text-3xl',
      sub: 'text-base',
      score: 'text-5xl',
    },
    many: {
      grid: 'grid-cols-[repeat(auto-fill,minmax(min(100%,20rem),1fr))]',
      row: 'px-3 py-2',
      rank: 'w-11 h-11 text-2xl',
      name: 'text-2xl',
      sub: 'text-base',
      score: 'text-4xl',
    },
    dense: {
      grid: 'grid-cols-[repeat(auto-fill,minmax(min(100%,15rem),1fr))]',
      row: 'px-3 py-1.5',
      rank: 'w-9 h-9 text-xl',
      name: 'text-xl',
      sub: 'text-sm',
      score: 'text-3xl',
    },
  }[size];
  useFlip(listRef);
  const ups = useRankUps(sorted.map((p) => p.id));
  return (
    <div
      className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-950 text-white p-5 lg:p-8 flex flex-col gap-5"
      data-board
    >
      <WinToast state={state} />
      <h1 className="sr-only">大画面 部屋 {roomId}</h1>
      <header className="flex items-center gap-4 flex-wrap">
        <div className="bg-amber-400 text-slate-900 rounded-2xl px-5 py-2 font-black text-3xl tabular-nums"># {roomId}</div>
        <div className="text-2xl lg:text-3xl font-black text-amber-300 min-w-0 truncate">{ruleLabel(state.rule)}</div>
        <div className="ml-auto text-6xl lg:text-7xl font-black tracking-tight tabular-nums">Q{q}</div>
      </header>
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-5 items-start">
        <ol ref={listRef} data-size={size} className={`grid ${size === 'dense' ? 'gap-2' : 'gap-2.5'} ${S.grid}`}>
          {sorted.map((p, i) => {
            const st = playerState(p, q);
            const scored = st.kind === 'win' || parseScoreToNumber(p.score) > 0 || (p.maru || 0) > 0;
            const medal = i < 3 && scored && st.kind !== 'lose';
            const color = teamColor(state, p.teamId);
            return (
              <li
                key={p.id}
                data-flip-id={p.id}
                className={`flex items-center gap-3 rounded-2xl ${S.row} ${
                  st.kind === 'win' ? 'bg-emerald-500/20 ring-2 ring-emerald-400' : st.kind === 'lose' ? 'bg-white/5' : 'bg-white/10'
                }`}
              >
                <span
                  className={`${S.rank} shrink-0 rounded-xl flex items-center justify-center font-black relative tabular-nums ${medal ? MEDAL[i] : 'bg-white/15'}`}
                >
                  {i === 0 && medal && <Crown className="absolute -top-4 -left-3 w-8 h-8 text-amber-300 -rotate-12" fill="currentColor" />}
                  {i + 1}
                </span>
                <span className="flex-1 min-w-0">
                  <span className={`flex items-center gap-2 ${S.name} font-black min-w-0 ${st.kind === 'lose' ? 'text-white/60' : ''}`}>
                    {color && <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: color }} />}
                    <span className="truncate">{p.name}</span>
                    {ups[p.id] && (
                      <span className="shrink-0 text-base font-black text-white bg-emerald-700 rounded-full px-2 py-0.5 motion-safe:animate-pop">
                        ▲{ups[p.id].d}
                      </span>
                    )}
                  </span>
                  {rule && (
                    <span className={`flex items-center gap-2 ${S.sub} font-bold text-white/80 mt-0.5`}>
                      <span className="tabular-nums">
                        〇{p.maru || 0} ✕{p.batsu || 0}
                      </span>
                      <StatusTag st={st} rank={ranks[p.id]} />
                    </span>
                  )}
                </span>
                <span className={`${S.score} font-black tabular-nums ${st.kind === 'lose' ? 'text-white/60' : ''}`}>
                  {scoreText(state, p)}
                </span>
              </li>
            );
          })}
          {!sorted.length && <li className="text-white/60 text-2xl font-bold">参加者を待っています…</li>}
        </ol>
        <aside className="flex flex-col gap-4">
          {teams.length > 0 && (
            <div className="bg-white/10 rounded-2xl p-4">
              <div className="text-white/70 font-bold mb-2 flex items-center gap-2">
                <Users size={18} /> チーム
              </div>
              <ul className="flex flex-col gap-2">
                {teams.map((t) => (
                  <li key={t.id} className="flex items-center gap-3">
                    <span className="w-2 self-stretch rounded-full shrink-0" style={{ background: teamColor(state, t.id) }} />
                    <span className="flex-1 min-w-0 text-2xl font-black truncate">{t.name}</span>
                    <span className="text-3xl font-black tabular-nums text-sky-300">{getTeamDisplayScore(t.id, state)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <div className="bg-white rounded-2xl p-4 flex flex-col items-center text-slate-800">
            <QrSvg text={inviteUrl(roomId)} size={190} />
            <div className="mt-2 font-black">読み取って参加</div>
            <div className="text-sm text-slate-600">部屋コード {roomId}</div>
          </div>
        </aside>
      </div>
    </div>
  );
};
