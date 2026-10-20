// 画面：参加者

import { useState } from 'react';
import { LogPanel } from '../components/LogPanel.jsx';
import { MainLayout } from '../components/MainLayout.jsx';
import { PlayerList } from '../components/PlayerList.jsx';
import { RecordPanel } from '../components/RecordPanel.jsx';
import { InviteCard } from '../components/InviteDialog.jsx';
import { GraphPanel } from '../components/ScoreGraph.jsx';
import { SelfScoreBar } from '../components/SelfScoreBar.jsx';
import { TeamBoard } from '../components/Teams.jsx';
import { WinToast } from '../components/WinToast.jsx';
import { TabBar } from '../ui/primitives.jsx';

export const ParticipantView = ({ state, roomId, myPlayerId, onOp, onLeave }) => {
  const [tab, setTab] = useState('ranking');
  const myPlayer = (state.allPlayers || state.players || []).find((p) => p.id === myPlayerId);
  return (
    <div className={myPlayer ? 'pb-[var(--selfbar-h,180px)] short:pb-0 short:pr-80' : ''}>
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
              {(state.allPlayers || state.players).length <= 1 && <InviteCard roomId={roomId} />}
            </>
          )}
          {tab === 'graph' && <GraphPanel state={state} myPlayerId={myPlayerId} />}
          {tab === 'log' && <LogPanel />}
          {tab === 'record' && <RecordPanel state={state} myPlayerId={myPlayerId} />}
        </div>
      </MainLayout>
      <SelfScoreBar state={state} myPlayer={myPlayer} onOp={onOp} />
    </div>
  );
};
