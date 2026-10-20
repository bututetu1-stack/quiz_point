import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  applyAdvance,
  applyAnswer,
  applyDeclare,
  initialScore,
  normalizeRule,
  playerState,
  progressHint,
  ruleDetails,
  ruleLabel,
  sortForRule,
  swedishPenalty,
  winRanks,
} from '../app/lib/rules.js';

const fresh = (id = 'p', rule = null) => ({ id, name: id, score: rule ? initialScore(rule) : '0/1', maru: 0, batsu: 0 });
// 〇✕の列（'o' / 'x'）を順に適用。q は問題番号（毎回1つ進む）
const run = (rule, seq, start = fresh('p', rule)) => {
  let p = start;
  let q = 1;
  for (const c of seq) {
    const res = applyAnswer(rule, p, c === 'o' ? 'correct' : 'wrong', { q, now: q });
    if (!res.ok) return { p, error: res.error, q };
    p = res.player;
    q += 1;
  }
  return { p, q };
};

test('normalizeRule：既定値で補い範囲内に収める・ルール無しは自由計算・旧形式の読み替え', () => {
  assert.deepEqual(normalizeRule({ type: 'nomx' }), { type: 'nomx', win: 7, lose: 3, rest: 0, combo: false });
  assert.deepEqual(normalizeRule({ type: 'by' }), { type: 'by', cInit: 0, cPer: 1, wInit: 10, wPer: 1, win: 100 });
  // v32 までの N by N（n）→ ✕側の初期値 n・N×N 点で勝ち抜け
  assert.deepEqual(normalizeRule({ type: 'by', n: 5 }), { type: 'by', cInit: 0, cPer: 1, wInit: 5, wPer: 1, win: 25 });
  // v32 までのディバイド（÷D）→ 毎回 ÷D・初期 0 点
  assert.deepEqual(normalizeRule({ type: 'divide', pt: 3, div: 2, win: 10 }), {
    type: 'divide',
    init: 0,
    pt: 3,
    mode: 'fixed',
    div: 2,
    win: 10,
  });
  assert.equal(normalizeRule({ type: 'divide' }).mode, 'count');
  assert.equal(normalizeRule({ type: 'divide', mode: '???' }).mode, 'count');
  assert.equal(normalizeRule(null).type, 'free');
  assert.equal(normalizeRule({ type: '???' }).type, 'free');
  assert.equal(ruleLabel({ type: 'nomx', win: 7, lose: 3 }), '7〇3✕');
  assert.equal(ruleLabel({ type: 'nomx', win: 0, lose: 0 }), '〇✕カウント');
  assert.equal(ruleLabel({ type: 'nomx', win: 0, lose: 0, rest: 2 }), '〇✕カウント・誤答2休');
  assert.equal(ruleLabel({ type: 'freeze' }), 'フリーズ 10');
  assert.equal(ruleLabel({ type: 'plusminus' }), '+1/−1（10点）');
  assert.equal(ruleLabel({ type: 'by' }), '10 by 10');
  assert.equal(ruleLabel({ type: 'divide' }), '10 ディバイド（100点）');
  assert.equal(initialScore({ type: 'divide' }), '10/1');
  assert.equal(initialScore({ type: 'by', cInit: 2, wInit: 5 }), '10/1');
  assert.equal(initialScore({ type: 'nomx' }), '0/1');
});

test('N〇M✕：7〇で勝ち抜け、3✕で脱落、終わった人は答えられない', () => {
  const rule = { type: 'nomx', win: 7, lose: 3 };
  const w = run(rule, 'ooxooooo');
  assert.equal(w.p.status, 'win');
  assert.equal(w.p.maru, 7);
  assert.equal(w.p.score, '7/1');
  assert.equal(run(rule, 'o', w.p).error, 'finished');
  const l = run(rule, 'xoxx');
  assert.equal(l.p.status, 'lose');
  assert.equal(l.p.batsu, 3);
});

