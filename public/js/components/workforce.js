window.VF = window.VF || {};

(function () {
  window.VF.renderWorkforce = function (state, esc) {
    const container = document.getElementById('tab-workforce');
    if (!container) return;
    const hqs = [...new Set(state.departments.map((d) => d.hq))];

    container.innerHTML = hqs.map((hq) => {
      const depts = state.departments.filter((d) => d.hq === hq);
      const cardsHtml = depts.map((d) => {
        const activeCards = state.cards.filter(
          (c) => c.current_dept === d.key && c.completed_depts.length < c.route_depts.length && c.last_verdict !== 'BLOCKED'
        );
        const engBadge = d.engine === 'Codex' ? 'badge-codex' : 'badge-gemini';
        return `
          <div class="dept-card ${activeCards.length ? 'working' : ''}">
            <div class="dept-head">
              <span class="dept-name">${esc(d.name)}</span>
              <span class="badge ${engBadge}">${d.engine}</span>
            </div>
            <div class="dept-desc">${esc(d.desc)}</div>
            <div class="dept-status">
              ${activeCards.length
                ? `🔄 <strong>작업 중:</strong> #${activeCards[0].id} ${esc(activeCards[0].title)}`
                : `🟢 대기 중 · 누적 처리 <strong>${d.completedActions}건</strong>`}
            </div>
            <div style="display:flex;justify-content:flex-end;margin-top:2px;">
              <button class="btn-sm" onclick="window.VF.openSkillFromWorkforce('${esc(d.key)}')">📘 SKILL.md 보기</button>
            </div>
          </div>`;
      }).join('');
      return `<div class="hq-section"><h3 class="hq-title">🏢 ${esc(hq)}</h3><div class="dept-grid">${cardsHtml}</div></div>`;
    }).join('');
  };
})();
