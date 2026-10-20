// 結果発表：表彰台（上位3人）・チームの結果・最終順位。ホストが出すと全員の画面に表示される。
// 自分の順位は一番上に大きく出し、一覧でも強調する

import { useRef } from 'react';
import { rankPlayers, scoreText, statusText } from '../lib/ranking.js';
import { winRanks } from '../lib/rules.js';
import { calcTeamScore, getTeamDisplayScore } from '../lib/score.js';
import { Crown, Trophy, Users, X } from '../ui/icons.jsx';
import { Button, Card, IconButton, useDialog } from '../ui/primitives.jsx';
import { Confetti } from './Confetti.jsx';
import { teamColor } from './Teams.jsx';

const PODIUM = [
  { place: 2, h: 'h-24', color: 'bg-medal-2', delay: '0.3s' },
  { place: 1, h: 'h-36', color: 'bg-medal-1', delay: '0.7s' },
  { place: 3, h: 'h-16', color: 'bg-medal-3', delay: '0s' },
];

export const ResultOverlay = ({ state, isHost, myPlayerId, onClose }) => {
  const sorted = rankPlayers(state);
  const ranks = winRanks(state.players);
  const status = (p) => statusText(p, ranks);
  const myRank = sorted.findIndex((p) => p.id === myPlayerId) + 1;
  const teams = [...state.teams].sort((a, b) => calcTeamScore(b.id, state) - calcTeamScore(a.id, state));
  const ref = useRef(null);
  // ホストの Esc では全員の結果発表を終えない（終えるのはボタンだけ）
  useDialog(true, isHost ? null : onClose, ref);
  return (
    <div className="fixed inset-0 z-50 bg-slate-900/70 flex items-center justify-center p-4 animate-fade-in" data-result>
      <Confetti count={90} />
      <Card
        ref={ref}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label="結果発表"
        className="outline-none w-full max-w-lg max-h-[92vh] overflow-y-auto p-6 relative"
      >
        <IconButton label="閉じる" onClick={onClose} className="absolute top-3 right-3">
          <X size={20} />
        </IconButton>
        <h2 className="text-center text-3xl font-black text-brand-ink flex items-center justify-center gap-2">
          <Trophy size={30} /> 結果発表
        </h2>
        {myRank > 0 && (
          <p className="text-center mt-2 font-black text-ink" data-my-result>
            あなたは <span className="text-3xl text-brand-ink tabular-nums">{myRank}</span> 位
            {myRank === 1 ? '！おめでとう！' : myRank <= 3 ? '！' : ''}
          </p>
        )}
        <div className="flex items-end justify-center gap-3 mt-5 mb-6">
          {PODIUM.map(({ place, h, color, delay }) => {
            const p = sorted[place - 1];
            return (
              <div key={place} className="flex flex-col items-center w-24 motion-safe:animate-rise" style={{ animationDelay: delay }}>
                {p ? (
                  <>
                    {place === 1 && <Crown className="w-9 h-9 text-medal-1 drop-shadow" fill="currentColor" />}
                    <div
                      className={`font-black text-center leading-tight break-all ${p.id === myPlayerId ? 'text-brand-ink' : 'text-ink'}`}
                    >
                      {p.name}
                    </div>
                    <div className="text-sm font-bold text-ink-2 mb-1 tabular-nums">{scoreText(state, p)}</div>
                  </>
                ) : (
                  <div className="text-ink-3 text-sm mb-1">—</div>
                )}
                <div
                  className={`w-full ${h} rounded-t-2xl ${color} flex items-start justify-center pt-2 text-3xl font-black text-medal-ink shadow-lg`}
                >
                  {place}
                </div>
              </div>
            );
          })}
        </div>
        {teams.length > 0 && (
          <div className="mb-4" data-team-result>
            <div className="text-xs font-bold text-ink-3 mb-1.5 flex items-center gap-1">
              <Users size={14} /> チームの結果
            </div>
            <ol className="flex flex-col gap-1.5">
              {teams.map((t, i) => (
                <li key={t.id} className="flex items-center gap-3 rounded-xl px-3 py-2 bg-sunken">
                  <span className="w-7 text-center font-black text-ink-2 tabular-nums">{i + 1}</span>
                  <span className="w-2 self-stretch rounded-full shrink-0" style={{ background: teamColor(state, t.id) }} />
                  <span className="flex-1 min-w-0 truncate font-black text-ink flex items-center gap-1">
                    {i === 0 && <Crown size={16} className="text-medal-1 shrink-0" fill="currentColor" />}
                    {t.name}
                  </span>
                  <span className="font-black text-ink tabular-nums text-lg">{getTeamDisplayScore(t.id, state)}</span>
                </li>
              ))}
            </ol>
          </div>
        )}
        <div className="text-xs font-bold text-ink-3 mb-1.5">最終順位</div>
        <ol className="flex flex-col gap-1.5">
          {sorted.map((p, i) => (
            <li
              key={p.id}
              className={`flex items-center gap-3 rounded-xl px-3 py-2 ${p.id === myPlayerId ? 'bg-brand-soft ring-2 ring-brand/60' : 'bg-sunken'}`}
            >
              <span className="w-7 text-center font-black text-ink-2 tabular-nums">{i + 1}</span>
              <span className="flex-1 min-w-0 truncate font-bold text-ink">
                {p.name}
                {p.id === myPlayerId && <span className="ml-1 text-xs text-brand-ink">（あなた）</span>}
              </span>
              {status(p) && <span className="text-xs font-bold text-ink-3">{status(p)}</span>}
              <span className="font-black text-ink tabular-nums">{scoreText(state, p)}</span>
            </li>
          ))}
        </ol>
        <Button variant={isHost ? 'primary' : 'secondary'} className="w-full py-3 mt-5" onClick={onClose}>
          {isHost ? '結果発表を終える' : '閉じる'}
        </Button>
      </Card>
    </div>
  );
};

