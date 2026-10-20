// 画面：ホーム / 部屋を作る / 入室

import { useState } from 'react';
import { HelpSheet } from '../components/HelpSheet.jsx';
import { ThemeButton } from '../components/ThemeButton.jsx';
import { Award, ChevronLeft, ChevronRight, Crown, HelpCircle, Monitor, QrCode, RotateCcw, UserPlus, Zap } from '../ui/icons.jsx';
import { Button, Card, IconButton, TextField } from '../ui/primitives.jsx';
import { BUILD } from '../version.js';

const savedName = () => {
  try {
    return (typeof localStorage !== 'undefined' && localStorage.getItem('playerName')) || '';
  } catch {
    return '';
  }
};

// ロゴ（傾いた琥珀のタイルに稲妻）
const Logo = ({ size = 'lg' }) => (
  <div
    className={`${size === 'lg' ? 'w-20 h-20 rounded-3xl' : 'w-14 h-14 rounded-2xl'} bg-brand mx-auto flex items-center justify-center rotate-6 shadow-btn`}
  >
    <Zap className={`text-white ${size === 'lg' ? 'w-10 h-10' : 'w-7 h-7'}`} fill="currentColor" />
  </div>
);

// 失敗したときの知らせ（画面の中に出す）
const ErrorNote = ({ text }) =>
  text ? (
    <p role="alert" className="mb-4 rounded-xl bg-ng-soft text-ng-ink text-sm font-bold px-3 py-2.5" data-entry-error>
      {text}
    </p>
  ) : null;

// 入口の画面の共通の枠（中央のカード・右上に表示切替）
const EntryFrame = ({ children, onBack }) => {
  const [help, setHelp] = useState(false);
  return (
    <div className="min-h-screen bg-page flex flex-col">
      <div className="flex items-center justify-between px-2 py-2">
        {onBack ? (
          <IconButton label="戻る" onClick={onBack}>
            <ChevronLeft size={24} />
          </IconButton>
        ) : (
          <span />
        )}
        <div className="flex items-center">
          <IconButton label="使い方" onClick={() => setHelp(true)}>
            <HelpCircle size={20} />
          </IconButton>
          <ThemeButton />
        </div>
      </div>
      <div className="flex-1 flex items-center justify-center px-4 pb-10">
        <Card className="w-full max-w-md p-6 sm:p-8">{children}</Card>
      </div>
      <HelpSheet open={help} onClose={() => setHelp(false)} />
    </div>
  );
};

export const HomeView = ({ onGoHostCreate, onGoJoin, lastRoom, onResume }) => (
  <EntryFrame>
    <div className="text-center">
      <Logo />
      <h1 className="text-3xl font-black text-ink mt-6 tracking-tight">Quiz Score Pro</h1>
      <p className="text-ink-2 font-bold mt-1 mb-7">みんなで盛り上がるリアルタイム得点表</p>
    </div>
    <div className="flex flex-col gap-3">
      {lastRoom && (
        <button
          onClick={() => onResume(lastRoom)}
          className="w-full flex items-center gap-3 rounded-2xl border-2 border-dashed border-brand/50 bg-brand-soft px-4 py-3 text-left hover:border-brand transition-colors"
          data-last-room
        >
          <RotateCcw size={20} className="text-brand-ink shrink-0" />
          <span className="flex-1 min-w-0">
            <span className="block font-black text-ink">前の部屋に戻る</span>
            <span className="block text-xs text-ink-2">
              部屋 <b className="text-brand-ink tabular-nums">{lastRoom}</b>（名前の入力なしで戻れます）
            </span>
          </span>
          <ChevronRight size={20} className="text-brand-ink shrink-0" />
        </button>
      )}
      <Button onClick={onGoJoin} className="w-full py-4 text-lg">
        <UserPlus size={22} />
        {' 参加者として入室する'}
      </Button>
      <div className="flex items-center gap-3 py-1" aria-hidden="true">
        <div className="flex-1 border-t border-line" />
        <span className="text-ink-3 text-xs font-bold">または</span>
        <div className="flex-1 border-t border-line" />
      </div>
      <Button onClick={onGoHostCreate} variant="secondary" className="w-full py-4 text-lg">
        <Crown size={22} className="text-brand" />
        {' ホストとして部屋を作る'}
      </Button>
    </div>
    {/* できること（押せる物と見分けがつくよう、枠のない文字＋アイコン） */}
    <ul className="mt-7 grid grid-cols-3 gap-2 text-center text-[0.6875rem] font-bold text-ink-2">
      {[
        [Award, '8 種類のルール'],
        [QrCode, 'QR で招待'],
        [Monitor, '大画面・結果発表'],
      ].map(([Icon, label]) => (
        <li key={label} className="flex flex-col items-center gap-1">
          <Icon size={18} className="text-brand-ink" />
          {label}
        </li>
      ))}
    </ul>
    <p className="text-ink-3 text-[0.6875rem] mt-6 text-center">{BUILD}</p>
  </EntryFrame>
);