test('N〇M✕：制限なし（0）なら何問でも続く', () => {
  const r = run({ type: 'nomx', win: 0, lose: 0 }, 'oooooooooooxxxxxxxxx');
  assert.equal(r.p.status, undefined);
  assert.equal(r.p.maru, 11);
  assert.equal(r.p.batsu, 9);
});

test('N〇M✕：誤答後の休み（問題番号で数える）', () => {
  const rule = { type: 'nomx', win: 0, lose: 0, rest: 2 };
  const a = applyAnswer(rule, fresh(), 'wrong', { q: 5 }).player;
  assert.equal(a.restUntilQ, 8);
  assert.deepEqual(playerState(a, 6), { kind: 'rest', restLeft: 2 });
  assert.equal(applyAnswer(rule, a, 'correct', { q: 7 }).error, 'resting');
  assert.equal(applyAnswer(rule, a, 'correct', { q: 8 }).ok, true);
});

test('休みは本人の「問題を進める」でも減り、ホストの Q と二重には数えない', () => {
  const rule = { type: 'nomx', win: 0, lose: 0, rest: 2 };
  let a = applyAnswer(rule, fresh(), 'wrong', { q: 1 }).player; // Q1 で誤答 → Q2・Q3 は休み、Q4 から
  assert.deepEqual(playerState(a, 1), { kind: 'rest', restLeft: 3 });
  a = applyAdvance(a, 1).player; // 本人が Q2 へ
  assert.equal(a.pq, 2);
  assert.deepEqual(playerState(a, 2), { kind: 'rest', restLeft: 2 }, 'ホストも Q2 に進めても同じ');
  a = applyAdvance(a, 2).player; // Q3
  a = applyAdvance(a, 2).player; // Q4（ホストは Q2 のまま）
  assert.deepEqual(playerState(a, 2), { kind: 'play' });
  assert.equal(applyAdvance(a, 2).error, 'not_resting', '休みでないときは進められない');
  const b = applyAnswer(rule, a, 'wrong', { q: 2 }).player; // 自分の Q4 で誤答 → Q7 から
  assert.equal(b.restUntilQ, 7);
});

test('N〇M✕：連答ボーナス（n 連続正解目は +n、誤答でリセット）・得点で勝ち抜け', () => {
  const rule = { type: 'nomx', win: 10, lose: 0, combo: true };
  const r = run(rule, 'oooxo'); // 1+2+3, ✕, 1
  assert.equal(r.p.score, '7/1');
  assert.equal(r.p.streak, 1);
  const w = run(rule, 'oooo'); // 1+2+3+4 = 10
  assert.equal(w.p.status, 'win');
});

test('フリーズ：k 回目の誤答で k 問休み、10〇で勝ち抜け', () => {
  const rule = { type: 'freeze' };
  const a = applyAnswer(rule, fresh(), 'wrong', { q: 1 }).player;
  assert.equal(a.restUntilQ, 3); // 1回目 → 1問休み（Q2）
  const b = applyAnswer(rule, a, 'wrong', { q: 3 }).player;
  assert.equal(b.restUntilQ, 6); // 2回目 → 2問休み（Q4・Q5）
  assert.equal(b.status, undefined, '脱落は 0 でなし');
  assert.equal(run(rule, 'oooooooooo').p.status, 'win');
  assert.equal(progressHint(rule, b), '〇あと10・次の✕は3休');
});

test('アップダウン：誤答で0点、2✕で脱落、10点で勝ち抜け（0 なら勝ち抜けなし）', () => {
  const rule = { type: 'updown', win: 10, lose: 2 };
  const a = run(rule, 'ooox');
  assert.equal(a.p.score, '0/1');
  assert.equal(a.p.status, undefined);
  assert.equal(run(rule, 'oxox').p.status, 'lose');
  assert.equal(run(rule, 'oooooooooo').p.status, 'win');
  assert.equal(run({ type: 'updown', win: 0, lose: 0 }, 'oooooooooooo').p.status, undefined);
});

