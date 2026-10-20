// App：画面の切り替え・入室/部屋作成・データ層（store）とのやりとり

import { useEffect, useMemo, useState } from 'react';
import { ResultOverlay } from './components/ResultOverlay.jsx';
import { RoomContext } from './context.js';
import { BoardView } from './views/BoardView.jsx';
import { HomeView, HostCreateView, JoinView } from './views/EntryViews.jsx';
import { HostView } from './views/HostView.jsx';
import { ParticipantView } from './views/ParticipantView.jsx';

const EMPTY = { players: [], spectators: [], allPlayers: [], teams: [], scoreMode: 'addsub', teamMode: 'product', rule: { type: 'free' }, q: 1, phase: null };

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

export const App = ({ store }) => {
  const [view, setView] = useState('home'); // home, hostcreate, join, host, participant, board
  const [roomId, setRoomId] = useState('');
  const [myPlayerId, setMyPlayerId] = useState(null);
  const [myName, setMyName] = useState('');
  const [state, setState] = useState(EMPTY);
  const [connected, setConnected] = useState(false);
  const [soundOn, setSoundOnState] = useState(() => load('qp_sound', '1') === '1');
  const [online, setOnline] = useState({});
  const [resultClosed, setResultClosed] = useState(false);

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
    }
    return res;
  };

  // 初期ロード時に URL の ?room= で自動参加
  //  - view=board: 大画面モード（入室しない）
  //  - ホスト：保存済みトークンで復帰
  //  - 参加者：この部屋に入ったことがあれば名前入力を省いて再入室、無ければ名前入力へ
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const roomFromUrl = (params.get('room') || '').trim().toUpperCase();
    if (!roomFromUrl) return;
    setRoomId(roomFromUrl);
    if (params.get('view') === 'board') {
      setView('board');
      return;
    }
    const savedName = (load('playerName') || '').trim();
    const savedPlayerId = load(`playerId_${roomFromUrl}`);
    const savedHostToken = load(`hostToken_${roomFromUrl}`);
    (async () => {
      if (savedHostToken) {
        const res = await store.hostJoin(roomFromUrl, savedHostToken);
        if (res.ok) {
          await enterAsPlayer(roomFromUrl, savedName || 'ホスト', savedPlayerId);
          setView('host');
          return;
        }
      }
      if (savedPlayerId && savedName) {
        const res = await enterAsPlayer(roomFromUrl, savedName, savedPlayerId);
        if (res.ok) {
          setView('participant');
          return;
        }
      }
      setView('join');
    })();
  }, [store]);

  const handleCreateRoom = async (name) => {
    const hostName = (name || '').trim() || 'ホスト';
    const res = await store.createRoom();
    if (!res.ok) {
      alert('部屋を作れませんでした: ' + res.error);
      return;
    }
    save(`hostToken_${res.roomId}`, res.hostToken);
    setRoomId(res.roomId);
    setRoomInUrl(res.roomId);
    await enterAsPlayer(res.roomId, hostName, null);
    setView('host');
  };

  const handleJoin = async (rId, name) => {
    const res = await enterAsPlayer(rId, name, load(`playerId_${rId}`));
    if (!res.ok) {
      alert(
        res.error === 'room_not_found'
          ? '部屋が見つかりませんでした。\n部屋コードを確認するか、ホストに招待リンクをもらい直してください（部屋は24時間で消えます）。'
          : '入室に失敗しました: ' + res.error,
      );
      return;
    }
    setRoomId(rId);
    setRoomInUrl(rId);
    setView('participant');
  };

  // 操作の送信。ログ用に操作した人の名前も添える
  const executeOp = async (type, payload = {}) => {
    const res = await store.op(roomId, type, { by: myName, ...payload });
    if (!res.ok) console.error('Op failed:', type, res.error);
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
        {view === 'home' && <HomeView onGoHostCreate={() => setView('hostcreate')} onGoJoin={() => setView('join')} />}
        {view === 'hostcreate' && <HostCreateView defaultName={myName} onCreate={handleCreateRoom} onBack={() => setView('home')} />}
        {view === 'join' && (
          <JoinView
            roomId={roomId}
            defaultName={myName}
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
        {showResult && (
          <ResultOverlay
            state={state}
            isHost={isHost}
            onClose={() => (isHost ? executeOp('setPhase', { phase: null }) : setResultClosed(true))}
          />
        )}
      </div>
    </RoomContext.Provider>
  );
};
