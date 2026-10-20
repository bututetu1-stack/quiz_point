// 画面：参加者

import { useState } from 'react';
import { MainLayout } from '../components/MainLayout.jsx';
import { RoomStatus } from '../components/RoomStatus.jsx';
import { PlayerList } from '../components/PlayerList.jsx';
import { GraphPanel } from '../components/ScoreGraph.jsx';
import { SelfScoreBar } from '../components/SelfScoreBar.jsx';
import { TeamBoard } from '../components/Teams.jsx';
import { TabBar } from '../ui/primitives.jsx';

export const ParticipantView = ({ state, roomId, myPlayerId, onOp, onLeave }) => {
  const [tab, setTab] = useState('ranking');
  const myPlayer = (state.players || []).find((p) => p.id === myPlayerId);
  return (
    <div style={{ paddingBottom: myPlayer ? 'var(--selfbar-h, 180px)' : 0 }}>
      <MainLayout roomId={roomId} onLeave={onLeave}>
        <div className="flex justify-center">
          <div className="bg-white p-1.5 rounded-2xl shadow-sm">
            <TabBar tab={tab} setTab={setTab} />
          </div>
        </div>
        <RoomStatus state={state} />
        {tab === 'ranking' ? (
          <>
            <TeamBoard state={state} />
            <PlayerList state={state} myPlayerId={myPlayerId} />
          </>
        ) : (
          <GraphPanel state={state} />
        )}
      </MainLayout>
      <SelfScoreBar state={state} myPlayer={myPlayer} onOp={onOp} />
    </div>
  );
};
