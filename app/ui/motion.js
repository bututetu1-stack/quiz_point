// 動きの共通部品：動きを減らす設定の判定・並び替えのアニメ（FLIP）・順位が上がった人の印

import { useEffect, useLayoutEffect, useRef, useState } from 'react';

export const reducedMotion = () =>
  typeof window !== 'undefined' && !!window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// 並びが変わったとき、data-flip-id を持つ子要素を元の位置から滑らかに動かす（縦・横とも。スクロールの影響を受けない offset で測る）
export const useFlip = (ref) => {
  const pos = useRef({});
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const items = [...el.children].filter((r) => r.dataset && r.dataset.flipId);
    const next = {};
    items.forEach((r) => {
      next[r.dataset.flipId] = [r.offsetLeft, r.offsetTop];
    });
    if (!reducedMotion()) {
      items.forEach((r) => {
        const prev = pos.current[r.dataset.flipId];
        if (!prev) return;
        const [x, y] = next[r.dataset.flipId];
        const dx = prev[0] - x;
        const dy = prev[1] - y;
        if (!dx && !dy) return;
        r.style.transition = 'none';
        r.style.transform = `translate(${dx}px, ${dy}px)`;
        requestAnimationFrame(() => {
          r.style.transition = 'transform 450ms cubic-bezier(.2,.8,.2,1)';
          r.style.transform = '';
        });
      });
    }
    pos.current = next;
  });
};

// 順位が上がった人：{ id: 上がった数 }（数秒で消える）。ids は上から順の id
export const useRankUps = (ids, ms = 3500) => {
  const prev = useRef(null);
  const [ups, setUps] = useState({});
  const timers = useRef([]);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);
  const key = ids.join(',');
  useEffect(() => {
    const now = {};
    ids.forEach((id, i) => {
      now[id] = i + 1;
    });
    if (prev.current) {
      const fresh = {};
      ids.forEach((id) => {
        const was = prev.current[id];
        if (was && was > now[id]) fresh[id] = was - now[id];
      });
      const stamp = Date.now() + Math.random();
      if (Object.keys(fresh).length) {
        setUps((u) => {
          const n = { ...u };
          Object.entries(fresh).forEach(([id, d]) => {
            n[id] = { d, stamp };
          });
          return n;
        });
        timers.current.push(
          setTimeout(() => setUps((u) => Object.fromEntries(Object.entries(u).filter(([, v]) => v.stamp !== stamp))), ms),
        );
      }
    }
    prev.current = now;
  }, [key]);
  return ups;
};
