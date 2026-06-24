/* 参加者 / ホーム のロジック（index.html） */
(function () {
  const socket = io();

  const homeEl = document.getElementById('home');
  const joinFormEl = document.getElementById('joinForm');
  const viewerEl = document.getElementById('viewer');
  const toastEl = document.getElementById('toast');

  let roomId = getQueryParam('room');
  let myPlayerId = null;

  function showToast(msg) {
    toastEl.textContent = msg;
    toastEl.classList.add('show');
    setTimeout(() => toastEl.classList.remove('show'), 1800);
  }
  function show(section) {
    [homeEl, joinFormEl, viewerEl].forEach((s) => s.classList.add('hidden'));
    section.classList.remove('hidden');
  }

  // ---- ルーティング ----
  if (roomId) {
    roomId = roomId.toUpperCase();
    setupJoin();
  } else {
    setupHome();
  }

  // ---- ホーム ----
  function setupHome() {
    show(homeEl);
    document.getElementById('createBtn').addEventListener('click', () => {
      socket.emit('createRoom', (res) => {
        if (!res || !res.ok) { showToast('部屋の作成に失敗しました'); return; }
        // hostToken を保存してホスト画面へ
        localStorage.setItem('hostToken:' + res.roomId, res.hostToken);
        location.href = '/host.html?room=' + res.roomId;
      });
    });
    const goJoin = () => {
      const code = document.getElementById('joinCode').value.trim().toUpperCase();
      if (code) location.href = '/?room=' + code;
    };
    document.getElementById('goJoin').addEventListener('click', goJoin);
    document.getElementById('joinCode').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') goJoin();
    });
  }

  // ---- 参加者: 入室フォーム ----
  function setupJoin() {
    document.getElementById('joinRoomCode').textContent = roomId;
    const savedName = localStorage.getItem('name:' + roomId) || '';
    const savedPlayerId = localStorage.getItem('playerId:' + roomId);

    socket.emit('checkRoom', { roomId }, (res) => {
      if (!res || !res.ok) {
        show(joinFormEl);
        document.getElementById('joinError').textContent =
          'この部屋は存在しないか、終了しています。';
        document.getElementById('enterBtn').disabled = true;
        return;
      }
      // 既に名前があれば自動で再入室
      if (savedName && savedPlayerId) {
        doJoin(savedName, savedPlayerId);
      } else {
        show(joinFormEl);
        document.getElementById('nameInput').value = savedName;
        document.getElementById('nameInput').focus();
      }
    });

    const enter = () => {
      const name = document.getElementById('nameInput').value.trim();
      if (!name) {
        document.getElementById('joinError').textContent = '名前を入力してください。';
        return;
      }
      doJoin(name, localStorage.getItem('playerId:' + roomId));
    };
    document.getElementById('enterBtn').addEventListener('click', enter);
    document.getElementById('nameInput').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') enter();
    });
  }

  function doJoin(name, playerId) {
    socket.emit('joinRoom', { roomId, name, playerId }, (res) => {
      if (!res || !res.ok) {
        show(joinFormEl);
        document.getElementById('joinError').textContent =
          res && res.error === 'room_not_found'
            ? 'この部屋は存在しません。'
            : '入室に失敗しました。';
        return;
      }
      myPlayerId = res.playerId;
      localStorage.setItem('name:' + roomId, name);
      localStorage.setItem('playerId:' + roomId, res.playerId);
      document.getElementById('viewerName').textContent = name;
      document.getElementById('viewerRoomCode').textContent = roomId;
      show(viewerEl);
      render(res.state);
    });
  }

  // 再接続時に自動で入り直す
  socket.on('connect', () => {
    if (myPlayerId && roomId) {
      const name = localStorage.getItem('name:' + roomId);
      if (name) socket.emit('joinRoom', { roomId, name, playerId: myPlayerId }, () => {});
    }
  });

  socket.on('state', render);

  // ---- 描画 ----
  function render(state) {
    if (!state) return;
    const players = state.players || [];
    const teams = state.teams || [];

    // チーム得点
    const teamsSection = document.getElementById('teamsSection');
    const teamBoard = document.getElementById('teamBoard');
    if (teams.length > 0) {
      teamsSection.classList.remove('hidden');
      const teamRows = teams.map((t) => {
        const members = players.filter((p) => p.teamId === t.id);
        return { name: t.name, score: teamScore(members.map((m) => m.score)), count: members.length };
      }).sort((a, b) => ratToNumber(b.score) - ratToNumber(a.score));

      teamBoard.innerHTML = teamRows.map((t, i) => `
        <li class="team-card ${i === 0 ? 'top1' : ''}">
          <span class="rank">${i + 1}</span>
          <span class="name">${escapeHtml(t.name)} <span class="team-chip">${t.count}人</span></span>
          <span class="score">${formatScore(t.score)}</span>
        </li>`).join('');
    } else {
      teamsSection.classList.add('hidden');
    }

    // 個人得点（降順）
    const sorted = sortByScoreDesc(players);
    const teamNameById = Object.fromEntries(teams.map((t) => [t.id, t.name]));
    const board = document.getElementById('playerBoard');
    if (sorted.length === 0) {
      board.innerHTML = '<li class="muted center" style="justify-content:center;">まだ参加者がいません</li>';
      return;
    }
    board.innerHTML = sorted.map((p, i) => `
      <li class="${i === 0 ? 'top1' : ''} ${p.id === myPlayerId ? 'me' : ''}">
        <span class="rank">${i + 1}</span>
        <span class="name">${escapeHtml(p.name)}${p.teamId && teamNameById[p.teamId] ? `<span class="team-chip">${escapeHtml(teamNameById[p.teamId])}</span>` : ''}</span>
        <span class="score">${formatScore(p.score)}</span>
      </li>`).join('');
  }
})();
