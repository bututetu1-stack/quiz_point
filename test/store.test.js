import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createStore, ROOM_TTL, roomState } from '../app/data/store.js';
import { playerState, sortForRule } from '../app/lib/rules.js';
import { createMemoryAdapter } from './helpers/memoryAdapter.js';

const setup = async () => {
  const db = createMemoryAdapter();
  const store = createStore(db);
  const room = await store.createRoom();
  assert.equal(room.ok, true);
  return { db, store, roomId: room.roomId, hostToken: room.hostToken };
};
const players = (db, roomId) => db._dump().rooms[roomId].players || {};
const player = (db, roomId, pid) => players(db, roomId)[pid];

test('部屋を作る・ホスト復帰・入室', async () => {
  const { db, store, roomId, hostToken } = await setup();
  assert.match(roomId, /^\d{4}$/);
  assert.deepEqual(await store.hostJoin(roomId, hostToken), { ok: true });
  assert.equal((await store.hostJoin(roomId, 'wrong')).error, 'unauthorized');
  const a = await store.joinRoom(roomId, ' アリス ', null);
  assert.equal(a.ok, true);
  assert.equal(player(db, roomId, a.playerId).name, 'アリス');
  // 保存済み ID で入り直すと名前だけ変わり、得点は残る
  await store.op(roomId, 'score', { playerId: a.playerId, operator: '+', valueStr: '5' });
  const again = await store.joinRoom(roomId, 'アリス2', a.playerId);
  assert.equal(again.playerId, a.playerId);
  assert.equal(player(db, roomId, a.playerId).name, 'アリス2');
  assert.equal(player(db, roomId, a.playerId).score, '5/1');
  assert.equal((await store.joinRoom('9999', 'x', null)).error, 'room_not_found');
  assert.equal((await store.joinRoom(roomId, '  ', null)).error, 'invalid_name');
});

test('得点操作は分数で厳密・〇✕・全員1/リセット', async () => {
  const { db, store, roomId } = await setup();
  const { playerId: a } = await store.joinRoom(roomId, 'A', null);
  const { playerId: b } = await store.joinRoom(roomId, 'B', null);
  await store.op(roomId, 'score', { playerId: a, operator: '+', valueStr: '1' });
  await store.op(roomId, 'score', { playerId: a, operator: '/', valueStr: '3' });
  await store.op(roomId, 'score', { playerId: a, operator: '*', valueStr: '3' });
  assert.equal(player(db, roomId, a).score, '1/1');
  await store.op(roomId, 'maru', { playerId: b });
  await store.op(roomId, 'batsu', { playerId: b });
  assert.equal(player(db, roomId, b).maru, 1);
  assert.equal(player(db, roomId, b).batsu, 1);
  assert.equal((await store.op(roomId, 'score', { playerId: a, operator: '+', valueStr: 'abc' })).error, 'invalid_value');
  await store.op(roomId, 'setAll', { valueStr: '1' });
  assert.ok(Object.values(players(db, roomId)).every((p) => p.score === '1/1'));
  await store.op(roomId, 'resetAll');
  assert.ok(Object.values(players(db, roomId)).every((p) => p.score === '0/1' && !p.maru && !p.batsu));
});

test('プレイヤー別 Undo：自分の直前だけ戻り、他人に影響しない', async () => {
  const { db, store, roomId } = await setup();
  const { playerId: a } = await store.joinRoom(roomId, 'A', null);
  const { playerId: b } = await store.joinRoom(roomId, 'B', null);
  await store.op(roomId, 'score', { playerId: a, operator: '+', valueStr: '10' });
  await store.op(roomId, 'score', { playerId: a, operator: '-', valueStr: '3' });
  await store.op(roomId, 'score', { playerId: b, operator: '+', valueStr: '4' });
  await store.op(roomId, 'setAll', { valueStr: '1' });
  await store.op(roomId, 'resetAll');
  await store.op(roomId, 'undo', { playerId: a });
  assert.equal(player(db, roomId, a).score, '1/1');
  assert.equal(player(db, roomId, b).score, '0/1');
  await store.op(roomId, 'undo', { playerId: a });
  assert.equal(player(db, roomId, a).score, '7/1');
  await store.op(roomId, 'undo', { playerId: b });
  assert.equal(player(db, roomId, b).score, '1/1');
  await store.op(roomId, 'undo', { playerId: a });
  await store.op(roomId, 'undo', { playerId: a });
  assert.equal(player(db, roomId, a).score, '0/1');
  assert.equal((await store.op(roomId, 'undo', { playerId: a })).error, 'nothing_to_undo');
});

