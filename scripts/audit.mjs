// UI の自動チェック：docs/index.html をメモリ上の DB（12 人の部屋）で開き、
// 画面幅 × 明るい/暗い × 画面 ごとに、はみ出し・文字のコントラスト・押せる大きさ・名前のないボタン・一画面に見える人数を数える。
// Firebase には接続しない。使い方: npm run build && node scripts/audit.mjs [--json 出力先] [--shots 出力ディレクトリ]
//   CHROME_PATH=... でブラウザを指定（未指定ならインストール済みの Google Chrome）
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import * as esbuild from 'esbuild';
import { chromium } from 'playwright-core';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PAGE = pathToFileURL(process.env.PAGE_FILE || path.join(REPO, 'docs/index.html')).href;
const arg = (name) => {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : null;
};
const SHOTS = arg('--shots');
if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });

const adapterJs = (
  await esbuild.build({
    entryPoints: [path.join(REPO, 'test/helpers/memoryAdapter.js')],
    bundle: true,
    format: 'iife',
    globalName: '__QPMem',
    write: false,
  })
).outputFiles[0].text;

// 12 人（長い名前・勝ち抜け・脱落・休み・チーム・観戦あり）
const NAMES = [
  '司会',
  'アリス',
  'ボブ',
  'チャーリー',
  'デイジー',
  'とても長い名前のプレイヤーさん',
  'Alexander the Great',
  'エマ',
  'フランク',
  'グレース',
  'ヘンリー',
  'アイビー',
];
const scenario = (free, phase, alone, crowd) => {
  const players = {};
  (alone ? NAMES.slice(0, 1) : crowd ? [...NAMES, ...Array.from({ length: 18 }, (_, k) => `参加者${k + 13}`)] : NAMES).forEach(
    (name, i) => {
      const id = i === 0 ? 'p_host' : `p_${i}`;
      const maru = (i * 7) % 8;
      const batsu = i % 3;
      players[id] = {
        id,
        name,
        score: free ? `${(i * 13) % 40}/${i % 4 === 3 ? 2 : 1}` : `${maru}/1`,
        maru,
        batsu,
        teamId: i % 3 === 0 ? 't_red' : i % 3 === 1 ? 't_blue' : null,
        rec: { o: maru + 3, x: batsu + 1, win: i % 5 === 1 ? 1 : 0, lose: i % 7 === 3 ? 1 : 0 },
        ...(i === 0 ? { restUntilQ: 14 } : {}),
        ...(i === 1 && !free ? { status: 'win', winSeq: 1, score: '7/1', maru: 7 } : {}),
        ...(i === 3 && !free ? { status: 'lose', loseSeq: 2, batsu: 3 } : {}),
        ...(i === 11 ? { spectator: true } : {}),
      };
    },
  );
  return {
    rooms: {
      '0427': {
        hostToken: 'tok',
        createdAt: Date.now(),
        scoreMode: 'addsub',
        teamMode: 'sum',
        rule: free ? { type: 'free' } : { type: 'nomx', win: 7, lose: 3, rest: 1, combo: false },
        q: 12,
        ...(phase ? { phase: 'result' } : {}),
        players,
        teams: { t_red: { id: 't_red', name: '赤組' }, t_blue: { id: 't_blue', name: '青組' } },
      },
    },
    // グラフ用の得点推移と操作ログ
    timeline: {
      '0427': Object.fromEntries(
        Array.from({ length: 24 }, (_, i) => [
          '-k' + String(i).padStart(10, '0'),
          { t: Date.now() - 600000 + i * 20000, p: i % 2 ? 'p_2' : 'p_1', s: `${Math.floor(i / 2) + 1}/1`, q: Math.floor(i / 2) + 1 },
        ]),
      ),
    },
    log: {
      '0427': Object.fromEntries(
        Array.from({ length: 8 }, (_, i) => [
          '-l' + String(i).padStart(10, '0'),
          { t: Date.now() - 100000 + i * 1000, text: `Q${i + 1} アリス ${i % 3 ? '〇' : '✕'}`, kind: i % 3 ? 'correct' : 'wrong' },
        ]),
      ),
    },
  };
};

const host = { hostToken_0427: 'tok', playerId_0427: 'p_host', playerName: '司会' };
const alice = { playerId_0427: 'p_2', playerName: 'ボブ' };
const clickText = (text) => (p) =>
  p.evaluate((t) => [...document.querySelectorAll('button')].find((b) => b.textContent.includes(t) && b.offsetParent)?.click(), text);
