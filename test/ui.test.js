// 画面テスト：ビルド済み docs/index.html を jsdom で動かし、ホストと参加者の流れを確認する
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createMemoryAdapter } from './helpers/memoryAdapter.js';
import { boot, builtHtml, waitFor } from './helpers/dom.js';

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
  await waitFor(() => h.text().includes(`あなた（${name}）の得点`), { msg: 'host view with self bar' });
  return h;
};

test('ビルド成果物は外部読み込みなしの1ファイル', () => {
  const html = builtHtml();
  assert.ok(!/<script[^>]+src=/i.test(html), '外部 script を読み込まない');
  assert.ok(!/<link\b/i.test(html), '外部 link を読み込まない');
  assert.ok(!/cdn\.tailwindcss|unpkg\.com|gstatic\.com\/firebasejs/.test(html), 'CDN の URL を含まない');
});

test('ホーム画面：バージョン表記と2つの入口', async () => {
  const h = boot({ db: createMemoryAdapter() });
  await waitFor(() => h.text().includes('ホストとして部屋を作る'));
  assert.ok(h.text().includes('v30'));
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
  // 下部バーの 〇（緑）で +1
  const bar = h.doc.querySelector('.fixed.bottom-0');
  h.click([...bar.querySelectorAll('button')].find((b) => b.className.includes('from-emerald-400')));
  await waitFor(() => playersOf(db)[0].score === '1/1', { msg: 'host +1' });
  h.click(h.byText('1つ戻す', bar));
  await waitFor(() => playersOf(db)[0].score === '0/1', { msg: 'host undo' });
  // 管理パネル：採点ロックのトグルは無く、全員1・0リセットがある
  assert.ok(!h.doc.querySelector('[role="switch"]'));
  assert.ok(h.text().includes('全員 1') && h.text().includes('0 リセット'));
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
  await waitFor(() => p.doc.querySelector('input[placeholder="0000"]'), { msg: 'join view' });
  const codeInput = p.doc.querySelector('input[placeholder="0000"]');
  assert.equal(codeInput.value, code);
  assert.ok(codeInput.disabled, '招待リンクではコードが固定');
  const nameInput = [...p.doc.querySelectorAll('input')].find((i) => i !== codeInput);
  p.type(nameInput, 'アリス');
  p.click(p.buttons().find((b) => /入室|参加/.test(b.textContent) && !b.disabled));
  await waitFor(() => p.text().includes('あなた（アリス）の得点'), { msg: 'participant view' });
  await waitFor(() => p.text().includes('司会'), { msg: 'sees host in ranking' });

  // チームを自分で選ぶ
  p.click(p.buttons().find((b) => b.textContent.trim() === '赤組'));
  const tid = Object.keys(room(db).teams)[0];
  await waitFor(() => playersOf(db).find((x) => x.name === 'アリス').teamId === tid, { msg: 'team picked' });

  // 加点 → ホスト画面にも反映
  const bar = p.doc.querySelector('.fixed.bottom-0');
  p.click([...bar.querySelectorAll('button')].find((b) => b.className.includes('from-emerald-400')));
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
  await waitFor(() => h2.text().includes('あなた（司会）の得点'), { msg: 'host restored' });
  assert.ok(h2.text().includes('HOST'));
  assert.equal(playersOf(db).length, 1);
  h2.close();
});

test('存在しない部屋コードで入室するとエラーを出す', async () => {
  const db = createMemoryAdapter();
  const p = boot({ db, url: '/?room=9999' });
  await waitFor(() => p.doc.querySelector('input[placeholder="0000"]'));
  const codeInput = p.doc.querySelector('input[placeholder="0000"]');
  p.type([...p.doc.querySelectorAll('input')].find((i) => i !== codeInput), 'ボブ');
  p.click(p.buttons().find((b) => /入室|参加/.test(b.textContent) && !b.disabled));
  await waitFor(() => (p.w.__alerts || []).length > 0, { msg: 'alert' });
  assert.ok(p.w.__alerts[0].includes('部屋が見つかりません'));
  p.close();
});
