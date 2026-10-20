// ホストの管理パネル（ゲーム設定・一括操作・チーム）

import { useState } from 'react';
import { getTeamDisplayScore } from '../lib/score.js';
import { Calculator, Edit2, Plus, RefreshCw, Settings, Trash2, Users, X, Zap } from '../ui/icons.jsx';
import { Button, Card, Seg } from '../ui/primitives.jsx';

export const SettingsPanel = ({ state, onOp, onClose }) => {
  const [newTeam, setNewTeam] = useState('');
  const simple = state.scoreMode === 'simple';
  const unassigned = state.players.filter((p) => !p.teamId);
  return (
    <div className="flex flex-col gap-4">
      {onClose && (
        <div className="flex justify-between items-center md:hidden">
          <h3 className="font-black text-slate-700">設定・チーム</h3>
          <button onClick={onClose} className="p-2 text-slate-400">
            <X />
          </button>
        </div>
      )}
      <Card className="p-5 flex flex-col gap-4">
        <h3 className="font-black text-slate-700 flex items-center gap-2">
          <Settings size={18} />
          {' ゲーム設定'}
        </h3>
        <div>
          <label className="text-xs font-bold text-slate-400 block mb-1">得点モード</label>
          <Seg
            value={state.scoreMode || 'addsub'}
            onChange={(k) =>
              onOp('setScoreMode', {
                mode: k,
              })
            }
            options={[
              ['addsub', '＋/− 数値'],
              ['simple', '〇/✖ Simple', 'text-emerald-600'],
            ]}
          />
        </div>
        {!simple && (
          <div>
            <label className="text-xs font-bold text-slate-400 block mb-1">チーム得点計算</label>
            <Seg
              value={state.teamMode || 'product'}
              onChange={(k) =>
                onOp('setTeamMode', {
                  mode: k,
                })
              }
              options={[
                ['sum', '和 (＋)', 'text-blue-600'],
                ['product', '積 (×)', 'text-rose-600'],
              ]}
            />
          </div>
        )}
        <p className="text-xs text-slate-400">全プレイヤーが各自の得点を操作します（ホストも1参加者）。</p>
      </Card>
      <Card className="p-5">
        <h3 className="font-black text-slate-700 mb-4 flex items-center gap-2">
          <Zap size={18} />
          {' 一括操作'}
        </h3>
        <div className="grid grid-cols-2 gap-2">
          <Button
            variant="ghost"
            className="bg-slate-50 py-3 text-sm text-slate-600"
            onClick={() => {
              if (window.confirm('全員を1にしますか？'))
                onOp('setAll', {
                  valueStr: '1',
                });
            }}
          >
            <Calculator size={16} />
            {' 全員 1'}
          </Button>
          <Button
            variant="ghost"
            className="bg-rose-50 text-rose-600 py-3 text-sm"
            onClick={() => {
              if (window.confirm('全員を0にリセットしますか？')) onOp('resetAll');
            }}
          >
            <RefreshCw size={16} />
            {' 全員 0 リセット'}
          </Button>
        </div>
      </Card>
      <Card className="p-5">
        <h3 className="font-black text-slate-700 mb-1 flex items-center gap-2">
          <Users size={18} />
          {' チーム'}
        </h3>
        <p className="text-xs text-slate-400 mb-3">
          所属は<b className="text-amber-600">各自が自分のバーでタップ選択</b>します。ここでは作成・改名・削除・「外す」ができます。
        </p>
        <div className="flex gap-2 mb-3">
          <input
            value={newTeam}
            onChange={(e) => setNewTeam(e.target.value)}
            placeholder="新チーム名"
            className="flex-1 bg-slate-100 rounded-xl px-3 py-2 text-sm outline-none"
          />
          <Button
            onClick={() => {
              if (newTeam.trim()) {
                onOp('createTeam', {
                  name: newTeam.trim(),
                });
                setNewTeam('');
              }
            }}
            className="px-4"
          >
            <Plus size={18} />
          </Button>
        </div>
        <div className="space-y-3">
          {state.teams.map((team) => {
            const members = state.players.filter((p) => p.teamId === team.id);
            return (
              <div key={team.id} className="bg-slate-50 rounded-2xl p-3 border border-slate-200">
                <div className="flex items-center justify-between mb-1">
                  <div className="font-bold text-slate-700 truncate text-sm">
                    {team.name}
                    <span className="ml-2 text-sky-600">{getTeamDisplayScore(team.id, state)}</span>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <button
                      onClick={() => {
                        const n = prompt('新しいチーム名', team.name);
                        if (n && n.trim())
                          onOp('renameTeam', {
                            teamId: team.id,
                            name: n.trim(),
                          });
                      }}
                      className="p-1 text-slate-400 hover:text-amber-500"
                    >
                      <Edit2 size={14} />
                    </button>
                    <button
                      onClick={() => {
                        if (window.confirm(`チーム「${team.name}」を削除しますか？`))
                          onOp('removeTeam', {
                            teamId: team.id,
                          });
                      }}
                      className="p-1 text-slate-400 hover:text-rose-500"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
                <div className="space-y-1">
                  {members.length ? (
                    members.map((p) => (
                      <div key={p.id} className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-2 py-1.5 text-sm">
                        <span className="flex-1 truncate text-slate-700">{p.name}</span>
                        <button
                          onClick={() =>
                            onOp('assignTeam', {
                              playerId: p.id,
                              teamId: null,
                            })
                          }
                          className="text-rose-400 text-xs shrink-0"
                        >
                          外す
                        </button>
                      </div>
                    ))
                  ) : (
                    <div className="text-xs text-slate-300 py-1">メンバーなし（ランキングからドラッグ）</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        {unassigned.length > 0 && (
          <div className="mt-3 text-xs text-slate-400">
            未所属（{unassigned.length}
            {'）: '}
            {unassigned.map((p) => p.name).join('、')}
          </div>
        )}
      </Card>
    </div>
  );
};
