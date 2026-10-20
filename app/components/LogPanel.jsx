// 操作ログ：誰が何をしたか（新しい順に最新50件）。ログタブを開いている間だけ受信する

import { useContext, useEffect, useState } from 'react';
import { RoomContext } from '../context.js';
import { Card, Unavailable } from '../ui/primitives.jsx';

const COLOR = {
  correct: 'bg-ok-soft text-ok-ink',
  win: 'bg-ok text-white',
  wrong: 'bg-ng-soft text-ng-ink',
  undo: 'bg-sunken text-ink-2',
  host: 'bg-brand-soft text-brand-ink',
  q: 'bg-ink text-card',
  score: 'bg-info-soft text-info-ink',
};
const LABEL = { correct: '〇', win: '抜', wrong: '✕', undo: '戻', host: '管', q: 'Q', score: '点' };

const hhmmss = (t) => new Date(t).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

export const LogPanel = () => {
  const { store, roomId } = useContext(RoomContext);
  const [items, setItems] = useState(null);
  const [denied, setDenied] = useState(false);
  useEffect(() => {
    if (!store || !roomId) return undefined;
    return store.subscribeLog(roomId, (xs, d) => {
      setItems(xs);
      setDenied(!!d);
    });
  }, [store, roomId]);
  if (denied) return <Unavailable what="操作ログ" />;
  if (!items) return <Card className="p-8 text-center text-ink-3 font-bold">読み込み中…</Card>;
  if (!items.length) return <Card className="p-8 text-center text-ink-3 font-bold">まだ操作はありません</Card>;
  return (
    <Card className="p-3" data-log>
      <ul className="flex flex-col divide-y divide-line">
        {items.map((e, i) => (
          <li key={`${e.t}_${i}`} className="flex items-center gap-3 px-2 py-2">
            <span
              className={`w-7 h-7 shrink-0 rounded-lg flex items-center justify-center text-xs font-black ${COLOR[e.kind] || 'bg-sunken text-ink-2'}`}
            >
              {LABEL[e.kind] || '・'}
            </span>
            <span className="flex-1 min-w-0 font-bold text-ink break-words">{e.text}</span>
            <span className="text-xs text-ink-3 shrink-0 tabular-nums">{hhmmss(e.t)}</span>
          </li>
        ))}
      </ul>
    </Card>
  );
};
