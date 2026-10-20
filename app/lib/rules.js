// クイズのルール：〇✕を押したときの得点・勝ち抜け・脱落・休みを決める純粋関数群。
// 計算の定義は Tokuten（https://tokuten.baton8.com/）に合わせている。勝ち抜け・脱落の自動判定は 0 で無効。
// 部屋の rule = { type, ...params }。プレイヤーの項目:
//   score（有理数文字列）, maru（〇数）, batsu（✕数。スウェーディッシュは✕の累計）,
//   status（'win' | 'lose' | なし）, winSeq / loseSeq（勝ち抜け・脱落した順番の通し番号）,
//   restUntilQ（この問題番号から再び答えられる）, restFromQ（誤答した問題番号。その問題の間は「次の n 問は休み」と出す）, pq（本人が「問題を進める」で進めた問題番号）,
//   streak（連続正解数）, correctAt（最後に正解した時刻。同点の並びに使う）,
//   rec（この部屋での累計 { o, x, win, lose }。リセット・ルール変更でも消さない）

import { applyOp } from './rational.js';
import { parseScoreToNumber } from './score.js';

export const RULE_GROUPS = [
  { key: 'count', label: '正解数で勝負' },
  { key: 'point', label: '総得点で勝負' },
  { key: 'free', label: 'そのほか' },
];

export const RULE_TYPES = [
  {
    type: 'nomx',
    group: 'count',
    label: 'N〇M✕',
    desc: 'N問正解で勝ち抜け、M回誤答で脱落。0 にすると制限なし。誤答後の休み・連答ボーナスも設定できる',
    params: [
      { key: 'win', label: '勝ち抜け（〇の数）', min: 0, max: 99, def: 7 },
      { key: 'lose', label: '脱落（✕の数）', min: 0, max: 99, def: 3 },
      { key: 'rest', label: '誤答後の休み（問）', min: 0, max: 20, def: 0 },
      { key: 'combo', label: '連答ボーナス（n 連続正解目は +n 点）', bool: true, def: false },
    ],
  },
  {
    type: 'freeze',
    group: 'count',
    label: 'フリーズ',
    desc: 'k 回目の誤答で k 問休み。N問正解で勝ち抜け（0 で制限なし）',
    params: [
      { key: 'win', label: '勝ち抜け（〇の数）', min: 0, max: 99, def: 10 },
      { key: 'lose', label: '脱落（✕の数、0 でなし）', min: 0, max: 99, def: 0 },
    ],
  },
  {
    type: 'swedish',
    group: 'count',
    label: 'スウェーディッシュ',
    desc: '誤答すると、それまでの正解数に応じて✕が付く（0問→1✕・1〜2問→2✕・3〜5問→3✕・6〜9問→4✕・10問〜→5✕…）。〇N で勝ち抜け、✕N で脱落',
    params: [{ key: 'n', label: 'N', min: 2, max: 30, def: 10 }],
  },
  {
    type: 'plusminus',
    group: 'point',
    label: '+M/−N',
    desc: '正解で +M 点、誤答で −N 点。勝ち抜けの点・脱落の✕は 0 でなし',
    params: [
      { key: 'plus', label: '正解の点（+M）', min: 0, max: 20, def: 1 },
      { key: 'minus', label: '誤答の点（−N）', min: 0, max: 20, def: 1 },
      { key: 'win', label: '勝ち抜け（点、0 でなし）', min: 0, max: 999, def: 10 },
      { key: 'lose', label: '脱落（✕の数、0 でなし）', min: 0, max: 99, def: 0 },
    ],
  },
  {
    type: 'updown',
    group: 'point',
    label: 'アップダウン',
    desc: '正解で +1、誤答で 0 点に戻る。N 点で勝ち抜け、M 回誤答で脱落（0 でなし）',
    params: [
      { key: 'win', label: '勝ち抜け（点、0 でなし）', min: 0, max: 99, def: 10 },
      { key: 'lose', label: '脱落（✕の数、0 でなし）', min: 0, max: 99, def: 2 },
    ],
  },
  {
    type: 'by',
    group: 'point',
    label: 'M by N',
    desc: '得点 =〇側 ×✕側。〇側は正解ごとに増え、✕側は誤答ごとに減る（✕側が 0 で脱落）。10 by 10 は 100 点で勝ち抜け',
    params: [
      { key: 'cInit', label: '〇側の初期値', min: 0, max: 50, def: 0 },
      { key: 'cPer', label: '〇側：正解ごとに ＋', min: 0, max: 50, def: 1 },
      { key: 'wInit', label: '✕側の初期値（N）', min: 1, max: 30, def: 10 },
      { key: 'wPer', label: '✕側：誤答ごとに −', min: 0, max: 20, def: 1 },
      { key: 'win', label: '勝ち抜け（点、0 でなし）', min: 0, max: 9999, def: 100 },
    ],
  },
  {
    type: 'divide',
    group: 'point',
    label: 'ディバイド',
    desc: '初期点から始め、正解で +P 点。誤答すると得点を割る（n 回目の誤答で ÷n・小数は切り捨て、または毎回 ÷D）',
    params: [
      { key: 'init', label: '初期点', min: 0, max: 50, def: 10 },
      { key: 'pt', label: '正解の点（+P）', min: 0, max: 50, def: 10 },
      {
        key: 'mode',
        label: '誤答したとき',
        options: [
          ['count', 'n 回目は ÷n'],
          ['fixed', '毎回 ÷D'],
        ],
        def: 'count',
      },
      { key: 'div', label: '割る数（D）', min: 2, max: 10, def: 2, when: (r) => r.mode === 'fixed' },
      { key: 'win', label: '勝ち抜け（点、0 でなし）', min: 0, max: 9999, def: 100 },
    ],
  },
  {
    type: 'free',
    group: 'free',
    label: '自由計算',
    desc: '各自が ＋ − × ÷ で自由に得点を付ける（分数・小数も可）。チーム得点は和または積',
    params: [],
  },
];