// ホストも1参加者。部屋を作る前に表示名を入力
export const HostCreateView = ({ defaultName, error, onCreate, onBack }) => {
  const [name, setName] = useState(defaultName || savedName());
  const submit = () => {
    const n = name.trim();
    if (n) onCreate(n);
  };
  return (
    <EntryFrame onBack={onBack}>
      <div className="text-center mb-6">
        <Logo size="sm" />
        <h1 className="text-2xl font-black text-ink mt-4">部屋を作る（ホスト）</h1>
        <p className="text-ink-2 text-sm mt-1">ホストも1人のプレイヤーとして参加します</p>
      </div>
      <label className="block text-sm font-bold text-ink-2 mb-2" htmlFor="host-name">
        あなたの名前
      </label>
      <TextField
        id="host-name"
        type="text"
        maxLength={30}
        autoComplete="nickname"
        enterKeyHint="go"
        value={name}
        autoFocus={true}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') submit();
        }}
        placeholder="司会"
        className="mb-4"
      />
      <ErrorNote text={error} />
      <Button onClick={submit} disabled={!name.trim()} className="w-full py-4 text-lg">
        <Crown size={22} />
        {' 部屋を作る'}
      </Button>
    </EntryFrame>
  );
};

export const JoinView = ({ roomId, defaultName, error, onJoin, onBack }) => {
  const [code, setCode] = useState(roomId || '');
  const [name, setName] = useState(defaultName || savedName());
  const invited = !!roomId;
  const submit = () => {
    const c = code.trim(),
      n = name.trim();
    if (c && n) onJoin(c, n);
  };
  return (
    <EntryFrame onBack={onBack}>
      <h1 className="text-2xl font-black text-ink mb-1 text-center">部屋に参加する</h1>
      {invited ? (
        <div className="flex flex-col items-center mb-6" data-invited-room>
          <span className="text-sm text-ink-2">招待された部屋</span>
          <span className="mt-1 bg-brand-soft text-brand-ink rounded-2xl px-5 py-1.5 text-3xl font-black tracking-[0.25em] tabular-nums">
            {roomId}
          </span>
        </div>
      ) : (
        <p className="text-ink-2 text-sm text-center mb-6">ホストから聞いた 4 桁の部屋コードを入れてください</p>
      )}
      <div className="flex flex-col gap-4">
        {!invited && (
          <div>
            <label className="block text-sm font-bold text-ink-2 mb-2" htmlFor="join-code">
              部屋コード (4桁)
            </label>
            <TextField
              id="join-code"
              type="text"
              inputMode="numeric"
              autoComplete="off"
              maxLength="4"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/[^0-9]/g, '').slice(0, 4))}
              className="text-3xl font-black tracking-[0.4em] text-center tabular-nums"
              placeholder="0000"
            />
          </div>
        )}
        <div>
          <label className="block text-sm font-bold text-ink-2 mb-2" htmlFor="join-name">
            あなたの名前
          </label>
          <TextField
            id="join-name"
            type="text"
            maxLength={30}
            autoComplete="nickname"
            enterKeyHint="go"
            value={name}
            autoFocus={invited}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') submit();
            }}
            placeholder="ゲスト"
          />
        </div>
        <ErrorNote text={error} />
        <Button onClick={submit} disabled={!code.trim() || !name.trim()} className="w-full py-4 mt-1 text-lg">
          入室する
        </Button>
      </div>
    </EntryFrame>
  );
};
