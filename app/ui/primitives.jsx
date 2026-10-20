// 共通部品（カード・ボタン・チップ・切替・タブ・下から出るシート・見出し付きセクション）
// 色は tailwind.config.cjs の意味の名前（card・ink・brand・ok・ng など）だけを使う

import { forwardRef, useEffect, useRef } from 'react';
import { Award, BarChart2, Clock, List, X } from './icons.jsx';

// ダイアログの共通の振る舞い：Esc で閉じる・開いたら中の最初の操作に焦点・Tab は中で回す・閉じたら元の場所に焦点を戻す
export const useDialog = (open, onClose, ref) => {
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    if (!open) return undefined;
    const prev = document.activeElement;
    const focusables = () => [...(ref.current ? ref.current.querySelectorAll('button, input, select, textarea, a[href]') : [])].filter((e) => !e.disabled);
    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        close.current && close.current();
      } else if (e.key === 'Tab') {
        const f = focusables();
        if (!f.length) return;
        const first = f[0];
        const last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', onKey);
    const t = setTimeout(() => {
      if (ref.current) ref.current.focus({ preventScroll: true });
    }, 0);
    return () => {
      document.removeEventListener('keydown', onKey);
      clearTimeout(t);
      if (prev && prev.focus && document.contains(prev)) prev.focus({ preventScroll: true });
    };
  }, [open]);
};

export const Card = forwardRef(({ children, className = '', ...props }, ref) => (
  <div ref={ref} className={`bg-card rounded-2xl border border-line shadow-soft ${className}`} {...props}>
    {children}
  </div>
));

const BUTTON = {
  primary: 'bg-brand text-on-brand shadow-btn hover:bg-brand-strong',
  secondary: 'bg-card text-ink border border-line hover:bg-sunken',
  ghost: 'text-ink-2 hover:bg-sunken',
  soft: 'bg-sunken text-ink-2 hover:text-ink',
  ok: 'bg-ok text-white shadow-btn hover:brightness-105',
  ng: 'bg-ng text-white shadow-btn hover:brightness-105',
  info: 'bg-info text-white shadow-btn hover:brightness-105',
};
// 旧名（green / danger / blue）も受け付ける
const ALIAS = { green: 'ok', danger: 'ng', blue: 'info' };

export const Button = ({ children, onClick, variant = 'primary', className = '', disabled, ...props }) => (
  <button
    onClick={onClick}
    disabled={disabled}
    className={`font-bold rounded-xl transition duration-150 active:scale-[.97] inline-flex items-center justify-center gap-2 select-none disabled:opacity-40 disabled:active:scale-100 disabled:shadow-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60 ${BUTTON[ALIAS[variant] || variant] || BUTTON.primary} ${className}`}
    {...props}
  >
    {children}
  </button>
);

// アイコンだけのボタン（label は読み上げとツールチップ）
export const IconButton = ({ label, children, className = '', ...props }) => (
  <button
    aria-label={label}
    title={label}
    className={`p-2 rounded-full text-ink-2 hover:bg-sunken hover:text-ink transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60 ${className}`}
    {...props}
  >
    {children}
  </button>
);

