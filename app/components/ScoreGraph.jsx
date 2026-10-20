// グラフ（ライブラリ非依存・自前 SVG 折れ線）。表示する幅に合わせて描くので、スマホでも文字が小さくならない

import { useContext, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { RoomContext } from '../context.js';
import { parseScoreToNumber } from '../lib/score.js';
import { eventsToSnapshots, groupByQuestion } from '../lib/timeline.js';
import { Card } from '../ui/primitives.jsx';

export const GRAPH_COLORS = [
  '#f59e0b',
  '#ec4899',
  '#3b82f6',
  '#10b981',
  '#8b5cf6',
  '#ef4444',
  '#06b6d4',
  '#84cc16',
  '#f97316',
  '#6366f1',
  '#14b8a6',
  '#a855f7',
  '#eab308',
  '#64748b',
];

// 目盛りの間隔を 1・2・5 × 10^k から選ぶ（4 本前後になるように）
const niceStep = (span) => {
  const raw = span / 4;
  const p = 10 ** Math.floor(Math.log10(raw));
  const m = raw / p;
  return (m <= 1 ? 1 : m <= 2 ? 2 : m <= 5 ? 5 : 10) * p;
};

// 要素の幅（測れないときは fallback）
const useWidth = (ref, fallback = 720) => {
  const [w, setW] = useState(fallback);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const update = () => setW(el.clientWidth || fallback);
    update();
    if (typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return w;
};

const Plot = ({ tl, players, width }) => {
  const W = Math.max(260, Math.round(width));
  const H = Math.round(Math.min(320, Math.max(200, W * 0.55)));
  const pad = { t: 12, r: 12, b: 24, l: 36 };
  const iw = W - pad.l - pad.r;
  const ih = H - pad.t - pad.b;
  let mn = 0;
  let mx = 1;
  tl.forEach((tick) =>
    Object.values(tick.scores || {}).forEach((v) => {
      const n = parseScoreToNumber(v);
      if (n > mx) mx = n;
      if (n < mn) mn = n;
    }),
  );
  const step = niceStep(Math.max(1, mx - mn));
  mx = Math.ceil(mx / step) * step || step;
  mn = mn < 0 ? Math.floor(mn / step) * step : 0;
  if (mx === mn) mx = mn + step;
  const x = (i) => pad.l + (tl.length === 1 ? iw / 2 : (i / (tl.length - 1)) * iw);
  const y = (v) => pad.t + ih - ((v - mn) / (mx - mn)) * ih;
  const ticks = [];
  for (let v = mn; v <= mx + step / 2; v += step) ticks.push(Number(v.toFixed(6)));
  const labelStep = Math.max(1, Math.ceil(tl.length / Math.max(3, Math.floor(iw / 52))));
  const muted = { fill: 'rgb(var(--c-ink-3))' };
  return (
    <svg
      data-graph={true}
      viewBox={`0 0 ${W} ${H}`}
      width={W}
      height={H}
      className="block max-w-full"
      role="img"
      aria-label="得点の推移のグラフ"
    >
      {ticks.map((tv, i) => {
        const gy = y(tv);
        return (
          <g key={i}>
            <line x1={pad.l} y1={gy} x2={W - pad.r} y2={gy} style={{ stroke: 'rgb(var(--c-line))' }} strokeWidth="1.5" />
            <text x={pad.l - 6} y={gy + 4} fontSize="12" style={muted} textAnchor="end">
              {Number.isInteger(tv) ? tv : Number(tv.toFixed(2))}
            </text>
          </g>
        );
      })}
      {tl.map((tick, i) =>
        tick.label && (i % labelStep === 0 || i === tl.length - 1) ? (
          <text key={'x' + i} x={x(i)} y={H - 6} fontSize="12" style={muted} textAnchor="middle">
            {tick.label}
          </text>
        ) : null,
      )}
      {players.map((p, pi) => {
        const c = GRAPH_COLORS[pi % GRAPH_COLORS.length];
        const pts = tl.map((tick, i) => [x(i), y(parseScoreToNumber(tick.scores[p.id]))]);
        return (
          <g key={p.id}>
            <polyline
              points={pts.map((pt) => `${pt[0]},${pt[1]}`).join(' ')}
              fill="none"
              stroke={c}
              strokeWidth="3"
              strokeLinejoin="round"
              strokeLinecap="round"
            />
            {pts.map((pt, i) => (
              <circle
                key={i}
                cx={pt[0]}
                cy={pt[1]}
                r={i === pts.length - 1 ? 5 : 3}
                style={{ fill: 'rgb(var(--c-card))' }}
                stroke={c}
                strokeWidth="2.5"
              />
            ))}
          </g>
        );
      })}
    </svg>
  );
};

export const ScoreGraph = ({ state }) => {
  const box = useRef(null);
  const width = useWidth(box);
  const tl = state.timeline || [];
  // 最終時点にスコアがあるプレイヤーのみ描画
  const last = tl.length ? tl[tl.length - 1].scores || {} : {};
  const players = state.players.filter((p) => last[p.id] !== undefined);
  return (
    <Card className="p-4 w-full">
      <div ref={box} className="w-full">
        {tl.length < 2 ? (
          <div className="h-56 flex items-center justify-center text-ink-3 font-bold text-center">得点が動くとここにグラフが出ます</div>
        ) : (
          <>
            <div className="flex flex-wrap gap-x-4 gap-y-1 mb-2 px-1">
              {players.map((p, i) => (
                <span key={p.id} className="inline-flex items-center gap-1.5 text-xs font-bold text-ink-2 max-w-[48%]">
                  <span className="w-3 h-3 rounded-full shrink-0" style={{ background: GRAPH_COLORS[i % GRAPH_COLORS.length] }} />
                  <span className="truncate">{p.name}</span>
                </span>
              ))}
            </div>
            <Plot tl={tl} players={players} width={width} />
          </>
        )}
      </div>
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
