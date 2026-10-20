// App：画面の切り替え・入室/部屋作成・データ層（store）とのやりとり

import { useEffect, useMemo, useRef, useState } from 'react';
import { BoardResult, ResultOverlay } from './components/ResultOverlay.jsx';
import { RoomContext } from './context.js';
import { ruleLabel } from './lib/rules.js';
import { useWakeLock } from './lib/wakeLock.js';
import { WifiOff } from './ui/icons.jsx';
import { useAsk } from './ui/dialogs.jsx';
import { closeTopDialog } from './ui/primitives.jsx';
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
  // 部屋の履歴には印を付ける（「戻る」で部屋を抜ける前に確かめるため）
  window.history.pushState(roomId ? { qpRoom: roomId } : {}, '', url);
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
  const { confirm } = useAsk();
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
  // 接続の知らせ：起動直後の一瞬は出さない（1.5 秒つながらないときだけ）。一度つながった後に切れたら「切れています」
  const everConnected = useRef(false);
  const [showConn, setShowConn] = useState(false);
  useEffect(() => {
    if (connected) {
      everConnected.current = true;
      setShowConn(false);
      return undefined;
    }
    const t = setTimeout(() => setShowConn(true), 1500);
    return () => clearTimeout(t);
  }, [connected]);

  // 部屋の画面にいる間だけ部屋データと接続状況を購読
  const inRoom = view === 'host' || view === 'participant' || view === 'board';
  useWakeLock(inRoom);
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
        ? `${view === 'board' ? '大画面 ' : ''}#${roomId}${state.exists ? ` ${ruleLabel(state.rule)}` : ''} | Quiz Score Pro` // 読み込み前は仮のルール名を出さない
        : 'Quiz Score Pro — クイズの得点表';
  }, [inRoom, roomId, view, state.rule, state.exists]);

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
    const savedId = load(`playerId_${rId}`);
    // 初めて入る部屋に同じ名前の人がいたら確かめる（ランキングで見分けにくくなるので）
    if (!savedId) {
      const names = await store.playerNames(rId);
      if (
        names.includes(name.trim()) &&
        !(await confirm(`この部屋には「${name.trim()}」がもういます。同じ名前で入りますか？`, {
          ok: 'このまま入る',
          note: '同じ名前だとランキングで見分けにくくなります。「やめる」で名前を変えられます。',
        }))
      )
        return;
    }
    const res = await enterAsPlayer(rId, name, savedId);
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

  // 部屋の中でブラウザの「戻る」（Android のジェスチャー含む）を押したら、いきなり抜けずに確かめる
  const leaveRef = useRef(leaveRoom);
  leaveRef.current = leaveRoom;
  useEffect(() => {
    if (!inRoom || !roomId || view === 'board') return undefined;
    // URL から直接戻ってきたときなど、部屋の履歴が無ければ 1 つ積んでおく（「戻る」でいきなりサイトを離れないように）
    if ((window.history.state || {}).qpRoom !== roomId) setRoomInUrl(roomId);
    const onPop = async () => {
      setRoomInUrl(roomId); // URL を部屋に戻しておく（やめたときはそのまま）
      // シート（メニューなど）が開いていれば、それを閉じるだけ（スマホの「戻る」ジェスチャーで閉じたい）
      if (closeTopDialog()) return;
      if (
        await confirm('退出してタイトルに戻りますか？', {
          ok: '退出する',
          note: '部屋と得点はそのまま残ります。招待リンクを開けば戻れます。',
        })
      )
        leaveRef.current();
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, [inRoom, roomId, view, confirm]);

  // ホームから入力画面（参加・部屋を作る）へは履歴を 1 つ積む。スマホの「戻る」でサイトを閉じずにホームへ戻れるように
  const goEntry = (v) => {
    setEntryError('');
    window.history.pushState({ qpEntry: v }, '', window.location.href);
    setView(v);
  };
  const backToHome = () => {
    if ((window.history.state || {}).qpEntry) {
      window.history.back(); // 下の popstate でホームへ
      return;
    }
    setRoomId('');
    setRoomInUrl('');
    setView('home');
  };
  useEffect(() => {
    if (view !== 'join' && view !== 'hostcreate') return undefined;
    const onPop = () => {
      setEntryError('');
      setRoomId('');
      setView('home');
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, [view]);

  const ctx = useMemo(() => ({ store, roomId, soundOn, setSoundOn, online }), [store, roomId, soundOn, online]);
  const isHost = view === 'host';
  const showResult = inRoom && state.phase === 'result' && !resultClosed;

  return (
    <RoomContext.Provider value={ctx}>
      <div className="text-ink bg-page min-h-screen">
        {!connected && showConn && (
          <div
            role="status"
            data-conn
            className={`fixed top-[3.75rem] short:top-12 left-1/2 -translate-x-1/2 z-40 w-max max-w-[calc(100%-1.5rem)] flex items-center gap-2 rounded-full px-4 py-2 text-xs sm:text-sm font-bold shadow-lg animate-fade-in ${
              everConnected.current ? 'bg-ng text-white' : 'bg-card text-ink border border-line'
            }`}
          >
            <WifiOff size={16} className="shrink-0" />
            {everConnected.current ? '通信が切れています。つながると自動で送ります' : '接続中… つながらないときは再読み込みしてください'}
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
            onGoHostCreate={() => goEntry('hostcreate')}
            onGoJoin={() => goEntry('join')}
          />
        )}
        {view === 'hostcreate' && (
          <HostCreateView defaultName={myName} error={entryError} onCreate={handleCreateRoom} onBack={backToHome} />
        )}
        {view === 'join' && <JoinView roomId={roomId} defaultName={myName} error={entryError} onJoin={handleJoin} onBack={backToHome} />}
        {view === 'host' && <HostView state={state} roomId={roomId} myPlayerId={myPlayerId} onOp={executeOp} onLeave={leaveRoom} />}
        {view === 'participant' && (
          <ParticipantView
            state={state}
            roomId={roomId}
            myPlayerId={myPlayerId}
            onOp={executeOp}
            onLeave={leaveRoom}
            onRejoin={() => enterAsPlayer(roomId, myName || load('playerName') || 'ゲスト', myPlayerId)}
          />
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
