// 画面：ホスト

import { useState } from 'react';
import { MainLayout } from '../components/MainLayout.jsx';
import { RoomStatus } from '../components/RoomStatus.jsx';
import { PlayerList } from '../components/PlayerList.jsx';
import { GraphPanel } from '../components/ScoreGraph.jsx';
import { SelfScoreBar } from '../components/SelfScoreBar.jsx';
import { SettingsPanel } from '../components/SettingsPanel.jsx';
import { TeamBoard } from '../components/Teams.jsx';
import { Menu } from '../ui/icons.jsx';
import { Button, TabBar } from '../ui/primitives.jsx';

export const HostView = ({ state, roomId, myPlayerId, onOp, onLeave }) => {
  const [tab, setTab] = useState('ranking');
  const [showPanel, setShowPanel] = useState(false);
  const copyUrl = () => {
    navigator.clipboard.writeText(`${location.origin}${location.pathname}?room=${roomId}`);
    alert('招待リンクをコピーしました');
  };
  const myPlayer = (state.players || []).find((p) => p.id === myPlayerId);
  return (
    <div style={{ paddingBottom: myPlayer ? 'var(--selfbar-h, 180px)' : 0 }}>
      <MainLayout roomId={roomId} isHost={true} onLeave={onLeave} onCopy={copyUrl}>
        <div className="flex items-center justify-between bg-white p-2 rounded-2xl shadow-sm">
          <TabBar tab={tab} setTab={setTab} />
          <Button variant="secondary" className="py-2 px-4 rounded-xl lg:hidden" onClick={() => setShowPanel(true)}>
            <Menu size={20} /> <span className="hidden sm:inline">管理</span>
          </Button>
        </div>
        <RoomStatus state={state} />
        <div className="flex gap-6 items-start">
          <div className="flex-1 w-full min-w-0">
            {tab === 'ranking' ? (
              <>
                <TeamBoard state={state} />
                <PlayerList
                  state={state}
                  myPlayerId={myPlayerId}
                  onRename={(id, name) =>
                    onOp('renamePlayer', {
                      playerId: id,
                      name,
                    })
                  }
                  onRemove={(id) =>
                    onOp('removePlayer', {
                      playerId: id,
                    })
                  }
                />
              </>
            ) : (
              <GraphPanel state={state} />
            )}
          </div>
          <div className="w-80 shrink-0 hidden lg:block">
            <SettingsPanel state={state} onOp={onOp} />
          </div>
        </div>
        {showPanel && (
          <div className="lg:hidden fixed inset-0 z-40 bg-black/40 flex items-end" onClick={() => setShowPanel(false)}>
            <div className="bg-slate-100 w-full max-h-[88vh] overflow-y-auto rounded-t-3xl p-4" onClick={(e) => e.stopPropagation()}>
              <SettingsPanel state={state} onOp={onOp} onClose={() => setShowPanel(false)} />
            </div>
          </div>
        )}
      </MainLayout>
      <SelfScoreBar state={state} myPlayer={myPlayer} onOp={onOp} />
    </div>
  );
};
