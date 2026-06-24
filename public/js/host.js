/* ホスト操作パネルのロジック（host.html） */
(function () {
  const socket = io();
  const roomId = (getQueryParam('room') || '').toUpperCase();
  const hostToken = localStorage.getItem('hostToken:' + roomId);

  const toastEl = document.getElementById('toast');
  const panelEl = document.getElementById('panel');
  const authErrorEl = document.getElementById('authError');

  let state = { players: [], teams: [] };
  // 各プレイヤー行で選択中の演算子（既定は ×）
  const selectedOp = {};

  // ○×モード設定（localStorage に保持）
  const settings = {
    maruBatsu: localStorage.getItem('mb:enabled') === '1',
    point: localStorage.getItem('mb:point') || '10',
  };

  function showToast(msg) {
    toastEl.textContent = msg;
    toastEl.classList.add('show');
    setTimeout(() => toastEl.classList.remove('show'), 1600);
  }

  if (!roomId || !hostToken) {
    panelEl.classList.add('hidden');
    authErrorEl.classList.remove('hidden');
    return;
  }

  function authenticate() {
    socket.emit('hostJoin', { roomId, hostToken }, (res) => {
      if (!res || !res.ok) {
        panelEl.classList.add('hidden');
        authErrorEl.classList.remove('hidden');
        return;
      }
      authErrorEl.classList.add('hidden');
      panelEl.classList.remove('hidden');
      initShare();
      render(res.state);
    });
  }
  socket.on('connect', authenticate);
  socket.on('state', render);

  function initShare() {
    document.getElementById('roomCode').textContent = roomId;
    const url = location.origin + '/?room=' + roomId;
    document.getElementById('shareUrl').textContent = url;
    document.getElementById('copyBtn').addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(url);
        showToast('リンクをコピーしました');
      } catch {
        showToast('コピーできませんでした');
      }
    });
  }

  // ---- 操作送信ヘルパ ----
  function op(type, payload, okMsg) {
    socket.emit('op', { roomId, hostToken, type, payload }, (res) => {
      if (!res || !res.ok) {
        showToast(errorMsg(res && res.error));
        return;
      }
      if (okMsg) showToast(okMsg);
      updateUndoBtn(res.canUndo);
    });
  }

  function errorMsg(code) {
    return ({
      invalid_value: '数値が不正です（例: 2, 0.5, 1/2）',
      invalid_name: '名前を入力してください',
      nothing_to_undo: '戻せる操作がありません',
      unauthorized: '権限がありません',
    })[code] || 'エラーが発生しました';
  }

  function updateUndoBtn(canUndo) {
    document.getElementById('undoBtn').disabled = !canUndo;
  }

  // ---- グローバルボタン ----
  document.getElementById('setAllOneBtn').addEventListener('click', () => {
    if (state.players.length === 0) return showToast('参加者がいません');
    op('setAll', { valueStr: '1' }, '全員を 1 にしました');
  });
  document.getElementById('resetAllBtn').addEventListener('click', () => {
    if (state.players.length === 0) return showToast('参加者がいません');
    if (confirm('全員の得点を 0 にしますか？')) op('resetAll', {}, 'リセットしました');
  });
  document.getElementById('undoBtn').addEventListener('click', () => {
    op('undo', {}, '一つ戻しました');
  });
  // ○×モードの切替・得点設定
  (function setupMaruBatsu() {
    const toggle = document.getElementById('maruBatsuToggle');
    const pointInput = document.getElementById('pointValue');
    toggle.checked = settings.maruBatsu;
    pointInput.value = settings.point;
    toggle.addEventListener('change', () => {
      settings.maruBatsu = toggle.checked;
      localStorage.setItem('mb:enabled', toggle.checked ? '1' : '0');
      renderPlayers();
    });
    pointInput.addEventListener('input', () => {
      settings.point = pointInput.value.trim();
      localStorage.setItem('mb:point', settings.point);
      if (settings.maruBatsu) renderPlayers();
    });
  })();

  document.getElementById('addTeamBtn').addEventListener('click', addTeam);
  document.getElementById('newTeamName').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') addTeam();
  });
  function addTeam() {
    const input = document.getElementById('newTeamName');
    const name = input.value.trim();
    if (!name) return showToast('チーム名を入力してください');
    op('createTeam', { name }, 'チームを追加しました');
    input.value = '';
  }

  // ---- 描画 ----
  function render(newState) {
    if (!newState) return;
    state = newState;
    renderTeams();
    renderPlayers();
  }

  function renderTeams() {
    const list = document.getElementById('teamList');
    const noTeams = document.getElementById('noTeams');
    const teams = state.teams || [];
    if (teams.length === 0) {
      list.innerHTML = '';
      noTeams.classList.remove('hidden');
      return;
    }
    noTeams.classList.add('hidden');

    const rows = teams.map((t) => {
      const members = state.players.filter((p) => p.teamId === t.id);
      return { ...t, score: teamScore(members.map((m) => m.score)), count: members.length };
    }).sort((a, b) => ratToNumber(b.score) - ratToNumber(a.score));

    list.innerHTML = rows.map((t) => `
      <li class="team-card">
        <span class="name">${escapeHtml(t.name)} <span class="team-chip">${t.count}人</span></span>
        <span class="score">${formatScore(t.score)}</span>
        <button class="ghost small" data-rename-team="${t.id}">改名</button>
        <button class="ghost small" data-del-team="${t.id}">削除</button>
      </li>`).join('');

    list.querySelectorAll('[data-del-team]').forEach((b) => {
      b.addEventListener('click', () => {
        if (confirm('このチームを削除しますか？（メンバーは未所属になります）')) {
          op('removeTeam', { teamId: b.dataset.delTeam });
        }
      });
    });
    list.querySelectorAll('[data-rename-team]').forEach((b) => {
      b.addEventListener('click', () => {
        const cur = state.teams.find((t) => t.id === b.dataset.renameTeam);
        const name = prompt('新しいチーム名', cur ? cur.name : '');
        if (name && name.trim()) op('renameTeam', { teamId: b.dataset.renameTeam, name: name.trim() });
      });
    });
  }

  function renderPlayers() {
    const list = document.getElementById('playerList');
    const noPlayers = document.getElementById('noPlayers');
    const players = sortByScoreDesc(state.players);

    if (players.length === 0) {
      list.innerHTML = '';
      noPlayers.classList.remove('hidden');
      return;
    }
    noPlayers.classList.add('hidden');

    const teamOptions = (selectedId) =>
      ['<option value="">（未所属）</option>']
        .concat(state.teams.map((t) =>
          `<option value="${t.id}" ${t.id === selectedId ? 'selected' : ''}>${escapeHtml(t.name)}</option>`))
        .join('');

    const pt = escapeHtml(settings.point || '0');
    list.innerHTML = players.map((p, i) => {
      const op0 = selectedOp[p.id] || '*';
      const mk = (sym, val) => `<button data-op="${val}" data-pid="${p.id}" class="${op0 === val ? 'active' : ''}">${sym}</button>`;
      const controls = settings.maruBatsu
        ? `
          <div class="controls mb-controls">
            <button class="mb-correct" data-mb="+" data-pid="${p.id}">○ +${pt}</button>
            <button class="mb-wrong" data-mb="-" data-pid="${p.id}">× −${pt}</button>
            <select data-team="${p.id}" class="grow" style="max-width:140px;">${teamOptions(p.teamId)}</select>
            <button class="ghost small" data-rename="${p.id}">改名</button>
            <button class="ghost small" data-remove="${p.id}">削除</button>
          </div>`
        : `
          <div class="controls">
            <div class="op-btns">
              ${mk('+', '+')}${mk('−', '-')}${mk('×', '*')}${mk('÷', '/')}
            </div>
            <input class="val-input" type="text" inputmode="decimal" placeholder="2 / 0.5 / 1/2"
                   data-val="${p.id}" />
            <button class="small" data-apply="${p.id}">適用</button>
            <select data-team="${p.id}" class="grow" style="max-width:140px;">${teamOptions(p.teamId)}</select>
            <button class="ghost small" data-rename="${p.id}">改名</button>
            <button class="ghost small" data-remove="${p.id}">削除</button>
          </div>`;
      return `
      <li class="${i === 0 ? 'top1' : ''}">
        <div style="flex:1; min-width:0;">
          <div class="row" style="gap:8px;">
            <span class="rank">${i + 1}</span>
            <span class="name">${escapeHtml(p.name)}</span>
            <span class="score">${formatScore(p.score)}</span>
          </div>
          ${controls}
        </div>
      </li>`;
    }).join('');

    // ○×ボタン（ワンタップで規定得点を加減）
    list.querySelectorAll('[data-mb]').forEach((b) => {
      b.addEventListener('click', () => {
        const valueStr = (settings.point || '').trim();
        if (!valueStr) return showToast('1問の得点を入力してください');
        op('score', { playerId: b.dataset.pid, operator: b.dataset.mb, valueStr });
      });
    });

    // 演算子選択
    list.querySelectorAll('[data-op]').forEach((b) => {
      b.addEventListener('click', () => {
        selectedOp[b.dataset.pid] = b.dataset.op;
        // 同じプレイヤー行のボタンの active を切り替え
        b.parentElement.querySelectorAll('button').forEach((x) => x.classList.toggle('active', x === b));
      });
    });

    // 適用
    const applyFor = (pid) => {
      const input = list.querySelector(`[data-val="${pid}"]`);
      const valueStr = input.value.trim();
      if (!valueStr) return showToast('数値を入力してください');
      op('score', { playerId: pid, operator: selectedOp[pid] || '*', valueStr });
      input.value = '';
    };
    list.querySelectorAll('[data-apply]').forEach((b) => {
      b.addEventListener('click', () => applyFor(b.dataset.apply));
    });
    list.querySelectorAll('[data-val]').forEach((inp) => {
      inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') applyFor(inp.dataset.val); });
    });

    // チーム割当
    list.querySelectorAll('[data-team]').forEach((sel) => {
      sel.addEventListener('change', () => {
        op('assignTeam', { playerId: sel.dataset.team, teamId: sel.value || null });
      });
    });

    // 改名・削除
    list.querySelectorAll('[data-rename]').forEach((b) => {
      b.addEventListener('click', () => {
        const cur = state.players.find((p) => p.id === b.dataset.rename);
        const name = prompt('新しい名前', cur ? cur.name : '');
        if (name && name.trim()) op('renamePlayer', { playerId: b.dataset.rename, name: name.trim() });
      });
    });
    list.querySelectorAll('[data-remove]').forEach((b) => {
      b.addEventListener('click', () => {
        const cur = state.players.find((p) => p.id === b.dataset.remove);
        if (confirm(`${cur ? cur.name : 'この参加者'} を削除しますか？`)) {
          op('removePlayer', { playerId: b.dataset.remove });
        }
      });
    });
  }
})();