const CHIP = {
  neutral: 'bg-sunken text-ink-2',
  brand: 'bg-brand-soft text-brand-ink',
  brandSolid: 'bg-brand text-on-brand',
  ok: 'bg-ok-soft text-ok-ink',
  okSolid: 'bg-ok-ink text-card',
  ng: 'bg-ng-soft text-ng-ink',
  info: 'bg-info-soft text-info-ink',
  muted: 'bg-ink-3 text-card',
};
export const Chip = ({ children, tone = 'neutral', className = '' }) => (
  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold leading-4 whitespace-nowrap ${CHIP[tone]} ${className}`}>{children}</span>
);

// 切替（[key, label, activeTextClass?] の配列）
export const Seg = ({ value, options, onChange, className = '', small = false }) => (
  <div className={`flex bg-sunken rounded-xl p-1 ${className}`}>
    {options.map(([k, l, c]) => (
      <button
        key={k}
        onClick={() => onChange(k)}
        aria-pressed={value === k}
        className={`flex-1 min-w-0 font-bold rounded-lg transition-colors whitespace-nowrap ${small ? 'text-xs py-1 px-1' : 'text-sm py-1.5 px-2'} ${value === k ? `bg-card shadow-sm ${c || 'text-brand-ink'}` : 'text-ink-3 hover:text-ink-2'}`}
      >
        {l}
      </button>
    ))}
  </div>
);

const TABS = [
  ['ranking', List, 'ランキング'],
  ['graph', BarChart2, 'グラフ'],
  ['log', Clock, 'ログ'],
  ['record', Award, '記録'],
];
export const TabBar = ({ tab, setTab }) => (
  <div className="flex flex-1 bg-sunken rounded-2xl p-1 gap-1" role="tablist">
    {TABS.map(([key, Icon, label]) => (
      <button
        key={key}
        role="tab"
        aria-selected={tab === key}
        onClick={() => setTab(key)}
        className={`flex-1 min-w-0 flex flex-col min-[360px]:flex-row items-center justify-center gap-0.5 min-[360px]:gap-1 sm:gap-1.5 py-1.5 rounded-xl text-[11px] min-[360px]:text-xs sm:text-sm font-bold transition-colors ${
          tab === key ? 'bg-card text-brand-ink shadow-sm' : 'text-ink-3 hover:text-ink-2'
        }`}
      >
        <Icon size={17} className="shrink-0" />
        <span className="truncate">{label}</span>
      </button>
    ))}
  </div>
);

// 下から出るシート（PC では中央のダイアログ）。外側を押すと閉じる
export const Sheet = ({ open, onClose, title, children, wide = false }) => {
  const ref = useRef(null);
  useDialog(open, onClose, ref);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center sm:p-4 animate-fade-in" onClick={onClose} data-sheet>
      <div
        ref={ref}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
        className={`outline-none w-full ${wide ? 'sm:max-w-lg' : 'sm:max-w-sm'} bg-card rounded-t-3xl sm:rounded-3xl shadow-soft border border-line max-h-[88vh] overflow-y-auto animate-sheet-up p-4 pb-[max(1rem,env(safe-area-inset-bottom))]`}
      >
        <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-line sm:hidden" />
        {title && (
          <div className="flex items-center justify-between gap-2 mb-2 px-1">
            <h3 className="font-black text-ink truncate">{title}</h3>
            <IconButton label="閉じる" onClick={onClose} className="-mr-1">
              <X size={20} />
            </IconButton>
          </div>
        )}
        {children}
      </div>
    </div>
  );
};

// シートの中の1行の操作
export const SheetItem = ({ icon, children, onClick, tone = 'ink', hint }) => (
  <button
    onClick={onClick}
    className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl text-left font-bold hover:bg-sunken transition-colors ${tone === 'ng' ? 'text-ng-ink' : 'text-ink'}`}
  >
    {icon && <span className={`shrink-0 ${tone === 'ng' ? 'text-ng-ink' : 'text-ink-3'}`}>{icon}</span>}
    <span className="flex-1 min-w-0">
      {children}
      {hint && <span className="block text-xs font-medium text-ink-3">{hint}</span>}
    </span>
  </button>
);

// 見出し付きのまとまり（管理パネルなど）
export const Section = ({ icon, title, action, children, className = '' }) => (
  <Card className={`p-4 ${className}`}>
    <div className="flex items-center justify-between gap-2 mb-3">
      <h3 className="font-black text-ink flex items-center gap-2 text-[15px]">
        {icon && <span className="text-brand">{icon}</span>}
        {title}
      </h3>
      {action}
    </div>
    {children}
  </Card>
);

// 文字入力（大きめ）
export const TextField = ({ className = '', ...props }) => (
  <input
    className={`w-full bg-sunken border border-transparent rounded-2xl px-4 py-3.5 text-lg font-bold text-ink placeholder:text-ink-3 outline-none focus:border-brand focus:ring-4 focus:ring-brand/20 transition ${className}`}
    {...props}
  />
);
