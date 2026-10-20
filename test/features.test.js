// PR3 の機能：大画面・結果発表・操作ログ・オンライン表示・自動再入室・招待 QR・勝ち抜け通知・CSV
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createMemoryAdapter } from './helpers/memoryAdapter.js';
import { answerAsk, boot, waitFor } from './helpers/dom.js';
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
  await waitFor(() => p.doc.querySelector('#join-name'));
  p.type(p.doc.querySelector('#join-name'), 'アリス');
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
  p.click(p.byText('正答'));
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
  p.click(p.byText('正答'));
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
  await answerAsk(h);
  await waitFor(() => (room(db).rule || {}).win === 1);
  await waitFor(() => p.text().includes('1〇'), { msg: 'participant sees new rule' });
  p.click(p.byText('正答'));
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
  assert.ok(!b.byText('正答'), '操作ボタンは無い');
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
  assert.ok(!p2.doc.querySelector('#join-name'), '入室画面を経由しない');
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
  assert.equal(csv[0], '順位,名前,チーム,得点,〇,✕,状態,累計〇,累計✕,勝ち抜け回数,脱落回数');
  assert.equal(csv[1], '1,アリス,赤組,3,3,0,勝ち抜け1位,0,0,0,0');
  assert.equal(csv[2], '2,"ボブ, Jr.",,2,2,1,,0,0,0,0');
  assert.deepEqual(myStanding(state, state.players[2]), { rank: 3, gap: 2, tie: false }, '競技中のトップ（ボブ）まで 2');
  assert.deepEqual(myStanding(state, state.players[1]), { rank: 2, gap: 0, tie: false });
  // 競技中のトップが同点なら tie
  const tied = { ...state, players: [...state.players, { id: 'd', name: 'ダン', score: '2/1', maru: 2, batsu: 1 }] };
  assert.equal(myStanding(tied, tied.players[1]).tie, true);
});

test('v33：休み中は「問題を進める」（ホストの次の問題と二重に減らない）・勝ち抜け宣言と元に戻す', async () => {
  const db = createMemoryAdapter();
  const { h, p } = await hostAndAlice(db);
  // ホストが N〇M✕ のプリセット「誤答2休」を選ぶ
  h.click(h.byText('変更する'));
  await waitFor(() => h.byText('このルールで始める'));
  h.click(h.byText('誤答2休'));
  const restField = () => [...h.doc.querySelectorAll('label')].find((l) => l.textContent.includes('誤答後の休み')).querySelector('input');
  await waitFor(() => restField().value === '2', { msg: 'preset applied' });
  h.click(h.byText('このルールで始める'));
  await answerAsk(h);
  await waitFor(() => (room(db).rule || {}).rest === 2, { msg: 'rest rule saved' });
  await waitFor(() => p.text().includes('誤答2休'), { msg: 'participant sees rule' });

  p.click(p.byText('誤答', p.doc.querySelector('[data-selfbar]'))); // Q1 で誤答 → Q2・Q3 は休み
  await waitFor(() => p.doc.querySelector('[data-rest]'), { msg: 'rest bar' });
  assert.ok(!p.byText('正答'), '休み中は正答/誤答の代わりに「問題を進める」');
  p.click(p.byText('問題を進める')); // 本人が Q2 へ
  await waitFor(() => p.doc.querySelector('[data-rest]').textContent.includes('あと2問'), { msg: 'rest 2 after self advance' });
  h.click(h.byText('次の問題')); // ホストも Q2 へ
  await waitFor(() => room(db).q === 2);
  await new Promise((r) => setTimeout(r, 30));
  assert.ok(p.doc.querySelector('[data-rest]').textContent.includes('あと2問'), '二重に減らない');
  await new Promise((r) => setTimeout(r, 450)); // 同じボタンの二度押しは 0.4 秒間受け付けないので、実際の間隔をあける
  p.click(p.byText('問題を進める'));
  await waitFor(() => p.doc.querySelector('[data-rest]').textContent.includes('あと1問'), { msg: 'rest 1' });
  await new Promise((r) => setTimeout(r, 450)); // 同じボタンの二度押しは 0.4 秒間受け付けないので、実際の間隔をあける
  p.click(p.byText('問題を進める'));
  await waitFor(() => p.byText('正答') && !p.byText('正答').disabled, { msg: 'back to play' });

  // 勝ち抜けを宣言 → ホストにも「勝ち抜け 1位」→ 元に戻す
  p.click(p.byText('勝ち抜け', p.doc.querySelector('[data-declare]')));
  await answerAsk(p);
  await waitFor(() => h.text().includes('勝ち抜け 1位'), { msg: 'win badge on host' });
  assert.ok(p.text().includes('勝ち抜けました'));
  p.click(p.byText('元に戻す'));
  await waitFor(() => !h.text().includes('勝ち抜け 1位'), { msg: 'undo declare' });
  h.close();
  p.close();
});