test('同時操作：2人が同時に加点しても両方残る', async () => {
  const { db, store, roomId } = await setup();
  const { playerId: a } = await store.joinRoom(roomId, 'A', null);
  const { playerId: b } = await store.joinRoom(roomId, 'B', null);
  // 別端末（別ストア）から同時に
  const storeB = createStore(db);
  await Promise.all([
    store.op(roomId, 'score', { playerId: a, operator: '+', valueStr: '3' }),
    storeB.op(roomId, 'score', { playerId: b, operator: '+', valueStr: '5' }),
    store.op(roomId, 'maru', { playerId: a }),
    storeB.op(roomId, 'maru', { playerId: b }),
  ]);
  assert.equal(player(db, roomId, a).score, '3/1');
  assert.equal(player(db, roomId, b).score, '5/1');
  assert.equal(player(db, roomId, a).maru, 1);
  assert.equal(player(db, roomId, b).maru, 1);
});

test('同時操作：入室直後に別の人が採点しても入室者が消えない', async () => {
  const { db, store, roomId } = await setup();
  const { playerId: a } = await store.joinRoom(roomId, 'A', null);
  const storeC = createStore(db);
  const [, c] = await Promise.all([
    store.op(roomId, 'score', { playerId: a, operator: '+', valueStr: '1' }),
    storeC.joinRoom(roomId, 'C', null),
    store.op(roomId, 'setAll', { valueStr: '2' }),
  ]);
  assert.ok(player(db, roomId, c.playerId), '入室者が残っている');
  assert.equal(player(db, roomId, c.playerId).name, 'C');
});

test('チーム：作成・割当・改名・削除（所属も外れる）・計算モード', async () => {
  const { db, store, roomId } = await setup();
  const { playerId: a } = await store.joinRoom(roomId, 'A', null);
  await store.op(roomId, 'createTeam', { name: '赤組' });
  const tid = Object.keys(db._dump().rooms[roomId].teams)[0];
  await store.op(roomId, 'assignTeam', { playerId: a, teamId: tid });
  assert.equal(player(db, roomId, a).teamId, tid);
  await store.op(roomId, 'renameTeam', { teamId: tid, name: '青組' });
  assert.equal(db._dump().rooms[roomId].teams[tid].name, '青組');
  await store.op(roomId, 'removeTeam', { teamId: tid });
  assert.equal(db._dump().rooms[roomId].teams, undefined);
  assert.ok(!player(db, roomId, a).teamId);
  await store.op(roomId, 'setTeamMode', { mode: 'sum' });
  await store.op(roomId, 'setScoreMode', { mode: 'simple' });
  assert.equal(db._dump().rooms[roomId].teamMode, 'sum');
  assert.equal(db._dump().rooms[roomId].scoreMode, 'simple');
});

test('改名・削除（削除した人の履歴も消える）・存在しない人への操作', async () => {
  const { db, store, roomId } = await setup();
  const { playerId: a } = await store.joinRoom(roomId, 'A', null);
  await store.op(roomId, 'renamePlayer', { playerId: a, name: 'エー' });
  assert.equal(player(db, roomId, a).name, 'エー');
  await store.op(roomId, 'maru', { playerId: a });
  await store.op(roomId, 'removePlayer', { playerId: a });
  assert.equal(player(db, roomId, a), undefined);
  assert.equal((db._dump().history || {})[roomId], undefined);
  assert.equal((await store.op(roomId, 'maru', { playerId: a })).error, 'player_not_found');
  assert.equal((await store.op(roomId, 'renamePlayer', { playerId: a, name: 'x' })).error, 'player_not_found');
  assert.equal(player(db, roomId, a), undefined, '存在しない人を操作しても作られない');
});

test('得点推移はイベントとして timeline/{room} に記録される', async () => {
  const { db, store, roomId } = await setup();
  const { playerId: a } = await store.joinRoom(roomId, 'A', null);
  await store.op(roomId, 'score', { playerId: a, operator: '+', valueStr: '2' });
  await store.op(roomId, 'resetAll');
  const events = Object.values(db._dump().timeline[roomId]);
  assert.equal(events.length, 2);
  assert.equal(events[0].p, a);
  assert.equal(events[0].s, '2/1');
  assert.equal(events[1].p, undefined);
  assert.equal(db._dump().rooms[roomId].timeline, undefined, '部屋データには推移を入れない');
});