test('+M/−N：正解 +M、誤答 −N（マイナスもあり）', () => {
  const rule = { type: 'plusminus', plus: 2, minus: 3, win: 0 };
  assert.equal(run(rule, 'x').p.score, '-3/1');
  assert.equal(run(rule, 'ooxo').p.score, '3/1');
  assert.equal(run({ type: 'plusminus' }, 'oooooooooo').p.status, 'win'); // +1 × 10
});

test('M by N：(〇初期+〇増分×〇) × (✕初期−✕減分×✕)、✕側が 0 で脱落', () => {
  const rule = { type: 'by', n: 5 }; // 旧形式 = 5 by 5
  assert.equal(run(rule, 'oooxo').p.score, '16/1'); // 4 × (5−1)
  assert.equal(run(rule, 'ooooo').p.status, 'win'); // 5 × 5 = 25
  assert.equal(run(rule, 'xxxxx').p.status, 'lose');
  const custom = { type: 'by', cInit: 1, cPer: 2, wInit: 6, wPer: 2, win: 0 };
  const c = run(custom, 'oox'); // (1+2×2) × (6−2) = 20
  assert.equal(c.p.score, '20/1');
  assert.equal(run(custom, 'xxx').p.status, 'lose'); // 6−2×3 = 0
});

test('スウェーディッシュ：✕＝ceil((√(8c+9)−1)/2)（0→1, 1〜2→2, 3〜5→3, 6〜9→4, 10〜→5…）', () => {
  assert.deepEqual([0, 1, 2, 3, 5, 6, 9, 10, 14, 15].map(swedishPenalty), [1, 2, 2, 3, 3, 4, 4, 5, 5, 6]);
  const rule = { type: 'swedish', n: 10 };
  assert.equal(run(rule, 'x').p.batsu, 1);
  assert.equal(run(rule, 'ox').p.batsu, 2);
  assert.equal(run(rule, 'ooox').p.batsu, 3);
  assert.equal(run(rule, 'oooooox').p.batsu, 4);
  assert.equal(run(rule, 'oooooooxx').p.status, undefined); // 4 + 4 = 8 → まだ脱落ではない
  assert.equal(run(rule, 'oooooooxxx').p.status, 'lose'); // 12 ≥ 10
  assert.equal(run(rule, 'oooooooooo').p.status, 'win');
  assert.equal(run({ type: 'swedish', n: 20 }, 'oooooooooox').p.batsu, 5, '10問正解後の誤答は 5✕');
  assert.equal(progressHint(rule, { maru: 3, batsu: 2 }), '〇あと7・✕あと8・次の✕+3');
});

test('ディバイド（Tokuten）：初期10・正解+10・n 回目の誤答で ÷n（切り捨て）', () => {
  const rule = { type: 'divide' };
  assert.equal(run(rule, 'x').p.score, '10/1'); // 10 ÷ 1
  assert.equal(run(rule, 'oxx').p.score, '10/1'); // 20 ÷ 1 → 20 ÷ 2
  assert.equal(run(rule, 'oxoxx').p.score, '5/1'); // 20 → ÷1=20 → 30 → ÷2=15 → ÷3=5
  assert.equal(run(rule, 'ooxx').p.score, '15/1'); // 30 ÷1 = 30 → ÷2 = 15
  assert.equal(run(rule, 'oxxx').p.score, '3/1'); // 20 → 20 → 10 → floor(10/3)=3
  assert.equal(run(rule, 'ooooooooo').p.status, 'win'); // 10 + 90 = 100
});

test('ディバイド（毎回 ÷D）：分数で厳密', () => {
  const rule = { type: 'divide', mode: 'fixed', init: 0, pt: 3, div: 2, win: 10 };
  assert.equal(run(rule, 'ox').p.score, '3/2');
  assert.equal(run(rule, 'oooo').p.status, 'win'); // 12
});

