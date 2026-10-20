// プレイヤー一覧（ランキング）

import { useMemo } from 'react';
import { isRuleMode, playerState, progressHint, sortForRule, winRanks } from '../lib/rules.js';
import { formatScoreStr, memberValue, parseScoreToNumber } from '../lib/score.js';
import { Crown, Edit2, Trash2, Users } from '../ui/icons.jsx';
import { Badge, Card } from '../ui/primitives.jsx';

// ルール時の状態バッジ（勝ち抜け n 位 / 失格 / 休み あと k 問）
const StateBadge = ({ st, winRank }) => {
  if (st.kind === 'win') return <Badge color="bg-emerald-500 text-white shadow-sm">勝ち抜け {winRank}位</Badge>;
  if (st.kind === 'lose') return <Badge color="bg-slate-500 text-white">失格</Badge>;
  if (st.kind === 'rest') return <Badge color="bg-sky-100 text-sky-700 border border-sky-200">休み あと{st.restLeft}問</Badge>;
  return null;
};

export const PlayerRow = ({ player, rank, state, isMe, onRename, onRemove, winRank }) => {
  const team = state.teams.find((t) => t.id === player.teamId);
  const rule = isRuleMode(state.rule);
  const simple = !rule && state.scoreMode === 'simple';
  const st = rule ? playerState(player, state.q || 1) : { kind: 'play' };
  const isTop = rank === 1 && (rule ? st.kind === 'win' || parseScoreToNumber(player.score) > 0 : simple ? (player.maru || 0) > 0 : memberValue(player, 'addsub') > 0);
  const scoreText = simple ? `${player.maru || 0} - ${player.batsu || 0}` : formatScoreStr(player.score);
  const rowColor = isMe ? 'border-amber-400 bg-amber-50' : st.kind === 'win' ? 'border-emerald-300 bg-emerald-50' : 'border-transparent bg-slate-50';
  return (
    <div
      data-player-id={player.id}
      className={`relative flex flex-col md:flex-row md:items-center gap-4 p-4 rounded-3xl border-2 transition-all ${rowColor} ${st.kind === 'lose' ? 'opacity-60' : ''}`}
    >
      <div className="flex items-center gap-3 w-full md:flex-1 min-w-0">
        <div className="w-12 h-12 shrink-0 flex items-center justify-center rounded-2xl bg-white shadow-sm text-xl font-black text-slate-700 relative">
          {isTop && <Crown className="absolute -top-4 -left-2 w-8 h-8 text-amber-400 drop-shadow-md" fill="currentColor" />}
          {rank}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 min-w-0 flex-wrap">
            <h3 className="font-bold text-lg text-slate-800 truncate">{player.name}</h3>
            {isMe && <Badge color="bg-amber-400 text-white shadow-sm">YOU</Badge>}
            {rule && <StateBadge st={st} winRank={winRank} />}
          </div>
          <div className="text-xs font-bold text-slate-400 mt-0.5 flex items-center gap-2 flex-wrap">
            {team && (
              <span className="flex items-center gap-1">
                <Users size={12} /> {team.name}
              </span>
            )}
            {rule && (
              <span className="text-slate-500">
                <span className="text-emerald-600">〇{player.maru || 0}</span> <span className="text-rose-500">✕{player.batsu || 0}</span>
              </span>
            )}
            {rule && st.kind !== 'win' && st.kind !== 'lose' && progressHint(state.rule, player) && <span>{progressHint(state.rule, player)}</span>}
          </div>
        </div>
        <div className="md:hidden text-3xl font-black text-slate-800 tracking-tighter shrink-0">{scoreText}</div>
      </div>
      <div className="hidden md:block text-4xl font-black text-slate-800 tracking-tighter w-32 text-center shrink-0">{scoreText}</div>
      {(onRename || onRemove) && (
        <div className="flex md:flex-col gap-1 justify-end shrink-0">
          {onRename && (
            <button
              onClick={() => {
                const n = prompt('新しい名前', player.name);
                if (n && n.trim()) onRename(player.id, n.trim());
              }}
              className="p-1.5 text-slate-300 hover:text-amber-500 rounded-lg"
              title="名前を変える"
            >
              <Edit2 size={16} />
            </button>
          )}
          {onRemove && (
            <button
              onClick={() => {
                if (window.confirm(`${player.name} を削除しますか？`)) onRemove(player.id);
              }}
              className="p-1.5 text-slate-300 hover:text-rose-500 rounded-lg"
              title="削除"
            >
              <Trash2 size={16} />
            </button>
          )}
        </div>
      )}
    </div>
  );
};

// 自由計算の並び（従来どおり）
const sortFree = (players, simple) =>
  [...players].sort((a, b) => {
    if (simple) {
      if ((b.maru || 0) !== (a.maru || 0)) return (b.maru || 0) - (a.maru || 0);
      if ((a.batsu || 0) !== (b.batsu || 0)) return (a.batsu || 0) - (b.batsu || 0);
      return (a.name || '').localeCompare(b.name || '');
    }
    const d = parseScoreToNumber(b.score) - parseScoreToNumber(a.score);
    return d !== 0 ? d : (a.name || '').localeCompare(b.name || '');
  });

export const PlayerList = ({ state, myPlayerId, onRename, onRemove }) => {
  const rule = isRuleMode(state.rule);
  const simple = state.scoreMode === 'simple';
  const sorted = useMemo(() => (rule ? sortForRule(state.players) : sortFree(state.players, simple)), [state.players, simple, rule]);
  const ranks = useMemo(() => winRanks(state.players), [state.players]);
  if (!state.players.length) return <Card className="p-8 text-center text-slate-400 font-bold">まだ参加者がいません</Card>;
  return (
    <div className="flex flex-col gap-3">
      {sorted.map((p, i) => (
        <PlayerRow
          key={p.id}
          player={p}
          rank={i + 1}
          state={state}
          isMe={p.id === myPlayerId}
          onRename={onRename}
          onRemove={onRemove}
          winRank={ranks[p.id]}
        />
      ))}
    </div>
  );
};
