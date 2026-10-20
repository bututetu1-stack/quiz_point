// 勝ち抜け通知：新しく勝ち抜けた人が出たら上からバナーと紙吹雪を出し、ファンファーレを鳴らす

import { useContext, useEffect, useRef, useState } from 'react';
import { RoomContext } from '../context.js';
import { winRanks } from '../lib/rules.js';
import { playSound } from '../lib/sound.js';
import { Trophy } from '../ui/icons.jsx';
import { Confetti } from './Confetti.jsx';

export const WinToast = ({ state }) => {
  const { soundOn } = useContext(RoomContext);
  const prev = useRef(null);
  const [toasts, setToasts] = useState([]);
  const [burst, setBurst] = useState(0);
  useEffect(() => {
    const winners = new Set(state.players.filter((p) => p.status === 'win').map((p) => p.id));
    // 最初に受け取った状態では通知しない（入室時に過去の勝ち抜けを並べないため）
    if (prev.current === null) {
      if (state.players.length) prev.current = winners;
      return;
    }
    const ranks = winRanks(state.players);
    const fresh = state.players.filter((p) => winners.has(p.id) && !prev.current.has(p.id));
    prev.current = winners;
    if (!fresh.length) return;
    playSound('win', soundOn);
    const items = fresh.map((p) => ({ id: `${p.id}_${Date.now()}`, text: `${p.name} 勝ち抜け！`, rank: ranks[p.id] }));
    setToasts((t) => [...t, ...items]);
    const b = Date.now();
    setBurst(b);
    setTimeout(() => setBurst((x) => (x === b ? 0 : x)), 3000);
    items.forEach((it) => setTimeout(() => setToasts((t) => t.filter((x) => x.id !== it.id)), 3500));
  }, [state.players, soundOn]);
  if (!toasts.length && !burst) return null;
  return (
    <>
      {burst > 0 && <Confetti key={burst} seed={burst % 1000} />}
      <div className="fixed top-3 left-0 right-0 z-[61] flex flex-col items-center gap-2 pointer-events-none px-4" data-win-toast role="status" aria-live="polite">
        {toasts.map((t) => (
          <div
            key={t.id}
            className="animate-slide-down bg-ok text-white px-5 py-3 rounded-2xl shadow-btn font-black text-xl flex items-center gap-2 max-w-full"
          >
            <Trophy size={22} /> {t.text}
            {t.rank && <span className="bg-black/20 rounded-full px-2 py-0.5 text-sm">{t.rank}位</span>}
          </div>
        ))}
      </div>
    </>
  );
};
