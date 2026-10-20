// 画面テスト：ビルド済み docs/index.html を jsdom で動かし、ホストと参加者の流れを確認する
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createMemoryAdapter } from './helpers/memoryAdapter.js';
import { answerAsk, boot, builtHtml, waitFor } from './helpers/dom.js';

const room = (db) => {
  const rooms = db._dump().rooms || {};
  const id = Object.keys(rooms)[0];
  return { id, ...rooms[id] };
};
const playersOf = (db) => Object.values(room(db).players || {});

// ホストとして部屋を作り、ホスト画面まで進める
const createAsHost = async (db, name = '司会') => {
  const h = boot({ db });
  await waitFor(() => h.byText('ホストとして部屋を作る'), { msg: 'home' });
  h.click(h.byText('ホストとして部屋を作る'));
  await waitFor(() => h.doc.querySelector('input[placeholder="司会"]'), { msg: 'host create view' });
  h.type(h.doc.querySelector('input[placeholder="司会"]'), name);
  h.click(h.buttons().find((b) => b.textContent.trim() === '部屋を作る'));
  await waitFor(() => h.text().includes(`あなた（${name}）`), { msg: 'host view with self bar' });
  return h;
};

test('ビルド成果物は外部読み込みなしの1ファイル', () => {
  const html = builtHtml();
  assert.ok(!/<script[^>]+src=/i.test(html), '外部 script を読み込まない');
  assert.ok(!/<link\b[^>]*href=["']?(https?:)?\/\//i.test(html), '外部 link を読み込まない（アイコンは data URI）');
  assert.ok(/<link rel="icon" href="data:image\/svg\+xml,/.test(html), 'タブのアイコンがある');
  assert.ok(!/cdn\.tailwindcss|unpkg\.com|gstatic\.com\/firebasejs/.test(html), 'CDN の URL を含まない');
});

test('ホーム画面：バージョン表記と2つの入口', async () => {
  const h = boot({ db: createMemoryAdapter() });
  await waitFor(() => h.text().includes('ホストとして部屋を作る'));
  assert.ok(h.text().includes('v44'));
  assert.ok(h.text().includes('参加者として入室する'));
  h.close();
});

test('ホスト：部屋を作るとホストも1プレイヤーになり、自分の得点だけ操作・Undo できる', async () => {
  const db = createMemoryAdapter();
  const h = await createAsHost(db);
  const r = room(db);
  assert.match(r.id, /^\d{4}$/);
  assert.ok(h.w.location.search.includes(`room=${r.id}`));
  assert.ok(h.text().includes(r.id), 'ヘッダーに部屋コード');
  assert.equal(playersOf(db).length, 1);
  assert.equal(playersOf(db)[0].name, '司会');
  // 下部パネルの「正答」で +1
  const bar = h.doc.querySelector('[data-selfbar]');
  h.click(h.byText('正答', bar));
  await waitFor(() => playersOf(db)[0].score === '1/1', { msg: 'host +1' });
  h.click(h.byText('元に戻す', bar));
  await waitFor(() => playersOf(db)[0].score === '0/1', { msg: 'host undo' });
  // 管理パネル：新しい部屋は〇✕カウント・Q1。採点ロックのトグルは無い。全員1 は自由計算のときだけ
  assert.ok(!h.doc.querySelector('[role="switch"]'));
  assert.ok(h.doc.querySelector('[data-room-status]').textContent.includes('〇✕カウント'));
  assert.ok(h.text().includes('次の問題') && h.text().includes('全員リセット'));
  assert.ok(!h.text().includes('全員 1'));
  h.close();
});

test('参加者：招待リンクから入室し、チームを自分で選べる。グラフも出る', async () => {
  const db = createMemoryAdapter();
  const h = await createAsHost(db);
  const code = room(db).id;
  // ホストがチームを作る
  h.type(h.doc.querySelector('input[placeholder="新チーム名"]'), '赤組');
  const addBtn = h.doc.querySelector('input[placeholder="新チーム名"]').parentElement.querySelector('button');
  h.click(addBtn);
  await waitFor(() => Object.keys(room(db).teams || {}).length === 1, { msg: 'team created' });

  const p = boot({ db, url: `/?room=${code}` });
  await waitFor(() => p.doc.querySelector('#join-name'), { msg: 'join view' });
  assert.ok(p.doc.querySelector('[data-invited-room]').textContent.includes(code), '招待された部屋を表示');
  assert.ok(!p.doc.querySelector('input[placeholder="0000"]'), '招待リンクではコードを入れ直させない');
  const nameInput = p.doc.querySelector('#join-name');
  p.type(nameInput, 'アリス');
  p.click(p.buttons().find((b) => /入室|参加/.test(b.textContent) && !b.disabled));
  await waitFor(() => p.text().includes('あなた（アリス）'), { msg: 'participant view' });
  await waitFor(() => p.text().includes('司会'), { msg: 'sees host in ranking' });

  // チームを自分で選ぶ（「チームを選ぶ」を開いてからチップを押す）
  p.click(p.doc.querySelector('[data-team-button]'));
  await waitFor(() => p.doc.querySelector('[data-team-choices]'), { msg: 'team choices open' });
  p.click([...p.doc.querySelectorAll('[data-team-choices] button')].find((b) => b.textContent.trim() === '赤組'));
  const tid = Object.keys(room(db).teams)[0];
  await waitFor(() => playersOf(db).find((x) => x.name === 'アリス').teamId === tid, { msg: 'team picked' });

  // 加点 → ホスト画面にも反映
  const bar = p.doc.querySelector('[data-selfbar]');
  p.click(p.byText('正答', bar));
  await waitFor(() => playersOf(db).find((x) => x.name === 'アリス').score === '1/1', { msg: 'alice +1' });

  // グラフタブ：プレイヤー数ぶんの折れ線
  p.click(p.byText('グラフ'));
  await waitFor(() => p.doc.querySelectorAll('[data-graph] polyline').length === 2, { msg: 'graph lines' });
  h.close();
  p.close();
});

test('ホストの再読み込み：保存済みトークンで復帰し、プレイヤーは重複しない', async () => {
  const db = createMemoryAdapter();
  const h = await createAsHost(db, '司会');
  const code = room(db).id;
  const storage = {};
  for (let i = 0; i < h.w.localStorage.length; i++) {
    const k = h.w.localStorage.key(i);
    storage[k] = h.w.localStorage.getItem(k);
  }
  h.close();
  const h2 = boot({ db, url: `/?room=${code}`, storage });
  await waitFor(() => h2.text().includes('あなた（司会）'), { msg: 'host restored' });
  assert.ok(h2.text().includes('HOST'));
  assert.equal(playersOf(db).length, 1);
  h2.close();
});

test('存在しない部屋コードで入室するとエラーを出す', async () => {
  const db = createMemoryAdapter();
  const p = boot({ db, url: '/?room=9999' });
  await waitFor(() => p.doc.querySelector('#join-name'));
  p.type(p.doc.querySelector('#join-name'), 'ボブ');
  p.click(p.buttons().find((b) => /入室|参加/.test(b.textContent) && !b.disabled));
  await waitFor(() => p.doc.querySelector('[data-entry-error]'), { msg: 'inline error' });
  assert.ok(p.doc.querySelector('[data-entry-error]').textContent.includes('部屋が見つかりません'));
  assert.equal((p.w.__alerts || []).length, 0, 'ダイアログは出さない');
  p.close();
});

test('ルール：ホストが 2〇2✕ に変えると、参加者は正解/誤答だけで勝ち抜け順位・問題番号が出る', async () => {
  const db = createMemoryAdapter();
  const h = await createAsHost(db);
  const code = room(db).id;
  // ルールを N〇M✕（勝ち抜け2・失格2）に
  h.click(h.byText('変更する'));
  await waitFor(() => h.byText('このルールで始める'));
  const field = (label) => [...h.doc.querySelectorAll('label')].find((l) => l.textContent.includes(label)).querySelector('input');
  h.type(field('勝ち抜け（〇の数）'), '2');
  h.type(field('脱落（✕の数）'), '2');
  await waitFor(() => field('脱落（✕の数）').value === '2');
  h.click(h.byText('このルールで始める'));
  await answerAsk(h);
  await waitFor(() => (room(db).rule || {}).win === 2 && room(db).rule.lose === 2, { msg: 'rule saved' });
  await waitFor(() => h.doc.querySelector('[data-room-status]').textContent.includes('2〇2✕'), { msg: 'status label' });

  const p = boot({ db, url: `/?room=${code}` });
  await waitFor(() => p.doc.querySelector('#join-name'));
  p.type(p.doc.querySelector('#join-name'), 'アリス');
  p.click(p.buttons().find((b) => /入室|参加/.test(b.textContent) && !b.disabled));
  await waitFor(() => p.byText('正答') && p.byText('誤答'), { msg: 'answer buttons' });
  assert.ok(!p.text().includes('自由計算'), 'ルール時はモード切替を出さない');

  // 正解1つ → あと1〇
  p.click(p.byText('正答'));
  await waitFor(() => p.text().includes('あと1〇'), { msg: 'hint after 1 correct' });
  // ホストが次の問題へ → 参加者にも Q2
  h.click(h.byText('次の問題'));
  await waitFor(() => p.doc.querySelector('[data-room-status]').textContent.includes('Q2'), { msg: 'Q2 on participant' });
  // もう1つ正解 → 勝ち抜け1位、ボタンは押せない
  await new Promise((r) => setTimeout(r, 450)); // 同じボタンの二度押しは 0.4 秒間受け付けないので、実際の間隔をあける
  p.click(p.byText('正答'));
  await waitFor(() => p.text().includes('勝ち抜け 1位'), { msg: 'win badge' });
  await waitFor(() => p.text().includes('勝ち抜けました'), { msg: 'win message' });
  assert.ok(p.byText('正答').disabled && p.byText('誤答').disabled);
  // Undo で競技中に戻る
  p.click(p.byText('元に戻す'));
  await waitFor(() => !p.text().includes('勝ち抜け 1位') && !p.byText('正答').disabled, { msg: 'undo win' });

  // 自由計算に変えると従来の操作に戻る
  h.click(h.byText('変更する'));
  await waitFor(() => h.byText('このルールで始める'));
  h.click(h.buttons().find((b) => b.textContent.trim() === '自由計算'));
  await waitFor(() => h.text().includes('各自が ＋ − × ÷'), { msg: 'free rule selected in editor' });
  h.click(h.byText('このルールで始める'));
  await answerAsk(h);
  await waitFor(() => p.text().includes('自由計算') && p.text().includes('加点のみ'), { msg: 'free mode controls' });
  await waitFor(() => h.text().includes('全員 1'), { msg: 'set-all shown in free' });
  h.close();
  p.close();
});
