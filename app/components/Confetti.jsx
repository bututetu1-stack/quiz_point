// 紙吹雪（勝ち抜け・結果発表の演出）。画面全体に重ねるだけで操作は邪魔しない。動きを減らす設定の端末では出さない

import { useMemo } from 'react';

const COLORS = ['#f59e0b', '#f43f5e', '#10b981', '#3b82f6', '#8b5cf6', '#fbbf24', '#06b6d4'];

export const Confetti = ({ count = 70, seed = 0 }) => {
  const pieces = useMemo(() => {
    // 毎回同じ並びにならないよう seed で少しずらす
    let x = (seed * 9301 + 49297) % 233280 || 1;
    const rnd = () => {
      x = (x * 9301 + 49297) % 233280;
      return x / 233280;
    };
    return Array.from({ length: count }, (_, i) => ({
      left: rnd() * 100,
      delay: rnd() * 0.6,
      dur: 1.6 + rnd() * 1.2,
      dx: (rnd() - 0.5) * 30,
      w: 6 + rnd() * 6,
      h: 8 + rnd() * 10,
      color: COLORS[i % COLORS.length],
      round: rnd() < 0.3,
    }));
  }, [count, seed]);
  return (
    <div className="fixed inset-0 z-[60] pointer-events-none overflow-hidden motion-reduce:hidden" aria-hidden="true" data-confetti>
      {pieces.map((p, i) => (
        <span
          key={i}
          className="absolute top-0 animate-confetti"
          style={{
            left: `${p.left}%`,
            width: p.w,
            height: p.round ? p.w : p.h,
            background: p.color,
            borderRadius: p.round ? '50%' : 2,
            animationDelay: `${p.delay}s`,
            animationDuration: `${p.dur}s`,
            '--dx': `${p.dx}vw`,
          }}
        />
      ))}
    </div>
  );
};
