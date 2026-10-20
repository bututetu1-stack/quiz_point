// 招待：部屋コード・QR コード・リンクのコピー・大画面表示へのリンク

import qrcode from 'qrcode-generator';
import { useMemo, useState } from 'react';
import { Copy, Monitor, X } from '../ui/icons.jsx';
import { Button, Card } from '../ui/primitives.jsx';

export const inviteUrl = (roomId) => `${location.origin}${location.pathname}?room=${roomId}`;
export const boardUrl = (roomId) => `${inviteUrl(roomId)}&view=board`;

// QR コードを SVG で描く（外部サービスに送らない）
export const QrSvg = ({ text, size = 200, className = '' }) => {
  const path = useMemo(() => {
    const qr = qrcode(0, 'M');
    qr.addData(text);
    qr.make();
    const n = qr.getModuleCount();
    let d = '';
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (qr.isDark(y, x)) d += `M${x + 2} ${y + 2}h1v1h-1z`;
    return { d, n };
  }, [text]);
  return (
    <svg
      viewBox={`0 0 ${path.n + 4} ${path.n + 4}`}
      width={size}
      height={size}
      shapeRendering="crispEdges"
      className={`rounded-xl ${className}`}
      data-qr
      role="img"
      aria-label="招待用の QR コード"
    >
      <rect width="100%" height="100%" fill="#fff" />
      <path d={path.d} fill="#0f172a" />
    </svg>
  );
};

export const InviteDialog = ({ roomId, isHost, onClose }) => {
  const [copied, setCopied] = useState(false);
  const url = inviteUrl(roomId);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt('このリンクをコピーしてください', url);
    }
  };
  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4 animate-fade-in" onClick={onClose}>
      <Card className="w-full max-w-sm p-6 relative text-center" onClick={(e) => e.stopPropagation()}>
        <button onClick={onClose} className="absolute top-3 right-3 p-2 text-slate-400 hover:bg-slate-100 rounded-full" title="閉じる">
          <X size={20} />
        </button>
        <div className="text-sm font-bold text-slate-400">部屋コード</div>
        <div className="text-5xl font-black tracking-widest text-amber-600 mb-3">{roomId}</div>
        <div className="flex justify-center mb-3">
          <QrSvg text={url} size={200} />
        </div>
        <p className="text-xs text-slate-400 mb-2">スマホのカメラで読み取ると入室画面が開きます</p>
        <div className="bg-slate-100 rounded-xl px-3 py-2 text-xs text-slate-600 break-all select-all mb-3">{url}</div>
        <div className="flex flex-col gap-2">
          <Button className="py-3" onClick={copy}>
            <Copy size={18} /> {copied ? 'コピーしました' : 'リンクをコピー'}
          </Button>
          {isHost && (
            <Button variant="secondary" className="py-3" onClick={() => window.open(boardUrl(roomId), '_blank')}>
              <Monitor size={18} /> 大画面で開く（プロジェクタ用）
            </Button>
          )}
        </div>
      </Card>
    </div>
  );
};
