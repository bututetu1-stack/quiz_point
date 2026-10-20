// App：画面の切り替え・入室/部屋作成・データ層（store）とのやりとり

import { useEffect, useMemo, useRef, useState } from 'react';
import { BoardResult, ResultOverlay } from './components/ResultOverlay.jsx';
import { RoomContext } from './context.js';
import { ruleLabel } from './lib/rules.js';
import { useToast } from './ui/toast.jsx';
import { BoardView } from './views/BoardView.jsx';
import { HomeView, HostCreateView, JoinView } from './views/EntryViews.jsx';
import { HostView } from './views/HostView.jsx';
import { ParticipantView } from './views/ParticipantView.jsx';

const EMPTY = {
  players: [],
  spectators: [],
  allPlayers: [],
  teams: [],
  scoreMode: 'addsub',
  teamMode: 'product',
  rule: { type: 'free' },
  q: 1,
  phase: null,
};

const setRoomInUrl = (roomId) => {
  const url = new URL(window.location);
  if (roomId) url.searchParams.set('room', roomId);
  else url.searchParams.delete('room');
  url.searchParams.delete('view');
  window.history.pushState({}, '', url);
};

const load = (k, d = null) => {
  try {
    const v = localStorage.getItem(k);
    return v === null ? d : v;
  } catch {
    return d;
  }
};
const save = (k, v) => {
  try {
    localStorage.setItem(k, v);
  } catch {
    // 保存できなくても続ける
  }
};

// 操作が通らなかったときの知らせ（null は知らせない）
const OP_ERRORS = {
  nothing_to_undo: '戻せる操作はもうありません',
  resting: '休み中です（「問題を進める」で数えます）',
  finished: 'すでに勝ち抜け／脱落しています（「元に戻す」で取り消せます）',
  not_resting: null,
  free_rule: null,
  player_not_found: 'この部屋のプレイヤーではなくなりました（ホストに削除された可能性があります）',
  invalid_value: '値を読み取れませんでした（例: 2・0.5・1/2）',
  invalid_name: '名前を入れてください',
};

