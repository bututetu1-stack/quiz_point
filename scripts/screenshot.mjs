// docs/index.html をブラウザで開き、メモリ上の DB（テスト用シナリオ）でスクリーンショットを撮る。
// Firebase には接続しない。
// 使い方: npm run build && node scripts/screenshot.mjs <出力ディレクトリ> [名前の一部]
//   CHROME_PATH=... でブラウザの実行ファイルを指定（未指定ならインストール済みの Google Chrome を使う）
//   RULE=free で自由計算のシナリオ、PHASE=1 で結果発表中のシナリオ
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import * as esbuild from 'esbuild';
import { chromium } from 'playwright-core';

const OUT = process.argv[2] || './out';
fs.mkdirSync(OUT, { recursive: true });
const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PAGE = pathToFileURL(path.join(REPO, 'docs/index.html')).href;

const adapterJs = (
  await esbuild.build({
    entryPoints: [path.join(REPO, 'test/helpers/memoryAdapter.js')],
    bundle: true,
    format: 'iife',
    globalName: '__QPMem',
    write: false,
  })
).outputFiles[0].text;

const t0 = Date.now() - 600000;
const scenario = {
  rooms: {
    '0427': {
      hostToken: 'tok',
      createdAt: Date.now(),
      scoreMode: 'addsub',
      teamMode: 'product',
      rule: process.env.RULE === 'free' ? { type: 'free' } : { type: 'nomx', win: 7, lose: 3, rest: 1, combo: false },
      q: 12,
      ...(process.env.PHASE ? { phase: 'result' } : {}),
      players: process.env.RULE === 'free' ? {
        p_host: { id: 'p_host', name: '司会', score: '12/1', maru: 4, batsu: 1, teamId: 't_red' },
        p_a: { id: 'p_a', name: 'アリス', score: '15/1', maru: 5, batsu: 0, teamId: 't_red' },
        p_b: { id: 'p_b', name: 'ボブ', score: '21/2', maru: 3, batsu: 2, teamId: 't_blue' },
        p_c: { id: 'p_c', name: 'チャーリー', score: '3/1', maru: 1, batsu: 1 },
      } : {
        p_host: { id: 'p_host', name: '司会', score: '4/1', maru: 4, batsu: 1, teamId: 't_red', restUntilQ: 13 },
        p_a: { id: 'p_a', name: 'アリス', score: '7/1', maru: 7, batsu: 0, teamId: 't_red', status: 'win', winSeq: 1 },
        p_b: { id: 'p_b', name: 'ボブ', score: '5/1', maru: 5, batsu: 2, teamId: 't_blue' },
        p_c: { id: 'p_c', name: 'チャーリー', score: '1/1', maru: 1, batsu: 3, status: 'lose' },
        p_d: { id: 'p_d', name: 'デイジー', score: '5/1', maru: 5, batsu: 1, teamId: 't_blue' },
      },
      teams: { t_red: { id: 't_red', name: '赤組' }, t_blue: { id: 't_blue', name: '青組' } },
    },
  },
  timeline: {
    '0427': Object.fromEntries(
      [
        ['p_a', '5/1'],
        ['p_b', '3/1'],
        ['p_host', '4/1'],
        ['p_a', '10/1'],
        ['p_c', '3/1'],
        ['p_b', '21/2'],
        ['p_host', '12/1'],
        ['p_a', '15/1'],
      ].map(([p, s], i) => ['-k' + String(i).padStart(10, '0'), { t: t0 + i * 60000, p, s, q: i + 1 }]),
    ),
  },
};

const initScript = (storage) => `
${adapterJs}
window.__QP_ADAPTER__ = __QPMem.createMemoryAdapter(${JSON.stringify(scenario)});
${Object.entries(storage)
  .map(([k, v]) => `localStorage.setItem(${JSON.stringify(k)}, ${JSON.stringify(v)});`)
  .join('\n')}
`;

const browser = await chromium.launch(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : { channel: 'chrome' });
const shot = async (name, { width, height, url = '', storage = {}, act, dark }) => {
  const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 2, colorScheme: dark ? 'dark' : 'light' });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await page.addInitScript(initScript(storage));
  await page.goto(PAGE + url);
  await page.waitForTimeout(400);
  if (act) await act(page);
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(OUT, name + '.png'), fullPage: false });
  if (errors.length) console.log(name, 'ERRORS:', errors);
  else console.log(name, 'ok');
  await ctx.close();
};

const host = { hostToken_0427: 'tok', playerId_0427: 'p_host', playerName: '司会' };

const only = process.argv[3];
const plans = {
  home_mobile: { width: 390, height: 844 },
  host_mobile: { width: 390, height: 844, url: '?room=0427', storage: host },
  host_desktop: { width: 1280, height: 860, url: '?room=0427', storage: host },
  participant_mobile: { width: 390, height: 844, url: '?room=0427', storage: { playerId_0427: 'p_a', playerName: 'アリス' } },
  dark_participant: { width: 390, height: 844, url: '?room=0427', storage: { playerId_0427: 'p_a', playerName: 'アリス' }, dark: true },
  dark_host_desktop: { width: 1280, height: 860, url: '?room=0427', storage: host, dark: true },
  board_desktop: { width: 1440, height: 860, url: '?room=0427&view=board' },
  result_mobile: {
    width: 390,
    height: 844,
    url: '?room=0427',
    storage: host,
    act: async (page) => page.evaluate(() => [...document.querySelectorAll('button')].find((b) => b.textContent.includes('結果発表（')) ? null : null),
  },
  invite_mobile: {
    width: 390,
    height: 844,
    url: '?room=0427',
    storage: { playerId_0427: 'p_a', playerName: 'アリス' },
    act: async (page) => page.evaluate(() => [...document.querySelectorAll('button')].find((b) => b.textContent.includes('0427')).click()),
  },
  team_open_mobile: {
    width: 390,
    height: 844,
    url: '?room=0427',
    storage: { playerId_0427: 'p_a', playerName: 'アリス' },
    act: async (page) => page.evaluate(() => document.querySelector('[data-team-button]').click()),
  },
  graph_mobile: {
    width: 390,
    height: 844,
    url: '?room=0427',
    storage: host,
    act: async (page) => page.evaluate(() => [...document.querySelectorAll('button')].find((b) => b.textContent.includes('グラフ')).click()),
  },
};
for (const [name, opt] of Object.entries(plans)) if (!only || name.includes(only)) await shot(name, opt);
await browser.close();
