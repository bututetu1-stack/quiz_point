// 共通部品（カード・ボタン・バッジ・切替・タブ）

import { Award, BarChart2, Clock, List } from './icons.jsx';

export const Card = ({ children, className = '', ...props }) => (
  <div className={`bg-white rounded-3xl shadow-xl shadow-amber-100/50 border-4 border-white ${className}`} {...props}>
    {children}
  </div>
);
export const Button = ({ children, onClick, variant = 'primary', className = '', disabled, ...props }) => {
  const base =
    'font-bold rounded-2xl transition-all duration-200 active:scale-95 flex items-center justify-center gap-2 disabled:opacity-40 disabled:active:scale-100';
  const variants = {
    primary:
      'bg-gradient-to-b from-amber-400 to-orange-500 text-white shadow-lg shadow-orange-200 hover:from-amber-300 hover:to-orange-400',
    secondary: 'bg-white text-slate-700 border-2 border-slate-200 hover:bg-slate-50',
    danger: 'bg-gradient-to-b from-rose-400 to-red-500 text-white shadow-lg shadow-red-200 hover:from-rose-300 hover:to-red-400',
    ghost: 'text-slate-500 hover:bg-slate-100',
    blue: 'bg-gradient-to-b from-sky-400 to-blue-500 text-white shadow-lg shadow-blue-200 hover:from-sky-300 hover:to-blue-400',
    green: 'bg-gradient-to-b from-emerald-400 to-green-500 text-white shadow-lg shadow-green-200 hover:from-emerald-300 hover:to-green-400',
  };
  return (
    <button onClick={onClick} disabled={disabled} className={`${base} ${variants[variant]} ${className}`} {...props}>
      {children}
    </button>
  );
};
export const Badge = ({ children, color = 'bg-amber-100 text-amber-700' }) => (
  <span className={`px-3 py-1 rounded-full text-sm font-bold ${color}`}>{children}</span>
);

export const Seg = ({ value, options, onChange }) => (
  <div className="flex bg-slate-100 rounded-xl p-1">
    {options.map(([k, l, c]) => (
      <button
        key={k}
        onClick={() => onChange(k)}
        className={`flex-1 text-sm font-bold py-1.5 rounded-lg transition-colors ${value === k ? `bg-white shadow-sm ${c || 'text-amber-600'}` : 'text-slate-500'}`}
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
  <div className="flex gap-1 sm:gap-2">
    {TABS.map(([key, Icon, label]) => (
      <Button
        key={key}
        variant={tab === key ? 'primary' : 'ghost'}
        className="py-2 px-3 sm:px-5 rounded-xl"
        onClick={() => setTab(key)}
        aria-label={label}
      >
        <Icon size={20} /> <span className="hidden sm:inline">{label}</span>
      </Button>
    ))}
  </div>
);
