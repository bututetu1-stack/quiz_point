// 画面：参加者

import { useState } from 'react';
import { LogPanel } from '../components/LogPanel.jsx';
import { MainLayout } from '../components/MainLayout.jsx';
import { PlayerList } from '../components/PlayerList.jsx';
import { RecordPanel } from '../components/RecordPanel.jsx';
import { RoomStatus } from '../components/RoomStatus.jsx';
import { GraphPanel } from '../components/ScoreGraph.jsx';
import { SelfScoreBar } from '../components/SelfScoreBar.jsx';
import { TeamBoard } from '../components/Teams.jsx';
import { WinToast } from '../components/WinToast.jsx';
import { TabBar } from '../ui/primitives.jsx';

export const ParticipantView = ({ state, roomId, myPlayerId, onOp, onLeave }) => {
  const [tab, setTab] = useState('ranking');
  const myPlayer = (state.allPlayers || state.players || []).find((p) => p.id === myPlayerId);
  return (
    <div style={{ paddingBottom: myPlayer ? 'var(--selfbar-h, 180px)' : 0 }}>
      <WinToast state={state} />
      <MainLayout roomId={roomId} onLeave={onLeave}>
        <div className="flex justify-center">
          <div className="bg-white p-1.5 rounded-2xl shadow-sm">
            <TabBar tab={tab} setTab={setTab} />
          </div>
        </div>
        <RoomStatus state={state} />
        {tab === 'ranking' && (
          <>
            <TeamBoard state={state} />
            <PlayerList state={state} myPlayerId={myPlayerId} />
          </>
        )}
        {tab === 'graph' && <GraphPanel state={state} />}
        {tab === 'log' && <LogPanel />}
        {tab === 'record' && <RecordPanel state={state} myPlayerId={myPlayerId} />}
      </MainLayout>
      <SelfScoreBar state={state} myPlayer={myPlayer} onOp={onOp} />
    </div>
  );
};
