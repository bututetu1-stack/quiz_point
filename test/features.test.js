// PR3 の機能：大画面・結果発表・操作ログ・オンライン表示・自動再入室・招待 QR・勝ち抜け通知・CSV
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createMemoryAdapter } from './helpers/memoryAdapter.js';
import { boot, waitFor } from './helpers/dom.js';
import { myStanding, toCsv } from '../app/lib/ranking.js';

const room = (db) => {
  const rooms = db._dump().rooms || {};
  const id = Object.keys(rooms)[0];
  return { id, ...rooms[id] };
};

// ホストが部屋を作り、参加者アリスが招待リンクから入る
const hostAndAlice = async (db) => {
  const h = boot({ db });
  await waitFor(() => h.byText('ホストとして部屋を作る'));
  h.click(h.byText('ホストとして部屋を作る'));
  await waitFor(() => h.doc.querySelector('input[placeholder="司会"]'));
  h.type(h.doc.querySelector('input[placeholder="司会"]'), '司会');
  h.click(h.buttons().find((b) => b.textContent.trim() === '部屋を作る'));
  await waitFor(() => h.text().includes('あなた（司会）'), { msg: 'host view' });
  const code = room(db).id;
  const p = boot({ db, url: `/?room=${code}` });
  await waitFor(() => p.doc.querySelector('input[placeholder="0000"]'));
  const codeInput = p.doc.querySelector('input[placeholder="0000"]');
  p.type([...p.doc.querySelectorAll('input')].find((i) => i !== codeInput), 'アリス');
  p.click(p.buttons().find((b) => /入室|参加/.test(b.textContent) && !b.disabled));
  await waitFor(() => p.text().includes('あなた（アリス）'), { msg: 'participant view' });
  return { h, p, code };
};

test('オンライン表示：入室中の人には緑の点が付く', async () => {
  const db = createMemoryAdapter();
  const { h, p, code } = await hostAndAlice(db);
  const aliceId = Object.values(room(db).players).find((x) => x.name === 'アリス').id;
  await waitFor(() => db._dump().presence[code][aliceId] === true, { msg: 'presence written' });
  await waitFor(() => h.doc.querySelector(`[data-player-id="${aliceId}"] [data-online="1"]`), { msg: 'online dot on host' });
  h.close();
  p.close();
});

test('操作ログ：〇✕・問題の進行が新しい順に並ぶ', async () => {
  const db = createMemoryAdapter();
  const { h, p } = await hostAndAlice(db);
  p.click(p.byText('正解'));
  await waitFor(() => Object.values(room(db).players).find((x) => x.name === 'アリス').maru === 1);
  h.click(h.byText('次の問題'));
  await waitFor(() => room(db).q === 2);
  p.click(p.buttons().find((b) => b.textContent.includes('ログ')));
  await waitFor(() => p.doc.querySelector('[data-log]'), { msg: 'log panel' });
  await waitFor(() => p.doc.querySelector('[data-log]').textContent.includes('Q1 アリス 〇'), { msg: 'answer in log' });
  const items = [...p.doc.querySelectorAll('[data-log] li')].map((li) => li.textContent);
  assert.ok(items[0].includes('Q2'), '一番上が最新');
  h.close();
  p.close();
});

test('結果発表：ホストが出すと参加者にも表彰台が出て、ホストが閉じると消える', async () => {
  const db = createMemoryAdapter();
  const { h, p } = await hostAndAlice(db);
  p.click(p.byText('正解'));
  await waitFor(() => Object.values(room(db).players).find((x) => x.name === 'アリス').maru === 1);
  h.click(h.byText('結果発表（全員の画面に表示）'));
  await waitFor(() => p.doc.querySelector('[data-result]'), { msg: 'result on participant' });
  assert.ok(p.doc.querySelector('[data-result]').textContent.includes('アリス'));
  await waitFor(() => h.doc.querySelector('[data-result]'));
  h.click(h.byText('結果発表を終える'));
  await waitFor(() => !p.doc.querySelector('[data-result]'), { msg: 'result closed for everyone' });
  h.close();
  p.close();
});

