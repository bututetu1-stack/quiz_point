// チーム：得点の帯（表示専用）と、自分の所属を選ぶボタン・選択肢

import { calcTeamScore, getTeamDisplayScore } from '../lib/score.js';
import { Check, Crown, Users } from '../ui/icons.jsx';

// チームの色（作った順に固定。得点の順位では変えない）
export const TEAM_COLORS = ['#f43f5e', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#06b6d4', '#ec4899', '#84cc16'];
export const teamColor = (state, teamId) => {
  const i = state.teams.findIndex((t) => t.id === teamId);
  return i < 0 ? null : TEAM_COLORS[i % TEAM_COLORS.length];
};

export const TeamBoard = ({ state }) => {
  if (!state.teams.length) return null;
  const sorted = [...state.teams].sort((a, b) => calcTeamScore(b.id, state) - calcTeamScore(a.id, state));
  const top = calcTeamScore(sorted[0].id, state);
  return (
    <div className="flex gap-2 overflow-x-auto -mx-3 px-3 sm:mx-0 sm:px-0 pb-0.5" data-teams>
      {sorted.map((team) => {
        const lead = sorted.length > 1 && calcTeamScore(team.id, state) === top && top !== 0;
        return (
          <div key={team.id} className="shrink-0 min-w-[7.5rem] flex-1 bg-card border border-line rounded-2xl pl-2 pr-3 py-1.5 flex items-stretch gap-2.5 shadow-sm">
            <span className="w-1.5 rounded-full shrink-0" style={{ background: teamColor(state, team.id) }} />
            <span className="min-w-0">
              <span className="flex items-center gap-1 text-xs font-bold text-ink-2 truncate">
                {lead && <Crown size={13} className="text-medal-1 shrink-0" fill="currentColor" />}
                <span className="truncate">{team.name}</span>
              </span>
              <span className="block text-xl font-black tabular-nums text-ink leading-tight">{getTeamDisplayScore(team.id, state)}</span>
            </span>
          </div>
        );
      })}
    </div>
  );
};

// 自分の所属（押すとチームの選択肢を開く）。未所属のうちは目立たせる
export const TeamButton = ({ state, myPlayer, onOpen }) => {
  if (!state.teams || !state.teams.length || !myPlayer) return null;
  const team = state.teams.find((t) => t.id === myPlayer.teamId);
  return (
    <button
      onClick={onOpen}
      className={`shrink-0 flex items-center gap-1 px-2.5 py-1.5 rounded-full text-xs font-bold border transition-colors max-w-[7rem] ${
        team ? 'bg-card text-ink-2 border-line hover:border-brand/60' : 'bg-brand text-on-brand border-brand motion-safe:animate-attn'
      }`}
      data-team-button
    >
      {team ? <span className="w-2 h-2 rounded-full shrink-0" style={{ background: teamColor(state, team.id) }} /> : <Users size={14} />}
      <span className="truncate">{team ? team.name : 'チームを選ぶ'}</span>
    </button>
  );
};

export const TeamChoices = ({ state, myPlayer, onOp, onDone }) => {
  const cur = myPlayer.teamId || '';
  const item = (key, label, teamId, color) => (
    <button
      key={key}
      onClick={() => {
        onOp('assignTeam', { playerId: myPlayer.id, teamId });
        onDone();
      }}
      className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl text-left font-bold border transition-colors ${
        cur === key ? 'bg-brand-soft border-brand/60 text-brand-ink' : 'bg-card border-line text-ink hover:bg-sunken'
      }`}
    >
      <span className="w-3 h-3 rounded-full shrink-0 border border-line" style={color ? { background: color, borderColor: color } : undefined} />
      <span className="flex-1 min-w-0 truncate">{label}</span>
      {cur === key && <Check size={18} />}
    </button>
  );
  return (
    <div className="flex flex-col gap-2" data-team-choices>
      {state.teams.map((t) => item(t.id, t.name, t.id, teamColor(state, t.id)))}
      {item('', '未所属', null, null)}
    </div>
  );
};