test('v33：観戦にするとランキングから外れ、参加に戻せる。記録タブに成績', async () => {
  const db = createMemoryAdapter();
  const { h, p } = await hostAndAlice(db);
  const aliceId = () => Object.values(room(db).players).find((x) => x.name === 'アリス').id;
  p.click(p.byText('正答'));
  await waitFor(() => Object.values(room(db).players).find((x) => x.name === 'アリス').maru === 1);
  // 本人が観戦に
  p.click(p.doc.querySelector('button[aria-label="メニュー"]'));
  await waitFor(() => p.doc.querySelector('[data-sheet]'), { msg: 'menu sheet' });
  p.click(p.byText('観戦にする', p.doc.querySelector('[data-sheet]')));
  await waitFor(() => p.doc.querySelector('[data-spectating]'), { msg: 'spectating bar' });
  await waitFor(() => !h.doc.querySelector(`[data-player-id="${aliceId()}"]`), { msg: 'removed from host ranking' });
  assert.ok(h.doc.querySelector('[data-spectators]').textContent.includes('アリス'));
  // ホストが参加に戻す
  h.click(h.doc.querySelector(`[data-spectator-id="${aliceId()}"]`));
  await waitFor(() => h.doc.querySelector('[data-sheet]'), { msg: 'host menu for spectator' });
  h.click(h.byText('参加に戻す', h.doc.querySelector('[data-sheet]')));
  await waitFor(() => h.doc.querySelector(`[data-player-id="${aliceId()}"]`), { msg: 'back in ranking' });
  await waitFor(() => p.byText('正答'), { msg: 'answer buttons again' });
  // 記録タブ
  p.click(p.buttons().find((b) => b.textContent.includes('記録')));
  await waitFor(() => p.doc.querySelector('[data-record]'), { msg: 'record panel' });
  const row = [...p.doc.querySelectorAll('[data-record] tbody tr')].find((tr) => tr.textContent.includes('アリス'));
  assert.ok(row, 'アリスの行');
  assert.deepEqual([...row.querySelectorAll('td')].slice(1).map((td) => td.textContent), ['1', '0', '0', '0']);
  h.close();
  p.close();
});

test('v33：ルール選択は2系統に分かれ、ディバイドの「割る数」は毎回 ÷D のときだけ出る', async () => {
  const db = createMemoryAdapter();
  const { h, p } = await hostAndAlice(db);
  h.click(h.byText('変更する'));
  await waitFor(() => h.byText('このルールで始める'));
  assert.ok(h.text().includes('正解数で勝負') && h.text().includes('総得点で勝負'));
  ['フリーズ', '+M/−N', 'M by N', 'ディバイド'].forEach((l) => assert.ok(h.buttons().some((b) => b.textContent.trim() === l), l));
  h.click(h.buttons().find((b) => b.textContent.trim() === 'ディバイド'));
  await waitFor(() => h.text().includes('初期点'));
  assert.ok(!h.text().includes('割る数（D）'));
  h.click(h.byText('毎回 ÷D'));
  await waitFor(() => h.text().includes('割る数（D）'), { msg: 'divisor field' });
  h.click(h.byText('n 回目は ÷n'));
  await waitFor(() => !h.text().includes('割る数（D）'), { msg: 'divisor hidden' });
  h.click(h.byText('このルールで始める'));
  await answerAsk(h);
  await waitFor(() => (room(db).rule || {}).type === 'divide', { msg: 'divide saved' });
  await waitFor(() => p.text().includes('10 ディバイド'), { msg: 'label' });
  assert.ok(Object.values(room(db).players).every((x) => x.score === '10/1'), '全員 初期 10 点');
  h.close();
  p.close();
});

