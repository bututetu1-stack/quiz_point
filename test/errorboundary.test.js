// 部品テスト：描画中にエラーが起きても真っ白にならず「再読み込み」が出る（ErrorBoundary を esbuild で小さく組んで jsdom で動かす）
import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as esbuild from 'esbuild';
import { JSDOM } from 'jsdom';
import { waitFor } from './helpers/dom.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('ErrorBoundary：子の描画でエラーが起きたら「表示に問題が起きました」と再読み込みのボタン', async () => {
  const out = await esbuild.build({
    stdin: {
      contents: `
        import { createRoot } from 'react-dom/client';
        import { ErrorBoundary } from './app/ui/ErrorBoundary.jsx';
        const Boom = () => { throw new Error('boom'); };
        createRoot(document.getElementById('r')).render(<ErrorBoundary><Boom /></ErrorBoundary>);
      `,
      resolveDir: ROOT,
      loader: 'jsx',
    },
    bundle: true,
    write: false,
    format: 'iife',
    jsx: 'automatic',
    define: { 'process.env.NODE_ENV': '"production"' },
    logLevel: 'silent',
  });
  const dom = new JSDOM('<!DOCTYPE html><div id="r"></div>', { runScripts: 'outside-only', pretendToBeVisual: true });
  dom.window.console.error = () => {};
  dom.window.eval(out.outputFiles[0].text);
  await waitFor(() => dom.window.document.querySelector('[data-crash]'), { msg: 'crash screen' });
  const t = dom.window.document.body.textContent;
  assert.ok(t.includes('表示に問題が起きました') && t.includes('再読み込み') && t.includes('boom'));
  dom.window.close();
});
