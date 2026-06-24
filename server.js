'use strict';

const path = require('path');
const crypto = require('crypto');
const http = require('http');
const express = require('express');
const { Server } = require('socket.io');

const { parseValue, applyOp, ZERO } = require('./src/scoreEngine');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;

// 静的フロント配信
app.use(express.static(path.join(__dirname, 'public')));

// ---- 部屋ストア（メモリ保持） ----
/** @type {Map<string, Room>} */
const rooms = new Map();

const MAX_HISTORY = 50;
const ROOM_TTL_MS = 24 * 60 * 60 * 1000; // 24h

function genRoomId() {
  // 紛らわしい文字を避けた6文字コード
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let id;
  do {
    id = Array.from({ length: 6 }, () =>
      alphabet[crypto.randomInt(alphabet.length)]
    ).join('');
  } while (rooms.has(id));
  return id;
}

function genId(prefix) {
  return prefix + '_' + crypto.randomBytes(6).toString('hex');
}

function createRoom() {
  const room = {
    id: genRoomId(),
    hostToken: crypto.randomBytes(16).toString('hex'),
    players: [],
    teams: [],
    history: [],
    createdAt: Date.now(),
    lastActive: Date.now(),
  };
  rooms.set(room.id, room);
  return room;
}

/** クライアントへ送る公開状態（hostToken や history は含めない） */
function publicState(room) {
  return {
    roomId: room.id,
    players: room.players.map((p) => ({
      id: p.id,
      name: p.name,
      score: p.score,
      teamId: p.teamId,
    })),
    teams: room.teams.map((t) => ({ id: t.id, name: t.name })),
  };
}

function broadcastState(room) {
  io.to(room.id).emit('state', publicState(room));
}

/** 操作前のスナップショットを履歴に積む（Undo 用） */
function pushHistory(room) {
  room.history.push({
    players: JSON.parse(JSON.stringify(room.players)),
    teams: JSON.parse(JSON.stringify(room.teams)),
  });
  if (room.history.length > MAX_HISTORY) room.history.shift();
}

function touch(room) {
  room.lastActive = Date.now();
}

// 古い部屋の定期クリーンアップ
setInterval(() => {
  const now = Date.now();
  for (const [id, room] of rooms) {
    if (now - room.lastActive > ROOM_TTL_MS) rooms.delete(id);
  }
}, 60 * 60 * 1000).unref();

