// プレイヤー一覧（ランキング）：メダル色・得点変化のアニメ・順位入れ替えのアニメ・オンライン表示・観戦中の人

import { useContext, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { RoomContext } from '../context.js';
import { rankPlayers, scoreText } from '../lib/ranking.js';
import { isRuleMode, playerState, progressHint, winRanks } from '../lib/rules.js';
import { parseScoreToNumber } from '../lib/score.js';
import { Crown, Edit2, Eye, Trash2, Users } from '../ui/icons.jsx';
import { Badge, Card } from '../ui/primitives.jsx';

const MEDAL = ['bg-amber-400 text-white', 'bg-slate-400 text-white', 'bg-orange-400 text-white'];

// 値が変わったら番号が増える（初回は 0）。key に使うとアニメが毎回やり直される
const useChangeKey = (value) => {
  const prev = useRef(value);
  const [n, setN] = useState(0);
  useLayoutEffect(() => {
    if (prev.current !== value) {
      prev.current = value;
      setN((x) => x + 1);
    }
  }, [value]);
  return n;
};

// ルール時の状態バッジ（勝ち抜け n 位 / 脱落 / 休み あと k 問）
const StateBadge = ({ st, winRank }) => {
  if (st.kind === 'win') return <Badge color="bg-emerald-500 text-white shadow-sm">勝ち抜け {winRank}位</Badge>;
  if (st.kind === 'lose') return <Badge color="bg-slate-500 text-white">脱落</Badge>;
  if (st.kind === 'rest') return <Badge color="bg-sky-100 text-sky-700 border border-sky-200">休み あと{st.restLeft}問</Badge>;
  return null;
};

export const PlayerRow = ({ player, rank, state, isMe, onRename, onRemove, onSpectate, winRank, online }) => {
  const team = state.teams.find((t) => t.id === player.teamId);
  const rule = isRuleMode(state.rule);
  const st = rule ? playerState(player, state.q || 1) : { kind: 'play' };
  const text = scoreText(state, player);
  const flash = useChangeKey(text);
  const scored = st.kind === 'win' || parseScoreToNumber(player.score) > 0 || (player.maru || 0) > 0;
  const medal = rank <= 3 && scored && st.kind !== 'lose' ? MEDAL[rank - 1] : 'bg-white text-slate-700';
  const rowColor = isMe ? 'border-amber-400 bg-amber-50' : st.kind === 'win' ? 'border-emerald-300 bg-emerald-50' : 'border-transparent bg-slate-50';
  const score = (
    <span key={flash} className={`inline-block ${flash ? 'animate-pop' : ''}`}>
      {text}
    </span>
  );
  return (
    <div
      data-player-id={player.id}
      className={`relative flex flex-col md:flex-row md:items-center gap-4 p-4 rounded-3xl border-2 transition-colors ${rowColor} ${st.kind === 'lose' ? 'opacity-60' : ''}`}
    >
      <div className="flex items-center gap-3 w-full md:flex-1 min-w-0">
        <div className={`w-12 h-12 shrink-0 flex items-center justify-center rounded-2xl shadow-sm text-xl font-black relative ${medal}`}>
          {rank === 1 && scored && <Crown className="absolute -top-4 -left-2 w-8 h-8 text-amber-400 drop-shadow-md" fill="currentColor" />}
          {rank}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 min-w-0 flex-wrap">
            <span
              className={`w-2.5 h-2.5 rounded-full shrink-0 ${online ? 'bg-emerald-400' : 'bg-slate-300'}`}
              title={online ? '接続中' : '未接続'}
              data-online={online ? '1' : '0'}
            />
            <h3 className="font-bold text-lg text-slate-800 truncate">{player.name}</h3>
            {isMe && <Badge color="bg-amber-400 text-white shadow-sm">YOU</Badge>}
            {rule && <StateBadge st={st} winRank={winRank} />}
          </div>
          <div className="text-xs font-bold text-slate-400 mt-0.5 flex items-center gap-2 flex-wrap">
            {team && (
              <span className="flex items-center gap-1">
                <Users size={12} /> {team.name}
              </span>
            )}
            {rule && (
              <span className="text-slate-500">
                <span className="text-emerald-600">〇{player.maru || 0}</span> <span className="text-rose-500">✕{player.batsu || 0}</span>
              </span>
            )}
            {rule && st.kind !== 'win' && st.kind !== 'lose' && progressHint(state.rule, player) && <span>{progressHint(state.rule, player)}</span>}
          </div>
        </div>
        <div className="md:hidden text-3xl font-black text-slate-800 tracking-tighter shrink-0">{score}</div>
      </div>
      <div className="hidden md:block text-4xl font-black text-slate-800 tracking-tighter w-32 text-center shrink-0">{score}</div>
      {(onRename || onRemove || onSpectate) && (
        <div className="flex md:flex-col gap-1 justify-end shrink-0">
          {onSpectate && (
            <button
              onClick={() => {
                if (window.confirm(`${player.name} を観戦にしますか？（ランキングから外れます）`)) onSpectate(player.id, true);
              }}
              className="p-1.5 text-slate-300 hover:text-sky-500 rounded-lg"
              title="観戦にする"
            >
              <Eye size={16} />
            </button>
          )}
          {onRename && (
            <button
              onClick={() => {
                const n = prompt('新しい名前', player.name);
                if (n && n.trim()) onRename(player.id, n.trim());
              }}
              className="p-1.5 text-slate-300 hover:text-amber-500 rounded-lg"
              title="名前を変える"
            >
              <Edit2 size={16} />
            </button>
          )}
          {onRemove && (
            <button
              onClick={() => {
                if (window.confirm(`${player.name} を削除しますか？`)) onRemove(player.id);
              }}
              className="p-1.5 text-slate-300 hover:text-rose-500 rounded-lg"
              title="削除"
            >
              <Trash2 size={16} />
            </button>
          )}
        </div>
      )}
    </div>
  );
};

// 順位が入れ替わったとき、行を元の位置から滑らかに動かす（FLIP）
const useFlip = (ref) => {
  const pos = useRef({});
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const rows = [...el.children].filter((r) => r.dataset && r.dataset.playerId);
    const next = {};
    rows.forEach((r) => {
      next[r.dataset.playerId] = r.offsetTop;
    });
    rows.forEach((r) => {
      const prev = pos.current[r.dataset.playerId];
      const d = prev == null ? 0 : prev - next[r.dataset.playerId];
      if (!d) return;
      r.style.transition = 'none';
      r.style.transform = `translateY(${d}px)`;
      requestAnimationFrame(() => {
        r.style.transition = 'transform 450ms cubic-bezier(.2,.8,.2,1)';
        r.style.transform = '';
      });
    });
    pos.current = next;
  });
};

