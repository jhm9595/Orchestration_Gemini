window.VF = window.VF || {};

(function () {
  const ACTION_LABELS = {
    COMPLETE: { text: '✅ 완료', cls: 'badge-codex' },
    INTAKE: { text: '🚀 접수', cls: 'badge-gemini' },
    REJECT: { text: '🔄 수정 요청', cls: 'badge-blocked' },
    STOP_HOOK_BLOCK: { text: '🛑 검문 차단', cls: 'badge-blocked' },
    BLOCKED: { text: '🚨 한계 도달', cls: 'badge-blocked' },
    STEER: { text: '👤 지시 반송', cls: 'badge-amber' },
    APPROVE: { text: '👤 강제 승인', cls: 'badge-codex' },
    COMMENT: { text: '💬 메모', cls: 'badge-gemini' },
    FEEDBACK_SPAWN: { text: '🎧 피드백 파생', cls: 'badge-amber' },
    SPAWNED: { text: '🌱 파생 착수', cls: 'badge-gemini' },
    READY: { text: '🟢 운영 대기', cls: 'badge-codex' },
  };

  window.VF.renderCardDetailModal = function (detail, state, modalTab, logFilter, esc) {
    const { card, parentCard, childCards, history } = detail;
    const proj = state.projects.find((p) => p.id === card.project_id) || {};
    const deptMap = Object.fromEntries(state.departments.map((d) => [d.key, d]));

    document.getElementById('dTitle').textContent = `#${card.id} ${card.title}`;
    document.getElementById('dMeta').textContent = `${proj.name || ''} · 🌏 ${proj.locales || ''} · 💰 ${proj.monetization || ''} · Round ${card.retry_count + 1}/${card.max_retries}`;

    document.querySelectorAll('.m-tab-btn').forEach((b) => b.classList.toggle('active', b.dataset.mtab === modalTab));
    ['timeline', 'routing', 'harness_logs'].forEach((t) => {
      document.getElementById('mtab-' + t).classList.toggle('hidden', t !== modalTab);
    });

    // Tab 1: Human-Friendly Compact Ping-Pong Timeline & CS Feedback
    const linBox = document.getElementById('dLineageBox');
    if (parentCard || childCards.length) {
      linBox.classList.remove('hidden');
      linBox.innerHTML = `<h4>🔗 작업 가계도 (Lineage)</h4>` +
        (parentCard ? `<div style="margin-bottom:4px;">⬆️ 원본: <a href="#" style="color:var(--accent);" onclick="window.VF.openCardDetail(${parentCard.id});return false;">#${parentCard.id} ${esc(parentCard.title)}</a></div>` : '') +
        childCards.map((ch) => `<div>⬇️ 파생 개선: <a href="#" style="color:var(--green);" onclick="window.VF.openCardDetail(${ch.id});return false;">#${ch.id} ${esc(ch.title)}</a></div>`).join('');
    } else {
      linBox.classList.add('hidden');
    }

    document.getElementById('dHistory').innerHTML = history.length
      ? history.map((h) => {
          const isRej = ['REJECT', 'BLOCKED', 'STOP_HOOK_BLOCK'].includes(h.action);
          const act = ACTION_LABELS[h.action] || { text: h.action, cls: 'badge-gemini' };
          const meta = h.harness_meta || {};
          const files = meta.changedFiles || [];
          const durStr = meta.durationMs ? `⚡ ${(meta.durationMs / 1000).toFixed(1)}s` : '';
          const cliTag = meta.realCli ? '실제 CLI' : '요약';
          const cls = isRej ? 'reject' : (h.engine === 'Codex' ? 'codex' : '');

          return `
            <div class="compact-event ${cls}">
              <div class="event-head">
                <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;">
                  <strong>${esc(h.dept_name)}</strong>
                  <span class="badge ${act.cls}">${act.text}</span>
                  <span class="sub-pill">R${h.round} · ${esc(h.engine)} (${cliTag})</span>
                  ${durStr ? `<span class="sub-pill">${durStr}</span>` : ''}
                </div>
                <span style="color:var(--muted);">${esc(h.created_at.slice(11, 19))}</span>
              </div>
              <div class="event-title">${esc(h.summary)}</div>
              ${files.length ? `<div class="event-files">${files.map((f) => `<span class="file-chip">📄 ${esc(f)}</span>`).join('')}</div>` : ''}
              <details class="event-details" ${isRej ? 'open' : ''}>
                <summary>상세 내역 펼치기 (#${esc(h.commit_hash)})</summary>
                <div class="hist-det" style="margin-top:5px;">${esc(h.details)}</div>
              </details>
            </div>`;
        }).join('')
      : '<div style="color:var(--muted);font-size:12px;">아직 실행 이력이 없습니다. 우측 상단 [▶️ 이 카드 1스텝 진행]을 눌러보세요.</div>';

    // Tab 2: 15-Dept Routing & Human Steering
    document.getElementById('dSpec').textContent = card.spec;
    document.getElementById('dRouteList').innerHTML = card.route_depts.map((k) => {
      const d = deptMap[k];
      const isDone = card.completed_depts.includes(k);
      const isCurr = card.current_dept === k && !isDone;
      return `<div class="route-item ${isDone ? 'done' : isCurr ? 'curr' : ''}">
        <span>${esc(d ? d.name : k)} <small style="color:var(--muted);">(${esc(d ? d.engine : '')})</small></span>
        <span>${isDone ? '✅ 완료' : isCurr ? '🔄 진행중' : '⏳ 대기'}</span>
      </div>`;
    }).join('');

    // Tab 3: Compact Harness Logs & Filtered Terminal Stream
    const harnessRows = history.filter((h) => h.harness_meta && Object.keys(h.harness_meta).length > 0);
    document.getElementById('dHarnessHistory').innerHTML = harnessRows.length
      ? harnessRows.map((h) => {
          const m = h.harness_meta || {};
          const issues = (m.linterIssues || []).map((i) => `<div style="color:#b91c1c;margin-top:4px;">• <strong>${esc(i.code)}</strong>: ${esc(i.message)}<br/>&nbsp;&nbsp;<em>${esc(i.hint)}</em></div>`).join('');
          return `
            <div class="compact-event ${h.action === 'STOP_HOOK_BLOCK' ? 'reject' : ''}">
              <div class="event-head">
                <strong>R${h.round} · ${esc(h.dept_name)} (${esc(h.action)})</strong>
                <div style="display:flex;gap:5px;flex-wrap:wrap;">
                  ${m.realCli ? '<span class="badge badge-codex">⚡ 실제 CLI</span>' : ''}
                  ${m.durationMs ? `<span class="sub-pill">${(m.durationMs / 1000).toFixed(1)}s</span>` : ''}
                  <span class="sub-pill">${esc(m.skillLoaded || '-')}</span>
                </div>
              </div>
              <div style="font-size:11.5px;color:#334155;">
                ${m.preHook ? `<div>🪝 ${esc(m.preHook)}</div>` : ''}
                ${m.stopHook ? `<div style="color:${h.action === 'STOP_HOOK_BLOCK' ? '#b91c1c' : '#065f46'};">🛑 ${esc(m.stopHook)}</div>` : ''}
              </div>
              ${issues}
              ${m.handoffPreview ? `<details class="event-details"><summary>📦 Fresh-Context Handoff 주입 내용 보기</summary><div class="term-box" style="margin-top:5px;">${esc(m.handoffPreview)}</div></details>` : ''}
            </div>`;
        }).join('')
      : '<div class="panel-box" style="color:var(--muted);">아직 기록된 하네스 로그가 없습니다.</div>';

    const term = document.getElementById('dTerminal');
    if (term) {
      const logs = state.engineState.terminalLogs || [];
      const shown = logFilter === 'summary'
        ? logs.filter((l) => /\[(DONE|IDEA INTAKE|PING-PONG|STOP HOOK BLOCK|CIRCUIT BREAKER|CS FEEDBACK|PING RESULT|CONTROL)\]/.test(l))
        : logs;
      term.textContent = shown.join('\n') || '(표시할 로그가 없습니다)';
      term.scrollTop = term.scrollHeight;
    }
  };
})();
