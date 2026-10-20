// 記録：この部屋での成績（〇✕の累計と勝ち抜け・脱落の回数）。リセットやルール変更でも消えない

import { recOf } from '../lib/rules.js';
import { Award } from '../ui/icons.jsx';
import { Card } from '../ui/primitives.jsx';

export const RecordPanel = ({ state, myPlayerId }) => {
  const rows = (state.allPlayers || state.players)
    .map((p) => ({ p, rec: recOf(p) }))
    .sort((a, b) => b.rec.win - a.rec.win || b.rec.o - a.rec.o || a.rec.x - b.rec.x || (a.p.name || '').localeCompare(b.p.name || ''));
  return (
    <Card className="p-5" data-record>
      <h3 className="font-black text-ink flex items-center gap-2">
        <Award size={18} className="text-brand" /> この部屋での成績
      </h3>
      <p className="text-xs text-ink-3 mt-1 mb-3">リセットやルール変更をしても消えません。</p>
      {rows.length ? (
        <table className="w-full text-sm table-fixed">
          <thead>
            <tr className="text-xs text-ink-3 whitespace-nowrap">
              <th className="text-left font-bold py-1">名前</th>
              <th className="font-bold py-1 w-10">〇</th>
              <th className="font-bold py-1 w-10">✕</th>
              <th className="font-bold py-1 w-16">勝ち抜け</th>
              <th className="font-bold py-1 w-12">脱落</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ p, rec }) => (
              <tr key={p.id} className={`border-t border-line ${p.id === myPlayerId ? 'bg-brand-soft' : ''}`}>
                <td className="py-2.5 pl-1 pr-2 font-bold text-ink truncate">
                  {p.name}
                  {p.id === myPlayerId && <span className="ml-1 text-xs text-brand-ink">（あなた）</span>}
                  {p.spectator && <span className="ml-1 text-xs text-ink-3">観戦中</span>}
                </td>
                <td className="text-center font-black tabular-nums text-ok-ink">{rec.o}</td>
                <td className="text-center font-black tabular-nums text-ng-ink">{rec.x}</td>
                <td className="text-center font-black tabular-nums text-ink">{rec.win}</td>
                <td className="text-center font-black tabular-nums text-ink-2">{rec.lose}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <div className="text-center text-ink-3 font-bold py-6">まだ参加者がいません</div>
      )}
    </Card>
  );
};
