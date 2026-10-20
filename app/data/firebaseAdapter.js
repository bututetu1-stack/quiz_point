// 本番用アダプタ：Firebase Realtime Database（modular API）を store.js が使う形に包む

import { initializeApp } from 'firebase/app';
import { get, getDatabase, onValue, push, ref, remove, runTransaction, set, update } from 'firebase/database';

export const createFirebaseAdapter = (config) => {
  const db = getDatabase(initializeApp(config));
  const r = (p) => ref(db, p);
  return {
    get: async (p) => (await get(r(p))).val(),
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
          cb(null);
        },
      ),
    onConnected: (cb) => onValue(r('.info/connected'), (s) => cb(!!s.val())),
  };
};
