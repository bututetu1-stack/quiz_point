// 画面の中の確認・入力（ブラウザの confirm / prompt の代わり）。
// const { confirm, prompt } = useAsk(); await confirm('削除しますか？', { ok: '削除する', danger: true }) → true / false
// await prompt('新しい名前', '今の名前') → 文字列（やめたら null）

import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { Button, Sheet, TextField } from './primitives.jsx';

const AskContext = createContext(null);

const AskSheet = ({ req, onDone }) => {
  const [value, setValue] = useState(req.value || '');
  const ok = () => {
    if (req.kind === 'prompt') {
      const v = value.trim();
      if (!v) return;
      onDone(v);
    } else onDone(true);
  };
  const cancel = () => onDone(req.kind === 'prompt' ? null : false);
  return (
    <Sheet open={true} onClose={cancel} title={req.title || (req.kind === 'prompt' ? '入力' : '確認')}>
      <div className="px-1 flex flex-col gap-3" data-ask={req.kind}>
        <p className="text-ink font-bold leading-relaxed whitespace-pre-line">{req.message}</p>
        {req.note && <p className="text-xs text-ink-3 -mt-2">{req.note}</p>}
        {req.kind === 'prompt' && (
          <TextField
            value={value}
            data-autofocus
            maxLength={30}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') ok();
            }}
            data-ask-input
          />
        )}
        <div className="flex gap-2 pt-1">
          <Button variant="secondary" className="flex-1 py-3" onClick={cancel} data-ask-cancel>
            やめる
          </Button>
          <Button
            variant={req.danger ? 'ng' : 'primary'}
            className="flex-[2] py-3"
            onClick={ok}
            disabled={req.kind === 'prompt' && !value.trim()}
            data-ask-ok
          >
            {req.ok || (req.kind === 'prompt' ? '決定' : 'OK')}
          </Button>
        </div>
      </div>
    </Sheet>
  );
};

export const AskProvider = ({ children }) => {
  const [req, setReq] = useState(null);
  const ask = useCallback(
    (r) =>
      new Promise((resolve) =>
        setReq((prev) => {
          if (prev) prev.resolve(prev.kind === 'prompt' ? null : false);
          return { ...r, resolve };
        }),
      ),
    [],
  );
  const api = useMemo(
    () => ({
      confirm: (message, opts = {}) => ask({ kind: 'confirm', message, ...opts }),
      prompt: (message, value = '', opts = {}) => ask({ kind: 'prompt', message, value, ...opts }),
    }),
    [ask],
  );
  return (
    <AskContext.Provider value={api}>
      {children}
      {req && (
        <AskSheet
          key={req.message}
          req={req}
          onDone={(v) => {
            req.resolve(v);
            setReq(null);
          }}
        />
      )}
    </AskContext.Provider>
  );
};

// Provider の外（単体の部品テストなど）ではブラウザの confirm / prompt にフォールバック
const fallback = {
  confirm: async (message) => window.confirm(message),
  prompt: async (message, value = '') => {
    const v = window.prompt(message, value);
    return v && v.trim() ? v.trim() : null;
  },
};
export const useAsk = () => useContext(AskContext) || fallback;
