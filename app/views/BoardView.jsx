// 画面：大画面モード（?room=XXXX&view=board）。プロジェクタ用で操作 UI は無い。いつも暗い配色。
// 人数が多くても1画面に収まるよう、幅に合わせて列を増やす

import { useMemo, useRef } from 'react';
import { inviteUrl, QrSvg } from '../components/InviteDialog.jsx';
import { teamColor } from '../components/Teams.jsx';
import { WinToast } from '../components/WinToast.jsx';
import { rankPlayers, scoreText } from '../lib/ranking.js';
import { isRuleMode, playerState, ruleLabel, winRanks } from '../lib/rules.js';
import { calcTeamScore, getTeamDisplayScore, parseScoreToNumber } from '../lib/score.js';
import { Crown, Users } from '../ui/icons.jsx';
import { useFlip, useRankUps } from '../ui/motion.js';

const MEDAL = ['bg-medal-1 text-medal-ink', 'bg-medal-2 text-medal-ink', 'bg-medal-3 text-medal-ink'];

const StatusTag = ({ st, rank }) => {
  if (st.kind === 'win') return <span className="text-sm font-black text-white bg-emerald-700 rounded-full px-2.5 py-0.5 whitespace-nowrap">勝ち抜け {rank}位</span>;
  if (st.kind === 'lose') return <span className="text-sm font-black text-white bg-slate-600 rounded-full px-2.5 py-0.5">脱落</span>;
  if (st.kind === 'rest') return <span className="text-sm font-black text-white bg-sky-700 rounded-full px-2.5 py-0.5 whitespace-nowrap">休み {st.restLeft}</span>;
  return null;
};

export const BoardView = ({ state, roomId }) => {
  const sorted = useMemo(() => rankPlayers(state), [state.players, state.rule, state.scoreMode]);
  const ranks = useMemo(() => winRanks(state.players), [state.players]);
  const rule = isRuleMode(state.rule);
  const teams = [...state.teams].sort((a, b) => calcTeamScore(b.id, state) - calcTeamScore(a.id, state));
  const q = state.q || 1;
  const many = sorted.length > 8;
  const listRef = useRef(null);
  useFlip(listRef);
  const ups = useRankUps(sorted.map((p) => p.id));
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-950 text-white p-5 lg:p-8 flex flex-col gap-5" data-board>
      <WinToast state={state} />
      <header className="flex items-center gap-4 flex-wrap">
        <div className="bg-amber-400 text-slate-900 rounded-2xl px-5 py-2 font-black text-3xl tabular-nums"># {roomId}</div>
        <div className="text-2xl lg:text-3xl font-black text-amber-300 min-w-0 truncate">{ruleLabel(state.rule)}</div>
        <div className="ml-auto text-6xl lg:text-7xl font-black tracking-tight tabular-nums">Q{q}</div>
      </header>
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-5 items-start">
        <ol ref={listRef} className={`grid gap-2.5 ${many ? 'grid-cols-[repeat(auto-fill,minmax(min(100%,20rem),1fr))]' : 'grid-cols-[repeat(auto-fill,minmax(min(100%,26rem),1fr))]'}`}>
          {sorted.map((p, i) => {
            const st = playerState(p, q);
            const scored = st.kind === 'win' || parseScoreToNumber(p.score) > 0 || (p.maru || 0) > 0;
            const medal = i < 3 && scored && st.kind !== 'lose';
            const color = teamColor(state, p.teamId);
            return (
              <li
                key={p.id}
                data-flip-id={p.id}
                className={`flex items-center gap-3 rounded-2xl ${many ? 'px-3 py-2' : 'px-4 py-3'} ${
                  st.kind === 'win' ? 'bg-emerald-500/20 ring-2 ring-emerald-400' : st.kind === 'lose' ? 'bg-white/5' : 'bg-white/10'
                }`}
              >
                <span
                  className={`${many ? 'w-11 h-11 text-2xl' : 'w-14 h-14 text-3xl'} shrink-0 rounded-xl flex items-center justify-center font-black relative tabular-nums ${medal ? MEDAL[i] : 'bg-white/15'}`}
                >
                  {i === 0 && medal && <Crown className="absolute -top-4 -left-3 w-8 h-8 text-amber-300 -rotate-12" fill="currentColor" />}
                  {i + 1}
                </span>
                <span className="flex-1 min-w-0">
                  <span className={`flex items-center gap-2 ${many ? 'text-2xl' : 'text-3xl'} font-black min-w-0 ${st.kind === 'lose' ? 'text-white/60' : ''}`}>
                    {color && <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: color }} />}
                    <span className="truncate">{p.name}</span>
                    {ups[p.id] && (
                      <span className="shrink-0 text-base font-black text-white bg-emerald-700 rounded-full px-2 py-0.5 motion-safe:animate-pop">▲{ups[p.id].d}</span>
                    )}
                  </span>
                  {rule && (
                    <span className="flex items-center gap-2 text-base font-bold text-white/80 mt-0.5">
                      <span className="tabular-nums">
                        〇{p.maru || 0} ✕{p.batsu || 0}
                      </span>
                      <StatusTag st={st} rank={ranks[p.id]} />
                    </span>
                  )}
                </span>
                <span className={`${many ? 'text-4xl' : 'text-5xl'} font-black tabular-nums ${st.kind === 'lose' ? 'text-white/60' : ''}`}>{scoreText(state, p)}</span>
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
