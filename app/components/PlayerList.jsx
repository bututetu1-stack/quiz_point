// プレイヤー一覧（ランキング）：1 人 1 行の詰めた表示。メダル色・得点変化と順位入れ替えのアニメ・オンライン表示・観戦中の人。
// ホストは行（観戦中の人はチップ）を押すと、名前を変える／観戦にする（参加に戻す）／削除 のメニューが出る

import { useContext, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { RoomContext } from '../context.js';
import { rankPlayers, scoreText } from '../lib/ranking.js';
import { isReach, isRuleMode, playerState, progressHint, winRanks } from '../lib/rules.js';
import { parseScoreToNumber } from '../lib/score.js';
import { Crown, Edit2, Eye, Trash2, UserPlus, Users } from '../ui/icons.jsx';
import { useAsk } from '../ui/dialogs.jsx';
import { useFlip, useRankUps } from '../ui/motion.js';
import { Card, Chip, Sheet, SheetItem } from '../ui/primitives.jsx';
import { TeamChoices, teamColor } from './Teams.jsx';

const MEDAL = ['bg-medal-1 text-medal-ink', 'bg-medal-2 text-medal-ink', 'bg-medal-3 text-medal-ink'];

// 値が変わったら番号が増える（初回は 0。空からの変化＝読み込み直後は数えない）。key に使うとアニメが毎回やり直される
export const useChangeKey = (value) => {
  const prev = useRef(value);
  const [n, setN] = useState(0);
  useLayoutEffect(() => {
    if (prev.current !== value) {
      const was = prev.current;
      prev.current = value;
      if (was !== '' && was != null) setN((x) => x + 1);
    }
  }, [value]);
  return n;
};

// ルール時の状態チップ（勝ち抜け n 位 / 脱落 / 休み あと k / リーチ）
export const StateChip = ({ st, winRank, reach }) => {
  if (st.kind === 'win') return <Chip tone="okSolid">勝ち抜け {winRank}位</Chip>;
  if (st.kind === 'lose') return <Chip tone="muted">脱落</Chip>;
  if (st.kind === 'rest') return <Chip tone="info">休み あと{st.restLeft}問</Chip>;
  if (reach)
    return (
      <Chip tone="ok" data-reach>
        リーチ
      </Chip>
    );
  return null;
};

// 接続中の印。online が null（接続状況を読めない＝Firebase のルールで拒否など）のときは出さない
const OnlineDot = ({ online }) =>
  online === null ? null : (
    <span
      className={`w-2 h-2 rounded-full shrink-0 ${online ? 'bg-ok' : 'bg-ink-3/40'}`}
      title={online ? '接続中' : '未接続'}
      data-online={online ? '1' : '0'}
    />
  );

export const PlayerRow = ({ player, rank, state, isMe, winRank, online, onTap, up }) => {
  const team = state.teams.find((t) => t.id === player.teamId);
  const rule = isRuleMode(state.rule);
  const st = rule ? playerState(player, state.q || 1) : { kind: 'play' };
  const text = scoreText(state, player);
  const flash = useChangeKey(text);
  const scored = st.kind === 'win' || parseScoreToNumber(player.score) > 0 || (player.maru || 0) > 0;
  const medal = rank <= 3 && scored && st.kind !== 'lose' ? MEDAL[rank - 1] : 'bg-sunken text-ink-2';
  const tone = isMe ? 'bg-brand-soft border-brand/60' : st.kind === 'win' ? 'bg-ok-soft border-ok/40' : 'bg-card border-line';
  const hint = rule && st.kind !== 'win' && st.kind !== 'lose' ? progressHint(state.rule, player) : '';
  const reach = rule && st.kind === 'play' && isReach(state.rule, player);
  const Tag = onTap ? 'button' : 'div';
  return (
    <Tag
      data-player-id={player.id}
      data-flip-id={player.id}
      onClick={onTap}
      className={`w-full text-left flex items-center gap-3 pl-2.5 pr-3.5 py-1.5 short:py-1 rounded-2xl border transition-colors ${tone} ${st.kind === 'lose' ? 'bg-sunken shadow-none' : 'shadow-sm'} ${onTap ? 'hover:border-brand/60 cursor-pointer' : ''}`}
    >
      <span
        className={`relative w-9 h-9 short:w-8 short:h-8 shrink-0 flex items-center justify-center rounded-xl text-base font-black tabular-nums ${medal}`}
      >
        {rank === 1 && scored && st.kind !== 'lose' && (
          <Crown className="absolute -top-3 -left-2 w-5 h-5 text-medal-1 -rotate-12" fill="currentColor" />
        )}
        {rank}
      </span>
      <span className="flex-1 min-w-0 short:flex short:items-center short:gap-3">
        <span className="flex items-center gap-1.5 min-w-0 short:shrink-0 short:max-w-[55%]">
          <OnlineDot online={online} />
          <span className={`font-bold text-[0.9375rem] truncate ${st.kind === 'lose' ? 'text-ink-2' : 'text-ink'}`}>{player.name}</span>
          {isMe && <Chip tone="brandSolid">YOU</Chip>}
          {rule && <StateChip st={st} winRank={winRank} reach={reach} />}
          {up > 0 && (
            <Chip tone="ok" className="motion-safe:animate-pop" data-rank-up>
              ▲{up}
            </Chip>
          )}
        </span>
        {(team || rule) && (
          <span className="flex items-center gap-2 text-xs text-ink-3 mt-0.5 short:mt-0 min-w-0">
            {team && (
              <span className="flex items-center gap-1 shrink-0 max-w-[40%] short:max-w-[6rem] min-w-0">
                <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: teamColor(state, team.id) }} />
                <span className="truncate">{team.name}</span>
              </span>
            )}
            {rule && (
              <span className="shrink-0 font-bold">
                <span className="text-ok-ink">〇{player.maru || 0}</span> <span className="text-ng-ink">✕{player.batsu || 0}</span>
              </span>
            )}
            {hint && <span className="truncate">{hint}</span>}
          </span>
        )}
      </span>
      <span
        key={flash}
        className={`shrink-0 text-[1.65rem] leading-none font-black tracking-tight tabular-nums ${st.kind === 'lose' ? 'text-ink-3' : 'text-ink'} ${flash ? 'motion-safe:animate-pop' : ''}`}
      >
        {text}
      </span>
    </Tag>
  );
};

