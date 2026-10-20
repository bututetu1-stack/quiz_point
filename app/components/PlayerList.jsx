// プレイヤー一覧（ランキング）

import { useMemo } from 'react';
import { formatScoreStr, memberValue, parseScoreToNumber } from '../lib/score.js';
import { Crown, Edit2, Trash2, Users } from '../ui/icons.jsx';
import { Badge, Card } from '../ui/primitives.jsx';

export const PlayerRow = ({ player, rank, state, isMe, onRename, onRemove }) => {
  const team = state.teams.find((t) => t.id === player.teamId);
  const simple = state.scoreMode === 'simple';
  const isTop = rank === 1 && (simple ? (player.maru || 0) > 0 : memberValue(player, 'addsub') > 0);
  const scoreText = simple ? `${player.maru || 0} - ${player.batsu || 0}` : formatScoreStr(player.score);
  return (
    <div
      data-player-id={player.id}
      className={`relative flex flex-col md:flex-row md:items-center gap-4 p-4 rounded-3xl border-2 transition-all ${isMe ? 'border-amber-400 bg-amber-50' : 'border-transparent bg-slate-50'}`}
    >
      <div className="flex items-center gap-3 w-full md:flex-1 min-w-0">
        <div className="w-12 h-12 shrink-0 flex items-center justify-center rounded-2xl bg-white shadow-sm text-xl font-black text-slate-700 relative">
          {isTop && <Crown className="absolute -top-4 -left-2 w-8 h-8 text-amber-400 drop-shadow-md" fill="currentColor" />}
          {rank}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 min-w-0">
            <h3 className="font-bold text-lg text-slate-800 truncate">{player.name}</h3>
            {isMe && <Badge color="bg-amber-400 text-white shadow-sm">YOU</Badge>}
          </div>
          {team && (
            <div className="text-xs font-bold text-slate-400 mt-0.5 flex items-center gap-1">
              <Users size={12} /> {team.name}
            </div>
          )}
        </div>
        <div className="md:hidden text-3xl font-black text-slate-800 tracking-tighter shrink-0">{scoreText}</div>
      </div>
      <div className="hidden md:block text-4xl font-black text-slate-800 tracking-tighter w-32 text-center shrink-0">{scoreText}</div>
      {(onRename || onRemove) && (
        <div className="flex md:flex-col gap-1 justify-end shrink-0 nodrag">
          {onRename && (
            <button
              onClick={() => {
                const n = prompt('新しい名前', player.name);
                if (n && n.trim()) onRename(player.id, n.trim());
              }}
              className="p-1.5 text-slate-300 hover:text-amber-500 rounded-lg"
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
            >
              <Trash2 size={16} />
            </button>
          )}
        </div>
      )}
    </div>
  );
};
export const PlayerList = ({ state, myPlayerId, onRename, onRemove }) => {
  const simple = state.scoreMode === 'simple';
  const sorted = useMemo(
    () =>
      [...state.players].sort((a, b) => {
        if (simple) {
          if ((b.maru || 0) !== (a.maru || 0)) return (b.maru || 0) - (a.maru || 0);
          if ((a.batsu || 0) !== (b.batsu || 0)) return (a.batsu || 0) - (b.batsu || 0);
          return (a.name || '').localeCompare(b.name || '');
        }
        const d = parseScoreToNumber(b.score) - parseScoreToNumber(a.score);
        return d !== 0 ? d : (a.name || '').localeCompare(b.name || '');
      }),
    [state.players, simple],
  );
  if (!state.players.length) return <Card className="p-8 text-center text-slate-400 font-bold">まだ参加者がいません</Card>;
  return (
    <div className="flex flex-col gap-3">
      {sorted.map((p, i) => (
        <PlayerRow key={p.id} player={p} rank={i + 1} state={state} isMe={p.id === myPlayerId} onRename={onRename} onRemove={onRemove} />
      ))}
    </div>
  );
};