export const DEFAULT_RULE = { type: 'nomx', win: 0, lose: 0, rest: 0, combo: false };

// 部屋の rule を既定値で補い、範囲内に収める（rule が無い古い部屋は自由計算）
export const normalizeRule = (rule) => {
  let r = rule || { type: 'free' };
  // v31〜v32 の形式を読み替える：N by N（n）→ ✕側の初期値 n・N×N 点で勝ち抜け、ディバイド（÷D）→ 毎回 ÷D・初期 0 点
  if (r.type === 'by' && r.n != null && r.wInit == null) r = { ...r, wInit: r.n, win: r.n * r.n };
  if (r.type === 'divide' && r.mode == null && r.div != null) r = { init: 0, ...r, mode: 'fixed' };
  const def = RULE_TYPES.find((d) => d.type === r.type) || RULE_TYPES.find((d) => d.type === 'free');
  const out = { type: def.type };
  def.params.forEach((p) => {
    const v = r[p.key];
    if (p.bool) out[p.key] = v === undefined ? p.def : !!v;
    else if (p.options) out[p.key] = p.options.some(([k]) => k === v) ? v : p.def;
    else {
      const n = Number.isFinite(Number(v)) && v !== '' && v !== null ? Math.round(Number(v)) : p.def;
      out[p.key] = Math.min(p.max, Math.max(p.min, n));
    }
  });
  return out;
};

export const isRuleMode = (rule) => normalizeRule(rule).type !== 'free';

const isStdBy = (r) => r.cInit === 0 && r.cPer === 1 && r.wPer === 1;

export const ruleLabel = (rule) => {
  const r = normalizeRule(rule);
  const winPt = (w) => (w ? `（${w}点）` : '');
  switch (r.type) {
    case 'nomx': {
      const extra = (r.rest ? `・誤答${r.rest}休` : '') + (r.combo ? '・連答' : '');
      if (!r.win && !r.lose) return `〇✕カウント${extra}`;
      return `${r.win || '∞'}〇${r.lose || '∞'}✕${extra}`;
    }
    case 'freeze':
      return `フリーズ${r.win ? ` ${r.win}` : ''}${r.lose ? `（${r.lose}✕脱落）` : ''}`;
    case 'swedish':
      return `スウェーディッシュ ${r.n}`;
    case 'plusminus':
      return `+${r.plus}/−${r.minus}${winPt(r.win)}`;
    case 'updown':
      return `${r.win ? `${r.win}点` : ''}アップダウン${r.lose ? `（${r.lose}✕脱落）` : ''}`;
    case 'by':
      if (isStdBy(r) && r.win === r.wInit * r.wInit) return `${r.wInit} by ${r.wInit}`;
      return `M by ${r.wInit}${winPt(r.win)}`;
    case 'divide':
      return `${r.mode === 'fixed' ? `ディバイド ÷${r.div}` : `${r.pt} ディバイド`}${winPt(r.win)}`;
    default:
      return '自由計算';
  }
};