const VIEWS = {
  home: { url: '' },
  join: { url: '?room=0427' },
  homeResume: { url: '', storage: { ...alice, qp_last_room: '0427' } },
  help: { url: '', act: (p) => p.evaluate(() => document.querySelector('button[aria-label="使い方"]').click()) },
  host: { url: '?room=0427', storage: host },
  participant: { url: '?room=0427', storage: alice },
  spectator: { url: '?room=0427', storage: { playerId_0427: 'p_11', playerName: 'アイビー' } },
  free: { url: '?room=0427', storage: alice, free: true },
  hostMenu: { url: '?room=0427', storage: host, act: (p) => p.evaluate(() => document.querySelector('[data-player-id="p_4"]').click()) },
  hostPanel: {
    url: '?room=0427',
    storage: host,
    act: (p) =>
      p.evaluate(() => [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === '管理' && b.offsetParent)?.click()),
  },
  board: { url: '?room=0427&view=board', board: true },
  result: { url: '?room=0427', storage: alice, phase: true },
  boardResult: { url: '?room=0427&view=board', board: true, phase: true },
  crowd: { url: '?room=0427', storage: alice, crowd: true },
  crowdBoard: { url: '?room=0427&view=board', board: true, crowd: true },
  ruleEditor: {
    url: '?room=0427',
    storage: host,
    act: async (p) => {
      await clickText('管理')(p);
      await p.waitForTimeout(200);
      await p.evaluate(() =>
        [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === '変更する' && b.offsetParent)?.click(),
      );
    },
  },
  graph: { url: '?room=0427', storage: alice, act: clickText('グラフ') },
  log: { url: '?room=0427', storage: alice, act: clickText('ログ') },
  record: { url: '?room=0427', storage: alice, act: clickText('記録') },
  alone: { url: '?room=0427', storage: host, alone: true },
  toast: { url: '?room=0427', storage: alice, act: clickText('元に戻す') },
  askConfirm: {
    url: '?room=0427',
    storage: host,
    act: (p) => p.evaluate(() => document.querySelector('button[aria-label="退出"]').click()),
  },
  askPrompt: {
    url: '?room=0427',
    storage: alice,
    act: async (p) => {
      await p.evaluate(() => document.querySelector('button[aria-label="メニュー"]').click());
      await p.waitForTimeout(200);
      await clickText('名前を変える')(p);
    },
  },
  ruleInfo: {
    url: '?room=0427',
    storage: alice,
    act: (p) =>
      p.evaluate(() =>
        [...document.querySelectorAll('[data-room-status] button, [data-rule-narrow]')].find((b) => b.offsetParent)?.click(),
      ),
  },
};
// [幅, 高さ, 文字の拡大率]
const SIZES = [
  [280, 653], // Galaxy Fold（閉じたとき）
  [320, 640],
  [390, 844],
  [390, 844, 1.5], // 端末の文字を大きくしている人
  [844, 390], // スマホ横向き
  [768, 1024],
  [1280, 860],
];

