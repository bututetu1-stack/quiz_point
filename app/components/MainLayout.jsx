// 部屋画面の共通レイアウト：1 行のヘッダー（部屋コード＝招待・ルールと Q・表示切替・効果音・退出）

import { useContext, useState } from 'react';
import { RoomContext } from '../context.js';
import { ruleLabel } from '../lib/rules.js';
import { LogOut, QrCode, Volume2, VolumeX } from '../ui/icons.jsx';
import { Chip, IconButton } from '../ui/primitives.jsx';
import { InviteDialog } from './InviteDialog.jsx';
import { RoomStatus } from './RoomStatus.jsx';
import { ThemeButton } from './ThemeButton.jsx';

export const MainLayout = ({ roomId, state, isHost, onOp, onLeave, children }) => {
  const { soundOn, setSoundOn } = useContext(RoomContext);
  const [invite, setInvite] = useState(false);
  return (
    <div className="min-h-screen bg-page flex flex-col">
      <header className="sticky top-0 z-20 bg-card/90 backdrop-blur border-b border-line">
        <div className="max-w-5xl mx-auto px-2 sm:px-4 h-14 flex items-center gap-1.5 sm:gap-3">
          <button
            onClick={() => setInvite(true)}
            className="shrink-0 flex items-center gap-1.5 bg-brand-soft text-brand-ink pl-2.5 pr-3 py-1.5 rounded-full font-black tabular-nums tracking-wide hover:brightness-95 transition"
            title="招待（QR コード・リンク）"
            aria-label={`部屋 ${roomId}（押すと招待の QR コードとリンク）`}
          >
            <QrCode size={16} /> {roomId}
          </button>
          {state && <RoomStatus state={state} onNextQ={isHost && onOp ? () => onOp('nextQ', { delta: 1 }) : null} />}
          <div className="flex items-center shrink-0 ml-auto">
            {isHost && <Chip tone="ng" className="hidden sm:inline-flex mr-1">HOST</Chip>}
            <ThemeButton />
            <IconButton label={soundOn ? '効果音 ON' : '効果音 OFF'} aria-pressed={soundOn} onClick={() => setSoundOn(!soundOn)}>
              {soundOn ? <Volume2 size={20} /> : <VolumeX size={20} />}
            </IconButton>
            <IconButton
              label="退出"
              className="hover:text-ng-ink"
              onClick={() => {
                if (window.confirm('退出してタイトルに戻りますか？')) onLeave();
              }}
            >
              <LogOut size={20} />
            </IconButton>
          </div>
        </div>
      </header>
      <main className="flex-1 max-w-5xl w-full mx-auto px-3 sm:px-4 py-3 sm:py-4 flex flex-col gap-3">
        {state && (
          <div className="min-[360px]:hidden -mb-1 text-xs font-black text-brand-ink truncate" data-rule-narrow>
            ルール：{ruleLabel(state.rule)}
          </div>
        )}
        {children}
      </main>
      {invite && <InviteDialog roomId={roomId} isHost={isHost} onClose={() => setInvite(false)} />}
    </div>
  );
};