test('自由計算では〇✕の自動計算はしない', () => {
  assert.equal(applyAnswer({ type: 'free' }, fresh(), 'correct').error, 'free_rule');
  assert.equal(applyDeclare({ type: 'free' }, fresh(), 'win').error, 'free_rule');
});

test('勝ち抜け・脱落の宣言：休み中でもでき、終わった人はできない。累計に数える', () => {
  const rule = { type: 'nomx', win: 0, lose: 0, rest: 3 };
  const resting = applyAnswer(rule, fresh(), 'wrong', { q: 1 }).player;
  const w = applyDeclare(rule, resting, 'win');
  assert.equal(w.ok, true);
  assert.equal(w.player.status, 'win');
  assert.equal(w.player.restUntilQ, null);
  assert.deepEqual(w.player.rec, { o: 0, x: 1, win: 1, lose: 0 });
  assert.equal(applyDeclare(rule, w.player, 'lose').error, 'finished');
  assert.equal(applyDeclare(rule, fresh(), 'lose').player.status, 'lose');
});

test('累計（rec）：〇✕と自動の勝ち抜け・脱落を数える', () => {
  const r = run({ type: 'nomx', win: 2, lose: 0 }, 'oxo');
  assert.deepEqual(r.p.rec, { o: 2, x: 1, win: 1, lose: 0 });
});

test('並び順：勝ち抜け（抜けた順）→ 競技中（得点・〇・✕・先に正解した人）→ 脱落（後から脱落した人が上）', () => {
  const ps = [
    { id: 'lose1', status: 'lose', loseSeq: 2, score: '9/1' },
    { id: 'b', score: '3/1', batsu: 2 },
    { id: 'w2', status: 'win', winSeq: 8, score: '7/1' },
    { id: 'a', score: '3/1', batsu: 0, correctAt: 50 },
    { id: 'a2', score: '3/1', batsu: 0, correctAt: 20 },
    { id: 'w1', status: 'win', winSeq: 3, score: '7/1' },
    { id: 'lose2', status: 'lose', loseSeq: 5, score: '0/1' },
  ];
  assert.deepEqual(
    sortForRule(ps, { type: 'nomx' }).map((p) => p.id),
    ['w1', 'w2', 'a2', 'a', 'b', 'lose2', 'lose1'],
  );
  assert.deepEqual(winRanks(ps), { w1: 1, w2: 2 });
  // アップダウンは同点なら〇の少ない方が上（Tokuten と同じ）
  const ud = [
    { id: 'many', score: '2/1', maru: 5 },
    { id: 'few', score: '2/1', maru: 2 },
  ];
  assert.deepEqual(
    sortForRule(ud, { type: 'updown' }).map((p) => p.id),
    ['few', 'many'],
  );
  assert.deepEqual(
    sortForRule(ud, { type: 'plusminus' }).map((p) => p.id),
    ['many', 'few'],
  );
});

test('あと何問の表示', () => {
  assert.equal(progressHint({ type: 'nomx', win: 7, lose: 3 }, { maru: 5, batsu: 1 }), '〇あと2・✕あと2');
  assert.equal(progressHint({ type: 'by', n: 10 }, { maru: 5, batsu: 1, score: '45/1' }), 'あと55点・✕あと9');
  assert.equal(progressHint({ type: 'divide' }, { batsu: 1, score: '20/1' }), 'あと80点・次の✕は÷2');
});

test('ruleDetails：0 で「なし」になる設定は「なし」と表示', () => {
  const d = ruleDetails({ type: 'nomx', win: 0, lose: 0, rest: 0 });
  assert.deepEqual(
    d.map((x) => x.value),
    ['なし', 'なし', 'なし', 'なし'],
  );
  assert.equal(ruleDetails({ type: 'nomx', win: 7, lose: 3, rest: 1 })[0].value, '7');
  assert.equal(ruleDetails({ type: 'divide', mode: 'fixed' }).find((x) => x.label === '誤答したとき').value, '毎回 ÷D');
});