// ---- Socket.IO ----
io.on('connection', (socket) => {
  // 部屋作成（ホスト）
  socket.on('createRoom', (cb) => {
    const room = createRoom();
    if (typeof cb === 'function') {
      cb({ ok: true, roomId: room.id, hostToken: room.hostToken });
    }
  });

  // ホスト参加（再認証含む）
  socket.on('hostJoin', ({ roomId, hostToken } = {}, cb) => {
    const room = rooms.get(roomId);
    if (!room || room.hostToken !== hostToken) {
      if (typeof cb === 'function') cb({ ok: false, error: 'unauthorized' });
      return;
    }
    socket.join(roomId);
    socket.data.roomId = roomId;
    socket.data.isHost = true;
    if (typeof cb === 'function') cb({ ok: true, state: publicState(room) });
  });

  // 参加者入室（閲覧専用）
  socket.on('joinRoom', ({ roomId, name, playerId } = {}, cb) => {
    const room = rooms.get(roomId);
    if (!room) {
      if (typeof cb === 'function') cb({ ok: false, error: 'room_not_found' });
      return;
    }
    const trimmed = (name || '').trim().slice(0, 30);
    if (!trimmed) {
      if (typeof cb === 'function') cb({ ok: false, error: 'invalid_name' });
      return;
    }

    let player = playerId ? room.players.find((p) => p.id === playerId) : null;
    if (player) {
      // 再接続: 名前を更新
      player.name = trimmed;
    } else {
      player = {
        id: genId('p'),
        name: trimmed,
        score: ZERO,
        teamId: null,
        joinedAt: Date.now(),
      };
      room.players.push(player);
    }

    socket.join(roomId);
    socket.data.roomId = roomId;
    socket.data.playerId = player.id;
    touch(room);

    if (typeof cb === 'function') {
      cb({ ok: true, playerId: player.id, state: publicState(room) });
    }
    broadcastState(room);
  });

  // 既存部屋の存在確認（参加者の入室画面用）
  socket.on('checkRoom', ({ roomId } = {}, cb) => {
    if (typeof cb === 'function') cb({ ok: rooms.has(roomId) });
  });

  // ホスト操作
  socket.on('op', ({ roomId, hostToken, type, payload } = {}, cb) => {
    const room = rooms.get(roomId);
    if (!room || room.hostToken !== hostToken) {
      if (typeof cb === 'function') cb({ ok: false, error: 'unauthorized' });
      return;
    }
    payload = payload || {};

    try {
      switch (type) {
        case 'score': {
          const player = room.players.find((p) => p.id === payload.playerId);
          if (!player) throw new Error('player_not_found');
          const value = parseValue(payload.valueStr);
          if (value === null) throw new Error('invalid_value');
          pushHistory(room);
          player.score = applyOp(player.score, payload.operator, value);
          break;
        }
        case 'setScore': {
          const player = room.players.find((p) => p.id === payload.playerId);
          if (!player) throw new Error('player_not_found');
          const value = parseValue(payload.valueStr);
          if (value === null) throw new Error('invalid_value');
          pushHistory(room);
          player.score = value;
          break;
        }
        case 'setAll': {
          const value = parseValue(payload.valueStr);
          if (value === null) throw new Error('invalid_value');
          pushHistory(room);
          room.players.forEach((p) => { p.score = value; });
          break;
        }
        case 'resetAll': {
          pushHistory(room);
          room.players.forEach((p) => { p.score = ZERO; });
          break;
        }
        case 'removePlayer': {
          pushHistory(room);
          room.players = room.players.filter((p) => p.id !== payload.playerId);
          break;
        }
        case 'renamePlayer': {
          const player = room.players.find((p) => p.id === payload.playerId);
          if (!player) throw new Error('player_not_found');
          const nm = (payload.name || '').trim().slice(0, 30);
          if (!nm) throw new Error('invalid_name');
          pushHistory(room);
          player.name = nm;
          break;
        }
        case 'createTeam': {
          const nm = (payload.name || '').trim().slice(0, 30);
          if (!nm) throw new Error('invalid_name');
          pushHistory(room);
          room.teams.push({ id: genId('t'), name: nm });
          break;
        }
        case 'renameTeam': {
          const team = room.teams.find((t) => t.id === payload.teamId);
          if (!team) throw new Error('team_not_found');
          const nm = (payload.name || '').trim().slice(0, 30);
          if (!nm) throw new Error('invalid_name');
          pushHistory(room);
          team.name = nm;
          break;
        }
        case 'removeTeam': {
          pushHistory(room);
          room.teams = room.teams.filter((t) => t.id !== payload.teamId);
          room.players.forEach((p) => {
            if (p.teamId === payload.teamId) p.teamId = null;
          });
          break;
        }
        case 'assignTeam': {
          const player = room.players.find((p) => p.id === payload.playerId);
          if (!player) throw new Error('player_not_found');
          const teamId = payload.teamId || null;
          if (teamId && !room.teams.some((t) => t.id === teamId)) {
            throw new Error('team_not_found');
          }
          pushHistory(room);
          player.teamId = teamId;
          break;
        }
        case 'undo': {
          if (room.history.length === 0) {
            if (typeof cb === 'function') cb({ ok: false, error: 'nothing_to_undo' });
            return;
          }
          const snap = room.history.pop();
          room.players = snap.players;
          room.teams = snap.teams;
          break;
        }
        default:
          throw new Error('unknown_op');
      }
    } catch (err) {
      if (typeof cb === 'function') cb({ ok: false, error: err.message });
      return;
    }

    touch(room);
    if (typeof cb === 'function') {
      cb({ ok: true, canUndo: room.history.length > 0 });
    }
    broadcastState(room);
  });
});

server.listen(PORT, () => {
  console.log(`quiz_point server listening on http://localhost:${PORT}`);
});

module.exports = { app, server, rooms };