// 設定の一覧（説明の画面用）：[{ label, value }]
export const ruleDetails = (rule) => {
  const r = normalizeRule(rule);
  const def = RULE_TYPES.find((d) => d.type === r.type);
  return def.params
    .filter((p) => !p.when || p.when(r))
    .map((p) => ({
      label: p.label,
      value: p.bool
        ? r[p.key]
          ? 'あり'
          : 'なし'
        : p.options
          ? (p.options.find(([k]) => k === r[p.key]) || ['', ''])[1]
          : r[p.key] === 0 && (/0 で/.test(p.label) || ['win', 'lose', 'rest'].includes(p.key))
            ? 'なし'
            : String(r[p.key]),
    }));
};

// いまの設定を具体的な文で（参加者向けの「いまのルール」・ホストのルール欄。種類の一般説明 desc とは別）
export const ruleSummary = (rule) => {
  const r = normalizeRule(rule);
  const winQ = (n) => (n ? `${n}問正答で勝ち抜け` : '勝ち抜けなし');
  const winP = (n) => (n ? `${n}点で勝ち抜け` : '勝ち抜けなし');
  const lose = (n) => (n ? `${n}回誤答で脱落` : '脱落なし');
  switch (r.type) {
    case 'nomx':
      return (
        [
          r.combo ? `正答で +1 点（n 問連続の正答は +n 点）。${winP(r.win)}` : winQ(r.win),
          lose(r.lose),
          r.rest ? `誤答のあと${r.rest}問休み` : '',
        ]
          .filter(Boolean)
          .join('、') + '。'
      );
    case 'freeze':
      return `k 回目の誤答で k 問休み。${winQ(r.win)}、${lose(r.lose)}。`;
    case 'swedish':
      return `${r.n}問正答で勝ち抜け、✕が${r.n}つで脱落。誤答すると、それまでの正答数に応じて✕が付く（0問→1つ・1〜2問→2つ・3〜5問→3つ・6〜9問→4つ…）。`;
    case 'plusminus':
      return `正答で +${r.plus} 点、誤答で −${r.minus} 点。${winP(r.win)}、${lose(r.lose)}。`;
    case 'updown':
      return `正答で +1 点、誤答で 0 点に戻る。${winP(r.win)}、${lose(r.lose)}。`;
    case 'by':
      return `得点＝〇側×✕側。〇側は ${r.cInit} から正答ごとに +${r.cPer}、✕側は ${r.wInit} から誤答ごとに −${r.wPer}（0 になると脱落）。${winP(r.win)}。`;
    case 'divide':
      return `${r.init} 点から始め、正答で +${r.pt} 点。誤答すると ${r.mode === 'fixed' ? `毎回 ÷${r.div}` : 'n 回目は ÷n'}（小数は切り捨て）。${winP(r.win)}。`;
    default:
      return RULE_TYPES.find((d) => d.type === 'free').desc;
  }
};

const int = (n) => `${n}/1`;

// ルールを始めたとき（リセット・途中参加）の得点
export const initialScore = (rule) => {
  const r = normalizeRule(rule);
  if (r.type === 'divide') return int(r.init);
  if (r.type === 'by') return int(r.cInit * r.wInit);
  return '0/1';
};

// スウェーディッシュ：正解数 c のときに誤答すると付く✕（0→1, 1〜2→2, 3〜5→3, 6〜9→4, 10〜14→5 …）
export const swedishPenalty = (correct) => Math.ceil((Math.sqrt(8 * Math.max(0, correct) + 9) - 1) / 2);

// その人にとっての「いまの問題番号」：ホストの Q と、本人が「問題を進める」で進めた番号の大きい方
export const effectiveQ = (p, q) => Math.max(q || 1, (p && p.pq) || 0);

// この部屋での累計（無ければ 0 で埋める）
export const recOf = (p) => ({ o: 0, x: 0, win: 0, lose: 0, ...((p && p.rec) || {}) });

// 今の状態：'win' | 'lose' | 'rest'（restLeft 問） | 'play'
// 誤答したその問題の間は upcoming: true（restLeft は「次から休む問題の数」。誤答2休なら 2）
export const playerState = (p, q) => {
  if (p.status === 'win') return { kind: 'win' };
  if (p.status === 'lose') return { kind: 'lose' };
  const eq = effectiveQ(p, q);
  if (p.restUntilQ && eq < p.restUntilQ) {
    // 誤答したその問題（とホストがそれより前に戻したとき）は「次の n 問は休み」
    if (p.restFromQ != null && eq <= p.restFromQ) return { kind: 'rest', restLeft: p.restUntilQ - p.restFromQ - 1, upcoming: true };
    return { kind: 'rest', restLeft: p.restUntilQ - eq };
  }
  return { kind: 'play' };
};

