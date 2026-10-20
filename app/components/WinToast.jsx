// 勝ち抜け通知：新しく勝ち抜けた人が出たら上からバナーを出し、ファンファーレを鳴らす

import { useContext, useEffect, useRef, useState } from 'react';
import { RoomContext } from '../context.js';
import { winRanks } from '../lib/rules.js';
import { playSound } from '../lib/sound.js';
import { Trophy } from '../ui/icons.jsx';

export const WinToast = ({ state }) => {
  const { soundOn } = useContext(RoomContext);
  const prev = useRef(null);
  const [toasts, setToasts] = useState([]);
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
    items.forEach((it) => setTimeout(() => setToasts((t) => t.filter((x) => x.id !== it.id)), 3500));
  }, [state.players, soundOn]);
  if (!toasts.length) return null;
  return (
    <div className="fixed top-3 left-0 right-0 z-50 flex flex-col items-center gap-2 pointer-events-none px-4" data-win-toast>
      {toasts.map((t) => (
        <div
          key={t.id}
          className="animate-slide-down bg-gradient-to-r from-emerald-500 to-teal-500 text-white px-5 py-3 rounded-2xl shadow-xl font-black text-lg flex items-center gap-2"
        >
          <Trophy size={22} /> {t.text}
          {t.rank && <span className="bg-white/25 rounded-full px-2 py-0.5 text-sm">{t.rank}位</span>}
        </div>
      ))}
    </div>
  );
};
