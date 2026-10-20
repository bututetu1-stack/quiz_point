// 並び順（ランキング・大画面・結果発表・CSV で共通）。観戦中の人は state.players に入っていない

import { isRuleMode, recOf, sortForRule, winRanks } from './rules.js';
import { formatScoreStr, parseScoreToNumber } from './score.js';

// 自由計算の並び：Simple は〇の多い順（同数なら✕の少ない順）、それ以外は得点の高い順
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

export const isSimpleFree = (state) => !isRuleMode(state.rule) && state.scoreMode === 'simple';

export const rankPlayers = (state) =>
  isRuleMode(state.rule) ? sortForRule(state.players, state.rule) : sortFree(state.players, isSimpleFree(state));

// 表示用の得点（Simple は「〇 - ✕」）
export const scoreText = (state, p) => (isSimpleFree(state) ? `${p.maru || 0} - ${p.batsu || 0}` : formatScoreStr(p.score));

// 比較用の数値
const value = (state, p) => (isSimpleFree(state) ? (p.maru || 0) - (p.batsu || 0) : parseScoreToNumber(p.score));

// 自分の順位と「1位まであと何点」（勝ち抜け・脱落が決まった人と観戦中の人は null）
export const myStanding = (state, me) => {
  if (!me) return null;
  const sorted = rankPlayers(state);
  const rank = sorted.findIndex((p) => p.id === me.id) + 1;
  if (!rank || me.status) return { rank, gap: null };
  const leader = sorted.find((p) => !p.status || p.status === 'win');
  const top = isRuleMode(state.rule) ? sorted.find((p) => !p.status) : leader;
  const gap = top && top.id !== me.id ? value(state, top) - value(state, me) : 0;
  return { rank, gap: Number(gap.toFixed(2)) };
};

// 状態の表示（勝ち抜け n位 / 脱落）
export const statusText = (p, ranks) => (p.status === 'win' ? `勝ち抜け${ranks[p.id] || ''}位` : p.status === 'lose' ? '脱落' : '');

// CSV（順位,名前,チーム,得点,〇,✕,状態 と、この部屋での累計）
export const toCsv = (state) => {
  const ranks = winRanks(state.players);
  const team = (p) => (state.teams.find((t) => t.id === p.teamId) || {}).name || '';
  const esc = (v) => {
    const s = String(v == null ? '' : v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const rows = [['順位', '名前', 'チーム', '得点', '〇', '✕', '状態', '累計〇', '累計✕', '勝ち抜け回数', '脱落回数']];
  rankPlayers(state).forEach((p, i) => {
    const rec = recOf(p);
    rows.push([i + 1, p.name, team(p), formatScoreStr(p.score), p.maru || 0, p.batsu || 0, statusText(p, ranks), rec.o, rec.x, rec.win, rec.lose]);
  });
  return rows.map((r) => r.map(esc).join(',')).join('\n');
};
