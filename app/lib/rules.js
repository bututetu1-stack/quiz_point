// クイズのルール：〇✕を押したときの得点・勝ち抜け・失格・休みを決める純粋関数群。
// 部屋の rule = { type, ...params }。プレイヤーの項目:
//   score（有理数文字列）, maru（〇数）, batsu（✕数。スウェーディッシュは✕の累計）,
//   status（'win' | 'lose' | なし）, winSeq（勝ち抜けた順番の通し番号）,
//   restUntilQ（この問題番号から再び答えられる）, streak（連続正解数）

import { applyOp } from './rational.js';
import { parseScoreToNumber } from './score.js';

export const RULE_TYPES = [
  {
    type: 'nomx',
    label: 'N〇M✕',
    desc: 'N問正解で勝ち抜け、M回誤答で失格。0 にすると制限なし。誤答後の休み・連答ボーナスも設定できる',
    params: [
      { key: 'win', label: '勝ち抜け（〇の数）', min: 0, max: 99, def: 7 },
      { key: 'lose', label: '失格（✕の数）', min: 0, max: 99, def: 3 },
      { key: 'rest', label: '誤答後の休み（問）', min: 0, max: 9, def: 0 },
      { key: 'combo', label: '連答ボーナス（n 連続正解目は +n 点）', bool: true, def: false },
    ],
  },
  {
    type: 'updown',
    label: 'アップダウン',
    desc: '正解で +1、誤答で 0 点に戻る。N 点で勝ち抜け、M 回誤答で失格',
    params: [
      { key: 'win', label: '勝ち抜け（点）', min: 1, max: 99, def: 10 },
      { key: 'lose', label: '失格（✕の数、0 で無し）', min: 0, max: 99, def: 2 },
    ],
  },
  {
    type: 'by',
    label: 'N by N',
    desc: '得点 =〇の数 ×（N −✕の数）。N×N 点で勝ち抜け、✕が N で失格',
    params: [{ key: 'n', label: 'N', min: 2, max: 30, def: 10 }],
  },
  {
    type: 'swedish',
    label: 'スウェーディッシュ',
    desc: '誤答すると、それまでの正解数に応じて✕が付く（0問→1✕・1〜2問→2✕・3〜5問→3✕・6問〜→4✕）。〇 N で勝ち抜け、✕ N で失格',
    params: [{ key: 'n', label: 'N', min: 2, max: 30, def: 10 }],
  },
  {
    type: 'divide',
    label: 'ディバイド',
    desc: '正解で +P 点、誤答で得点が ÷D。N 点で勝ち抜け',
    params: [
      { key: 'pt', label: '正解の点（P）', min: 1, max: 99, def: 1 },
      { key: 'div', label: '誤答で割る数（D）', min: 2, max: 10, def: 2 },
      { key: 'win', label: '勝ち抜け（点）', min: 1, max: 999, def: 10 },
    ],
  },
  {
    type: 'free',
    label: '自由計算',
    desc: '各自が ＋ − × ÷ で自由に得点を付ける（分数・小数も可）。チーム得点は和または積',
    params: [],
  },
];

export const DEFAULT_RULE = { type: 'nomx', win: 0, lose: 0, rest: 0, combo: false };

// 部屋の rule を既定値で補い、範囲内に収める（rule が無い古い部屋は自由計算）
export const normalizeRule = (rule) => {
  const r = rule || { type: 'free' };
  const def = RULE_TYPES.find((d) => d.type === r.type) || RULE_TYPES.find((d) => d.type === 'free');
  const out = { type: def.type };
  def.params.forEach((p) => {
    const v = r[p.key];
    if (p.bool) out[p.key] = v === undefined ? p.def : !!v;
    else {
      const n = Number.isFinite(Number(v)) && v !== '' && v !== null ? Math.round(Number(v)) : p.def;
      out[p.key] = Math.min(p.max, Math.max(p.min, n));
    }
  });
  return out;
};

export const isRuleMode = (rule) => normalizeRule(rule).type !== 'free';

export const ruleLabel = (rule) => {
  const r = normalizeRule(rule);
  switch (r.type) {
    case 'nomx': {
      if (!r.win && !r.lose) return `〇✕カウント${r.rest ? `・誤答${r.rest}休` : ''}${r.combo ? '・連答' : ''}`;
      const base = `${r.win || '∞'}〇${r.lose || '∞'}✕`;
      return base + (r.rest ? `・誤答${r.rest}休` : '') + (r.combo ? '・連答' : '');
    }
    case 'updown':
      return `${r.win}点アップダウン${r.lose ? `（${r.lose}✕失格）` : ''}`;
    case 'by':
      return `${r.n} by ${r.n}`;
    case 'swedish':
      return `スウェーディッシュ ${r.n}`;
    case 'divide':
      return `ディバイド（+${r.pt}・÷${r.div}・${r.win}点）`;
    default:
      return '自由計算';
  }
};

const int = (n) => `${n}/1`;
export const swedishPenalty = (correct) => (correct <= 0 ? 1 : correct <= 2 ? 2 : correct <= 5 ? 3 : 4);

// 今の状態：'win' | 'lose' | 'rest'（restLeft 問） | 'play'
export const playerState = (p, q) => {
  if (p.status === 'win') return { kind: 'win' };
  if (p.status === 'lose') return { kind: 'lose' };
  if (p.restUntilQ && q < p.restUntilQ) return { kind: 'rest', restLeft: p.restUntilQ - q };
  return { kind: 'play' };
};