test('v34：表示の切替ボタン（自動 → 明るい → 暗い → 自動）が data-theme と保存に反映される', async () => {
  const db = createMemoryAdapter();
  const h = boot({ db });
  await waitFor(() => h.doc.querySelector('[data-theme-button]'), { msg: 'theme button on home' });
  const btn = () => h.doc.querySelector('[data-theme-button]');
  assert.equal(btn().dataset.themeButton, 'auto');
  assert.equal(h.doc.documentElement.dataset.theme, 'light', 'jsdom は OS 設定が無いので明るい');
  h.click(btn());
  await waitFor(() => btn().dataset.themeButton === 'light');
  assert.equal(h.w.localStorage.getItem('qp_theme'), 'light');
  h.click(btn());
  await waitFor(() => btn().dataset.themeButton === 'dark');
  assert.equal(h.doc.documentElement.dataset.theme, 'dark');
  assert.equal(h.w.localStorage.getItem('qp_theme'), 'dark');
  h.click(btn());
  await waitFor(() => btn().dataset.themeButton === 'auto');
  assert.equal(h.w.localStorage.getItem('qp_theme'), null);
  assert.equal(h.doc.documentElement.dataset.theme, 'light');
  h.close();
  // 保存した設定は次に開いたときにも効く
  const h2 = boot({ db, storage: { qp_theme: 'dark' } });
  await waitFor(() => h2.doc.querySelector('[data-theme-button]'));
  assert.equal(h2.doc.documentElement.dataset.theme, 'dark');
  h2.close();
});

test('v34：ホストは行を押すとメニューから改名・観戦・削除ができる（参加者の行は押せない）', async () => {
  const db = createMemoryAdapter();
  const { h, p } = await hostAndAlice(db);
  const aliceId = Object.values(room(db).players).find((x) => x.name === 'アリス').id;
  const row = () => h.doc.querySelector(`[data-player-id="${aliceId}"]`);
  await waitFor(() => row(), { msg: 'alice row on host' });
  assert.equal(row().tagName, 'BUTTON');
  await waitFor(() => p.doc.querySelector(`[data-player-id="${aliceId}"]`));
  assert.equal(p.doc.querySelector(`[data-player-id="${aliceId}"]`).tagName, 'DIV', '参加者の画面の行はボタンではない');
  // 改名
  h.click(row());
  await waitFor(() => h.doc.querySelector('[data-sheet]'), { msg: 'menu' });
  h.click(h.byText('名前を変える', h.doc.querySelector('[data-sheet]')));
  await answerAsk(h, 'アリス2');
  await waitFor(() => room(db).players[aliceId].name === 'アリス2', { msg: 'renamed' });
  assert.ok(!h.doc.querySelector('[data-sheet]'), 'メニューは閉じる');
  // 観戦にする
  h.click(row());
  await waitFor(() => h.doc.querySelector('[data-sheet]'));
  h.click(h.byText('観戦にする', h.doc.querySelector('[data-sheet]')));
  await waitFor(() => room(db).players[aliceId].spectator === true, { msg: 'spectator' });
  await waitFor(() => p.doc.querySelector('[data-spectating]'), { msg: 'alice sees spectating bar' });
  // 観戦中のチップから削除
  h.click(h.doc.querySelector(`[data-spectator-id="${aliceId}"]`));
  await waitFor(() => h.doc.querySelector('[data-sheet]'));
  h.click(h.byText('削除する', h.doc.querySelector('[data-sheet]')));
  await answerAsk(h);
  await waitFor(() => !room(db).players[aliceId], { msg: 'removed' });
  h.close();
  p.close();
});