test('勝ち抜け通知：誰かが勝ち抜けると他の人の画面にバナーが出る', async () => {
  const db = createMemoryAdapter();
  const { h, p } = await hostAndAlice(db);
  h.click(h.byText('変更する'));
  await waitFor(() => h.byText('このルールで始める'));
  const field = (label) => [...h.doc.querySelectorAll('label')].find((l) => l.textContent.includes(label)).querySelector('input');
  h.type(field('勝ち抜け（〇の数）'), '1');
  await waitFor(() => field('勝ち抜け（〇の数）').value === '1');
  h.click(h.byText('このルールで始める'));
  await waitFor(() => (room(db).rule || {}).win === 1);
  await waitFor(() => p.text().includes('1〇'), { msg: 'participant sees new rule' });
  p.click(p.byText('正解'));
  await waitFor(() => h.doc.querySelector('[data-win-toast]'), { msg: 'toast on host' });
  assert.ok(h.doc.querySelector('[data-win-toast]').textContent.includes('アリス 勝ち抜け'));
  h.close();
  p.close();
});

test('大画面モード：入室せずにランキングと参加用 QR を表示', async () => {
  const db = createMemoryAdapter();
  const { h, p, code } = await hostAndAlice(db);
  const b = boot({ db, url: `/?room=${code}&view=board` });
  await waitFor(() => b.doc.querySelector('[data-board]'), { msg: 'board view' });
  await waitFor(() => b.doc.querySelector('[data-board]').textContent.includes('アリス'), { msg: 'players on board' });
  assert.ok(b.doc.querySelector('[data-board] [data-qr]'), 'QR コード');
  assert.ok(!b.byText('正解'), '操作ボタンは無い');
  assert.equal(Object.keys(room(db).players).length, 2, '大画面はプレイヤーとして入らない');
  b.close();
  h.close();
  p.close();
});

test('自動再入室：入ったことのある参加者は名前入力を省いて戻る。招待ダイアログに QR', async () => {
  const db = createMemoryAdapter();
  const { h, p, code } = await hostAndAlice(db);
  const storage = { [`playerId_${code}`]: p.w.localStorage.getItem(`playerId_${code}`), playerName: 'アリス' };
  p.close();
  const p2 = boot({ db, url: `/?room=${code}`, storage });
  await waitFor(() => p2.text().includes('あなた（アリス）'), { msg: 'auto rejoin' });
  assert.ok(!p2.doc.querySelector('input[placeholder="0000"]'), '入室画面を経由しない');
  assert.equal(Object.keys(room(db).players).length, 2, 'プレイヤーは増えない');
  // 部屋コードを押すと招待ダイアログ（QR とリンク）
  p2.click(p2.buttons().find((b) => b.textContent.includes(code)));
  await waitFor(() => p2.doc.querySelector('[data-qr]'), { msg: 'invite QR' });
  assert.ok(p2.text().includes(`?room=${code}`));
  p2.close();
  h.close();
});

test('CSV と「1位まであと何点」', () => {
  const state = {
    rule: { type: 'nomx', win: 3, lose: 2 },
    scoreMode: 'addsub',
    teams: [{ id: 't', name: '赤組' }],
    players: [
      { id: 'a', name: 'アリス', score: '3/1', maru: 3, batsu: 0, status: 'win', winSeq: 1, teamId: 't' },
      { id: 'b', name: 'ボブ, Jr.', score: '2/1', maru: 2, batsu: 1 },
      { id: 'c', name: 'チャーリー', score: '0/1', maru: 0, batsu: 0 },
    ],
  };
  const csv = toCsv(state).split('\n');
  assert.equal(csv[0], '順位,名前,チーム,得点,〇,✕,状態');
  assert.equal(csv[1], '1,アリス,赤組,3,3,0,勝ち抜け1位');
  assert.equal(csv[2], '2,"ボブ, Jr.",,2,2,1,');
  assert.deepEqual(myStanding(state, state.players[2]), { rank: 3, gap: 2 }, '競技中のトップ（ボブ）まで 2');
  assert.deepEqual(myStanding(state, state.players[1]), { rank: 2, gap: 0 });
});
