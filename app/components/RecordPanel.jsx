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
      <h3 className="font-black text-slate-700 flex items-center gap-2">
        <Award size={18} /> この部屋での成績
      </h3>
      <p className="text-xs text-slate-400 mt-1 mb-3">リセットやルール変更をしても消えません。</p>
      {rows.length ? (
        <table className="w-full text-sm table-fixed">
          <thead>
            <tr className="text-xs text-slate-400 whitespace-nowrap">
              <th className="text-left font-bold py-1">名前</th>
              <th className="font-bold py-1 w-10">〇</th>
              <th className="font-bold py-1 w-10">✕</th>
              <th className="font-bold py-1 w-16">勝ち抜け</th>
              <th className="font-bold py-1 w-12">脱落</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ p, rec }) => (
              <tr key={p.id} className={`border-t border-slate-100 ${p.id === myPlayerId ? 'bg-amber-50' : ''}`}>
                <td className="py-2 pr-2 font-bold text-slate-700 truncate">
                  {p.name}
                  {p.id === myPlayerId && <span className="ml-1 text-xs text-amber-600">（あなた）</span>}
                  {p.spectator && <span className="ml-1 text-xs text-slate-400">観戦中</span>}
                </td>
                <td className="text-center font-black text-emerald-600">{rec.o}</td>
                <td className="text-center font-black text-rose-500">{rec.x}</td>
                <td className="text-center font-black text-slate-700">{rec.win}</td>
                <td className="text-center font-black text-slate-500">{rec.lose}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <div className="text-center text-slate-400 font-bold py-6">まだ参加者がいません</div>
      )}
    </Card>
  );
};