test('部屋作成時に期限切れの部屋を掃除する', async () => {
  const db = createMemoryAdapter();
  const store = createStore(db);
  const old = Date.now() - ROOM_TTL - 1000;
  await db.set('rooms/1234', { hostToken: 'x', createdAt: old, players: { p: { id: 'p', name: 'old' } } });
  await db.set('roomIndex/1234', old);
  await db.set('history/1234/p/k', { score: '1/1' });
  const r = await store.createRoom();
  assert.equal(r.ok, true);
  const dump = db._dump();
  assert.equal(r.roomId === '1234' ? dump.rooms['1234'].hostToken === r.hostToken : dump.rooms['1234'] === undefined, true);
  assert.equal((dump.history || {})['1234'], undefined);
});

test('timeline / roomIndex への読み書きが拒否されても、部屋作成と採点は成功する', async () => {
  const mem = createMemoryAdapter();
  const denied = (p) => /^(timeline|roomIndex)(\/|$)/.test(p);
  const deny = () => Promise.reject(new Error('PERMISSION_DENIED'));
  const db = {
    ...mem,
    get: (p) => (denied(p) ? deny() : mem.get(p)),
    set: (p, v) => (denied(p) ? deny() : mem.set(p, v)),
    remove: (p) => (denied(p) ? deny() : mem.remove(p)),
    push: (p, v) => (denied(p) ? deny() : mem.push(p, v)),
  };
  const warn = console.warn;
  console.warn = () => {};
  try {
    const store = createStore(db);
    const r = await store.createRoom();
    assert.equal(r.ok, true);
    const { playerId } = await store.joinRoom(r.roomId, 'A', null);
    assert.deepEqual(await store.op(r.roomId, 'score', { playerId, operator: '+', valueStr: '2' }), { ok: true });
    assert.equal(mem._dump().rooms[r.roomId].players[playerId].score, '2/1');
    assert.deepEqual(await store.op(r.roomId, 'undo', { playerId }), { ok: true });
  } finally {
    console.warn = warn;
  }
});

test('ルール：新しい部屋は〇✕カウント・Q1。answer で〇✕が反映され、勝ち抜け順が付く', async () => {
  const { db, store, roomId } = await setup();
  const r0 = db._dump().rooms[roomId];
  assert.equal(r0.rule.type, 'nomx');
  assert.equal(r0.q, 1);
  await store.op(roomId, 'setRule', { rule: { type: 'nomx', win: 2, lose: 2 } });
  const { playerId: a } = await store.joinRoom(roomId, 'A', null);
  const { playerId: b } = await store.joinRoom(roomId, 'B', null);
  await store.op(roomId, 'answer', { playerId: b, result: 'correct' });
  await store.op(roomId, 'answer', { playerId: a, result: 'correct' });
  await store.op(roomId, 'answer', { playerId: b, result: 'correct' });
  await store.op(roomId, 'answer', { playerId: a, result: 'correct' });
  assert.equal(player(db, roomId, b).status, 'win');
  assert.equal(player(db, roomId, a).status, 'win');
  assert.ok(player(db, roomId, b).winSeq < player(db, roomId, a).winSeq, 'B が先に勝ち抜け');
  assert.equal((await store.op(roomId, 'answer', { playerId: a, result: 'correct' })).error, 'finished');
  // 勝ち抜けを Undo すると競技中に戻る
  await store.op(roomId, 'undo', { playerId: a });
  assert.equal(player(db, roomId, a).status, undefined);
  assert.equal(player(db, roomId, a).winSeq, undefined);
  assert.equal(player(db, roomId, a).maru, 1);
});

