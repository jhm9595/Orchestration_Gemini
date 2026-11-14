window.VF = window.VF || {};

(function () {
  const SWATCHES = {
    indigo: '#4f46e5',
    emerald: '#059669',
    amber: '#d97706',
    rose: '#e11d48',
    violet: '#7c3aed',
    cyan: '#0891b2',
  };

  window.VF.renderPortfolio = function (state, esc) {
    const container = document.getElementById('tab-portfolio');
    if (!container) return;
    const catNames = {
      web_saas: '🌐 웹 SaaS',
      mobile_game: '🎮 모바일/웹 게임',
      shorts_bot: '🎬 쇼츠·자동화 봇',
      global_commerce: '🛒 글로벌 커머스',
    };

    container.innerHTML = `<div class="proj-grid">` + state.projects.map((p) => {
      const pCards = state.cards.filter((c) => c.project_id === p.id);
      const doneCnt = pCards.filter((c) => c.completed_depts.length >= c.route_depts.length).length;
      const color = p.color || 'indigo';
      const swatchHtml = Object.entries(SWATCHES).map(([k, hex]) =>
        `<span class="color-swatch ${color === k ? 'selected' : ''}" style="background:${hex}" title="${k}" onclick="window.VF.setProjectColor(${p.id}, '${k}')"></span>`
      ).join('');

      return `
        <div class="proj-card proj-theme-${color}">
          <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;">
            <strong style="font-size:14.5px;color:var(--p-ink);">${esc(p.name)}</strong>
            <span class="badge badge-codex">${esc(p.status)}</span>
          </div>
          <div style="font-size:12px;color:var(--muted);">유형: ${catNames[p.category] || esc(p.category)}</div>
          <div style="font-size:12px;">🌏 타겟 로케일: <strong>${esc(p.locales)}</strong></div>
          <div style="font-size:12px;">💰 수익화: <strong>${esc(p.monetization)}</strong></div>
          <div style="font-size:12px;color:var(--p-ink);font-weight:600;">진행 카드 ${pCards.length}건 (출시/운영 ${doneCnt}건)</div>
          <div style="display:flex;justify-content:space-between;align-items:center;margin-top:2px;">
            <span style="font-size:11px;color:var(--muted);">존 컬러 변경:</span>
            <div class="color-dots">${swatchHtml}</div>
          </div>
          <div style="display:flex;gap:8px;margin-top:6px;">
            <button onclick="window.VF.setFilter(${p.id});window.VF.switchTab('kanban')">📋 이 프로젝트 칸반 보기</button>
            <button class="btn-primary" onclick="window.VF.openIdeaModal(${p.id})">+ 카드 추가</button>
          </div>
        </div>`;
    }).join('') + `</div>`;
  };
})();
