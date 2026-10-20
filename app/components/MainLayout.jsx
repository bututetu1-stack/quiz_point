// 部屋画面の共通レイアウト（ヘッダー：部屋コード・招待・効果音・退出）

import { useContext, useState } from 'react';
import { RoomContext } from '../context.js';
import { Hash, LogOut, QrCode, Volume2, VolumeX } from '../ui/icons.jsx';
import { Badge } from '../ui/primitives.jsx';
import { InviteDialog } from './InviteDialog.jsx';

export const MainLayout = ({ roomId, isHost, onLeave, children }) => {
  const { soundOn, setSoundOn } = useContext(RoomContext);
  const [invite, setInvite] = useState(false);
  return (
    <div className="min-h-screen bg-slate-100 flex flex-col font-sans">
      <header className="bg-white px-4 py-3 flex items-center justify-between gap-2 sticky top-0 z-20 shadow-sm">
        <div className="flex items-center gap-2 min-w-0">
          <button
            onClick={() => setInvite(true)}
            className="bg-amber-100 text-amber-700 px-4 py-1.5 rounded-full font-black text-lg flex items-center gap-2 shrink-0 hover:bg-amber-200 transition-colors"
            title="招待（QR コード・リンク）"
          >
            <Hash size={18} /> {roomId}
          </button>
          <button
            onClick={() => setInvite(true)}
            className="text-slate-500 hover:text-amber-500 transition-colors p-2 bg-slate-50 rounded-full"
            title="招待（QR コード・リンク）"
          >
            <QrCode size={18} />
          </button>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {isHost && <Badge color="bg-rose-100 text-rose-600 border border-rose-200">HOST</Badge>}
          <button
            onClick={() => setSoundOn(!soundOn)}
            className="p-2 text-slate-400 hover:bg-slate-100 rounded-full transition-colors"
            title={soundOn ? '効果音 ON' : '効果音 OFF'}
            aria-pressed={soundOn}
          >
            {soundOn ? <Volume2 size={20} /> : <VolumeX size={20} />}
          </button>
          <button
            onClick={() => {
              if (window.confirm('退出してタイトルに戻りますか？')) onLeave();
            }}
            className="p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-500 rounded-full transition-colors"
            title="退出"
          >
            <LogOut size={20} />
          </button>
        </div>
      </header>
      <main className="flex-1 max-w-5xl w-full mx-auto p-4 md:p-6 flex flex-col gap-6">{children}</main>
      {invite && <InviteDialog roomId={roomId} isHost={isHost} onClose={() => setInvite(false)} />}
    </div>
  );
};
