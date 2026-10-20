// 画面：参加者

import { useEffect, useState } from 'react';
import { LogPanel } from '../components/LogPanel.jsx';
import { MainLayout } from '../components/MainLayout.jsx';
import { PlayerList } from '../components/PlayerList.jsx';
import { RecordPanel } from '../components/RecordPanel.jsx';
import { InviteCard } from '../components/InviteDialog.jsx';
import { GraphPanel } from '../components/ScoreGraph.jsx';
import { SelfScoreBar } from '../components/SelfScoreBar.jsx';
import { TeamBoard } from '../components/Teams.jsx';
import { WinToast } from '../components/WinToast.jsx';
import { UserPlus } from '../ui/icons.jsx';
import { Button, TabBar } from '../ui/primitives.jsx';

// 部屋を読み込めたのに自分がいない（ホストに削除された）とき、少し待ってから出す案内
const RemovedBar = ({ onRejoin }) => {
  const [busy, setBusy] = useState(false);
  return (
    <div className="fixed bottom-0 inset-x-0 z-30 bg-card/95 backdrop-blur border-t border-line shadow-up" data-removed>
      <div className="max-w-3xl mx-auto px-3 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] flex items-center gap-3">
        <p className="flex-1 min-w-0 text-sm text-ink-2 leading-snug">
          <b className="text-ink">あなたはこの部屋のプレイヤーから外れています。</b>ホストが削除した可能性があります。
        </p>
        <Button
          className="shrink-0 px-4 py-2.5 text-sm"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            await onRejoin();
            setBusy(false);
          }}
        >
          <UserPlus size={16} /> もう一度入る
        </Button>
      </div>
    </div>
  );
};

export const ParticipantView = ({ state, roomId, myPlayerId, onOp, onLeave, onRejoin }) => {
  const [tab, setTab] = useState('ranking');
  const myPlayer = (state.allPlayers || state.players || []).find((p) => p.id === myPlayerId);
  // 読み込み直後のすれ違いで一瞬出ないよう、1.5 秒続いたときだけ
  const missing = !!state.exists && !myPlayer;
  const [removed, setRemoved] = useState(false);
  useEffect(() => {
    if (!missing) {
      setRemoved(false);
      return undefined;
    }
    const t = setTimeout(() => setRemoved(true), 1500);
    return () => clearTimeout(t);
  }, [missing]);
  return (
    <div className={myPlayer ? 'pb-[var(--selfbar-h,180px)] short:pb-0 short:pr-80' : removed && missing ? 'pb-24' : ''}>
      <WinToast state={state} />
      <MainLayout roomId={roomId} state={state} onLeave={onLeave}>
        <div className="w-full max-w-3xl mx-auto flex flex-col gap-3">
          <div className="flex">
            <TabBar tab={tab} setTab={setTab} />
          </div>
          {tab === 'ranking' && (
            <>
              <TeamBoard state={state} />
              <PlayerList state={state} myPlayerId={myPlayerId} />
              {myPlayer && (state.allPlayers || state.players).length <= 1 && <InviteCard roomId={roomId} />}
            </>
          )}
          {tab === 'graph' && <GraphPanel state={state} myPlayerId={myPlayerId} />}
          {tab === 'log' && <LogPanel />}
          {tab === 'record' && <RecordPanel state={state} myPlayerId={myPlayerId} />}
        </div>
      </MainLayout>
      <SelfScoreBar state={state} myPlayer={myPlayer} onOp={onOp} />
      {removed && missing && onRejoin && <RemovedBar onRejoin={onRejoin} />}
    </div>
  );
};
