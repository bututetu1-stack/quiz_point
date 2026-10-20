// 画面：ホーム / 部屋を作る / 入室

import { useState } from 'react';
import { Crown, UserPlus, X, Zap } from '../ui/icons.jsx';
import { Button, Card } from '../ui/primitives.jsx';
import { BUILD } from '../version.js';

export const HomeView = ({ onGoHostCreate, onGoJoin }) => (
  <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
    <Card className="w-full max-w-md p-8 text-center">
      <div className="w-24 h-24 bg-amber-400 rounded-3xl mx-auto mb-6 flex items-center justify-center rotate-12 shadow-lg shadow-amber-200">
        <Zap className="text-white w-12 h-12" fill="currentColor" />
      </div>
      <h1 className="text-3xl font-black text-slate-800 mb-2 tracking-tight">Quiz Score Pro</h1>
      <p className="text-slate-500 font-medium mb-8">みんなで盛り上がるリアルタイム得点表</p>
      <div className="space-y-4">
        <Button onClick={onGoJoin} className="w-full py-4 text-lg">
          <UserPlus size={24} />
          {' 参加者として入室する'}
        </Button>
        <div className="relative flex py-2 items-center">
          <div className="flex-grow border-t border-slate-200" />
          <span className="flex-shrink-0 mx-4 text-slate-300 text-sm font-bold">OR</span>
          <div className="flex-grow border-t border-slate-200" />
        </div>
        <Button
          onClick={onGoHostCreate}
          variant="secondary"
          className="w-full py-4 text-lg text-amber-600 border-amber-200 hover:bg-amber-50"
        >
          <Crown size={24} />
          {' ホストとして部屋を作る'}
        </Button>
      </div>
      <p className="text-slate-300 text-[10px] mt-6">{BUILD}</p>
    </Card>
  </div>
);

// ホストも1参加者。部屋を作る前に表示名を入力
export const HostCreateView = ({ defaultName, onCreate, onBack }) => {
  const [name, setName] = useState(defaultName || (typeof localStorage !== 'undefined' ? localStorage.getItem('playerName') || '' : ''));
  const submit = () => {
    const n = name.trim();
    if (n) onCreate(n);
  };
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md p-8 relative">
        <button onClick={onBack} className="absolute top-4 left-4 p-2 text-slate-400 hover:bg-slate-100 rounded-full">
          <X size={24} />
        </button>
        <div className="text-center mt-2 mb-6">
          <div className="w-16 h-16 bg-amber-400 rounded-2xl mx-auto mb-3 flex items-center justify-center rotate-6 shadow-lg shadow-amber-200">
            <Crown className="text-white w-8 h-8" />
          </div>
          <h2 className="text-2xl font-black text-slate-800">部屋を作る（ホスト）</h2>
          <p className="text-slate-400 text-sm mt-1">ホストも1人のプレイヤーとして参加します</p>
        </div>
        <label className="block text-sm font-bold text-slate-500 mb-2">あなたの名前</label>
        <input
          type="text"
          value={name}
          autoFocus={true}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') submit();
          }}
          className="w-full bg-slate-100 border-none rounded-2xl p-4 text-lg font-bold focus:ring-4 focus:ring-amber-200 outline-none transition-all mb-4"
          placeholder="司会"
        />
        <Button onClick={submit} disabled={!name.trim()} className="w-full py-4 text-lg">
          <Crown size={22} />
          {' 部屋を作る'}
        </Button>
      </Card>
    </div>
  );
};
export const JoinView = ({ roomId, defaultName, onJoin, onBack }) => {
  const [code, setCode] = useState(roomId || '');
  const [name, setName] = useState(defaultName || (typeof localStorage !== 'undefined' ? localStorage.getItem('playerName') || '' : ''));
  const invited = !!roomId;
  const submit = () => {
    const c = code.trim(),
      n = name.trim();
    if (c && n) onJoin(c, n);
  };
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md p-8 relative">
        <button onClick={onBack} className="absolute top-4 left-4 p-2 text-slate-400 hover:bg-slate-100 rounded-full">
          <X size={24} />
        </button>
        <h2 className="text-2xl font-black text-slate-800 mt-4 mb-6 text-center">部屋に参加する</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-bold text-slate-500 mb-2">部屋コード (4桁)</label>
            <input
              type="text"
              inputMode="numeric"
              maxLength="4"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/[^0-9]/g, '').slice(0, 4))}
              disabled={invited}
              className="w-full bg-slate-100 border-none rounded-2xl p-4 text-2xl font-black tracking-widest text-center focus:ring-4 focus:ring-amber-200 outline-none transition-all disabled:opacity-70"
              placeholder="0000"
            />
          </div>
          <div>
            <label className="block text-sm font-bold text-slate-500 mb-2">あなたの名前</label>
            <input
              type="text"
              value={name}
              autoFocus={invited}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') submit();
              }}
              className="w-full bg-slate-100 border-none rounded-2xl p-4 text-lg font-bold focus:ring-4 focus:ring-amber-200 outline-none transition-all"
              placeholder="ゲスト"
            />
          </div>
          <Button onClick={submit} disabled={!code.trim() || !name.trim()} className="w-full py-4 mt-2 text-lg">
            入室する
          </Button>
        </div>
      </Card>
    </div>
  );
};