// 〇✕を1回反映した次のプレイヤーを返す。答えられない状態なら error
export const applyAnswer = (rule, player, result, { q = 1, now = Date.now() } = {}) => {
  const r = normalizeRule(rule);
  if (r.type === 'free') return { ok: false, error: 'free_rule' };
  const st = playerState(player, q);
  if (st.kind === 'win' || st.kind === 'lose') return { ok: false, error: 'finished' };
  if (st.kind === 'rest') return { ok: false, error: 'resting' };
  const eq = effectiveQ(player, q);
  const p = { ...player, maru: player.maru || 0, batsu: player.batsu || 0, score: player.score || '0/1', streak: player.streak || 0 };
  p.restUntilQ = null;
  p.restFromQ = null;
  const ok = result === 'correct';
  const win = () => {
    p.status = 'win';
  };
  const lose = () => {
    p.status = 'lose';
  };
  if (ok) {
    p.maru += 1;
    p.correctAt = now;
  }
  switch (r.type) {
    case 'nomx':
      if (ok) {
        p.streak += 1;
        p.score = r.combo ? applyOp(p.score, '+', int(p.streak)) : int(p.maru);
        if (r.win && (r.combo ? parseScoreToNumber(p.score) : p.maru) >= r.win) win();
      } else {
        p.batsu += 1;
        p.streak = 0;
        if (r.rest) {
          p.restUntilQ = eq + r.rest + 1;
          p.restFromQ = eq;
        }
        if (r.lose && p.batsu >= r.lose) lose();
      }
      break;
    case 'freeze':
      if (ok) {
        p.score = int(p.maru);
        if (r.win && p.maru >= r.win) win();
      } else {
        p.batsu += 1;
        p.restUntilQ = eq + p.batsu + 1; // k 回目の誤答で k 問休み
        p.restFromQ = eq;
        if (r.lose && p.batsu >= r.lose) lose();
      }
      break;
    case 'swedish':
      if (ok) {
        p.score = int(p.maru);
        if (p.maru >= r.n) win();
      } else {
        p.batsu += swedishPenalty(p.maru);
        if (p.batsu >= r.n) lose();
      }
      break;
    case 'plusminus':
      if (ok) {
        p.score = applyOp(p.score, '+', int(r.plus));
        if (r.win && parseScoreToNumber(p.score) >= r.win) win();
      } else {
        p.batsu += 1;
        p.score = applyOp(p.score, '-', int(r.minus));
        if (r.lose && p.batsu >= r.lose) lose();
      }
      break;
    case 'updown':
      if (ok) {
        p.score = applyOp(p.score, '+', '1/1');
        if (r.win && parseScoreToNumber(p.score) >= r.win) win();
      } else {
        p.batsu += 1;
        p.score = '0/1';
        if (r.lose && p.batsu >= r.lose) lose();
      }
      break;
    case 'by': {
      if (!ok) p.batsu += 1;
      const c = r.cInit + r.cPer * p.maru;
      const w = Math.max(0, r.wInit - r.wPer * p.batsu);
      p.score = int(c * w);
      if (!ok && w <= 0) lose();
      else if (r.win && c * w >= r.win) win();
      break;
    }
    case 'divide':
      if (ok) {
        p.score = applyOp(p.score, '+', int(r.pt));
        if (r.win && parseScoreToNumber(p.score) >= r.win) win();
      } else {
        p.batsu += 1;
        p.score = r.mode === 'fixed' ? applyOp(p.score, '/', int(r.div)) : int(Math.floor(parseScoreToNumber(p.score) / p.batsu));
      }
      break;
    default:
      break;
  }
  if (r.type !== 'nomx') p.streak = ok ? p.streak + 1 : 0;
  const rec = recOf(player);
  rec[ok ? 'o' : 'x'] += 1;
  if (p.status === 'win') rec.win += 1;
  if (p.status === 'lose') rec.lose += 1;
  p.rec = rec;
  return { ok: true, player: p };
};

// リーチ：あと 1 問正答すれば勝ち抜け（ルールの計算でそのまま確かめる。休み中なら、休み明けの 1 問で）
export const isReach = (rule, p) => {
  if (!isRuleMode(rule) || p.status || p.spectator) return false;
  const res = applyAnswer(rule, { ...p, restUntilQ: null, restFromQ: null }, 'correct', { q: effectiveQ(p, 1) });
  return !!(res.ok && res.player.status === 'win');
};

