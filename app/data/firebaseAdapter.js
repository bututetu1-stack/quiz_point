// 本番用アダプタ：Firebase Realtime Database（modular API）を store.js が使う形に包む

import { initializeApp } from 'firebase/app';
import {
  get,
  getDatabase,
  limitToFirst,
  limitToLast,
  onDisconnect,
  onValue,
  push,
  query,
  ref,
  remove,
  runTransaction,
  set,
  update,
} from 'firebase/database';

export const createFirebaseAdapter = (config) => {
  const db = getDatabase(initializeApp(config));
  const r = (p) => ref(db, p);
  return {
    get: async (p) => (await get(r(p))).val(),
    // 読めるかだけ確かめる（中身は 1 件だけ）。拒否なら例外
    probe: async (p) => {
      await get(query(r(p), limitToFirst(1)));
    },
    set: (p, v) => set(r(p), v),
    update: (p, v) => update(r(p), v),
    remove: (p) => remove(r(p)),
    push: async (p, v) => (await push(r(p), v)).key,
    transaction: async (p, fn) => {
      const res = await runTransaction(r(p), fn);
      return { committed: res.committed, value: res.snapshot.val() };
    },
    onValue: (p, cb) =>
      onValue(
        r(p),
        (s) => cb(s.val()),
        (e) => {
          console.warn('quiz_point: 読み込みできません', p, e && e.message);
          cb(null, e || new Error('denied'));
        },
      ),
    onConnected: (cb) => onValue(r('.info/connected'), (s) => cb(!!s.val())),
    // 最新 n 件だけ購読（操作ログ用）
    onValueLast: (p, n, cb) =>
      onValue(
        query(r(p), limitToLast(n)),
        (s) => cb(s.val()),
        (e) => cb(null, e || new Error('denied')),
      ),
    // 在室フラグ：接続中は true、切断されたらサーバ側で消える。戻り値で解除
    presence: (p) => {
      const node = r(p);
      const off = onValue(r('.info/connected'), (s) => {
        if (!s.val()) return;
        onDisconnect(node)
          .remove()
          .then(() => set(node, true))
          .catch(() => {});
      });
      return () => {
        off();
        onDisconnect(node)
          .cancel()
          .catch(() => {});
        remove(node).catch(() => {});
      };
    },
  };
};
