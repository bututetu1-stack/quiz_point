// 短い知らせ（画面下に数秒）。const toast = useToast(); toast('戻せる操作がありません')

import { createContext, useCallback, useContext, useState } from 'react';

const ToastContext = createContext(null);

export const ToastProvider = ({ children }) => {
  const [items, setItems] = useState([]);
  const show = useCallback((text, tone = 'neutral') => {
    const id = Date.now() + Math.random();
    // 同じ文が続けて来たら1つにまとめる
    setItems((xs) => [...xs.filter((x) => x.text !== text), { id, text, tone }].slice(-3));
    setTimeout(() => setItems((xs) => xs.filter((x) => x.id !== id)), 2600);
  }, []);
  return (
    <ToastContext.Provider value={show}>
      {children}
      <div
        className="fixed inset-x-0 bottom-[calc(var(--selfbar-h,0px)+0.5rem)] short:bottom-3 z-[45] flex flex-col items-center gap-2 px-4 pointer-events-none"
        role="status"
        aria-live="polite"
        data-toasts
      >
        {items.map((t) => (
          <div
            key={t.id}
            className={`motion-safe:animate-sheet-up max-w-sm rounded-2xl px-4 py-2.5 text-sm font-bold shadow-btn ${
              t.tone === 'ng' ? 'bg-ng text-white' : 'bg-ink text-card'
            }`}
            data-toast
          >
            {t.text}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = () => useContext(ToastContext) || (() => {});
