// 操作ログ：誰が何をしたか（新しい順に最新50件）。ログタブを開いている間だけ受信する

import { useContext, useEffect, useState } from 'react';
import { RoomContext } from '../context.js';
import { Card } from '../ui/primitives.jsx';

const COLOR = {
  correct: 'bg-emerald-100 text-emerald-700',
  win: 'bg-emerald-500 text-white',
  wrong: 'bg-rose-100 text-rose-600',
  undo: 'bg-slate-200 text-slate-600',
  host: 'bg-amber-100 text-amber-700',
  q: 'bg-slate-800 text-white',
  score: 'bg-sky-100 text-sky-700',
};
const LABEL = { correct: '〇', win: '抜', wrong: '✕', undo: '戻', host: '管', q: 'Q', score: '点' };

const hhmmss = (t) => new Date(t).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

export const LogPanel = () => {
  const { store, roomId } = useContext(RoomContext);
  const [items, setItems] = useState(null);
  useEffect(() => {
    if (!store || !roomId) return undefined;
    return store.subscribeLog(roomId, setItems);
  }, [store, roomId]);
  if (!items) return <Card className="p-8 text-center text-slate-400 font-bold">読み込み中…</Card>;
  if (!items.length) return <Card className="p-8 text-center text-slate-400 font-bold">まだ操作はありません</Card>;
  return (
    <Card className="p-3" data-log>
      <ul className="flex flex-col divide-y divide-slate-100">
        {items.map((e, i) => (
          <li key={`${e.t}_${i}`} className="flex items-center gap-3 px-2 py-2">
            <span className={`w-7 h-7 shrink-0 rounded-lg flex items-center justify-center text-xs font-black ${COLOR[e.kind] || 'bg-slate-100 text-slate-500'}`}>
              {LABEL[e.kind] || '・'}
            </span>
            <span className="flex-1 min-w-0 font-bold text-slate-700 break-words">{e.text}</span>
            <span className="text-xs text-slate-400 shrink-0 tabular-nums">{hhmmss(e.t)}</span>
          </li>
        ))}
      </ul>
    </Card>
  );
};
