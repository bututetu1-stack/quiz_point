// チームボード（表示専用）とチーム自己選択

import { calcTeamScore, getTeamDisplayScore } from '../lib/score.js';
import { Users } from '../ui/icons.jsx';

export const TeamBoard = ({ state }) => {
  if (!state.teams.length) return null;
  const sorted = [...state.teams].sort((a, b) => calcTeamScore(b.id, state) - calcTeamScore(a.id, state));
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
      {sorted.map((team, index) => (
        <div key={team.id} className="bg-white rounded-3xl p-4 shadow-lg shadow-sky-100 border-b-4 border-sky-400 relative overflow-hidden">
          {index === 0 && <div className="absolute -top-2 -right-2 bg-amber-400 w-12 h-12 rotate-45" />}
          <div className="text-sm font-bold text-slate-500 mb-1 flex items-center gap-1">
            <Users size={14} /> {team.name}
          </div>
          <div className="text-2xl md:text-3xl font-black text-sky-600">{getTeamDisplayScore(team.id, state)}</div>
        </div>
      ))}
    </div>
  );
};

// チーム自己選択（自分の所属をタップで変更）
export const TeamPicker = ({ state, myPlayer, onOp }) => {
  if (!state.teams || !state.teams.length || !myPlayer) return null;
  const cur = myPlayer.teamId || '';
  const chip = (key, label, teamId) => (
    <button
      key={key}
      onClick={() =>
        onOp('assignTeam', {
          playerId: myPlayer.id,
          teamId,
        })
      }
      className={`shrink-0 px-3 py-1.5 rounded-full text-sm font-bold border-2 transition-colors ${cur === key ? 'bg-sky-500 text-white border-sky-500' : 'bg-white text-slate-500 border-slate-200 hover:border-sky-300'}`}
    >
      {label}
    </button>
  );
  return (
    <div className="flex items-center gap-2 mb-2 overflow-x-auto">
      <span className="text-xs font-bold text-slate-400 shrink-0 flex items-center gap-1">
        <Users size={14} />
        {' チーム'}
      </span>
      {chip('', '未所属', null)}
      {state.teams.map((t) => chip(t.id, t.name, t.id))}
    </div>
  );
};
