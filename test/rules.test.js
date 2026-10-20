import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyAnswer, normalizeRule, playerState, progressHint, ruleLabel, sortForRule, winRanks } from '../app/lib/rules.js';

const fresh = (id = 'p') => ({ id, name: id, score: '0/1', maru: 0, batsu: 0 });
// 〇✕の列（'o' / 'x'）を順に適用。q は問題番号（毎回1つ進む）
const run = (rule, seq, start = fresh()) => {
  let p = start;
  let q = 1;
  for (const c of seq) {
    const res = applyAnswer(rule, p, c === 'o' ? 'correct' : 'wrong', { q });
    if (!res.ok) return { p, error: res.error, q };
    p = res.player;
    q += 1;
  }
  return { p, q };
};

test('normalizeRule：既定値で補い範囲内に収める・ルール無しは自由計算', () => {
  assert.deepEqual(normalizeRule({ type: 'nomx' }), { type: 'nomx', win: 7, lose: 3, rest: 0, combo: false });
  assert.deepEqual(normalizeRule({ type: 'by', n: 999 }), { type: 'by', n: 30 });
  assert.equal(normalizeRule(null).type, 'free');
  assert.equal(normalizeRule({ type: '???' }).type, 'free');
  assert.equal(ruleLabel({ type: 'nomx', win: 7, lose: 3 }), '7〇3✕');
  assert.equal(ruleLabel({ type: 'nomx', win: 0, lose: 0 }), '〇✕カウント');
});

test('N〇M✕：7〇で勝ち抜け、3✕で失格、終わった人は答えられない', () => {
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

test('N〇M✕：連答ボーナス（n 連続正解目は +n、誤答でリセット）・得点で勝ち抜け', () => {
  const rule = { type: 'nomx', win: 10, lose: 0, combo: true };
  const r = run(rule, 'oooxo'); // 1+2+3, ✕, 1
  assert.equal(r.p.score, '7/1');
  assert.equal(r.p.streak, 1);
  const w = run(rule, 'oooo'); // 1+2+3+4 = 10
  assert.equal(w.p.status, 'win');
});

test('アップダウン：誤答で0点、2✕で失格、10点で勝ち抜け', () => {
  const rule = { type: 'updown', win: 10, lose: 2 };
  const a = run(rule, 'ooox');
  assert.equal(a.p.score, '0/1');
  assert.equal(a.p.status, undefined);
  assert.equal(run(rule, 'oxox').p.status, 'lose');
  assert.equal(run(rule, 'oooooooooo').p.status, 'win');
});

test('N by N：得点 =〇×(N−✕)、N×N で勝ち抜け、✕ N で失格', () => {
  const rule = { type: 'by', n: 5 };
  const a = run(rule, 'oooxo'); // 4 × (5−1) = 16
  assert.equal(a.p.score, '16/1');
  assert.equal(run(rule, 'ooooo').p.status, 'win'); // 5 × 5 = 25
  assert.equal(run(rule, 'xxxxx').p.status, 'lose');
});

test('スウェーディッシュ：正解数に応じた✕（0→1, 1〜2→2, 3〜5→3, 6〜→4）', () => {
  const rule = { type: 'swedish', n: 10 };
  assert.equal(run(rule, 'x').p.batsu, 1);
  assert.equal(run(rule, 'ox').p.batsu, 2);
  assert.equal(run(rule, 'ooox').p.batsu, 3);
  assert.equal(run(rule, 'oooooox').p.batsu, 4);
  assert.equal(run(rule, 'oooooooxx').p.status, undefined); // 4 + 4 = 8 → まだ失格ではない
  assert.equal(run(rule, 'oooooooxxx').p.status, 'lose'); // 12 ≥ 10
  assert.equal(run(rule, 'oooooooxx').p.batsu, 8);
  assert.equal(run(rule, 'oooooooooo').p.status, 'win');
});

test('ディバイド：正解 +P、誤答で ÷D（分数で厳密）', () => {
  const rule = { type: 'divide', pt: 3, div: 2, win: 10 };
  const a = run(rule, 'ox'); // 3 → 3/2
  assert.equal(a.p.score, '3/2');
  assert.equal(run(rule, 'oooo').p.status, 'win'); // 12
});

test('自由計算では〇✕の自動計算はしない', () => {
  assert.equal(applyAnswer({ type: 'free' }, fresh(), 'correct').error, 'free_rule');
});

test('並び順：勝ち抜け（抜けた順）→ 競技中（得点・✕の少なさ）→ 失格', () => {
  const ps = [
    { id: 'lose', status: 'lose', score: '9/1' },
    { id: 'b', score: '3/1', batsu: 2 },
    { id: 'w2', status: 'win', winSeq: 8, score: '7/1' },
    { id: 'a', score: '3/1', batsu: 0 },
    { id: 'w1', status: 'win', winSeq: 3, score: '7/1' },
  ];
  assert.deepEqual(
    sortForRule(ps).map((p) => p.id),
    ['w1', 'w2', 'a', 'b', 'lose'],
  );
  assert.deepEqual(winRanks(ps), { w1: 1, w2: 2 });
});

test('あと何問の表示', () => {
  assert.equal(progressHint({ type: 'nomx', win: 7, lose: 3 }, { maru: 5, batsu: 1 }), 'あと2〇・✕あと2');
  assert.equal(progressHint({ type: 'by', n: 10 }, { maru: 5, batsu: 1, score: '45/1' }), 'あと55点・✕あと9');
});
