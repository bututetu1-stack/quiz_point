// 得点の数値化・表示とチーム得点の計算

export const parseScoreToNumber = (scoreStr) => {
  if (!scoreStr && scoreStr !== 0) return 0;
  const str = scoreStr.toString();
  const parts = str.split('/');
  if (parts.length === 2) {
    return parseInt(parts[0], 10) / parseInt(parts[1], 10);
  }
  return parseFloat(str) || 0;
};
export const formatScoreStr = (scoreStr) => {
  const val = parseScoreToNumber(scoreStr);
  if (Number.isInteger(val)) return val.toString();
  return Number(val.toFixed(2)).toString(); // 小数第2位まで、末尾0除去
};

export const QUICK_PRESETS = [1, 2, 3, 4, 5];
export const fmtNum = (v) => (Number.isInteger(v) ? v : Number(v.toFixed(2)));
export const memberValue = (p, scoreMode) => (scoreMode === 'simple' ? (p.maru || 0) - (p.batsu || 0) : parseScoreToNumber(p.score));
export const calcTeamMaruBatsu = (members) =>
  members.reduce(
    (a, m) => ({
      maru: a.maru + (m.maru || 0),
      batsu: a.batsu + (m.batsu || 0),
    }),
    {
      maru: 0,
      batsu: 0,
    },
  );
// ルール（自由計算以外）ではメンバーの得点の合計
const ruleMode = (state) => !!state.rule && state.rule.type !== 'free';

export const calcTeamScore = (teamId, state) => {
  const members = state.players.filter((p) => p.teamId === teamId);
  if (!members.length) return 0;
  if (ruleMode(state)) return members.reduce((a, p) => a + parseScoreToNumber(p.score), 0);
  if (state.scoreMode === 'simple') {
    const mb = calcTeamMaruBatsu(members);
    return mb.maru - mb.batsu;
  }
  const scores = members.map((p) => parseScoreToNumber(p.score));
  return state.teamMode === 'product' ? scores.reduce((a, v) => a * v, 1) : scores.reduce((a, v) => a + v, 0);
};
export const getTeamDisplayScore = (teamId, state) => {
  if (!ruleMode(state) && state.scoreMode === 'simple') {
    const mb = calcTeamMaruBatsu(state.players.filter((p) => p.teamId === teamId));
    return `${mb.maru} － ${mb.batsu}`;
  }
  return String(fmtNum(calcTeamScore(teamId, state)));
};