test('ルール：休みは問題番号で数え、nextQ で進む。答えられないときは履歴を積まない', async () => {
  const { db, store, roomId } = await setup();
  await store.op(roomId, 'setRule', { rule: { type: 'nomx', win: 0, lose: 0, rest: 1 } });
  const { playerId: a } = await store.joinRoom(roomId, 'A', null);
  await store.op(roomId, 'answer', { playerId: a, result: 'wrong' }); // Q1 で誤答 → Q2 は休み
  await store.op(roomId, 'nextQ', {});
  assert.equal(db._dump().rooms[roomId].q, 2);
  assert.equal((await store.op(roomId, 'answer', { playerId: a, result: 'correct' })).error, 'resting');
  assert.equal(Object.keys(db._dump().history[roomId][a]).length, 1, '休み中の操作は履歴に残らない');
  await store.op(roomId, 'nextQ', {});
  assert.deepEqual(await store.op(roomId, 'answer', { playerId: a, result: 'correct' }), { ok: true });
  await store.op(roomId, 'nextQ', { delta: -1 });
  await store.op(roomId, 'nextQ', { delta: -1 });
  await store.op(roomId, 'nextQ', { delta: -1 });
  assert.equal(db._dump().rooms[roomId].q, 1, '1 未満にはならない');
});

test('ルール変更は全員の得点・状態・問題番号・Undo 履歴をリセットする', async () => {
  const { db, store, roomId } = await setup();
  await store.op(roomId, 'setRule', { rule: { type: 'updown', win: 1, lose: 2 } });
  const { playerId: a } = await store.joinRoom(roomId, 'A', null);
  await store.op(roomId, 'answer', { playerId: a, result: 'correct' });
  await store.op(roomId, 'nextQ', {});
  assert.equal(player(db, roomId, a).status, 'win');
  await store.op(roomId, 'setRule', { rule: { type: 'by', n: 5 } });
  const p = player(db, roomId, a);
  assert.equal(p.status, undefined);
  assert.equal(p.score, '0/1');
  assert.equal(db._dump().rooms[roomId].q, 1);
  assert.equal(db._dump().rooms[roomId].rule.type, 'by');
  assert.equal((await store.op(roomId, 'undo', { playerId: a })).error, 'nothing_to_undo');
  // 全員リセットも状態と問題番号を戻す
  await store.op(roomId, 'answer', { playerId: a, result: 'wrong' });
  await store.op(roomId, 'nextQ', {});
  await store.op(roomId, 'resetAll');
  assert.equal(player(db, roomId, a).batsu, 0);
  assert.equal(db._dump().rooms[roomId].q, 1);
});

test('勝ち抜け・脱落の宣言：通し番号が付き、元に戻すで取り消せる。脱落は後の人が上に並ぶ', async () => {
  const { db, store, roomId } = await setup();
  const { playerId: a } = await store.joinRoom(roomId, 'A', null);
  const { playerId: b } = await store.joinRoom(roomId, 'B', null);
  const { playerId: c } = await store.joinRoom(roomId, 'C', null);
  assert.deepEqual(await store.op(roomId, 'declare', { playerId: a, status: 'win' }), { ok: true });
  assert.equal(player(db, roomId, a).status, 'win');
  assert.ok(player(db, roomId, a).winSeq > 0);
  assert.equal((await store.op(roomId, 'declare', { playerId: a, status: 'lose' })).error, 'finished');
  await store.op(roomId, 'declare', { playerId: b, status: 'lose' });
  await store.op(roomId, 'declare', { playerId: c, status: 'lose' });
  assert.ok(player(db, roomId, c).loseSeq > player(db, roomId, b).loseSeq);
  const order = roomState(roomId, db._dump().rooms[roomId]).players;
  assert.deepEqual(sortForRule(order, db._dump().rooms[roomId].rule).map((p) => p.name), ['A', 'C', 'B']);
  assert.deepEqual(player(db, roomId, a).rec, { o: 0, x: 0, win: 1, lose: 0 });
  await store.op(roomId, 'undo', { playerId: a });
  assert.equal(player(db, roomId, a).status, undefined);
  assert.equal(player(db, roomId, a).winSeq, undefined);
  assert.deepEqual(player(db, roomId, a).rec, { o: 0, x: 0, win: 0, lose: 0 }, '累計も戻る');
  // 自由計算では宣言できない
  await store.op(roomId, 'setRule', { rule: { type: 'free' } });
  assert.equal((await store.op(roomId, 'declare', { playerId: a, status: 'win' })).error, 'free_rule');
});

