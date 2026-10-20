// 画面：大画面モード（?room=XXXX&view=board）。プロジェクタ用で操作 UI は無い

import { useMemo } from 'react';
import { inviteUrl, QrSvg } from '../components/InviteDialog.jsx';
import { WinToast } from '../components/WinToast.jsx';
import { rankPlayers, scoreText } from '../lib/ranking.js';
import { isRuleMode, playerState, ruleLabel, winRanks } from '../lib/rules.js';
import { calcTeamScore, getTeamDisplayScore } from '../lib/score.js';
import { Crown, Users } from '../ui/icons.jsx';

const MEDAL = ['bg-amber-400', 'bg-slate-400', 'bg-orange-400'];

const StatusTag = ({ p, q, rank }) => {
  const st = playerState(p, q);
  if (st.kind === 'win') return <span className="text-base font-black bg-emerald-500 rounded-full px-3 py-0.5">勝ち抜け {rank}位</span>;
  if (st.kind === 'lose') return <span className="text-base font-black bg-slate-600 rounded-full px-3 py-0.5">脱落</span>;
  if (st.kind === 'rest') return <span className="text-base font-black bg-sky-600 rounded-full px-3 py-0.5">休み {st.restLeft}</span>;
  return null;
};

export const BoardView = ({ state, roomId }) => {
  const sorted = useMemo(() => rankPlayers(state), [state.players, state.rule, state.scoreMode]);
  const ranks = useMemo(() => winRanks(state.players), [state.players]);
  const rule = isRuleMode(state.rule);
  const teams = [...state.teams].sort((a, b) => calcTeamScore(b.id, state) - calcTeamScore(a.id, state));
  const q = state.q || 1;
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-950 text-white p-6 lg:p-10 flex flex-col gap-6" data-board>
      <WinToast state={state} />
      <header className="flex items-center gap-4 flex-wrap">
        <div className="bg-amber-400 text-slate-900 rounded-2xl px-5 py-2 font-black text-3xl"># {roomId}</div>
        <div className="text-2xl lg:text-3xl font-black text-amber-300">{ruleLabel(state.rule)}</div>
        <div className="ml-auto text-6xl lg:text-7xl font-black tracking-tight">Q{q}</div>
      </header>
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6 items-start">
        <ol className="grid gap-3 grid-cols-1 xl:grid-cols-2">
          {sorted.map((p, i) => {
            const st = playerState(p, q);
            return (
              <li
                key={p.id}
                className={`flex items-center gap-4 rounded-3xl px-5 py-3 ${st.kind === 'win' ? 'bg-emerald-500/20 ring-2 ring-emerald-400' : 'bg-white/10'} ${st.kind === 'lose' ? 'opacity-50' : ''}`}
              >
                <span className={`w-14 h-14 shrink-0 rounded-2xl flex items-center justify-center text-3xl font-black relative ${i < 3 ? MEDAL[i] : 'bg-white/15'}`}>
                  {i === 0 && <Crown className="absolute -top-5 -left-3 w-9 h-9 text-amber-300" fill="currentColor" />}
                  {i + 1}
                </span>
                <span className="flex-1 min-w-0">
                  <span className="block text-3xl font-black truncate">{p.name}</span>
                  <span className="flex items-center gap-2 text-lg font-bold text-white/70">
                    {rule && (
                      <span>
                        〇{p.maru || 0} ✕{p.batsu || 0}
                      </span>
                    )}
                    {rule && <StatusTag p={p} q={q} rank={ranks[p.id]} />}
                  </span>
                </span>
                <span className="text-5xl font-black tabular-nums">{scoreText(state, p)}</span>
              </li>
            );
          })}
          {!sorted.length && <li className="text-white/50 text-2xl font-bold">参加者を待っています…</li>}
        </ol>
        <aside className="flex flex-col gap-4">
          {teams.length > 0 && (
            <div className="bg-white/10 rounded-3xl p-5">
              <div className="text-white/60 font-bold mb-2 flex items-center gap-2">
                <Users size={18} /> チーム
              </div>
              <ul className="flex flex-col gap-2">
                {teams.map((t) => (
                  <li key={t.id} className="flex items-center justify-between gap-3">
                    <span className="text-2xl font-black truncate">{t.name}</span>
                    <span className="text-3xl font-black text-sky-300">{getTeamDisplayScore(t.id, state)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <div className="bg-white rounded-3xl p-4 flex flex-col items-center text-slate-800">
            <QrSvg text={inviteUrl(roomId)} size={200} />
            <div className="mt-2 font-black">読み取って参加</div>
            <div className="text-sm text-slate-500">部屋コード {roomId}</div>
          </div>
        </aside>
      </div>
    </div>
  );
};
