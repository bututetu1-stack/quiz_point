// データ層：Realtime Database 上の部屋・プレイヤー・履歴・得点推移を扱う。
// db は「アダプタ」（本番は firebaseAdapter.js、テストはメモリ実装）で、次を持つ:
//   get(path) / set(path, v) / update(path, obj) / remove(path) / push(path, v) → key
//   transaction(path, fn) → { committed, value }   （fn が undefined を返すと中止）
//   onValue(path, cb) → 購読解除関数 / onConnected(cb) → 購読解除関数
//
// データ構造:
//   rooms/{room}            : { hostToken, createdAt, scoreMode, teamMode, rule, q, seq, phase, players: {pid: {...}}, teams: {tid: {...}} }
//                             プレイヤーの項目は lib/rules.js 冒頭を参照。spectator: true なら観戦中（ランキングに出ない）
//   history/{room}/{pid}/k  : そのプレイヤーの得点変更前 { score, maru, batsu, …ルール系の状態, rec }（プレイヤー別 Undo 用）
//   timeline/{room}/k       : 得点推移イベント { t, p?, s?, m?, b? }（lib/timeline.js 参照）
//   roomIndex/{room}        : createdAt（期限切れの部屋を掃除するための軽い索引）
//   log/{room}/k            : 操作ログ { t, text, kind }（最新50件だけ表示）
//   presence/{room}/{pid}   : 接続中なら true（切断でサーバ側が消す）
//
// 同時操作で更新が消えないよう、プレイヤー1人分は players/{pid} の transaction、
// 全員分は players の transaction で書く（手元のキャッシュで丸ごと上書きしない）。
// Firebase の transaction は手元に値が無いと最初 null で呼ばれるので、null のときは null を返し、
// サーバ側の値で呼び直してもらう（undefined で中止すると、実在しても「見つからない」扱いになる）。

import { applyOp, parseValue } from '../lib/rational.js';
import { genId, genRoomCode, genToken } from '../lib/ids.js';
import {
  applyAdvance,
  applyAnswer,
  applyDeclare,
  DEFAULT_RULE,
  effectiveQ,
  freshRuleFields,
  initialScore,
  normalizeRule,
  playerState,
  recOf,
  ruleLabel,
} from '../lib/rules.js';
import { formatScoreStr } from '../lib/score.js';

export const ROOM_TTL = 24 * 60 * 60 * 1000; // 24h 経過した部屋は掃除対象

const OK = { ok: true };
const err = (error) => ({ ok: false, error });
const cleanName = (name) => (name || '').trim().slice(0, 30);
// Undo 用に残す「得点まわり」の値（ルール系の状態も含む）
const snapOf = (p) => ({
  score: p.score || '0/1',
  maru: p.maru || 0,
  batsu: p.batsu || 0,
  status: p.status || null,
  winSeq: p.winSeq ?? null,
  loseSeq: p.loseSeq ?? null,
  restUntilQ: p.restUntilQ ?? null,
  pq: p.pq ?? null,
  streak: p.streak || 0,
  correctAt: p.correctAt ?? null,
  rec: recOf(p),
});
// 得点推移・部屋索引などの付随データは、書けなくても本体の操作を止めない
const soft = (promise, fallback = null) =>
  Promise.resolve(promise).catch((e) => {
    console.warn('quiz_point:', e && e.message ? e.message : e);
    return fallback;
  });

export const roomState = (roomId, v) => {
  v = v || {};
  const all = Object.values(v.players || {});
  return {
    roomId,
    exists: !!v.createdAt,
    players: all.filter((p) => !p.spectator), // 参加者（ランキング・チーム・グラフの対象）
    spectators: all.filter((p) => p.spectator),
    allPlayers: all,
    teams: Object.values(v.teams || {}),
    teamMode: v.teamMode || 'product',
    scoreMode: v.scoreMode || 'addsub',
    rule: normalizeRule(v.rule),
    q: v.q || 1,
    phase: v.phase || null,
  };
};

