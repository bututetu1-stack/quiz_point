// テスト・スクリーンショット用：メモリ上で動く Realtime Database の代用品。
// 各操作は1拍おいてから原子的に実行し、購読者へは非同期で通知する（ネットワーク越しに近い振る舞い）。

const clone = (v) => (v === undefined ? undefined : JSON.parse(JSON.stringify(v)));
const split = (p) => String(p).split('/').filter(Boolean);
const tick = () => new Promise((r) => setTimeout(r, 0));

// Firebase と同じく null の子と空のオブジェクトは保存しない
const normalize = (v) => {
  if (v === null || v === undefined) return null;
  if (typeof v !== 'object') return v;
  const out = {};
  Object.entries(v).forEach(([k, c]) => {
    const n = normalize(c);
    if (n !== null) out[k] = n;
  });
  return Object.keys(out).length ? out : null;
};

// initial: 最初から入れておくデータ（スクリーンショット用のシナリオなど）
export const createMemoryAdapter = (initial = null) => {
  let root = normalize(clone(initial));
  let seq = 0;
  const listeners = new Set();

  const getAt = (path) => {
    let cur = root;
    for (const k of split(path)) {
      if (cur === null || typeof cur !== 'object') return null;
      cur = cur[k] === undefined ? null : cur[k];
    }
    return clone(cur);
  };
  const setAt = (path, value) => {
    const keys = split(path);
    const v = normalize(clone(value));
    if (!keys.length) {
      root = v;
    } else {
      if (root === null || typeof root !== 'object') root = {};
      let cur = root;
      for (const k of keys.slice(0, -1)) {
        if (cur[k] === null || typeof cur[k] !== 'object') cur[k] = {};
        cur = cur[k];
      }
      const last = keys[keys.length - 1];
      if (v === null) delete cur[last];
      else cur[last] = v;
      root = normalize(root);
    }
    notify(path);
  };
  const related = (a, b) => {
    const x = split(a).join('/');
    const y = split(b).join('/');
    return x === y || x.startsWith(y + '/') || y.startsWith(x + '/') || !x || !y;
  };
  const notify = (path) => {
    listeners.forEach((l) => {
      if (related(l.path, path)) setTimeout(() => listeners.has(l) && l.cb(getAt(l.path)), 0);
    });
  };

  return {
    async get(p) {
      await tick();
      return getAt(p);
    },
    async set(p, v) {
      await tick();
      setAt(p, v);
    },
    async update(p, obj) {
      await tick();
      Object.entries(obj).forEach(([k, v]) => setAt(`${p}/${k}`, v));
    },
    async remove(p) {
      await tick();
      setAt(p, null);
    },
    async push(p, v) {
      await tick();
      const key = '-k' + String(++seq).padStart(10, '0');
      setAt(`${p}/${key}`, v);
      return key;
    },
    async transaction(p, fn) {
      await tick();
      const cur = getAt(p);
      const next = fn(cur);
      if (next === undefined) return { committed: false, value: cur };
      setAt(p, next);
      return { committed: true, value: getAt(p) };
    },
    onValue(p, cb) {
      const l = { path: p, cb };
      listeners.add(l);
      setTimeout(() => listeners.has(l) && cb(getAt(p)), 0);
      return () => listeners.delete(l);
    },
    onConnected(cb) {
      setTimeout(() => cb(true), 0);
      return () => {};
    },
    _dump: () => clone(root),
  };
};
