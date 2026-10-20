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
// チーム自己選択：普段は「チーム: 赤組 ▾」のボタンだけ。開くと候補のチップを出す
export const TeamButton = ({ state, myPlayer, open, onToggle }) => {
  if (!state.teams || !state.teams.length || !myPlayer) return null;
  const team = state.teams.find((t) => t.id === myPlayer.teamId);
  return (
    <button
      onClick={onToggle}
      aria-expanded={open}
      className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-bold border-2 transition-colors flex items-center gap-1 max-w-[9rem] ${
        team ? 'bg-sky-50 text-sky-700 border-sky-200' : 'bg-amber-50 text-amber-700 border-amber-300'
      }`}
      data-team-button
    >
      <Users size={14} />
      <span className="truncate">{team ? team.name : 'チームを選ぶ'}</span>
      <span aria-hidden="true">{open ? '▴' : '▾'}</span>
    </button>
  );
};

export const TeamChoices = ({ state, myPlayer, onOp, onDone }) => {
  const cur = myPlayer.teamId || '';
  const chip = (key, label, teamId) => (
    <button
      key={key}
      onClick={() => {
        onOp('assignTeam', { playerId: myPlayer.id, teamId });
        onDone();
      }}
      className={`shrink-0 px-3 py-1.5 rounded-full text-sm font-bold border-2 transition-colors ${
        cur === key ? 'bg-sky-500 text-white border-sky-500' : 'bg-white text-slate-500 border-slate-200 hover:border-sky-300'
      }`}
    >
      {label}
    </button>
  );
  return (
    <div className="flex items-center gap-2 mb-2 overflow-x-auto pb-1" data-team-choices>
      {chip('', '未所属', null)}
      {state.teams.map((t) => chip(t.id, t.name, t.id))}
    </div>
  );
};
