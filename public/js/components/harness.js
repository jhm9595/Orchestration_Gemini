window.VF = window.VF || {};

(function () {
  window.VF.renderHarness = function (harnessData, selectedSkillKey, esc) {
    const container = document.getElementById('tab-harness');
    if (!container) return;
    if (!harnessData) {
      container.innerHTML = '<div class="panel-box">하네스 상태를 불러오는 중...</div>';
      return;
    }

    const { linter, skills, hooks } = harnessData;
    const activeKey = selectedSkillKey || (skills[0] && skills[0].key) || 'ui';
    const activeSkill = skills.find((s) => s.key === activeKey) || skills[0];
    const m = linter.metrics || {};

    const checksHtml = [
      ...(linter.checks || []).map((c) => `
        <div class="check-row">
          <span>✅ <strong>${esc(c.code)}</strong> — ${esc(c.label)}</span>
          <span class="badge badge-codex">PASS</span>
        </div>`),
      ...(linter.issues || []).map((i) => `
        <div class="check-row" style="border-color:#fecaca;background:#fef2f2;flex-direction:column;align-items:flex-start;gap:4px;">
          <div><strong>❌ ${esc(i.code)}</strong> — ${esc(i.message)}</div>
          <div style="color:#991b1b;font-size:11.5px;">${esc(i.hint)}</div>
        </div>`),
    ].join('');

    const hooksHtml = (hooks || []).map((h) => `
      <div class="check-row">
        <div>
          <strong>${esc(h.name)}</strong>
          <div style="font-size:11.5px;color:var(--muted);">${esc(h.desc)}</div>
        </div>
        <span class="badge badge-gemini">ACTIVE</span>
      </div>`).join('');

    const skillPills = (skills || []).map((s) => `
      <span class="pill ${s.key === activeSkill.key ? 'active' : ''}" onclick="window.VF.selectHarnessSkill('${esc(s.key)}')">
        ${esc(s.key)}.md (${s.lines}줄)
      </span>`).join('');

    container.innerHTML = `
      <div class="harness-grid">
        <div>
          <div class="panel-box">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;gap:8px;flex-wrap:wrap;">
              <h4 style="margin:0;">🔍 Mechanical Fast Gate Linter (실제 코드베이스 검사)</h4>
              <button class="btn-sm btn-primary" onclick="window.VF.refreshHarness()">🔍 지금 코드베이스 린터/Stop Hook 재검사</button>
            </div>
            <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:10px;">
              <div class="dept-status"><strong>index.html</strong><br/>${m.indexLines || 0}줄 (한계 150줄)</div>
              <div class="dept-status"><strong>모듈 컴포넌트</strong><br/>${m.componentsCount || 0}개 파일</div>
              <div class="dept-status"><strong>테마 모드</strong><br/>${esc(m.themeMode || 'UNKNOWN')}</div>
            </div>
            ${checksHtml}
          </div>
          <div class="panel-box">
            <h4>🪝 라이프사이클 훅 & Fresh-Context Handoff 엔진</h4>
            ${hooksHtml}
          </div>
        </div>

        <div>
          <div class="panel-box">
            <h4>📘 15개 전문 부서 On-Demand Skills (.harness/skills/*.md)</h4>
            <div class="filter-pills" style="margin-bottom:10px;">${skillPills}</div>
            ${activeSkill ? `
              <div style="font-size:11.5px;color:var(--muted);margin-bottom:6px;">
                파일 경로: <code>${esc(activeSkill.path)}</code> · ${activeSkill.bytes} bytes
              </div>
              <div class="skill-viewer">${esc(activeSkill.content)}</div>
            ` : ''}
          </div>
        </div>
      </div>`;
  };
})();