// 本人が「勝ち抜け」「脱落」を宣言する（休み中でも可）
export const applyDeclare = (rule, player, status) => {
  if (!isRuleMode(rule)) return { ok: false, error: 'free_rule' };
  if (player.status) return { ok: false, error: 'finished' };
  const s = status === 'lose' ? 'lose' : 'win';
  const rec = recOf(player);
  rec[s] += 1;
  return { ok: true, player: { ...player, status: s, restUntilQ: null, restFromQ: null, rec } };
};

// 休み中の本人が「問題を進める」：自分の問題番号を1つ進める
export const applyAdvance = (player, q) => {
  if (playerState(player, q).kind !== 'rest') return { ok: false, error: 'not_resting' };
  return { ok: true, player: { ...player, pq: effectiveQ(player, q) + 1 } };
};

// 勝ち抜け・脱落まであと何か（表示用の短い文）
export const progressHint = (rule, p) => {
  const r = normalizeRule(rule);
  const maru = p.maru || 0;
  const batsu = p.batsu || 0;
  const score = parseScoreToNumber(p.score);
  const pts = (n) => `あと${Number(Math.max(0, n).toFixed(2))}点`;
  const parts = [];
  switch (r.type) {
    case 'nomx':
      if (r.win) parts.push(r.combo ? `あと${Math.max(0, r.win - score)}点` : `〇あと${Math.max(0, r.win - maru)}`);
      if (r.lose) parts.push(`✕あと${Math.max(0, r.lose - batsu)}`);
      break;
    case 'freeze':
      if (r.win) parts.push(`〇あと${Math.max(0, r.win - maru)}`);
      if (r.lose) parts.push(`✕あと${Math.max(0, r.lose - batsu)}`);
      parts.push(`次の✕は${batsu + 1}休`);
      break;
    case 'swedish':
      parts.push(`〇あと${Math.max(0, r.n - maru)}`);
      parts.push(`✕あと${Math.max(0, r.n - batsu)}`);
      parts.push(`次の✕+${swedishPenalty(maru)}`);
      break;
    case 'plusminus':
    case 'updown':
      if (r.win) parts.push(pts(r.win - score));
      if (r.lose) parts.push(`✕あと${Math.max(0, r.lose - batsu)}`);
      break;
    case 'by': {
      if (r.win) parts.push(pts(r.win - score));
      const w = Math.max(0, r.wInit - r.wPer * batsu);
      if (r.wPer > 0) parts.push(`✕あと${Math.ceil(w / r.wPer)}`);
      break;
    }
    case 'divide':
      if (r.win) parts.push(pts(r.win - score));
      parts.push(`次の✕は÷${r.mode === 'fixed' ? r.div : batsu + 1}`);
      break;
    default:
      break;
  }
  return parts.join('・');
};

// ランキングの並び（Tokuten と同じ）：
//   勝ち抜け（抜けた順）→ 競技中（得点 →〇の多さ（アップダウンは少なさ）→ ✕の少なさ → 先に正解した人）→ 脱落（後から脱落した人が上）
export const sortForRule = (players, rule) => {
  const updown = normalizeRule(rule).type === 'updown';
  const group = (p) => (p.status === 'win' ? 0 : p.status === 'lose' ? 2 : 1);
  return [...players].sort((a, b) => {
    const g = group(a) - group(b);
    if (g) return g;
    if (group(a) === 0) return (a.winSeq ?? Infinity) - (b.winSeq ?? Infinity);
    if (group(a) === 2 && (a.loseSeq ?? 0) !== (b.loseSeq ?? 0)) return (b.loseSeq ?? 0) - (a.loseSeq ?? 0);
    const d = parseScoreToNumber(b.score) - parseScoreToNumber(a.score);
    if (d) return d;
    if ((b.maru || 0) !== (a.maru || 0)) return updown ? (a.maru || 0) - (b.maru || 0) : (b.maru || 0) - (a.maru || 0);
    if ((a.batsu || 0) !== (b.batsu || 0)) return (a.batsu || 0) - (b.batsu || 0);
    const ca = a.correctAt ?? Infinity;
    const cb = b.correctAt ?? Infinity;
    if (ca !== cb) return ca < cb ? -1 : 1;
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

// ルール系の項目をまっさらにした状態（全員リセット・ルール変更時）。累計（rec）は残す
export const freshRuleFields = () => ({
  status: null,
  winSeq: null,
  loseSeq: null,
  restUntilQ: null,
  restFromQ: null,
  pq: null,
  streak: 0,
  correctAt: null,
});
