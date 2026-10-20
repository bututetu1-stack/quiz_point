// 画面：ホスト（自分も1プレイヤー。PC では右に管理パネル、スマホでは「管理」ボタンで下から開く）

import { useState } from 'react';
import { LogPanel } from '../components/LogPanel.jsx';
import { MainLayout } from '../components/MainLayout.jsx';
import { PlayerList } from '../components/PlayerList.jsx';
import { RoomStatus } from '../components/RoomStatus.jsx';
import { GraphPanel } from '../components/ScoreGraph.jsx';
import { SelfScoreBar } from '../components/SelfScoreBar.jsx';
import { SettingsPanel } from '../components/SettingsPanel.jsx';
import { TeamBoard } from '../components/Teams.jsx';
import { WinToast } from '../components/WinToast.jsx';
import { Menu } from '../ui/icons.jsx';
import { Button, TabBar } from '../ui/primitives.jsx';

export const HostView = ({ state, roomId, myPlayerId, onOp, onLeave }) => {
  const [tab, setTab] = useState('ranking');
  const [showPanel, setShowPanel] = useState(false);
  const myPlayer = (state.players || []).find((p) => p.id === myPlayerId);
  return (
    <div style={{ paddingBottom: myPlayer ? 'var(--selfbar-h, 180px)' : 0 }}>
      <WinToast state={state} />
      <MainLayout roomId={roomId} isHost={true} onLeave={onLeave}>
        <div className="flex items-center justify-between bg-white p-2 rounded-2xl shadow-sm">
          <TabBar tab={tab} setTab={setTab} />
          <Button variant="secondary" className="py-2 px-4 rounded-xl lg:hidden" onClick={() => setShowPanel(true)}>
            <Menu size={20} /> 管理
          </Button>
        </div>
        <RoomStatus state={state} />
        <div className="flex gap-6 items-start">
          <div className="flex-1 w-full min-w-0">
            {tab === 'ranking' && (
              <>
                <TeamBoard state={state} />
                <PlayerList
                  state={state}
                  myPlayerId={myPlayerId}
                  onRename={(id, name) => onOp('renamePlayer', { playerId: id, name })}
                  onRemove={(id) => onOp('removePlayer', { playerId: id })}
                />
              </>
            )}
            {tab === 'graph' && <GraphPanel state={state} />}
            {tab === 'log' && <LogPanel />}
          </div>
          <div className="w-80 shrink-0 hidden lg:block">
            <SettingsPanel state={state} roomId={roomId} onOp={onOp} />
          </div>
        </div>
        {showPanel && (
          <div className="lg:hidden fixed inset-0 z-40 bg-black/40 flex items-end" onClick={() => setShowPanel(false)}>
            <div className="bg-slate-100 w-full max-h-[88vh] overflow-y-auto rounded-t-3xl p-4" onClick={(e) => e.stopPropagation()}>
              <SettingsPanel state={state} roomId={roomId} onOp={onOp} onClose={() => setShowPanel(false)} />
            </div>
          </div>
        )}
      </MainLayout>
      <SelfScoreBar state={state} myPlayer={myPlayer} onOp={onOp} />
    </div>
  );
};