export const createStore = (db) => {
  const now = () => Date.now();
  const R = (room) => `rooms/${room}`;
  const P = (room, pid) => `rooms/${room}/players/${pid}`;
  const H = (room, pid) => `history/${room}/${pid}`;
  const T = (room) => `timeline/${room}`;

  const pushTimeline = (room, e) => soft(db.push(T(room), { t: now(), ...e }));
  const addLog = (room, text, kind = 'info') => soft(db.push(`log/${room}`, { t: now(), text, kind }));
  const OP_SYMBOL = { '+': '＋', '-': '−', '*': '×', '/': '÷' };

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

  const eventOf = (pid, p, q) => ({ p: pid, s: p.score || '0/1', m: p.maru || 0, b: p.batsu || 0, ...(q ? { q } : {}) });

  // 得点が変わる1人分の操作：変更前を履歴へ、変更後を推移へ
  const scoreOp = async (room, pid, mutate) => {
    const res = await updatePlayer(room, pid, mutate);
    if (!res.ok) return res;
    const q = await soft(db.get(`${R(room)}/q`));
    await Promise.all([db.push(H(room, pid), res.prior), pushTimeline(room, eventOf(pid, res.player, q || 1))]);
    return res;
  };

  // ルール系の1人分の操作：pure（rules.js の関数）で次の状態を作る。できない状態なら何も記録しない
  const ruleOp = async (room, pid, pure) => {
    let error = null;
    const res = await updatePlayer(room, pid, (p) => {
      const a = pure(p);
      error = a.ok ? null : a.error;
      return a.ok ? a.player : p;
    });
    if (!res.ok) return res;
    if (error) return err(error);
    await db.push(H(room, pid), res.prior);
    return res;
  };

  // 勝ち抜け・脱落した人に通し番号（勝ち抜け順・脱落順）を振る
  const assignSeq = async (room, pid, pl) => {
    const key = pl.status === 'win' ? 'winSeq' : pl.status === 'lose' ? 'loseSeq' : null;
    if (!key || pl[key] != null) return;
    const seq = await db.transaction(`${R(room)}/seq`, (n) => (n || 0) + 1);
    await updatePlayer(room, pid, (p) => (p.status === pl.status && p[key] == null ? { ...p, [key]: seq.value } : p));
  };

  // 〇✕：部屋のルールで次の状態を計算。答えられない状態（勝ち抜け済み・休み中など）なら何も記録しない
  const answer = async (room, pid, result) => {
    const [rule, q] = await Promise.all([db.get(`${R(room)}/rule`), db.get(`${R(room)}/q`)]);
    const qq = q || 1;
    const res = await ruleOp(room, pid, (p) => applyAnswer(rule, p, result, { q: qq, now: now() }));
    if (!res.ok) return res;
    const pl = res.player;
    const tail = pl.status === 'win' ? '（勝ち抜け！）' : pl.status === 'lose' ? '（脱落）' : '';
    await Promise.all([
      pushTimeline(room, eventOf(pid, pl, qq)),
      addLog(room, `Q${effectiveQ(pl, qq)} ${pl.name} ${result === 'correct' ? '〇' : '✕'}${tail}`, pl.status === 'win' ? 'win' : result),
    ]);
    await assignSeq(room, pid, pl);
    return OK;
  };

  // 本人が勝ち抜け・脱落を宣言（「元に戻す」で取り消せる）
  const declare = async (room, pid, status) => {
    const rule = await db.get(`${R(room)}/rule`);
    const res = await ruleOp(room, pid, (p) => applyDeclare(rule, p, status));
    if (!res.ok) return res;
    const pl = res.player;
    await addLog(room, `${pl.name} ${pl.status === 'win' ? '勝ち抜け！' : '脱落'}（宣言）`, pl.status === 'win' ? 'win' : 'wrong');
    await assignSeq(room, pid, pl);
    return OK;
  };

  // 休み中の本人が「問題を進める」
  const advanceSelf = async (room, pid) => {
    const q = (await db.get(`${R(room)}/q`)) || 1;
    const res = await ruleOp(room, pid, (p) => applyAdvance(p, q));
    if (!res.ok) return res;
    const st = playerState(res.player, q);
    await addLog(room, `${res.player.name} 問題を進める（${st.kind === 'rest' ? `休みあと${st.restLeft}` : '休み明け'}）`, 'q');
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
    const res = await updatePlayer(room, pid, (p) => ({
      ...p,
      ...freshRuleFields(),
      ...snap,
      score: snap.score != null ? snap.score : '0/1',
    }));
    if (!res.ok) return res;
    const q = await soft(db.get(`${R(room)}/q`));
    await Promise.all([
      db.remove(`${H(room, pid)}/${key}`),
      pushTimeline(room, eventOf(pid, res.player, q || 1)),
      addLog(room, `${res.player.name} 元に戻す`, 'undo'),
    ]);
    return OK;
  };

  const removeRoomData = (room) =>
    Promise.all(
      [R(room), `history/${room}`, T(room), `roomIndex/${room}`, `log/${room}`, `presence/${room}`].map((p) => soft(db.remove(p))),
    );

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
          return { hostToken, createdAt: t, scoreMode: 'addsub', teamMode: 'product', rule: DEFAULT_RULE, q: 1 };
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

    // 入室：保存済み playerId があれば名前だけ更新、無ければ新規作成（得点はルールの初期点から）
    async joinRoom(room, name, playerId) {
      const nm = cleanName(name);
      if (!nm) return err('invalid_name');
      const [createdAt, rule] = await Promise.all([db.get(`${R(room)}/createdAt`), db.get(`${R(room)}/rule`)]);
      if (createdAt == null) return err('room_not_found');
      const pid = playerId || genId('p');
      const res = await db.transaction(P(room, pid), (cur) =>
        cur ? { ...cur, name: nm } : { id: pid, name: nm, score: initialScore(rule), maru: 0, batsu: 0, teamId: null, joinedAt: now() },
      );
      if (!res.committed) return err('join_failed');
      return { ok: true, playerId: pid };
    },

    subscribeRoom: (room, cb) => db.onValue(R(room), (v) => cb(roomState(room, v))),
    subscribeTimeline: (room, cb) => db.onValue(T(room), (v) => cb(Object.values(v || {}))),
    // 操作ログ：新しい順に最新50件
    subscribeLog: (room, cb) =>
      db.onValueLast(`log/${room}`, 50, (v) =>
        cb(
          Object.entries(v || {})
            .sort(([a], [b]) => (a < b ? 1 : -1))
            .map(([, e]) => e),
        ),
      ),
    // 接続中の人：{ pid: true }
    subscribePresence: (room, cb) => db.onValue(`presence/${room}`, (v) => cb(v || {})),
    // 自分を「接続中」にする（戻り値で解除）。書けなくても動作は止めない
    goOnline: (room, pid) => {
      try {
        return db.presence(`presence/${room}/${pid}`);
      } catch (e) {
        return () => {};
      }
    },

    async op(room, type, payload = {}) {
      try {
        const pid = payload.playerId;
        switch (type) {
          case 'answer':
            return await answer(room, pid, payload.result === 'correct' ? 'correct' : 'wrong');
          case 'declare':
            return await declare(room, pid, payload.status === 'lose' ? 'lose' : 'win');
          case 'advanceSelf':
            return await advanceSelf(room, pid);
          // 観戦にする／参加に戻す（本人、またはホストが他の人に）
          case 'setSpectator': {
            const on = !!payload.on;
            const res = await updatePlayer(room, pid, (p) => ({ ...p, spectator: on || null }));
            if (!res.ok) return res;
            await addLog(room, `${res.player.name} ${on ? 'が観戦に' : 'が参加に戻る'}`, 'host');
            return OK;
          }
          case 'maru':
          case 'batsu': {
            const res = await scoreOp(room, pid, (p) => {
              p[type] = (p[type] || 0) + 1;
              const rec = recOf(p);
              rec[type === 'maru' ? 'o' : 'x'] += 1;
              p.rec = rec;
              return p;
            });
            if (res.ok) await addLog(room, `${res.player.name} ${type === 'maru' ? '〇' : '✕'}`, type === 'maru' ? 'correct' : 'wrong');
            return res.ok ? OK : res;
          }
          case 'score':
          case 'setScore': {
            const val = parseValue(payload.valueStr);
            if (val === null) return err('invalid_value');
            const res = await scoreOp(room, pid, (p) => {
              p.score = type === 'score' ? applyOp(p.score || '0/1', payload.operator, val) : val;
              return p;
            });
            if (res.ok) {
              const how = type === 'score' ? `${OP_SYMBOL[payload.operator] || payload.operator}${payload.valueStr}` : `を ${payload.valueStr} に`;
              await addLog(room, `${res.player.name} ${how} → ${formatScoreStr(res.player.score)}`, 'score');
            }
            return res.ok ? OK : res;
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
            ).then(async (res) => {
              if (res.ok) await addLog(room, `${payload.by || 'ホスト'} が全員を ${payload.valueStr} に`, 'host');
              return res;
            });
          }
          case 'resetAll': {
            const s0 = initialScore(await db.get(`${R(room)}/rule`));
            const res = await bulkOp(room, (p) => ({ ...p, ...freshRuleFields(), score: s0, maru: 0, batsu: 0 }), { s: s0, m: 0, b: 0, q: 1 });
            if (res.ok)
              await Promise.all([db.set(`${R(room)}/q`, 1), db.remove(`${R(room)}/seq`), addLog(room, `${payload.by || 'ホスト'} が全員をリセット`, 'host')]);
            return res;
          }
          // ルール変更：全員の得点・状態と問題番号をリセットし、別ルールの Undo 履歴は消す
          case 'setRule': {
            const rule = normalizeRule(payload.rule);
            const s0 = initialScore(rule);
            await db.set(`${R(room)}/rule`, rule);
            await db.transaction(`${R(room)}/players`, (cur) => {
              if (!cur) return null;
              const next = {};
              Object.entries(cur).forEach(([id, p]) => {
                next[id] = { ...p, ...freshRuleFields(), score: s0, maru: 0, batsu: 0 };
              });
              return next;
            });
            await Promise.all([db.set(`${R(room)}/q`, 1), db.remove(`${R(room)}/seq`), db.remove(`history/${room}`)]);
            await Promise.all([
              pushTimeline(room, { s: s0, m: 0, b: 0, q: 1 }),
              addLog(room, `${payload.by || 'ホスト'} がルールを「${ruleLabel(rule)}」に`, 'host'),
            ]);
            return OK;
          }
          // 問題番号を進める / 戻す（1 未満にはしない）
          case 'nextQ': {
            const d = payload.delta === -1 ? -1 : 1;
            const res = await db.transaction(`${R(room)}/q`, (q) => Math.max(1, (q || 1) + d));
            await addLog(room, `Q${res.value} ${d > 0 ? 'へ進む' : 'に戻す'}`, 'q');
            return OK;
          }
          // 結果発表の表示（'result'）／解除（null）
          case 'setPhase': {
            await db.set(`${R(room)}/phase`, payload.phase === 'result' ? 'result' : null);
            if (payload.phase === 'result') await addLog(room, '結果発表！', 'host');
            return OK;
          }
          case 'undo':
            return await undo(room, pid);
          case 'removePlayer':
            await Promise.all([db.remove(P(room, pid)), db.remove(H(room, pid)), soft(db.remove(`presence/${room}/${pid}`))]);
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
