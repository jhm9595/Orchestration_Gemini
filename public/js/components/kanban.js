window.VF = window.VF || {};

(function () {
  function renderCardMarkup(c, proj, deptMap, esc) {
    const dept = deptMap[c.current_dept] || { name: c.current_dept };
    const pct = Math.round((c.completed_depts.length / Math.max(1, c.route_depts.length)) * 100);
    const isBlocked = c.last_verdict === 'BLOCKED';
    const engClass = isBlocked ? 'badge-blocked' : (c.assigned_engine === 'Codex' ? 'badge-codex' : 'badge-gemini');
    const engLabel = isBlocked ? '🚨 BLOCKED' : c.assigned_engine;
    const themeClass = `proj-theme-${proj.color || 'indigo'}`;

    return `
      <div class="k-card ${themeClass} ${isBlocked ? 'blocked' : ''}" onclick="window.VF.openCardDetail(${c.id})">
        <div class="card-top">
          <span class="proj-tag" title="${esc(proj.name)}">${esc(proj.name)}</span>
          <span class="badge ${engClass}">${engLabel} · R${c.retry_count + 1}/${c.max_retries}</span>
        </div>
        <div class="card-title">#${c.id} ${esc(c.title)}</div>
        <div class="card-dept">
          <span>${esc(dept.name)}</span>
          <span style="color:var(--muted)">${c.completed_depts.length}/${c.route_depts.length} (${pct}%)</span>
        </div>
        <div class="progress-bar"><div class="progress-fill" style="width:${pct}%"></div></div>
        ${c.parent_card_id ? `<div class="lineage-pill">🔗 유저 피드백 파생 (#${c.parent_card_id} →)</div>` : ''}
      </div>`;
  }

  window.VF.renderProjectFilterBar = function (state, selectedProjectId, boardMode, esc) {
    const bar = document.getElementById('projectFilterBar');
    if (!bar) return;
    const pills = [
      `<span class="pill ${selectedProjectId === 0 ? 'active' : ''}" onclick="window.VF.setFilter(0)">전체 프로젝트 (${state.cards.length})</span>`,
      ...state.projects.map((p) => {
        const cnt = state.cards.filter((c) => c.project_id === p.id).length;
        const cls = `pill proj-pill proj-theme-${p.color || 'indigo'} ${selectedProjectId === p.id ? 'active' : ''}`;
        return `<span class="${cls}" onclick="window.VF.setFilter(${p.id})"><span class="dot"></span>${esc(p.name)} (${cnt})</span>`;
      }),
    ];
    bar.innerHTML = pills.join('');

    const sw = document.getElementById('boardViewSwitch');
    if (sw) {
      sw.innerHTML = `
        <button class="${boardMode === 'columns' ? 'active' : ''}" onclick="window.VF.setBoardMode('columns')">📋 6단계 컬럼 보기</button>
        <button class="${boardMode === 'zones' ? 'active' : ''}" onclick="window.VF.setBoardMode('zones')">🎨 프로젝트 존별 보기</button>`;
    }
  };

  window.VF.renderKanban = function (state, selectedProjectId, boardMode, esc) {
    const board = document.getElementById('kanbanBoard');
    if (!board) return;
    const deptMap = Object.fromEntries(state.departments.map((d) => [d.key, d]));
    const projMap = Object.fromEntries(state.projects.map((p) => [p.id, p]));
    const filtered = selectedProjectId ? state.cards.filter((c) => c.project_id === selectedProjectId) : state.cards;

    if (boardMode === 'zones') {
      board.className = 'zone-list';
      const targetProjs = selectedProjectId ? state.projects.filter((p) => p.id === selectedProjectId) : state.projects;
      board.innerHTML = targetProjs.map((proj) => {
        const pCards = filtered.filter((c) => c.project_id === proj.id);
        const themeClass = `proj-theme-${proj.color || 'indigo'}`;
        return `
          <div class="proj-zone ${themeClass}">
            <div class="proj-zone-head">
              <div class="proj-zone-title">
                <span class="dot"></span>
                <span>${esc(proj.name)}</span>
                <span class="sub-pill">🌏 ${esc(proj.locales)}</span>
                <span class="sub-pill">💰 ${esc(proj.monetization)}</span>
              </div>
              <div style="display:flex;gap:6px;align-items:center;">
                <span class="k-count">${pCards.length}개 카드</span>
                <button class="btn-sm btn-primary" onclick="window.VF.openIdeaModal(${proj.id})">+ 카드 추가</button>
              </div>
            </div>
            <div class="zone-cards-grid">
              ${pCards.map((c) => renderCardMarkup(c, proj, deptMap, esc)).join('') || '<div style="color:var(--muted);padding:12px;">진행 중인 카드가 없습니다.</div>'}
            </div>
          </div>`;
      }).join('');
      return;
    }

    board.className = 'kanban-board';
    board.innerHTML = state.stages.map((st) => {
      const colCards = filtered.filter((c) => c.stage === st.key);
      const cardsHtml = colCards.map((c) => {
        const proj = projMap[c.project_id] || { name: '프로젝트', color: 'indigo' };
        return renderCardMarkup(c, proj, deptMap, esc);
      }).join('');
      return `
        <div class="k-col">
          <div class="k-col-head"><span>${esc(st.label)}</span><span class="k-count">${colCards.length}</span></div>
          <div class="k-cards">${cardsHtml || '<div style="color:var(--muted);font-size:11.5px;text-align:center;padding:24px 0;">대기 카드 없음</div>'}</div>
        </div>`;
    }).join('');
  };
})();
