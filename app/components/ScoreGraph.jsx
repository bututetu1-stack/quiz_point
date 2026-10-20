// グラフ（ライブラリ非依存・自前 SVG 折れ線）

import { useContext, useEffect, useMemo, useState } from 'react';
import { RoomContext } from '../context.js';
import { parseScoreToNumber } from '../lib/score.js';
import { eventsToSnapshots, groupByQuestion } from '../lib/timeline.js';
import { Card } from '../ui/primitives.jsx';

export const GRAPH_COLORS = ['#f59e0b', '#ec4899', '#3b82f6', '#10b981', '#8b5cf6', '#ef4444', '#06b6d4', '#f97316'];
export const ScoreGraph = ({ state }) => {
  if (!state.timeline || state.timeline.length < 2) {
    return <Card className="p-8 h-64 flex items-center justify-center text-ink-3 font-bold text-center">得点が動くとここにグラフが出ます</Card>;
  }
  const tl = state.timeline;
  // 最終時点にスコアがあるプレイヤーのみ描画
  const last = tl[tl.length - 1].scores || {};
  const players = state.players.filter((p) => last[p.id] !== undefined);
  const W = 720,
    H = 300,
    pad = {
      t: 16,
      r: 16,
      b: 22,
      l: 40,
    };
  const iw = W - pad.l - pad.r,
    ih = H - pad.t - pad.b;
  let mn = 0,
    mx = 1;
  tl.forEach((tick) =>
    Object.values(tick.scores || {}).forEach((v) => {
      const n = parseScoreToNumber(v);
      if (n > mx) mx = n;
      if (n < mn) mn = n;
    }),
  );
  mx = Math.ceil(mx * 1.1) || 1;
  mn = mn < 0 ? Math.floor(mn * 1.1) : 0;
  if (mx === mn) mx = mn + 1;
  const x = (i) => pad.l + (tl.length === 1 ? iw / 2 : (i / (tl.length - 1)) * iw);
  const y = (v) => pad.t + ih - ((v - mn) / (mx - mn)) * ih;
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((r) => mn + (mx - mn) * r);
  const labelStep = Math.max(1, Math.ceil(tl.length / 10));
  return (
    <Card className="p-4 w-full">
      <div className="flex flex-wrap gap-x-4 gap-y-1 mb-2 px-1">
        {players.map((p, i) => (
          <span key={p.id} className="inline-flex items-center gap-1.5 text-xs font-bold text-ink-2 max-w-[48%]">
            <span
              className="w-3 h-3 rounded-full shrink-0"
              style={{
                background: GRAPH_COLORS[i % GRAPH_COLORS.length],
              }}
            />
            <span className="truncate">{p.name}</span>
          </span>
        ))}
      </div>
      <svg
        data-graph={true}
        viewBox={`0 0 ${W} ${H}`}
        width="100%"
        className="block"
        style={{
          height: 'auto',
        }}
      >
        {ticks.map((tv, i) => {
          const gy = y(tv);
          return (
            <g key={i}>
              <line x1={pad.l} y1={gy} x2={W - pad.r} y2={gy} style={{ stroke: 'rgb(var(--c-line))' }} strokeWidth="2" />
              <text x={pad.l - 8} y={gy + 4} fontSize="12" style={{ fill: 'rgb(var(--c-ink-3))' }} textAnchor="end">
                {Number.isInteger(tv) ? tv : tv.toFixed(1)}
              </text>
            </g>
          );
        })}
        {tl.map((tick, i) =>
          tick.label && (i % labelStep === 0 || i === tl.length - 1) ? (
            <text key={'x' + i} x={x(i)} y={H - 4} fontSize="12" style={{ fill: 'rgb(var(--c-ink-3))' }} textAnchor="middle">
              {tick.label}
            </text>
          ) : null,
        )}
        {players.map((p, pi) => {
          const c = GRAPH_COLORS[pi % GRAPH_COLORS.length];
          const pts = tl.map((tick, i) => [x(i), y(parseScoreToNumber(tick.scores[p.id]))]);
          const line = pts.map((pt) => `${pt[0]},${pt[1]}`).join(' ');
          return (
            <g key={p.id}>
              <polyline points={line} fill="none" stroke={c} strokeWidth="4" strokeLinejoin="round" strokeLinecap="round" />
              {pts.map((pt, i) => (
                <circle key={i} cx={pt[0]} cy={pt[1]} r={i === pts.length - 1 ? 6 : 4} style={{ fill: 'rgb(var(--c-card))' }} stroke={c} strokeWidth="3" />
              ))}
            </g>
          );
        })}
      </svg>
    </Card>
  );
};

// グラフタブを開いている間だけ得点推移を購読し、グラフ用のスナップショットに展開する
export const GraphPanel = ({ state }) => {
  const { store, roomId } = useContext(RoomContext);
  const [events, setEvents] = useState([]);
  useEffect(() => {
    if (!store || !roomId) return undefined;
    return store.subscribeTimeline(roomId, setEvents);
  }, [store, roomId]);
  const simple = state.scoreMode === 'simple' && (!state.rule || state.rule.type === 'free');
  const timeline = useMemo(
    () => groupByQuestion(eventsToSnapshots(events, state.players, simple ? 'simple' : 'addsub')),
    [events, state.players, simple],
  );
  return <ScoreGraph state={{ ...state, timeline }} />;
};