// 〇✕を1回反映した次のプレイヤーを返す。答えられない状態なら error
export const applyAnswer = (rule, player, result, { q = 1 } = {}) => {
  const r = normalizeRule(rule);
  if (r.type === 'free') return { ok: false, error: 'free_rule' };
  const st = playerState(player, q);
  if (st.kind === 'win' || st.kind === 'lose') return { ok: false, error: 'finished' };
  if (st.kind === 'rest') return { ok: false, error: 'resting' };
  const p = { ...player, maru: player.maru || 0, batsu: player.batsu || 0, score: player.score || '0/1', streak: player.streak || 0 };
  p.restUntilQ = null;
  const ok = result === 'correct';
  if (ok) p.maru += 1;
  switch (r.type) {
    case 'nomx':
      if (ok) {
        p.streak += 1;
        p.score = r.combo ? applyOp(p.score, '+', int(p.streak)) : int(p.maru);
        if (r.win && (r.combo ? parseScoreToNumber(p.score) : p.maru) >= r.win) p.status = 'win';
      } else {
        p.batsu += 1;
        p.streak = 0;
        if (r.rest) p.restUntilQ = q + r.rest + 1;
        if (r.lose && p.batsu >= r.lose) p.status = 'lose';
      }
      break;
    case 'updown':
      if (ok) {
        p.score = applyOp(p.score, '+', '1/1');
        if (parseScoreToNumber(p.score) >= r.win) p.status = 'win';
      } else {
        p.batsu += 1;
        p.score = '0/1';
        if (r.lose && p.batsu >= r.lose) p.status = 'lose';
      }
      break;
    case 'by':
      if (!ok) p.batsu += 1;
      p.score = int(p.maru * Math.max(0, r.n - p.batsu));
      if (p.batsu >= r.n) p.status = 'lose';
      else if (p.maru * (r.n - p.batsu) >= r.n * r.n) p.status = 'win';
      break;
    case 'swedish':
      if (ok) {
        p.score = int(p.maru);
        if (p.maru >= r.n) p.status = 'win';
      } else {
        p.batsu += swedishPenalty(p.maru);
        if (p.batsu >= r.n) p.status = 'lose';
      }
      break;
    case 'divide':
      if (ok) {
        p.score = applyOp(p.score, '+', int(r.pt));
        if (parseScoreToNumber(p.score) >= r.win) p.status = 'win';
      } else {
        p.batsu += 1;
        p.score = applyOp(p.score, '/', int(r.div));
      }
      break;
    default:
      break;
  }
  if (!ok && r.type !== 'nomx') p.streak = 0;
  if (ok && r.type !== 'nomx') p.streak += 1;
  return { ok: true, player: p };
};

// 勝ち抜け・失格まであと何か（表示用の短い文）
export const progressHint = (rule, p) => {
  const r = normalizeRule(rule);
  const maru = p.maru || 0;
  const batsu = p.batsu || 0;
  const score = parseScoreToNumber(p.score);
  const parts = [];
  switch (r.type) {
    case 'nomx':
      if (r.win) parts.push(`あと${Math.max(0, r.win - (r.combo ? score : maru))}${r.combo ? '点' : '〇'}`);
      if (r.lose) parts.push(`✕あと${Math.max(0, r.lose - batsu)}`);
      break;
    case 'updown':
      parts.push(`あと${Math.max(0, r.win - score)}点`);
      if (r.lose) parts.push(`✕あと${Math.max(0, r.lose - batsu)}`);
      break;
    case 'by':
      parts.push(`あと${Math.max(0, r.n * r.n - score)}点`);
      parts.push(`✕あと${Math.max(0, r.n - batsu)}`);
      break;
    case 'swedish':
      parts.push(`あと${Math.max(0, r.n - maru)}〇`);
      parts.push(`✕あと${Math.max(0, r.n - batsu)}`);
      break;
    case 'divide':
      parts.push(`あと${Number(Math.max(0, r.win - score).toFixed(2))}点`);
      break;
    default:
      break;
  }
  return parts.join('・');
};

// ランキングの並び：勝ち抜け（抜けた順）→ 競技中（得点の高い順、同点は✕の少ない順）→ 失格
export const sortForRule = (players) => {
  const group = (p) => (p.status === 'win' ? 0 : p.status === 'lose' ? 2 : 1);
  return [...players].sort((a, b) => {
    const g = group(a) - group(b);
    if (g) return g;
    if (group(a) === 0) return (a.winSeq ?? Infinity) - (b.winSeq ?? Infinity);
    const d = parseScoreToNumber(b.score) - parseScoreToNumber(a.score);
    if (d) return d;
    if ((a.batsu || 0) !== (b.batsu || 0)) return (a.batsu || 0) - (b.batsu || 0);
    if ((b.maru || 0) !== (a.maru || 0)) return (b.maru || 0) - (a.maru || 0);
    return (a.name || '').localeCompare(b.name || '');
  });
};

// 勝ち抜けた人の順位（1位, 2位, …）
export const winRanks = (players) => {
  const ranks = {};
  players
    .filter((p) => p.status === 'win')
    .sort((a, b) => (a.winSeq ?? Infinity) - (b.winSeq ?? Infinity))
    .forEach((p, i) => {
      ranks[p.id] = i + 1;
    });
  return ranks;
};

// ルール系の項目をまっさらにした状態（全員リセット・ルール変更時）
export const freshRuleFields = () => ({ status: null, winSeq: null, restUntilQ: null, streak: 0 });
