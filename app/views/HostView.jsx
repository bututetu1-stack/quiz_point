// 画面：ホスト（自分も1プレイヤー。PC では右に管理パネル、スマホでは「管理」で下から開く）

import { useState } from 'react';
import { LogPanel } from '../components/LogPanel.jsx';
import { MainLayout } from '../components/MainLayout.jsx';
import { PlayerList } from '../components/PlayerList.jsx';
import { RecordPanel } from '../components/RecordPanel.jsx';
import { InviteCard } from '../components/InviteDialog.jsx';
import { GraphPanel } from '../components/ScoreGraph.jsx';
import { SelfScoreBar } from '../components/SelfScoreBar.jsx';
import { SettingsPanel } from '../components/SettingsPanel.jsx';
import { TeamBoard } from '../components/Teams.jsx';
import { WinToast } from '../components/WinToast.jsx';
import { Settings } from '../ui/icons.jsx';
import { Sheet, TabBar } from '../ui/primitives.jsx';

export const HostView = ({ state, roomId, myPlayerId, onOp, onLeave }) => {
  const [tab, setTab] = useState('ranking');
  const [showPanel, setShowPanel] = useState(false);
  const myPlayer = (state.allPlayers || state.players || []).find((p) => p.id === myPlayerId);
  return (
    <div className={myPlayer ? 'pb-[var(--selfbar-h,180px)] short:pb-0 short:pr-80' : ''}>
      <WinToast state={state} />
      <MainLayout roomId={roomId} state={state} isHost={true} onOp={onOp} onLeave={onLeave}>
        <div className="flex gap-6 items-start">
          <div className="flex-1 min-w-0 flex flex-col gap-3">
            <div className="flex gap-2 items-stretch">
              <TabBar tab={tab} setTab={setTab} />
              <button
                onClick={() => setShowPanel(true)}
                className="lg:hidden shrink-0 flex flex-col min-[360px]:flex-row items-center justify-center gap-0.5 min-[360px]:gap-1 px-3 rounded-2xl bg-ink text-card text-[0.6875rem] min-[360px]:text-xs sm:text-sm font-bold hover:bg-ink-2 transition-colors"
              >
                <Settings size={17} /> 管理
              </button>
            </div>
            {tab === 'ranking' && (
              <>
                <TeamBoard state={state} />
                <PlayerList state={state} myPlayerId={myPlayerId} hostOp={onOp} />
                {(state.allPlayers || state.players).length <= 1 && <InviteCard roomId={roomId} />}
              </>
            )}
            {tab === 'graph' && <GraphPanel state={state} />}
            {tab === 'log' && <LogPanel />}
            {tab === 'record' && <RecordPanel state={state} myPlayerId={myPlayerId} />}
          </div>
          <aside className="w-80 shrink-0 hidden lg:block sticky top-[4.5rem] max-h-[calc(100vh_-_5.5rem_-_var(--selfbar-h,0px))] overflow-y-auto">
            <SettingsPanel state={state} roomId={roomId} onOp={onOp} />
          </aside>
        </div>
        <Sheet open={showPanel} onClose={() => setShowPanel(false)} title="ホストの管理" wide>
          <SettingsPanel state={state} roomId={roomId} onOp={onOp} />
        </Sheet>
      </MainLayout>
      <SelfScoreBar state={state} myPlayer={myPlayer} onOp={onOp} withAside />
    </div>
  );
};