test('v35：メニュー（シート）は Esc で閉じ、開いている間はダイアログに焦点がある', async () => {
  const db = createMemoryAdapter();
  const { h, p } = await hostAndAlice(db);
  p.click(p.doc.querySelector('button[aria-label="メニュー"]'));
  await waitFor(() => p.doc.querySelector('[data-sheet] [role="dialog"]'), { msg: 'sheet open' });
  await waitFor(() => p.doc.activeElement === p.doc.querySelector('[data-sheet] [role="dialog"]'), { msg: 'focus on dialog' });
  p.doc.dispatchEvent(new p.w.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  await waitFor(() => !p.doc.querySelector('[data-sheet]'), { msg: 'closed by Esc' });
  h.close();
  p.close();
});

test('v35：全員 0 点のときは「いまトップ！」ではなく「いまトップタイ」', async () => {
  const db = createMemoryAdapter();
  const { h, p } = await hostAndAlice(db);
  await waitFor(() => p.doc.querySelector('[data-selfbar]').textContent.includes('いまトップタイ'), { msg: 'tie on participant' });
  p.click(p.byText('正答'));
  await waitFor(() => p.doc.querySelector('[data-selfbar]').textContent.includes('いまトップ！'), { msg: 'top after correct' });
  await waitFor(() => h.doc.querySelector('[data-selfbar]').textContent.includes('いま2位'), { msg: 'host is 2nd' });
  h.close();
  p.close();
});

test('v38：順位が上がった人の行に ▲（数秒で消える）。大画面にも出る', async () => {
  const db = createMemoryAdapter();
  const { h, p, code } = await hostAndAlice(db);
  const aliceId = Object.values(room(db).players).find((x) => x.name === 'アリス').id;
  const b = boot({ db, url: `/?room=${code}&view=board` });
  await waitFor(() => b.doc.querySelector('[data-board]') && b.doc.querySelector('[data-board]').textContent.includes('アリス'), { msg: 'board' });
  // ホストが先に1点 → アリスが2点で抜く
  h.click(h.byText('正答', h.doc.querySelector('[data-selfbar]')));
  await waitFor(() => Object.values(room(db).players).find((x) => x.name === '司会').maru === 1);
  p.click(p.byText('正答', p.doc.querySelector('[data-selfbar]')));
  await waitFor(() => room(db).players[aliceId].maru === 1);
  await new Promise((r) => setTimeout(r, 450)); // 同じボタンの二度押しは 0.4 秒間受け付けないので、実際の間隔をあける
  p.click(p.byText('正答', p.doc.querySelector('[data-selfbar]')));
  await waitFor(() => room(db).players[aliceId].maru === 2);
  await waitFor(() => h.doc.querySelector(`[data-player-id="${aliceId}"] [data-rank-up]`), { msg: 'rank up chip on host' });
  assert.ok(h.doc.querySelector(`[data-player-id="${aliceId}"] [data-rank-up]`).textContent.includes('▲1'));
  await waitFor(() => b.doc.querySelector('[data-board]').textContent.includes('▲1'), { msg: 'rank up on board' });
  b.close();
  h.close();
  p.close();
});

test('v39：初めての人には最初の〇✕まで「正答／誤答を押す」の一言が出る', async () => {
  const db = createMemoryAdapter();
  const { h, p } = await hostAndAlice(db);
  await waitFor(() => p.doc.querySelector('[data-first-tip]'), { msg: 'first tip' });
  p.click(p.byText('正答', p.doc.querySelector('[data-selfbar]')));
  await waitFor(() => !p.doc.querySelector('[data-first-tip]'), { msg: 'tip hidden after first answer' });
  h.close();
  p.close();
});

test('v40：正答の二度押しは 1 回だけ数える。戻せる操作が無いときは知らせる', async () => {
  const db = createMemoryAdapter();
  const { h, p } = await hostAndAlice(db);
  const aliceId = Object.values(room(db).players).find((x) => x.name === 'アリス').id;
  // 元に戻す（まだ何もしていない）→ 知らせが出る
  p.click(p.byText('元に戻す'));
  await waitFor(() => p.doc.querySelector('[data-toast]'), { msg: 'toast' });
  assert.ok(p.doc.querySelector('[data-toast]').textContent.includes('戻せる操作はもうありません'));
  // 正答を素早く 2 回 → 1 回だけ
  const bar = p.doc.querySelector('[data-selfbar]');
  p.click(p.byText('正答', bar));
  p.click(p.byText('正答', bar));
  await waitFor(() => room(db).players[aliceId].maru === 1);
  await new Promise((r) => setTimeout(r, 120));
  assert.equal(room(db).players[aliceId].maru, 1, '二度押しは 1 回だけ');
  // 別のボタンはすぐ押せる（誤答）
  p.click(p.byText('誤答', bar));
  await waitFor(() => room(db).players[aliceId].batsu === 1, { msg: 'different button allowed' });
  h.close();
  p.close();
});

test('v41：グラフ・ログが読めない（データベースの設定で拒否）ときは理由を出す', async () => {
  const base = createMemoryAdapter();
  // timeline と log の読み込みだけ拒否する
  const denied = (p) => p.startsWith('timeline/') || p.startsWith('log/');
  const db = {
    ...base,
    onValue: (p, cb) => {
      if (!denied(p)) return base.onValue(p, cb);
      setTimeout(() => cb(null, new Error('permission_denied')), 0);
      return () => {};
    },
    onValueLast: (p, n, cb) => {
      if (!denied(p)) return base.onValueLast(p, n, cb);
      setTimeout(() => cb(null, new Error('permission_denied')), 0);
      return () => {};
    },
  };
  const { h, p } = await hostAndAlice(db);
  p.click(p.buttons().find((b) => b.textContent.includes('グラフ')));
  await waitFor(() => p.doc.querySelector('[data-unavailable]'), { msg: 'graph unavailable' });
  assert.ok(p.doc.querySelector('[data-unavailable]').textContent.includes('グラフ'));
  p.click(p.buttons().find((b) => b.textContent.includes('ログ')));
  await waitFor(() => p.doc.querySelector('[data-unavailable]') && p.doc.querySelector('[data-unavailable]').textContent.includes('操作ログ'), {
    msg: 'log unavailable',
  });
  h.close();
  p.close();
});

test('v41：データベースの設定が足りないと、ホストの管理パネルに知らせとルールのコピーが出る', async () => {
  const base = createMemoryAdapter();
  const db = {
    ...base,
    get: async (p) => {
      if (p.startsWith('timeline/') || p.startsWith('presence/')) throw new Error('permission_denied');
      return base.get(p);
    },
  };
  const h = boot({ db });
  await waitFor(() => h.byText('ホストとして部屋を作る'));
  h.click(h.byText('ホストとして部屋を作る'));
  await waitFor(() => h.doc.querySelector('input[placeholder="司会"]'));
  h.type(h.doc.querySelector('input[placeholder="司会"]'), '司会');
  h.click(h.buttons().find((b) => b.textContent.trim() === '部屋を作る'));
  await waitFor(() => h.doc.querySelector('[data-access-warning]'), { msg: 'access warning' });
  const t = h.doc.querySelector('[data-access-warning]').textContent;
  assert.ok(t.includes('グラフ') && t.includes('オンライン表示'));
  assert.ok(!t.includes('操作ログ'), '読めるものは出さない');
  h.close();
  // 全部読めるなら出ない
  const db2 = createMemoryAdapter();
  const h2 = boot({ db: db2 });
  await waitFor(() => h2.byText('ホストとして部屋を作る'));
  h2.click(h2.byText('ホストとして部屋を作る'));
  await waitFor(() => h2.doc.querySelector('input[placeholder="司会"]'));
  h2.type(h2.doc.querySelector('input[placeholder="司会"]'), '司会');
  h2.click(h2.buttons().find((b) => b.textContent.trim() === '部屋を作る'));
  await waitFor(() => h2.text().includes('あなた（司会）'));
  await new Promise((r) => setTimeout(r, 100));
  assert.ok(!h2.doc.querySelector('[data-access-warning]'));
  h2.close();
});

test('v43：結果発表では自分の順位を大きく出し、チームがあればチームの結果も出す', async () => {
  const db = createMemoryAdapter();
  const { h, p } = await hostAndAlice(db);
  h.type(h.doc.querySelector('input[placeholder="新チーム名"]'), '赤組');
  h.click(h.doc.querySelector('input[placeholder="新チーム名"]').parentElement.querySelector('button'));
  await waitFor(() => Object.keys(room(db).teams || {}).length === 1, { msg: 'team' });
  p.click(p.byText('正答', p.doc.querySelector('[data-selfbar]')));
  await waitFor(() => Object.values(room(db).players).find((x) => x.name === 'アリス').maru === 1);
  h.click(h.byText('結果発表（全員の画面に表示）'));
  await waitFor(() => p.doc.querySelector('[data-result] [data-my-result]'), { msg: 'my result' });
  assert.ok(p.doc.querySelector('[data-my-result]').textContent.includes('1'));
  assert.ok(p.doc.querySelector('[data-result] [data-team-result]').textContent.includes('赤組'));
  await waitFor(() => h.doc.querySelector('[data-result] [data-my-result]'));
  assert.ok(h.doc.querySelector('[data-my-result]').textContent.includes('2'));
  h.close();
  p.close();
});