export const App = ({ store }) => {
  const toast = useToast();
  const [view, setView] = useState('home'); // home, hostcreate, join, host, participant, board
  const [roomId, setRoomId] = useState('');
  const [myPlayerId, setMyPlayerId] = useState(null);
  const [myName, setMyName] = useState('');
  const [state, setState] = useState(EMPTY);
  const [connected, setConnected] = useState(false);
  const [soundOn, setSoundOnState] = useState(() => load('qp_sound', '1') === '1');
  const [online, setOnline] = useState({});
  const [resultClosed, setResultClosed] = useState(false);
  const [entryError, setEntryError] = useState('');

  const setSoundOn = (on) => {
    setSoundOnState(on);
    save('qp_sound', on ? '1' : '0');
  };

  useEffect(() => store.onConnected(setConnected), [store]);

  // 部屋の画面にいる間だけ部屋データと接続状況を購読
  const inRoom = view === 'host' || view === 'participant' || view === 'board';
  useEffect(() => {
    if (!inRoom || !roomId) return undefined;
    const offRoom = store.subscribeRoom(roomId, setState);
    const offPresence = store.subscribePresence(roomId, setOnline);
    return () => {
      offRoom();
      offPresence();
    };
  }, [store, inRoom, roomId]);

  // 自分を「接続中」にする
  useEffect(() => {
    if (!inRoom || view === 'board' || !roomId || !myPlayerId) return undefined;
    return store.goOnline(roomId, myPlayerId);
  }, [store, inRoom, view, roomId, myPlayerId]);

  // タブの名前：部屋にいる間は部屋コードとルール（複数の部屋を開いていても見分けられる）
  useEffect(() => {
    document.title =
      inRoom && roomId
        ? `${view === 'board' ? '大画面 ' : ''}#${roomId} ${ruleLabel(state.rule)} | Quiz Score Pro`
        : 'Quiz Score Pro — クイズの得点表';
  }, [inRoom, roomId, view, state.rule]);

  // 結果発表が新しく出たら、閉じた状態を戻す
  useEffect(() => {
    if (state.phase !== 'result') setResultClosed(false);
  }, [state.phase]);

  // 自分を players に登録（ホストも1プレイヤー）
  const enterAsPlayer = async (rId, name, savedPlayerId) => {
    const res = await store.joinRoom(rId, name, savedPlayerId);
    if (res.ok) {
      setMyPlayerId(res.playerId);
      setMyName(name);
      save(`playerId_${rId}`, res.playerId);
      save('playerName', name);
      save('qp_last_room', rId);
    }
    return res;
  };

  // 初期ロード時に URL の ?room= で自動参加
  //  - view=board: 大画面モード（入室しない）
  //  - ホスト：保存済みトークンで復帰
  //  - 参加者：この部屋に入ったことがあれば名前入力を省いて再入室、無ければ名前入力へ
  // 保存してある情報で部屋に戻る（ホストはトークン、参加者は前の playerId と名前）。戻れなければ入室画面へ
  const resumeRoom = async (room) => {
    setRoomId(room);
    const savedName = (load('playerName') || '').trim();
    const savedPlayerId = load(`playerId_${room}`);
    const savedHostToken = load(`hostToken_${room}`);
    if (savedHostToken) {
      const res = await store.hostJoin(room, savedHostToken);
      if (res.ok) {
        await enterAsPlayer(room, savedName || 'ホスト', savedPlayerId);
        setView('host');
        return;
      }
    }
    if (savedPlayerId && savedName) {
      const res = await enterAsPlayer(room, savedName, savedPlayerId);
      if (res.ok) {
        setView('participant');
        return;
      }
    }
    setView('join');
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const roomFromUrl = (params.get('room') || '').trim().toUpperCase();
    if (!roomFromUrl) return;
    if (params.get('view') === 'board') {
      setRoomId(roomFromUrl);
      setView('board');
      return;
    }
    resumeRoom(roomFromUrl);
  }, [store]);

  // ホームの「前の部屋に戻る」：最後に入った部屋（保存した入室情報があるときだけ）
  const lastRoom = (() => {
    const r = load('qp_last_room');
    return r && (load(`hostToken_${r}`) || load(`playerId_${r}`)) ? r : null;
  })();

  const handleCreateRoom = async (name) => {
    const hostName = (name || '').trim() || 'ホスト';
    setEntryError('');
    const res = await store.createRoom();
    if (!res.ok) {
      setEntryError(`部屋を作れませんでした（${res.error}）。通信状態を確かめて、もう一度押してください。`);
      return;
    }
    save(`hostToken_${res.roomId}`, res.hostToken);
    setRoomId(res.roomId);
    setRoomInUrl(res.roomId);
    await enterAsPlayer(res.roomId, hostName, null);
    setView('host');
  };

  const handleJoin = async (rId, name) => {
    setEntryError('');
    const res = await enterAsPlayer(rId, name, load(`playerId_${rId}`));
    if (!res.ok) {
      setEntryError(
        res.error === 'room_not_found'
          ? '部屋が見つかりませんでした。部屋コードを確認するか、ホストに招待リンクをもらい直してください（部屋は24時間で消えます）。'
          : `入室できませんでした（${res.error}）。もう一度押してください。`,
      );
      return;
    }
    setRoomId(rId);
    setRoomInUrl(rId);
    setView('participant');
  };

  // 操作の送信。ログ用に操作した人の名前も添える
  const lastNextQ = useRef({ delta: 0, t: 0 });
  const executeOp = async (type, payload = {}) => {
    // 問題を進める／戻すの二度押し（▶ の連打・キーの押しっぱなし）は 0.5 秒に 1 回だけ
    if (type === 'nextQ') {
      const d = payload.delta === -1 ? -1 : 1;
      const now = Date.now();
      if (lastNextQ.current.delta === d && now - lastNextQ.current.t < 500) return { ok: true, skipped: true };
      lastNextQ.current = { delta: d, t: now };
    }
    const res = await store.op(roomId, type, { by: myName, ...payload });
    if (!res.ok) {
      console.error('Op failed:', type, res.error);
      const msg = OP_ERRORS[res.error];
      if (msg !== null) toast(msg || '送れませんでした。通信状態を確かめて、もう一度押してください', msg ? 'neutral' : 'ng');
    }
    return res;
  };

  // 部屋を退出してタイトルへ（データは残し、ローカル状態のみリセット）
  const leaveRoom = () => {
    setRoomInUrl('');
    setRoomId('');
    setMyPlayerId(null);
    setMyName('');
    setState(EMPTY);
    setView('home');
  };

  const ctx = useMemo(() => ({ store, roomId, soundOn, setSoundOn, online }), [store, roomId, soundOn, online]);
  const isHost = view === 'host';
  const showResult = inRoom && state.phase === 'result' && !resultClosed;

  return (
    <RoomContext.Provider value={ctx}>
      <div className="text-ink bg-page min-h-screen">
        {!connected && (
          <div className="bg-ng text-white text-center text-xs sm:text-sm py-2 px-3 font-bold sticky top-0 z-40">
            接続中… つながらない場合は再読み込みしてください
          </div>
        )}
        {view === 'home' && (
          <HomeView
            lastRoom={lastRoom}
            onResume={async (r) => {
              setEntryError('');
              if (!(await store.roomAlive(r))) {
                save('qp_last_room', '');
                toast(`部屋 ${r} はもう終わっています（部屋は 24 時間で消えます）`);
                setView('home');
                return;
              }
              setRoomInUrl(r);
              resumeRoom(r);
            }}
            onGoHostCreate={() => {
              setEntryError('');
              setView('hostcreate');
            }}
            onGoJoin={() => {
              setEntryError('');
              setView('join');
            }}
          />
        )}
        {view === 'hostcreate' && (
          <HostCreateView defaultName={myName} error={entryError} onCreate={handleCreateRoom} onBack={() => setView('home')} />
        )}
        {view === 'join' && (
          <JoinView
            roomId={roomId}
            defaultName={myName}
            error={entryError}
            onJoin={handleJoin}
            onBack={() => {
              setRoomId('');
              setRoomInUrl('');
              setView('home');
            }}
          />
        )}
        {view === 'host' && <HostView state={state} roomId={roomId} myPlayerId={myPlayerId} onOp={executeOp} onLeave={leaveRoom} />}
        {view === 'participant' && (
          <ParticipantView state={state} roomId={roomId} myPlayerId={myPlayerId} onOp={executeOp} onLeave={leaveRoom} />
        )}
        {view === 'board' && <BoardView state={state} roomId={roomId} />}
        {showResult && view === 'board' && <BoardResult state={state} />}
        {showResult && view !== 'board' && (
          <ResultOverlay
            state={state}
            isHost={isHost}
            myPlayerId={myPlayerId}
            onClose={() => (isHost ? executeOp('setPhase', { phase: null }) : setResultClosed(true))}
          />
        )}
      </div>
    </RoomContext.Provider>
  );
};