// ページの中で測る
const measure = () => {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const parse = (c) => {
    const m = c.match(/rgba?\(([^)]+)\)/);
    if (!m) return [0, 0, 0, 0];
    const p = m[1]
      .split(/[ ,/]+/)
      .filter(Boolean)
      .map(Number);
    return [p[0], p[1], p[2], p[3] === undefined ? 1 : p[3]];
  };
  const over = (top, bottom) => {
    const a = top[3];
    return [top[0] * a + bottom[0] * (1 - a), top[1] * a + bottom[1] * (1 - a), top[2] * a + bottom[2] * (1 - a), 1];
  };
  const lum = ([r, g, b]) => {
    const f = (v) => {
      v /= 255;
      return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
    };
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
  };
  const ratio = (a, b) => {
    const x = lum(a);
    const y = lum(b);
    return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
  };
  const visible = (el) => {
    const r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) return false;
    const s = getComputedStyle(el);
    return s.visibility !== 'hidden' && s.display !== 'none';
  };
  // 背景色（祖先をたどって重ねる。グラデーションや画像は無視）と、祖先の opacity の積
  const bgOf = (el) => {
    const layers = [];
    let op = 1;
    for (let e = el; e; e = e.parentElement) {
      const s = getComputedStyle(e);
      op *= Number(s.opacity);
      const c = parse(s.backgroundColor);
      if (c[3] > 0) layers.push(c);
      if (c[3] >= 1) break;
    }
    let bg = [255, 255, 255, 1];
    const root = parse(getComputedStyle(document.documentElement).backgroundColor);
    if (root[3] > 0) bg = over(root, bg);
    for (let i = layers.length - 1; i >= 0; i--) bg = over(layers[i], bg);
    return { bg, op };
  };
  const out = {
    overflowX: Math.max(0, document.documentElement.scrollWidth - vw),
    offscreen: [],
    lowContrast: [],
    smallTargets: [],
    unnamed: [],
    tinyText: [],
    rows: 0,
  };
  // SVG の文字は描画後の高さで測る（縮小表示で読めなくなっていないか）
  for (const t of document.querySelectorAll('svg text')) {
    const h = t.getBoundingClientRect().height;
    if (h > 0 && h < 9) out.tinyText.push(`svg:${t.textContent.trim().slice(0, 12)}`);
  }
  const scrollParent = (el) => {
    for (let e = el.parentElement; e; e = e.parentElement) {
      const s = getComputedStyle(e);
      if (/(auto|scroll|hidden)/.test(s.overflowX) && e !== document.body && e !== document.documentElement) return e;
    }
    return null;
  };
  const label = (el) => (el.getAttribute('aria-label') || el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 30);
  for (const el of document.querySelectorAll('body *')) {
    if (!visible(el) || el.closest('svg')) continue;
    const r = el.getBoundingClientRect();
    const hasText = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
    if (hasText) {
      if ((r.right > vw + 1 || r.left < -1) && !scrollParent(el)) out.offscreen.push(label(el));
      const s = getComputedStyle(el);
      const { bg, op } = bgOf(el);
      const fg0 = parse(s.color);
      const fg = over([fg0[0], fg0[1], fg0[2], fg0[3] * op], bg);
      const cr = ratio(fg, bg);
      const size = parseFloat(s.fontSize);
      const large = size >= 24 || (size >= 18.66 && Number(s.fontWeight) >= 700);
      const need = large ? 3 : 4.5;
      const disabled = el.closest('button:disabled');
      if (cr < need && !disabled) out.lowContrast.push(`${label(el)} (${cr.toFixed(2)})`);
      if (size < 11) out.tinyText.push(`${label(el)} ${size}px`);
    }
    if (el.matches('button, a, input, select, [role="button"]')) {
      if (Math.min(r.width, r.height) < 24) out.smallTargets.push(`${label(el)} ${Math.round(r.width)}x${Math.round(r.height)}`);
      if (el.matches('button') && !label(el) && !el.getAttribute('title')) out.unnamed.push(el.outerHTML.slice(0, 60));
    }
  }
  // 一画面に見える人数（ヘッダーの下〜下部パネルの上に収まる行）
  const header = document.querySelector('header');
  const top = header ? header.getBoundingClientRect().bottom : 0;
  const bar = document.querySelector('[data-selfbar]');
  // 下部パネルが横（横持ちで右に置く）なら下端は画面の下
  const barRect = bar ? bar.getBoundingClientRect() : null;
  const bottom = barRect && barRect.left < vw / 2 ? barRect.top : vh;
  out.rows = [...document.querySelectorAll('[data-player-id]')].filter((e) => {
    const r = e.getBoundingClientRect();
    return r.top >= top - 1 && r.bottom <= bottom + 1;
  }).length;
  out.barHeight = bar ? Math.round(bar.getBoundingClientRect().height) : 0;
  return out;
};

const browser = await chromium.launch(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : { channel: 'chrome' });
const results = [];
for (const [view, opt] of Object.entries(VIEWS)) {
  for (const [w, h, scale = 1] of SIZES) {
    for (const theme of opt.board ? ['dark'] : ['light', 'dark']) {
      const ctx = await browser.newContext({ viewport: { width: w, height: h }, colorScheme: theme });
      const page = await ctx.newPage();
      const errors = [];
      page.on('pageerror', (e) => errors.push(e.message));
      await page.addInitScript(
        `${adapterJs}\nwindow.__QP_ADAPTER__ = __QPMem.createMemoryAdapter(${JSON.stringify(scenario(!!opt.free, !!opt.phase, !!opt.alone, !!opt.crowd))});\n` +
          Object.entries(opt.storage || {})
            .map(([k, v]) => `localStorage.setItem(${JSON.stringify(k)}, ${JSON.stringify(v)});`)
            .join('\n') +
          (scale !== 1
            ? `\ndocument.addEventListener('DOMContentLoaded', () => { document.documentElement.style.fontSize = '${scale * 100}%'; });`
            : ''),
      );
      await page.goto(PAGE + (opt.url || ''));
      await page.waitForTimeout(opt.phase ? 2600 : 350); // 結果発表は表彰台のアニメが終わるまで待つ
      if (opt.act) {
        await opt.act(page);
        await page.waitForTimeout(350);
      }
      const m = await page.evaluate(measure);
      // キーボードだけで操作したとき、Tab で移った先が見えるか（最初の 25 か所。390px 明るいときだけ測る）
      m.focusInvisible = [];
      if (w === 390 && scale === 1 && theme === 'light') {
        for (let k = 0; k < 25; k++) {
          await page.keyboard.press('Tab');
          const f = await page.evaluate(() => {
            const el = document.activeElement;
            if (!el || el === document.body) return null;
            const s = getComputedStyle(el);
            const visible = (s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) > 0) || (s.boxShadow && s.boxShadow !== 'none');
            return visible ? null : (el.getAttribute('aria-label') || el.textContent || el.tagName).trim().slice(0, 24);
          });
          if (f) m.focusInvisible.push(f);
        }
      }
      const tag = scale !== 1 ? `${w}x${scale * 100}` : `${w}`;
      if (SHOTS) await page.screenshot({ path: path.join(SHOTS, `${view}_${tag}_${theme}.png`) });
      results.push({ view, w, h, scale, theme, errors, ...m });
      await ctx.close();
    }
  }
}
await browser.close();

