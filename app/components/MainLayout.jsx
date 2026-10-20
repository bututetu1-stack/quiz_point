// 部屋画面の共通レイアウト（ヘッダー）

import { Copy, Hash, LogOut } from '../ui/icons.jsx';
import { Badge } from '../ui/primitives.jsx';

export const MainLayout = ({ roomId, isHost, onLeave, onCopy, children }) => (
  <div className="min-h-screen bg-slate-100 flex flex-col font-sans">
    <header className="bg-white px-4 py-3 flex items-center justify-between sticky top-0 z-10 shadow-sm">
      <div className="flex items-center gap-3 min-w-0">
        <div className="bg-amber-100 text-amber-700 px-4 py-1.5 rounded-full font-black text-lg flex items-center gap-2 shrink-0">
          <Hash size={18} /> {roomId}
        </div>
        {isHost && (
          <button
            onClick={onCopy}
            className="text-slate-400 hover:text-amber-500 transition-colors p-1.5 bg-slate-50 rounded-full"
            title="招待リンクをコピー"
          >
            <Copy size={18} />
          </button>
        )}
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {isHost && <Badge color="bg-rose-100 text-rose-600 border border-rose-200">HOST</Badge>}
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
  </div>
);
