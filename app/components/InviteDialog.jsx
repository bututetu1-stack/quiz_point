// 招待：部屋コード・QR コード・リンクのコピー・大画面表示へのリンク

import qrcode from 'qrcode-generator';
import { useMemo, useRef, useState } from 'react';
import { useAsk } from '../ui/dialogs.jsx';
import { Copy, Monitor, X } from '../ui/icons.jsx';
import { Button, Card, IconButton, useDialog } from '../ui/primitives.jsx';

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

// リンクのコピー（できない環境では選択できる形で見せる）
const useCopy = (url) => {
  const [copied, setCopied] = useState(false);
  const { showCopy } = useAsk();
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      await showCopy('自動でコピーできませんでした。下のリンクを長押し（PC は Ctrl+C）でコピーしてください', url);
    }
  };
  return [copied, copy];
};

// まだ自分しかいない部屋に出す「招待しよう」の案内
export const InviteCard = ({ roomId }) => {
  const url = inviteUrl(roomId);
  const [copied, copy] = useCopy(url);
  return (
    <Card className="p-4 flex flex-col min-[480px]:flex-row items-center gap-4 border-dashed border-2 border-brand/50" data-invite-card>
      <div className="bg-white p-2 rounded-2xl border border-line shrink-0">
        <QrSvg text={url} size={140} />
      </div>
      <div className="flex-1 min-w-0 text-center min-[480px]:text-left">
        <div className="font-black text-ink text-lg">みんなを招待しよう</div>
        <p className="text-sm text-ink-2 mt-1 leading-relaxed">
          スマホのカメラで QR コードを読み取るか、ホームの「参加者として入室する」で部屋コード{' '}
          <b className="text-brand-ink tabular-nums">{roomId}</b> を入れると参加できます。
        </p>
        <Button className="mt-3 px-4 py-2.5 text-sm" onClick={copy}>
          <Copy size={16} /> {copied ? 'コピーしました' : 'リンクをコピー'}
        </Button>
      </div>
    </Card>
  );
};

export const InviteDialog = ({ roomId, isHost, onClose }) => {
  const url = inviteUrl(roomId);
  const [copied, copy] = useCopy(url);
  const ref = useRef(null);
  useDialog(true, onClose, ref);
  return (
    <div className="fixed inset-0 z-50 bg-scrim/50 flex items-center justify-center p-4 animate-fade-in" onClick={onClose}>
      <Card
        ref={ref}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label="招待"
        className="outline-none w-full max-w-sm max-h-[92vh] overflow-y-auto p-6 short:p-4 relative text-center"
        onClick={(e) => e.stopPropagation()}
      >
        <IconButton label="閉じる" onClick={onClose} className="absolute top-3 right-3">
          <X size={20} />
        </IconButton>
        <div className="text-sm font-bold text-ink-3">部屋コード</div>
        <div className="text-5xl short:text-3xl font-black tracking-[0.2em] tabular-nums text-brand-ink mb-3 short:mb-2">{roomId}</div>
        {/* スマホ横向きでは QR を小さくして、閉じるボタンまで画面に収める */}
        <div className="flex justify-center mb-3 short:mb-2 short:[&_svg]:w-32 short:[&_svg]:h-32">
          <div className="bg-white p-2 rounded-2xl border border-line">
            <QrSvg text={url} size={200} />
          </div>
        </div>
        <p className="text-xs text-ink-3 mb-2">スマホのカメラで読み取ると入室画面が開きます</p>
        <div className="bg-sunken rounded-xl px-3 py-2 text-xs text-ink-2 break-all select-all mb-3">{url}</div>
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
