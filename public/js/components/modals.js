window.VF = window.VF || {};

(function () {
  window.VF.renderCardDetailModal = function (detail, state, modalTab, esc) {
    const { card, parentCard, childCards, history } = detail;
    const proj = state.projects.find((p) => p.id === card.project_id) || {};
    const deptMap = Object.fromEntries(state.departments.map((d) => [d.key, d]));

    document.getElementById('dTitle').textContent = `#${card.id} ${card.title}`;
    document.getElementById('dMeta').textContent = `${proj.name || ''} · 🌏 ${proj.locales || ''} · 💰 ${proj.monetization || ''} · Round ${card.retry_count + 1}/${card.max_retries}`;

    // Tab buttons active state
    document.querySelectorAll('.m-tab-btn').forEach((b) => b.classList.toggle('active', b.dataset.mtab === modalTab));
    ['timeline', 'routing', 'harness_logs'].forEach((t) => {
      document.getElementById('mtab-' + t).classList.toggle('hidden', t !== modalTab);
    });

    // Tab 1: Timeline + Lineage + CS Feedback
    const linBox = document.getElementById('dLineageBox');
    if (parentCard || childCards.length) {
      linBox.classList.remove('hidden');
      linBox.innerHTML = `<h4>🔗 작업 가계도 (Lineage)</h4>` +
        (parentCard ? `<div style="margin-bottom:4px;">⬆️ 원본 카드: <a href="#" style="color:var(--accent);" onclick="window.VF.openCardDetail(${parentCard.id});return false;">#${parentCard.id} ${esc(parentCard.title)}</a></div>` : '') +
        childCards.map((ch) => `<div>⬇️ 파생 개선 카드: <a href="#" style="color:var(--green);" onclick="window.VF.openCardDetail(${ch.id});return false;">#${ch.id} ${esc(ch.title)}</a></div>`).join('');
    } else {
      linBox.classList.add('hidden');
    }

    document.getElementById('dHistory').innerHTML = history.map((h) => {
      const isRej = h.action === 'REJECT' || h.action === 'BLOCKED' || h.action === 'STOP_HOOK_BLOCK';
      const cls = isRej ? 'reject' : (h.engine === 'Codex' ? 'codex' : '');
      return `
        <div class="hist-item ${cls}">
          <div class="hist-meta">
            <strong>${esc(h.dept_name)}</strong>
            <span>[${esc(h.engine)}]</span>
            <span>Round ${h.round}</span>
            <span>#${esc(h.commit_hash)}</span>
            <span>${esc(h.created_at.slice(11, 19))}</span>
          </div>
          <div class="hist-sum">${esc(h.summary)}</div>
          <div class="hist-det">${esc(h.details)}</div>
        </div>`;
    }).join('');

    // Tab 2: Spec + 15 Dept Route + Human Steering
    document.getElementById('dSpec').textContent = card.spec;
    document.getElementById('dRouteList').innerHTML = card.route_depts.map((k) => {
      const d = deptMap[k];
      const isDone = card.completed_depts.includes(k);
      const isCurr = card.current_dept === k && !isDone;
      return `<div class="route-item ${isDone ? 'done' : isCurr ? 'curr' : ''}">
        <span>${esc(d ? d.name : k)}</span>
        <span>${isDone ? '✅ 완료' : isCurr ? '🔄 진행중' : '⏳ 대기'}</span>
      </div>`;
    }).join('');

    // Tab 3: Harness Handoff, Linter & Stop Hook Logs
    const harnessRows = history.filter((h) => h.harness_meta && Object.keys(h.harness_meta).length > 0);
    document.getElementById('dHarnessHistory').innerHTML = harnessRows.length
      ? harnessRows.map((h) => {
          const m = h.harness_meta || {};
          const issues = (m.linterIssues || []).map((i) => `<div style="color:#b91c1c;margin-top:4px;">• <strong>${esc(i.code)}</strong>: ${esc(i.message)}<br/>&nbsp;&nbsp;<em>${esc(i.hint)}</em></div>`).join('');
          return `
            <div class="panel-box">
              <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
                <strong>R${h.round} · ${esc(h.dept_name)} (${esc(h.action)})</strong>
                <span class="sub-pill">Skill: ${esc(m.skillLoaded || '-')}</span>
              </div>
              ${m.preHook ? `<div style="font-size:11.5px;color:#334155;">🪝 <strong>PreHook:</strong> ${esc(m.preHook)}</div>` : ''}
              ${m.postHook ? `<div style="font-size:11.5px;color:#334155;">🪝 <strong>PostHook:</strong> ${esc(m.postHook)}</div>` : ''}
              ${m.stopHook ? `<div style="font-size:11.5px;color:${h.action === 'STOP_HOOK_BLOCK' ? '#b91c1c' : '#065f46'};margin-top:3px;">🛑 <strong>StopHook:</strong> ${esc(m.stopHook)}</div>` : ''}
              ${issues}
              ${m.handoffPreview ? `<details style="margin-top:6px;"><summary style="cursor:pointer;font-size:11.5px;color:var(--accent);">📦 Fresh-Context Handoff 패킷 보기</summary><div class="term-box" style="margin-top:6px;">${esc(m.handoffPreview)}</div></details>` : ''}
            </div>`;
        }).join('')
      : '<div class="panel-box" style="color:var(--muted);">아직 기록된 하네스 메타 로그가 없습니다. [▶️ 이 카드 1스텝 진행]을 눌러보세요.</div>';

    const term = document.getElementById('dTerminal');
    if (term) {
      term.textContent = state.engineState.terminalLogs.join('\n');
      term.scrollTop = term.scrollHeight;
    }
  };
})();
