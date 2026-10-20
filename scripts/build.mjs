// ビルド：JSX と依存ライブラリを1つの JS に、Tailwind を必要なクラスだけの CSS にし、
// どちらも HTML に埋め込んで docs/index.html（GitHub Pages 用・外部読み込みなし）を出力する。

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as esbuild from 'esbuild';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'docs', 'index.html');

const js = await esbuild.build({
  entryPoints: [path.join(ROOT, 'app/main.jsx')],
  bundle: true,
  minify: true,
  format: 'iife',
  target: 'es2020',
  jsx: 'automatic',
  define: { 'process.env.NODE_ENV': '"production"' },
  legalComments: 'none',
  write: false,
});

// .bin/tailwindcss は Windows では直接起動できないので、CLI 本体を node で実行する
const css = execFileSync(
  process.execPath,
  [path.join(ROOT, 'node_modules/tailwindcss/lib/cli.js'), '-c', path.join(ROOT, 'tailwind.config.cjs'), '-i', path.join(ROOT, 'app/styles.css'), '--minify'],
  { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] },
);

// タブのアイコン（琥珀の角丸に稲妻。外部ファイルにせず data URI で埋め込む）
const ICON = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect x="4" y="4" width="56" height="56" rx="16" fill="#f59e0b"/><path d="M35 10 17 36h13l-3 18 20-27H34z" fill="#fff"/></svg>`;

// </script> が JS 中に現れても HTML が壊れないようにする
const code = js.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');

const html = `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
<meta name="description" content="クイズ大会・フリバ用のリアルタイム得点表。部屋を作って QR で招待、各自のスマホで正答・誤答を押すだけ。" />
<meta name="theme-color" content="#fbf7ef" />
<link rel="icon" href="data:image/svg+xml,${encodeURIComponent(ICON)}" />
<title>Quiz Score Pro — クイズの得点表</title>
<style>${css}</style>
</head>
<body>
<div id="root"><div id="boot" style="padding:24px;color:#94a3b8;font-family:sans-serif">読み込み中…</div></div>
<script>window.addEventListener("error",function(e){var b=document.getElementById("boot");if(b)b.textContent="エラー: "+(e.message||e.error);});</script>
<script>${code}</script>
</body>
</html>
`;

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, html);
console.log(`wrote ${path.relative(ROOT, OUT)} (${(html.length / 1024).toFixed(0)} KB: js ${(code.length / 1024).toFixed(0)} KB, css ${(css.length / 1024).toFixed(0)} KB)`);