test('休み：本人の「問題を進める」とホストの「次の問題」を両方押しても二重に減らない', async () => {
  const { db, store, roomId } = await setup();
  await store.op(roomId, 'setRule', { rule: { type: 'nomx', win: 0, lose: 0, rest: 2 } });
  const { playerId: a } = await store.joinRoom(roomId, 'A', null);
  await store.op(roomId, 'answer', { playerId: a, result: 'wrong' }); // Q1 で誤答 → Q2・Q3 は休み
  assert.deepEqual(await store.op(roomId, 'advanceSelf', { playerId: a }), { ok: true }); // 本人が Q2 へ
  await store.op(roomId, 'nextQ', {}); // ホストも Q2 へ
  const st = () => playerState(player(db, roomId, a), db._dump().rooms[roomId].q);
  assert.deepEqual(st(), { kind: 'rest', restLeft: 2 });
  await store.op(roomId, 'advanceSelf', { playerId: a }); // Q3
  await store.op(roomId, 'undo', { playerId: a }); // 押し間違いは元に戻せる
  assert.deepEqual(st(), { kind: 'rest', restLeft: 2 });
  await store.op(roomId, 'advanceSelf', { playerId: a }); // Q3
  await store.op(roomId, 'advanceSelf', { playerId: a }); // Q4
  assert.deepEqual(st(), { kind: 'play' });
  assert.equal((await store.op(roomId, 'advanceSelf', { playerId: a })).error, 'not_resting');
  assert.deepEqual(await store.op(roomId, 'answer', { playerId: a, result: 'correct' }), { ok: true });
  // リセットで本人の問題番号も消える
  await store.op(roomId, 'resetAll');
  assert.equal(player(db, roomId, a).pq, undefined);
});

test('観戦：players から外れ（spectators に入り）、参加に戻せる', async () => {
  const { db, store, roomId } = await setup();
  const { playerId: a } = await store.joinRoom(roomId, 'A', null);
  await store.joinRoom(roomId, 'B', null);
  await store.op(roomId, 'setSpectator', { playerId: a, on: true });
  let s = roomState(roomId, db._dump().rooms[roomId]);
  assert.deepEqual(s.players.map((p) => p.name), ['B']);
  assert.deepEqual(s.spectators.map((p) => p.name), ['A']);
  assert.equal(s.allPlayers.length, 2);
  await store.op(roomId, 'setSpectator', { playerId: a, on: false });
  s = roomState(roomId, db._dump().rooms[roomId]);
  assert.equal(s.players.length, 2);
  assert.equal(player(db, roomId, a).spectator, undefined);
});

test('記録（rec）はリセット・ルール変更でも消えない。自由計算の〇✕も数える', async () => {
  const { db, store, roomId } = await setup();
  await store.op(roomId, 'setRule', { rule: { type: 'nomx', win: 1, lose: 0 } });
  const { playerId: a } = await store.joinRoom(roomId, 'A', null);
  await store.op(roomId, 'answer', { playerId: a, result: 'wrong' });
  await store.op(roomId, 'answer', { playerId: a, result: 'correct' }); // 勝ち抜け
  await store.op(roomId, 'resetAll');
  await store.op(roomId, 'setRule', { rule: { type: 'free' } });
  await store.op(roomId, 'maru', { playerId: a });
  assert.deepEqual(player(db, roomId, a).rec, { o: 2, x: 1, win: 1, lose: 0 });
  assert.equal(player(db, roomId, a).maru, 1);
});

test('ディバイド：途中参加・リセット・ルール変更のどれでも初期点から始まる', async () => {
  const { db, store, roomId } = await setup();
  const { playerId: a } = await store.joinRoom(roomId, 'A', null);
  await store.op(roomId, 'setRule', { rule: { type: 'divide' } });
  assert.equal(player(db, roomId, a).score, '10/1');
  const { playerId: b } = await store.joinRoom(roomId, 'B', null);
  assert.equal(player(db, roomId, b).score, '10/1');
  await store.op(roomId, 'answer', { playerId: b, result: 'correct' });
  await store.op(roomId, 'answer', { playerId: b, result: 'wrong' });
  await store.op(roomId, 'answer', { playerId: b, result: 'wrong' });
  assert.equal(player(db, roomId, b).score, '10/1'); // 20 → ÷1 → ÷2
  await store.op(roomId, 'resetAll');
  assert.equal(player(db, roomId, b).score, '10/1');
  assert.equal(player(db, roomId, b).batsu, 0);
});