// 大画面（プロジェクタ）用の結果発表：画面いっぱいに、遠くからでも読める大きさで。いつも暗い配色
const BIG_PODIUM = [
  { place: 2, h: 'h-40', color: 'bg-medal-2', delay: '0.4s' },
  { place: 1, h: 'h-56', color: 'bg-medal-1', delay: '1s' },
  { place: 3, h: 'h-28', color: 'bg-medal-3', delay: '0s' },
];

export const BoardResult = ({ state }) => {
  const sorted = rankPlayers(state);
  const ranks = winRanks(state.players);
  const teams = [...state.teams].sort((a, b) => calcTeamScore(b.id, state) - calcTeamScore(a.id, state));
  const rest = sorted.slice(3);
  return (
    <div
      className="fixed inset-0 z-50 bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 text-white p-6 lg:p-10 flex flex-col gap-6 overflow-y-auto"
      data-result
      data-board-result
    >
      <Confetti count={140} />
      <h2 className="text-center text-5xl lg:text-6xl font-black text-amber-300 flex items-center justify-center gap-4">
        <Trophy size={56} /> 結果発表
      </h2>
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] gap-8 items-end">
        <div className="flex items-end justify-center gap-4">
          {BIG_PODIUM.map(({ place, h, color, delay }) => {
            const p = sorted[place - 1];
            return (
              <div
                key={place}
                className="flex flex-col items-center w-44 lg:w-52 motion-safe:animate-rise"
                style={{ animationDelay: delay }}
              >
                {p ? (
                  <>
                    {place === 1 && <Crown className="w-16 h-16 text-amber-300" fill="currentColor" />}
                    <div className="text-3xl lg:text-4xl font-black text-center leading-tight break-all">{p.name}</div>
                    <div className="text-2xl font-black text-white/80 mb-2 tabular-nums">{scoreText(state, p)}</div>
                  </>
                ) : (
                  <div className="text-white/60 text-2xl mb-2">—</div>
                )}
                <div
                  className={`w-full ${h} rounded-t-3xl ${color} flex items-start justify-center pt-3 text-7xl font-black text-medal-ink`}
                >
                  {place}
                </div>
              </div>
            );
          })}
        </div>
        <div className="flex flex-col gap-5 self-stretch justify-end">
          {teams.length > 0 && (
            <div className="bg-white/10 rounded-3xl p-5">
              <div className="text-white/70 font-bold mb-2 flex items-center gap-2 text-lg">
                <Users size={20} /> チームの結果
              </div>
              <ol className="flex flex-col gap-2">
                {teams.map((t, i) => (
                  <li key={t.id} className="flex items-center gap-3">
                    <span className="w-8 text-2xl font-black text-white/70 tabular-nums">{i + 1}</span>
                    <span className="w-2.5 self-stretch rounded-full shrink-0" style={{ background: teamColor(state, t.id) }} />
                    <span className="flex-1 min-w-0 truncate text-3xl font-black flex items-center gap-2">
                      {i === 0 && <Crown size={26} className="text-amber-300 shrink-0" fill="currentColor" />}
                      {t.name}
                    </span>
                    <span className="text-4xl font-black text-sky-300 tabular-nums">{getTeamDisplayScore(t.id, state)}</span>
                  </li>
                ))}
              </ol>
            </div>
          )}
          {rest.length > 0 && (
            <ol className="grid gap-2 grid-cols-[repeat(auto-fill,minmax(min(100%,16rem),1fr))]" start={4}>
              {rest.map((p, i) => (
                <li key={p.id} className="flex items-center gap-3 bg-white/10 rounded-2xl px-4 py-2">
                  <span className="w-8 text-xl font-black text-white/70 tabular-nums">{i + 4}</span>
                  <span className="flex-1 min-w-0 truncate text-2xl font-black">{p.name}</span>
                  {statusText(p, ranks) && <span className="text-sm font-bold text-white/70 shrink-0">{statusText(p, ranks)}</span>}
                  <span className="text-2xl font-black tabular-nums">{scoreText(state, p)}</span>
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>
    </div>
  );
};
