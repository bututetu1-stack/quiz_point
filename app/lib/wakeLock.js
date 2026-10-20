// 部屋にいる間は画面を消さない（クイズの合間にスマホが暗くなる・ロックされるのを防ぐ）
// Screen Wake Lock API。対応していない端末では何もしない。タブを離れると自動で外れるので、戻ったら取り直す

import { useEffect } from 'react';

export const useWakeLock = (active) => {
  useEffect(() => {
    if (!active || typeof navigator === 'undefined' || !navigator.wakeLock) return undefined;
    let lock = null;
    let alive = true;
    let pending = false;
    const request = async () => {
      if (pending || document.visibilityState !== 'visible' || (lock && !lock.released)) return;
      pending = true;
      try {
        const l = await navigator.wakeLock.request('screen');
        if (alive) lock = l;
        else l.release().catch(() => {});
      } catch {
        // 省電力モードなどで断られても続ける
      } finally {
        pending = false;
      }
    };
    const onVisible = () => {
      if (document.visibilityState === 'visible') request();
    };
    request();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      alive = false;
      document.removeEventListener('visibilitychange', onVisible);
      if (lock && !lock.released) lock.release().catch(() => {});
    };
  }, [active]);
};