// 観戦中の人（ランキングの下に名前のチップ。ホストは押すとメニュー）
const Spectators = ({ state, myPlayerId, online, onTap }) => {
  const list = state.spectators || [];
  if (!list.length) return null;
  return (
    <div className="px-1" data-spectators>
      <div className="text-xs font-bold text-ink-3 mb-1.5 flex items-center gap-1">
        <Eye size={14} /> 観戦中（{list.length}）
      </div>
      <div className="flex flex-wrap gap-1.5">
        {list.map((p) => {
          const Tag = onTap ? 'button' : 'span';
          return (
            <Tag
              key={p.id}
              data-spectator-id={p.id}
              onClick={onTap ? () => onTap(p) : undefined}
              className={`flex items-center gap-1.5 bg-card border border-line rounded-full px-3 py-1 text-sm font-bold text-ink-2 max-w-full ${onTap ? 'hover:border-brand/60' : ''}`}
            >
              <OnlineDot online={online ? !!online[p.id] : null} />
              <span className="truncate">{p.name}</span>
              {p.id === myPlayerId && <span className="text-brand-ink text-xs shrink-0">（あなた）</span>}
            </Tag>
          );
        })}
      </div>
    </div>
  );
};

// ホストの他人操作メニュー
// isSelf：ホスト自身の行（自分は削除できない。消すと操作欄が無くなり戻せないため）
const PlayerMenu = ({ state, player, onOp, onClose, isSelf }) => {
  const { confirm, prompt } = useAsk();
  const [teamMode, setTeamMode] = useState(false);
  if (!player) return null;
  const id = player.id;
  const done = (fn) => () => {
    onClose();
    fn();
  };
  const team = state.teams.find((t) => t.id === player.teamId);
  if (teamMode)
    return (
      <Sheet open={true} onClose={onClose} title={`${player.name} のチーム`}>
        <TeamChoices state={state} myPlayer={player} onOp={onOp} onDone={onClose} />
      </Sheet>
    );
  return (
    <Sheet open={true} onClose={onClose} title={player.name}>
      <SheetItem
        icon={<Edit2 size={18} />}
        onClick={done(async () => {
          const n = await prompt(`${player.name} の新しい名前`, player.name, { title: '名前を変える' });
          if (n) onOp('renamePlayer', { playerId: id, name: n });
        })}
      >
        名前を変える
      </SheetItem>
      {state.teams.length > 0 && !player.spectator && (
        <SheetItem icon={<Users size={18} />} hint={team ? `いま：${team.name}` : 'まだ選んでいません'} onClick={() => setTeamMode(true)}>
          チームを変える
        </SheetItem>
      )}
      {player.spectator ? (
        <SheetItem icon={<UserPlus size={18} />} onClick={done(() => onOp('setSpectator', { playerId: id, on: false }))}>
          参加に戻す
        </SheetItem>
      ) : (
        <SheetItem
          icon={<Eye size={18} />}
          hint="ランキングから外れ、見るだけになります"
          onClick={done(() => onOp('setSpectator', { playerId: id, on: true }))}
        >
          観戦にする
        </SheetItem>
      )}
      {!isSelf && (
        <SheetItem
          icon={<Trash2 size={18} />}
          tone="ng"
          onClick={done(async () => {
            if (await confirm(`${player.name} を削除しますか？`, { ok: '削除する', danger: true, note: 'この人の得点・記録も消えます。' }))
              onOp('removePlayer', { playerId: id });
          })}
        >
          削除する
        </SheetItem>
      )}
    </Sheet>
  );
};

