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

const css = execFileSync(
  path.join(ROOT, 'node_modules/.bin/tailwindcss'),
  ['-c', path.join(ROOT, 'tailwind.config.cjs'), '-i', path.join(ROOT, 'app/styles.css'), '--minify'],
  { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] },
);

// </script> が JS 中に現れても HTML が壊れないようにする
const code = js.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');

const html = `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
<title>Quiz Scoreboard</title>
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
