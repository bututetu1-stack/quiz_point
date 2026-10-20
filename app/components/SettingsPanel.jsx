// ホストの管理パネル：進行（問題番号・結果発表・大画面・CSV）／ルール／一括操作／チーム

import { useState } from 'react';
import { toCsv } from '../lib/ranking.js';
import { isRuleMode } from '../lib/rules.js';
import { getTeamDisplayScore } from '../lib/score.js';
import { Calculator, Download, Edit2, Monitor, Plus, RefreshCw, Trash2, Trophy, Users } from '../ui/icons.jsx';
import { useAsk } from '../ui/dialogs.jsx';
import { Button, Section } from '../ui/primitives.jsx';
import { AccessCheck } from './AccessCheck.jsx';
import { boardUrl } from './InviteDialog.jsx';
import { ProgressControls, RuleCard } from './RuleSettings.jsx';
import { teamColor } from './Teams.jsx';

// 最終順位を CSV でダウンロード（Excel で文字化けしないよう BOM 付き）
const downloadCsv = (state, roomId) => {
  const blob = new Blob(['﻿' + toCsv(state)], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `quiz_${roomId}_${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
};

export const SettingsPanel = ({ state, roomId, onOp }) => {
  const [newTeam, setNewTeam] = useState('');
  const { confirm, prompt } = useAsk();
  const rule = isRuleMode(state.rule);
  const unassigned = state.players.filter((p) => !p.teamId);
  const addTeam = () => {
    if (newTeam.trim()) {
      onOp('createTeam', { name: newTeam.trim() });
      setNewTeam('');
    }
  };
  return (
    <div className="flex flex-col gap-3">
      <AccessCheck />
      <Section icon={<Trophy size={18} />} title="進行">
        <ProgressControls state={state} onOp={onOp} />
        <Button className="w-full py-3 text-sm mt-3" onClick={() => onOp('setPhase', { phase: 'result' })}>
          <Trophy size={16} /> 結果発表（全員の画面に表示）
        </Button>
        <div className="grid grid-cols-2 gap-2 mt-2">
          <Button variant="soft" className="py-2.5 text-sm" onClick={() => window.open(boardUrl(roomId), '_blank')}>
            <Monitor size={16} /> 大画面
          </Button>
          <Button variant="soft" className="py-2.5 text-sm" onClick={() => downloadCsv(state, roomId)}>
            <Download size={16} /> CSV 保存
          </Button>
        </div>
      </Section>
      <RuleCard state={state} onOp={onOp} />
      <Section icon={<RefreshCw size={18} />} title="一括操作">
        <p className="text-xs text-ink-3 mb-3">得点は各自が自分で操作します（ホストも1参加者）。</p>
        <div className="grid grid-cols-2 gap-2">
          {!rule && (
            <Button
              variant="soft"
              className="py-2.5 text-sm"
              onClick={async () => {
                if (await confirm('全員の得点を 1 にしますか？', { ok: '全員 1 にする' })) onOp('setAll', { valueStr: '1' });
              }}
            >
              <Calculator size={16} /> 全員 1
            </Button>
          )}
          <Button
            variant="soft"
            className={`py-2.5 text-sm text-ng-ink ${rule ? 'col-span-2' : ''}`}
            onClick={async () => {
              const ok = await confirm(rule ? '全員の得点・状態をリセットして Q1 に戻しますか？' : '全員の得点を 0 にリセットしますか？', {
                ok: 'リセットする',
                danger: true,
                note: '記録タブの成績は残ります。各自「元に戻す」で直前に戻せます。',
              });
              if (ok) onOp('resetAll');
            }}
          >
            <RefreshCw size={16} /> {rule ? '全員リセット' : '全員 0 リセット'}
          </Button>
        </div>
      </Section>
      <Section icon={<Users size={18} />} title="チーム">
        <p className="text-xs text-ink-3 mb-3">所属は各自が選びます（ホストはランキングの行を押して変えることもできます）。ここでは作成・改名・削除・「外す」ができます。</p>
        <div className="flex gap-2 mb-3">
          <input
            value={newTeam}
            onChange={(e) => setNewTeam(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') addTeam();
            }}
            placeholder="新チーム名"
            className="flex-1 min-w-0 bg-sunken rounded-xl px-3 py-2 text-sm font-bold text-ink placeholder:text-ink-3 outline-none focus:ring-2 focus:ring-brand/40"
          />
          <Button onClick={addTeam} className="px-3.5" aria-label="チームを作る">
            <Plus size={18} />
          </Button>
        </div>
        <div className="flex flex-col gap-2">
          {state.teams.map((team) => {
            const members = state.players.filter((p) => p.teamId === team.id);
            return (
              <div key={team.id} className="bg-sunken rounded-xl p-2.5">
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: teamColor(state, team.id) }} />
                  <span className="flex-1 min-w-0 font-bold text-ink truncate text-sm">{team.name}</span>
                  <span className="font-black tabular-nums text-ink">{getTeamDisplayScore(team.id, state)}</span>
                  <button
                    onClick={async () => {
                      const n = await prompt('新しいチーム名', team.name, { title: 'チーム名を変える' });
                      if (n) onOp('renameTeam', { teamId: team.id, name: n });
                    }}
                    className="p-1.5 rounded-lg text-ink-3 hover:text-brand-ink hover:bg-card"
                    aria-label={`${team.name} の名前を変える`}
                  >
                    <Edit2 size={14} />
                  </button>
                  <button
                    onClick={async () => {
                      if (
                        await confirm(`チーム「${team.name}」を削除しますか？`, {
                          ok: '削除する',
                          danger: true,
                          note: 'メンバーは未所属に戻ります。',
                        })
                      )
                        onOp('removeTeam', { teamId: team.id });
                    }}
                    className="p-1.5 rounded-lg text-ink-3 hover:text-ng-ink hover:bg-card"
                    aria-label={`${team.name} を削除`}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
                <div className="flex flex-wrap gap-1">
                  {members.length ? (
                    members.map((p) => (
                      <span
                        key={p.id}
                        className="flex items-center gap-1 bg-card border border-line rounded-full pl-2.5 pr-1 py-0.5 text-xs font-bold text-ink-2 max-w-full"
                      >
                        <span className="truncate">{p.name}</span>
                        <button
                          onClick={() => onOp('assignTeam', { playerId: p.id, teamId: null })}
                          className="text-ng-ink px-2 min-h-[24px] rounded-full hover:bg-ng-soft"
                          aria-label={`${p.name} をチームから外す`}
                        >
                          外す
                        </button>
                      </span>
                    ))
                  ) : (
                    <span className="text-xs text-ink-3 px-1">メンバーなし</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        {unassigned.length > 0 && state.teams.length > 0 && (
          <div className="mt-3 text-xs text-ink-3">
            未所属（{unassigned.length}）: {unassigned.map((p) => p.name).join('、')}
          </div>
        )}
      </Section>
    </div>
  );
};
