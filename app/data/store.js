// データ層：Realtime Database 上の部屋・プレイヤー・履歴・得点推移を扱う。
// db は「アダプタ」（本番は firebaseAdapter.js、テストはメモリ実装）で、次を持つ:
//   get(path) / set(path, v) / update(path, obj) / remove(path) / push(path, v) → key
//   transaction(path, fn) → { committed, value }   （fn が undefined を返すと中止）
//   onValue(path, cb) → 購読解除関数 / onConnected(cb) → 購読解除関数
//
// データ構造:
//   rooms/{room}            : { hostToken, createdAt, scoreMode, teamMode, players: {pid: {...}}, teams: {tid: {...}} }
//   history/{room}/{pid}/k  : そのプレイヤーの得点変更前 { score, maru, batsu }（プレイヤー別 Undo 用）
//   timeline/{room}/k       : 得点推移イベント { t, p?, s?, m?, b? }（lib/timeline.js 参照）
//   roomIndex/{room}        : createdAt（期限切れの部屋を掃除するための軽い索引）
//
// 同時操作で更新が消えないよう、プレイヤー1人分は players/{pid} の transaction、
// 全員分は players の transaction で書く（手元のキャッシュで丸ごと上書きしない）。
// Firebase の transaction は手元に値が無いと最初 null で呼ばれるので、null のときは null を返し、
// サーバ側の値で呼び直してもらう（undefined で中止すると、実在しても「見つからない」扱いになる）。

import { applyOp, parseValue } from '../lib/rational.js';
import { genId, genRoomCode, genToken } from '../lib/ids.js';

export const ROOM_TTL = 24 * 60 * 60 * 1000; // 24h 経過した部屋は掃除対象

const OK = { ok: true };
const err = (error) => ({ ok: false, error });
const cleanName = (name) => (name || '').trim().slice(0, 30);
const snapOf = (p) => ({ score: p.score || '0/1', maru: p.maru || 0, batsu: p.batsu || 0 });
// 得点推移・部屋索引などの付随データは、書けなくても本体の操作を止めない
const soft = (promise, fallback = null) =>
  Promise.resolve(promise).catch((e) => {
    console.warn('quiz_point:', e && e.message ? e.message : e);
    return fallback;
  });

export const roomState = (roomId, v) => {
  v = v || {};
  return {
    roomId,
    exists: !!v.createdAt,
    players: Object.values(v.players || {}),
    teams: Object.values(v.teams || {}),
    teamMode: v.teamMode || 'product',
    scoreMode: v.scoreMode || 'addsub',
  };
};