// 観戦中の人（ランキングの下に名前だけ。ホストは参加に戻す・削除ができる）
const Spectators = ({ state, myPlayerId, online, onSpectate, onRemove }) => {
  const list = state.spectators || [];
  if (!list.length) return null;
  return (
    <div className="bg-white rounded-2xl px-4 py-3 shadow-sm" data-spectators>
      <div className="text-xs font-bold text-slate-400 mb-2 flex items-center gap-1">
        <Eye size={14} /> 観戦中（{list.length}）
      </div>
      <div className="flex flex-wrap gap-2">
        {list.map((p) => (
          <span key={p.id} className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-full pl-3 pr-1.5 py-1 text-sm font-bold text-slate-600">
            <span className={`w-2 h-2 rounded-full ${online[p.id] ? 'bg-emerald-400' : 'bg-slate-300'}`} />
            {p.name}
            {p.id === myPlayerId && <span className="text-amber-600 text-xs">（あなた）</span>}
            {onSpectate && (
              <button onClick={() => onSpectate(p.id, false)} className="text-xs text-sky-600 px-1.5" title="参加に戻す">
                参加に戻す
              </button>
            )}
            {onRemove && (
              <button
                onClick={() => {
                  if (window.confirm(`${p.name} を削除しますか？`)) onRemove(p.id);
                }}
                className="p-1 text-slate-300 hover:text-rose-500"
                title="削除"
              >
                <Trash2 size={14} />
              </button>
            )}
          </span>
        ))}
      </div>
    </div>
  );
};

export const PlayerList = ({ state, myPlayerId, onRename, onRemove, onSpectate }) => {
  const { online = {} } = useContext(RoomContext);
  const sorted = useMemo(() => rankPlayers(state), [state.players, state.rule, state.scoreMode]);
  const ranks = useMemo(() => winRanks(state.players), [state.players]);
  const listRef = useRef(null);
  useFlip(listRef);
  return (
    <div className="flex flex-col gap-3">
      {!state.players.length && <Card className="p-8 text-center text-slate-400 font-bold">まだ参加者がいません</Card>}
      <div className="flex flex-col gap-3" ref={listRef}>
        {sorted.map((p, i) => (
          <PlayerRow
            key={p.id}
            player={p}
            rank={i + 1}
            state={state}
            isMe={p.id === myPlayerId}
            onRename={onRename}
            onRemove={onRemove}
            onSpectate={onSpectate}
            winRank={ranks[p.id]}
            online={!!online[p.id]}
          />
        ))}
      </div>
      <Spectators state={state} myPlayerId={myPlayerId} online={online} onSpectate={onSpectate} onRemove={onRemove} />
    </div>
  );
};