// hostOp：ホストのときだけ渡す（行を押すとメニュー）
export const PlayerList = ({ state, myPlayerId, hostOp }) => {
  const { online = {} } = useContext(RoomContext);
  const presenceKnown = Object.keys(online).length > 0;
  const sorted = useMemo(() => rankPlayers(state), [state.players, state.rule, state.scoreMode]);
  const ranks = useMemo(() => winRanks(state.players), [state.players]);
  const [menu, setMenu] = useState(null);
  const listRef = useRef(null);
  useFlip(listRef);
  const ups = useRankUps(sorted.map((p) => p.id));
  const tap = hostOp ? (p) => setMenu(p) : null;
  return (
    <div className="flex flex-col gap-3">
      {!state.players.length && <Card className="p-8 text-center text-ink-3 font-bold">まだ参加者がいません</Card>}
      <div className="flex flex-col gap-1.5" ref={listRef}>
        {sorted.map((p, i) => (
          <PlayerRow
            key={p.id}
            player={p}
            rank={i + 1}
            state={state}
            isMe={p.id === myPlayerId}
            winRank={ranks[p.id]}
            online={presenceKnown ? !!online[p.id] : null}
            onTap={tap ? () => tap(p) : null}
            up={ups[p.id] ? ups[p.id].d : 0}
          />
        ))}
      </div>
      <Spectators state={state} myPlayerId={myPlayerId} online={presenceKnown ? online : null} onTap={tap} />
      {hostOp && (
        <PlayerMenu
          key={menu ? menu.id : 'none'}
          state={state}
          player={menu}
          isSelf={!!menu && menu.id === myPlayerId}
          onOp={hostOp}
          onClose={() => setMenu(null)}
        />
      )}
    </div>
  );
};