// 自動で付けられる部分の点数（55 点満点）。残り 45 点（見た目の階層・一貫性・わかりやすさ・楽しさ）は目で見て付ける
const uniq = (key) => new Set(results.flatMap((r) => r[key].map((x) => `${r.view}:${x.replace(/ \(.+\)$/, '').replace(/ \d+x\d+$/, '')}`)));
const overflowPages = results.filter((r) => r.overflowX > 0).length;
const offscreen = uniq('offscreen').size;
const lowContrast = uniq('lowContrast').size;
const small = uniq('smallTargets').size;
const unnamed = uniq('unnamed').size;
const tiny = uniq('tinyText').size;
const focusless = uniq('focusInvisible').size;
const rows390 = results.find((r) => r.view === 'participant' && r.w === 390 && r.scale === 1 && r.theme === 'light').rows;
const hostRows390 = results.find((r) => r.view === 'host' && r.w === 390 && r.scale === 1 && r.theme === 'light').rows;
const landRows = results.find((r) => r.view === 'participant' && r.w === 844 && r.theme === 'light').rows;
const errors = results.reduce((a, r) => a + r.errors.length, 0);
const density = (n) => (n >= 8 ? 10 : n >= 7 ? 8 : n >= 6 ? 6 : n >= 5 ? 4 : 2);
const score = {
  responsive: Math.max(0, 15 - 5 * overflowPages - offscreen - 0.5 * tiny),
  contrast: Math.max(0, 15 - 0.5 * lowContrast),
  targets: Math.max(0, 10 - 0.5 * small),
  // 名前のないボタンと、Tab で移っても見えない操作（キーボードだけの人が迷う）
  names: Math.max(0, 5 - unnamed - 0.25 * focusless),
  // 縦持ち（参加者・ホスト）と横持ち（参加者、3 人で満点）
  density: (density(rows390) * 2 + density(hostRows390) * 2 + Math.min(10, landRows * 3.4)) / 5,
  errors: errors ? -10 : 0,
};
score.total = Object.values(score).reduce((a, b) => a + b, 0);

const pad = (s, n) => String(s).padEnd(n);
console.log(pad('view', 12), pad('size', 10), pad('theme', 6), 'ovfX offscr lowC small unnamed tiny rows bar errors');
for (const r of results)
  console.log(
    pad(r.view, 12),
    pad(`${r.w}x${r.h}`, 10),
    pad(r.theme, 6),
    pad(r.overflowX, 4),
    pad(r.offscreen.length, 6),
    pad(r.lowContrast.length, 4),
    pad(r.smallTargets.length, 5),
    pad(r.unnamed.length, 7),
    pad(r.tinyText.length, 4),
    pad(r.rows, 4),
    pad(r.barHeight, 3),
    r.errors.length,
  );
const detail = (key) => [...uniq(key)].slice(0, 40);
console.log('\nはみ出し:', detail('offscreen'));
console.log('低コントラスト:', detail('lowContrast'));
console.log('小さい押し先:', detail('smallTargets'));
console.log('名前のないボタン:', detail('unnamed'));
console.log('小さすぎる文字:', detail('tinyText'));
console.log('Tab で移っても見えない:', detail('focusInvisible'));
console.log('エラー:', [...new Set(results.flatMap((r) => r.errors))]);
console.log(`\n参加者 390px で見える人数: ${rows390} / ホスト: ${hostRows390} / 横向き 844x390: ${landRows}`);
console.log('自動の点数（55点満点）:', JSON.stringify(score));
const json = arg('--json');
if (json) fs.writeFileSync(json, JSON.stringify({ score, results }, null, 2));
