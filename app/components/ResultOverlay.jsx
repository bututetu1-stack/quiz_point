// 結果発表：表彰台（上位3人）と最終順位。ホストが出すと全員の画面に表示される

import { rankPlayers, scoreText, statusText } from '../lib/ranking.js';
import { winRanks } from '../lib/rules.js';
import { Crown, Trophy, X } from '../ui/icons.jsx';
import { Button, Card, IconButton } from '../ui/primitives.jsx';

const PODIUM = [
  { place: 2, h: 'h-24', color: 'from-slate-300 to-slate-400', delay: '0.3s' },
  { place: 1, h: 'h-36', color: 'from-amber-300 to-amber-500', delay: '0.7s' },
  { place: 3, h: 'h-16', color: 'from-orange-300 to-orange-400', delay: '0s' },
];

export const ResultOverlay = ({ state, isHost, onClose }) => {
  const sorted = rankPlayers(state);
  const ranks = winRanks(state.players);
  const status = (p) => statusText(p, ranks);
  return (
    <div className="fixed inset-0 z-50 bg-slate-900/70 flex items-center justify-center p-4 animate-fade-in" data-result>
      <Card className="w-full max-w-lg max-h-[92vh] overflow-y-auto p-6 relative">
        <IconButton label="閉じる" onClick={onClose} className="absolute top-3 right-3">
          <X size={20} />
        </IconButton>
        <h2 className="text-center text-3xl font-black text-brand-ink flex items-center justify-center gap-2 mb-6">
          <Trophy size={30} /> 結果発表
        </h2>
        <div className="flex items-end justify-center gap-3 mb-6">
          {PODIUM.map(({ place, h, color, delay }) => {
            const p = sorted[place - 1];
            return (
              <div key={place} className="flex flex-col items-center w-24 animate-rise" style={{ animationDelay: delay }}>
                {p ? (
                  <>
                    {place === 1 && <Crown className="w-9 h-9 text-medal-1 drop-shadow" fill="currentColor" />}
                    <div className="font-black text-ink text-center leading-tight break-all">{p.name}</div>
                    <div className="text-sm font-bold text-ink-2 mb-1 tabular-nums">{scoreText(state, p)}</div>
                  </>
                ) : (
                  <div className="text-ink-3 text-sm mb-1">—</div>
                )}
                <div className={`w-full ${h} rounded-t-2xl bg-gradient-to-b ${color} flex items-start justify-center pt-2 text-3xl font-black text-white shadow-lg`}>
                  {place}
                </div>
              </div>
            );
          })}
        </div>
        <ol className="flex flex-col gap-1.5">
          {sorted.map((p, i) => (
            <li key={p.id} className="flex items-center gap-3 bg-sunken rounded-xl px-3 py-2">
              <span className="w-7 text-center font-black text-ink-2 tabular-nums">{i + 1}</span>
              <span className="flex-1 min-w-0 truncate font-bold text-ink">{p.name}</span>
              {status(p) && <span className="text-xs font-bold text-ink-3">{status(p)}</span>}
              <span className="font-black text-ink tabular-nums">{scoreText(state, p)}</span>
            </li>
          ))}
        </ol>
        <Button variant={isHost ? 'primary' : 'secondary'} className="w-full py-3 mt-5" onClick={onClose}>
          {isHost ? '結果発表を終える' : '閉じる'}
        </Button>
      </Card>
    </div>
  );
};