export const createStore = (db) => {
  const now = () => Date.now();
  const R = (room) => `rooms/${room}`;
  const P = (room, pid) => `rooms/${room}/players/${pid}`;
  const H = (room, pid) => `history/${room}/${pid}`;
  const T = (room) => `timeline/${room}`;

  const pushTimeline = (room, e) => soft(db.push(T(room), { t: now(), ...e }));

  // 1人分を transaction で更新。mutate はコピーを受け取り、変更後を返す
  const updatePlayer = async (room, pid, mutate) => {
    if (!pid) return err('player_not_found');
    let prior = null;
    const res = await db.transaction(P(room, pid), (cur) => {
      if (!cur) {
        prior = null;
        return null;
      }
      prior = snapOf(cur);
      return mutate({ ...cur });
    });
    if (!res.committed || !res.value) return err('player_not_found');
    return { ok: true, prior, player: res.value };
  };

  // 得点が変わる1人分の操作：変更前を履歴へ、変更後を推移へ
  const scoreOp = async (room, pid, mutate) => {
    const res = await updatePlayer(room, pid, mutate);
    if (!res.ok) return res;
    const p = res.player;
    await Promise.all([
      db.push(H(room, pid), res.prior),
      pushTimeline(room, { p: pid, s: p.score || '0/1', m: p.maru || 0, b: p.batsu || 0 }),
    ]);
    return OK;
  };

  // 全員分（全員1・全員リセット）：各自の変更前を各自の履歴へ積む
  const bulkOp = async (room, mutate, event) => {
    let priors = {};
    const res = await db.transaction(`${R(room)}/players`, (cur) => {
      priors = {};
      if (!cur) return null;
      const next = {};
      Object.entries(cur).forEach(([id, p]) => {
        priors[id] = snapOf(p);
        next[id] = mutate({ ...p });
      });
      return next;
    });
    if (!res.committed) return err('aborted');
    await Promise.all([...Object.entries(priors).map(([id, s]) => db.push(H(room, id), s)), pushTimeline(room, event)]);
    return OK;
  };

  const undo = async (room, pid) => {
    if (!pid) return err('player_not_found');
    const h = (await db.get(H(room, pid))) || {};
    const keys = Object.keys(h).sort();
    if (!keys.length) return err('nothing_to_undo');
    const key = keys[keys.length - 1];
    const snap = h[key] || {};
    const res = await updatePlayer(room, pid, (p) => {
      p.score = snap.score != null ? snap.score : '0/1';
      p.maru = snap.maru || 0;
      p.batsu = snap.batsu || 0;
      return p;
    });
    if (!res.ok) return res;
    const p = res.player;
    await Promise.all([db.remove(`${H(room, pid)}/${key}`), pushTimeline(room, { p: pid, s: p.score, m: p.maru || 0, b: p.batsu || 0 })]);
    return OK;
  };

  const removeRoomData = (room) =>
    Promise.all([db.remove(R(room)), db.remove(`history/${room}`), db.remove(T(room)), db.remove(`roomIndex/${room}`)]);

  return {
    onConnected: (cb) => db.onConnected(cb),

    // 部屋を作る：期限切れの部屋を索引から掃除し、空いているコードを transaction で確保
    async createRoom() {
      const hostToken = genToken();
      const t = now();
      const idx = (await soft(db.get('roomIndex'))) || {};
      const used = new Set();
      await Promise.all(
        Object.entries(idx).map(([code, createdAt]) => {
          if (t - createdAt > ROOM_TTL) return soft(removeRoomData(code));
          used.add(code);
          return null;
        }),
      );
      for (let i = 0; i < 50; i++) {
        const code = genRoomCode();
        if (used.has(code)) continue;
        const res = await db.transaction(R(code), (cur) => {
          if (cur && t - (cur.createdAt || 0) <= ROOM_TTL) return undefined; // 使用中
          return { hostToken, createdAt: t, scoreMode: 'addsub', teamMode: 'product' };
        });
        if (res.committed) {
          await Promise.all([soft(db.set(`roomIndex/${code}`, t)), soft(db.remove(`history/${code}`)), soft(db.remove(T(code)))]);
          return { ok: true, roomId: code, hostToken };
        }
      }
      return err('no_room_code');
    },

    // ホスト復帰：部屋が消えていたら同じコード・トークンで作り直す
    async hostJoin(room, hostToken) {
      const tok = await db.get(`${R(room)}/hostToken`);
      if (tok == null) {
        const t = now();
        await Promise.all([db.update(R(room), { hostToken, createdAt: t }), soft(db.set(`roomIndex/${room}`, t))]);
        return OK;
      }
      return tok === hostToken ? OK : err('unauthorized');
    },

    // 入室：保存済み playerId があれば名前だけ更新、無ければ新規作成
    async joinRoom(room, name, playerId) {
      const nm = cleanName(name);
      if (!nm) return err('invalid_name');
      const createdAt = await db.get(`${R(room)}/createdAt`);
      if (createdAt == null) return err('room_not_found');
      const pid = playerId || genId('p');
      const res = await db.transaction(P(room, pid), (cur) =>
        cur ? { ...cur, name: nm } : { id: pid, name: nm, score: '0/1', maru: 0, batsu: 0, teamId: null, joinedAt: now() },
      );
      if (!res.committed) return err('join_failed');
      return { ok: true, playerId: pid };
    },

    subscribeRoom: (room, cb) => db.onValue(R(room), (v) => cb(roomState(room, v))),
    subscribeTimeline: (room, cb) => db.onValue(T(room), (v) => cb(Object.values(v || {}))),

    async op(room, type, payload = {}) {
      try {
        const pid = payload.playerId;
        switch (type) {
          case 'maru':
          case 'batsu':
            return await scoreOp(room, pid, (p) => {
              p[type] = (p[type] || 0) + 1;
              return p;
            });
          case 'score':
          case 'setScore': {
            const val = parseValue(payload.valueStr);
            if (val === null) return err('invalid_value');
            return await scoreOp(room, pid, (p) => {
              p.score = type === 'score' ? applyOp(p.score || '0/1', payload.operator, val) : val;
              return p;
            });
          }
          case 'setAll': {
            const val = parseValue(payload.valueStr);
            if (val === null) return err('invalid_value');
            return await bulkOp(
              room,
              (p) => {
                p.score = val;
                return p;
              },
              { s: val },
            );
          }
          case 'resetAll':
            return await bulkOp(
              room,
              (p) => {
                p.score = '0/1';
                p.maru = 0;
                p.batsu = 0;
                return p;
              },
              { s: '0/1', m: 0, b: 0 },
            );
          case 'undo':
            return await undo(room, pid);
          case 'removePlayer':
            await Promise.all([db.remove(P(room, pid)), db.remove(H(room, pid))]);
            return OK;
          case 'renamePlayer': {
            const nm = cleanName(payload.name);
            if (!nm) return err('invalid_name');
            const res = await updatePlayer(room, pid, (p) => ({ ...p, name: nm }));
            return res.ok ? OK : res;
          }
          case 'assignTeam': {
            const res = await updatePlayer(room, pid, (p) => ({ ...p, teamId: payload.teamId || null }));
            return res.ok ? OK : res;
          }
          case 'createTeam': {
            const nm = cleanName(payload.name);
            if (!nm) return err('invalid_name');
            const tid = genId('t');
            await db.set(`${R(room)}/teams/${tid}`, { id: tid, name: nm });
            return OK;
          }
          case 'renameTeam': {
            const nm = cleanName(payload.name);
            if (!nm) return err('invalid_name');
            const res = await db.transaction(`${R(room)}/teams/${payload.teamId}`, (cur) => (cur ? { ...cur, name: nm } : null));
            return res.value ? OK : err('team_not_found');
          }
          case 'removeTeam':
            await db.remove(`${R(room)}/teams/${payload.teamId}`);
            await db.transaction(`${R(room)}/players`, (cur) => {
              if (!cur) return null;
              const next = {};
              Object.entries(cur).forEach(([id, p]) => {
                next[id] = p.teamId === payload.teamId ? { ...p, teamId: null } : p;
              });
              return next;
            });
            return OK;
          case 'setTeamMode':
            await db.set(`${R(room)}/teamMode`, payload.mode === 'sum' ? 'sum' : 'product');
            return OK;
          case 'setScoreMode':
            await db.set(`${R(room)}/scoreMode`, payload.mode === 'simple' ? 'simple' : 'addsub');
            return OK;
          default:
            return err('unknown_op');
        }
      } catch (e) {
        return err(e && e.message ? e.message : String(e));
      }
    },
  };
};
