// App：画面の切り替え・入室/部屋作成・データ層（store）とのやりとり

import { useEffect, useMemo, useState } from 'react';
import { RoomContext } from './context.js';
import { HomeView, HostCreateView, JoinView } from './views/EntryViews.jsx';
import { HostView } from './views/HostView.jsx';
import { ParticipantView } from './views/ParticipantView.jsx';

const EMPTY = { players: [], teams: [], scoreMode: 'addsub', teamMode: 'product' };

const setRoomInUrl = (roomId) => {
  const url = new URL(window.location);
  if (roomId) url.searchParams.set('room', roomId);
  else url.searchParams.delete('room');
  window.history.pushState({}, '', url);
};

export const App = ({ store }) => {
  const [view, setView] = useState('home'); // home, hostcreate, join, host, participant
  const [roomId, setRoomId] = useState('');
  const [myPlayerId, setMyPlayerId] = useState(null);
  const [myName, setMyName] = useState('');
  const [state, setState] = useState(EMPTY);
  const [connected, setConnected] = useState(false);

  useEffect(() => store.onConnected(setConnected), [store]);

  // 部屋の画面にいる間だけ部屋データを購読
  const inRoom = view === 'host' || view === 'participant';
  useEffect(() => {
    if (!inRoom || !roomId) return undefined;
    return store.subscribeRoom(roomId, setState);
  }, [store, inRoom, roomId]);

  // 自分を players に登録（ホストも1プレイヤー）
  const enterAsPlayer = async (rId, name, savedPlayerId) => {
    const res = await store.joinRoom(rId, name, savedPlayerId);
    if (res.ok) {
      setMyPlayerId(res.playerId);
      setMyName(name);
      localStorage.setItem(`playerId_${rId}`, res.playerId);
      localStorage.setItem('playerName', name);
    }
    return res;
  };

  // 初期ロード時に URL の ?room= で自動参加（ホストはトークンで復帰、参加者は名前入力へ）
  useEffect(() => {
    const roomFromUrl = (new URLSearchParams(window.location.search).get('room') || '').trim().toUpperCase();
    if (!roomFromUrl) return;
    setRoomId(roomFromUrl);
    const savedHostToken = localStorage.getItem(`hostToken_${roomFromUrl}`);
    if (!savedHostToken) {
      setView('join');
      return;
    }
    (async () => {
      const res = await store.hostJoin(roomFromUrl, savedHostToken);
      if (!res.ok) {
        setView('join');
        return;
      }
      const name = (localStorage.getItem('playerName') || '').trim() || 'ホスト';
      await enterAsPlayer(roomFromUrl, name, localStorage.getItem(`playerId_${roomFromUrl}`));
      setView('host');
    })();
  }, [store]);

  const handleCreateRoom = async (name) => {
    const hostName = (name || '').trim() || 'ホスト';
    const res = await store.createRoom();
    if (!res.ok) {
      alert('部屋を作れませんでした: ' + res.error);
      return;
    }
    localStorage.setItem(`hostToken_${res.roomId}`, res.hostToken);
    setRoomId(res.roomId);
    setRoomInUrl(res.roomId);
    await enterAsPlayer(res.roomId, hostName, null);
    setView('host');
  };

  const handleJoin = async (rId, name) => {
    const res = await enterAsPlayer(rId, name, localStorage.getItem(`playerId_${rId}`));
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

  const executeOp = async (type, payload = {}) => {
    const res = await store.op(roomId, type, payload);
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

  const ctx = useMemo(() => ({ store, roomId }), [store, roomId]);

  return (
    <RoomContext.Provider value={ctx}>
      <div className="text-slate-800 bg-slate-50 min-h-screen">
        {!connected && (
          <div className="bg-rose-500 text-white text-center text-xs sm:text-sm py-2 px-3 font-bold">
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
      </div>
    </RoomContext.Provider>
  );
};
