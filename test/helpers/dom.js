// ビルド済み docs/index.html を jsdom で起動し、メモリ上の DB を差し込んで画面を操作するための道具

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export const builtHtml = () => fs.readFileSync(path.join(ROOT, 'docs/index.html'), 'utf8');

// url: '/?room=1234' など / storage: 事前に入れておく localStorage
export const boot = ({ db, url = '/', storage = {} }) => {
  const dom = new JSDOM(builtHtml(), {
    url: 'http://localhost' + url,
    runScripts: 'dangerously',
    pretendToBeVisual: true,
    beforeParse(w) {
      w.__QP_ADAPTER__ = db;
      w.alert = (m) => (w.__alerts = [...(w.__alerts || []), m]);
      w.confirm = () => true;
      w.prompt = () => w.__promptAnswer || null;
      Object.entries(storage).forEach(([k, v]) => w.localStorage.setItem(k, v));
    },
  });
  const w = dom.window;
  const doc = w.document;
  const text = () => doc.body.textContent || '';
  const buttons = () => [...doc.querySelectorAll('button')];
  const byText = (s, root = doc) => [...root.querySelectorAll('button')].find((b) => (b.textContent || '').includes(s));
  const click = (el) => {
    if (!el) throw new Error('click: element not found');
    el.dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
  };
  // React の制御された input に値を入れる
  const type = (el, value) => {
    if (!el) throw new Error('type: element not found');
    const setter = Object.getOwnPropertyDescriptor(w.HTMLInputElement.prototype, 'value').set;
    setter.call(el, value);
    el.dispatchEvent(new w.Event('input', { bubbles: true }));
  };
  const close = () => w.close();
  return { dom, w, doc, text, buttons, byText, click, type, close };
};

export const waitFor = async (cond, { timeout = 3000, msg = 'condition' } = {}) => {
  const start = Date.now();
  for (;;) {
    let v;
    try {
      v = cond();
    } catch {
      v = false;
    }
    if (v) return v;
    if (Date.now() - start > timeout) throw new Error('timeout waiting for ' + msg);
    await new Promise((r) => setTimeout(r, 10));
  }
};
