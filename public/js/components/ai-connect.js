window.VF = window.VF || {};

(function () {
  window.VF.renderAiConnect = function (aiData, pingResults, esc) {
    const container = document.getElementById('tab-ai_connect');
    if (!container) return;
    if (!aiData) {
      container.innerHTML = '<div class="panel-box">로컬 AI CLI 환경 감지 중...</div>';
      return;
    }

    const { detected, config, departments } = aiData;
    const providers = config?.providers || {};
    const deptEngines = config?.deptEngines || {};
    const geminiBridgeOn = providers?.Gemini?.autoBridge !== false;

    const detectedCards = (detected || []).map((cli) => {
      let okBadge = '<span class="badge">미설치</span>';
      if (cli.installed && cli.signedIn && !cli.warning) {
        okBadge = '<span class="badge badge-codex">✅ 연결 준비됨</span>';
      } else if (cli.installed && cli.warning) {
        okBadge = `<span class="badge badge-amber">${cli.id === 'Gemini' && geminiBridgeOn ? '⚠️ 티어 확인 · 브릿지 활성' : '⚠️ 로그인/티어 확인'}</span>`;
      } else if (cli.installed) {
        okBadge = '<span class="badge badge-amber">⚠️ 로그인 확인 필요</span>';
      }

      const ping = pingResults[cli.id];
      const canPing = ['Gemini', 'Codex', 'OpenCode'].includes(cli.id) && cli.installed;

      return `
        <div class="dept-card">
          <div class="dept-head">
            <span class="dept-name">${esc(cli.id)} (${esc(cli.cli)})</span>
            ${okBadge}
          </div>
          <div class="dept-desc">버전: <strong>${esc(cli.version)}</strong></div>
          <div class="dept-desc" style="word-break:break-all;">경로: <code>${esc(cli.path)}</code></div>
          <div class="dept-status">${esc(cli.authStatus)}</div>
          ${canPing ? `
            <div style="display:flex;gap:6px;margin-top:4px;">
              <button class="btn-sm btn-primary" style="flex:1;" onclick="window.VF.pingAiEngine('${esc(cli.id)}')">
                ${ping?.loading ? '⏳ 실제 CLI 호출 중...' : `⚡ ${esc(cli.id)} 연결 테스트 (Ping)`}
              </button>
            </div>
          ` : ''}
          ${ping && !ping.loading ? `
            <div class="ping-box ${ping.ok ? 'ok' : 'fail'}">
              <div><strong>${ping.ok ? (ping.bridged ? '✅ 브릿지 연결 성공' : '✅ 연결 성공') : '❌ 실패'}</strong> · ${(ping.durationMs / 1000).toFixed(1)}초</div>
              <div style="margin-top:3px;white-space:pre-wrap;">${esc(ping.output)}</div>
            </div>
          ` : ''}
        </div>`;
    }).join('');

    const hasGeminiOauthWarn = (detected || []).some((c) => c.id === 'Gemini' && c.warning);

    const providerForms = ['Gemini', 'Codex', 'Custom'].map((key) => {
      const p = providers[key] || { command: '', args: '', timeoutMs: 120000 };
      const bridgeToggleHtml = key === 'Gemini' ? `
        <div class="form-row" style="margin-top:8px;padding:8px 10px;border-radius:8px;background:#f8fafc;border:1px solid var(--border);">
          <label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-weight:600;color:var(--text);">
            <input type="checkbox" id="cfg-autobridge-Gemini" ${p.autoBridge !== false ? 'checked' : ''} style="width:auto;" />
            <span>🔄 Auto-Bridge (Codex CLI / OpenCode CLI 실시간 연동)</span>
          </label>
          <div style="font-size:11.5px;color:var(--muted);margin-top:3px;">
            <code>gemini</code> CLI가 Google 개인 무료 OAuth <code>IneligibleTierError</code> 또는 쿼터 제한(429)에 걸릴 경우, 검증된 로컬 <code>codex</code> 실전 CLI로 자동 전환하여 100% 실제 코드 작업을 중단 없이 수행합니다.
          </div>
        </div>` : '';

      return `
        <div class="panel-box">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
            <h4 style="margin:0;">⚙️ ${esc(key)} CLI 실행 설정</h4>
            <button class="btn-sm" onclick="window.VF.pingAiEngine('${esc(key)}')">⚡ Ping 테스트</button>
          </div>
          <div class="form-row">
            <label>실행 명령어 (예: gemini, codex, opencode, claude 등)</label>
            <input id="cfg-cmd-${esc(key)}" value="${esc(p.command)}" />
          </div>
          <div class="form-row">
            <label>비대화형(Headless) 실행 플래그</label>
            <textarea id="cfg-args-${esc(key)}" rows="2">${esc(p.args)}</textarea>
          </div>
          <div class="form-row">
            <label>타임아웃 (ms)</label>
            <input id="cfg-timeout-${esc(key)}" type="number" value="${esc(p.timeoutMs || 120000)}" />
          </div>
          ${bridgeToggleHtml}
        </div>`;
    }).join('');

    const deptMappingRows = (departments || []).map((d) => {
      const curr = deptEngines[d.key] || d.engine;
      return `
        <div class="check-row">
          <span><strong>${esc(d.name)}</strong> <span style="color:var(--muted);font-size:11px;">(${esc(d.hq)})</span></span>
          <select id="dept-eng-${esc(d.key)}" class="mode-select" style="padding:4px 8px;">
            <option value="Gemini" ${curr === 'Gemini' ? 'selected' : ''}>🔵 Gemini CLI</option>
            <option value="Codex" ${curr === 'Codex' ? 'selected' : ''}>🟢 Codex CLI</option>
            <option value="Custom" ${curr === 'Custom' ? 'selected' : ''}>🟣 Custom CLI (OpenCode/Claude 등)</option>
          </select>
        </div>`;
    }).join('');

    container.innerHTML = `
      <div class="panel-box" style="background:var(--accent-bg);border-color:#bfdbfe;">
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;">
          <div>
            <strong style="font-size:14px;">🚀 누구나 1분 만에 내 구독 AI 연결하기 (API 비용 0원 · 100% 실제 CLI 실행)</strong>
            <div style="font-size:12px;color:#1e3a8a;margin-top:2px;">
              1) 터미널에 <code>codex login</code> / <code>gemini</code> / <code>opencode auth login</code> 로그인 → 2) 아래 <strong>Ping 테스트</strong>로 실제 CLI 응답 확인 → 3) 칸반에서 <strong>1스텝 실행</strong> 클릭 시 실제 워크스페이스 파일을 수정·감사합니다.
            </div>
          </div>
          <button class="btn-sm" onclick="window.VF.refreshAiConfig()">🔄 CLI 상태 다시 감지</button>
        </div>
      </div>

      ${hasGeminiOauthWarn ? `
        <div class="panel-box" style="background:#fffbeb;border-color:#fde68a;margin-bottom:12px;">
          <strong style="color:#92400e;font-size:12.5px;">💡 Gemini CLI OAuth 티어 안내 (자동 감지됨)</strong>
          <div style="font-size:12px;color:#78350f;margin-top:3px;">
            현재 PC의 <code>~/.gemini/settings.json</code>이 <code>oauth-personal</code>로 설정되어 있어 Google Gemini CLI 0.40+에서 <code>IneligibleTierError</code>(무료 티어 개인 OAuth 지원 종료 → Antigravity 통합 안내) 또는 무료 API 쿼터 제한이 발생할 수 있습니다.
            <strong>해결 방법:</strong> 유료 <code>GEMINI_API_KEY</code>를 사용하거나, 아래 <strong>Auto-Bridge (Codex CLI 실시간 연동)</strong>를 켜두시면(기본 활성) 실패 시 즉시 로컬 <code>codex</code> 실제 CLI로 자동 전환되어 멈춤 없이 실제 작업이 진행됩니다.
          </div>
        </div>
      ` : ''}

      <h3 class="hq-title" style="margin:12px 0 8px;">🔍 1. 로컬 설치 CLI 자동 감지 &amp; 실시간 연결 테스트</h3>
      <div class="dept-grid" style="margin-bottom:16px;">${detectedCards}</div>

      <div class="harness-grid">
        <div>
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
            <h3 class="hq-title" style="margin:0;">🛠️ 2. 프로바이더별 CLI 명령어 커스텀</h3>
            <button class="btn-primary btn-sm" onclick="window.VF.saveAiConfig()">💾 모든 AI 설정 저장</button>
          </div>
          ${providerForms}
        </div>
        <div>
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
            <h3 class="hq-title" style="margin:0;">🏢 3. 15개 부서별 담당 AI 엔진 매핑</h3>
            <button class="btn-primary btn-sm" onclick="window.VF.saveAiConfig()">💾 부서 매핑 저장</button>
          </div>
          <div class="panel-box" style="max-height:520px;overflow-y:auto;">
            ${deptMappingRows}
          </div>
        </div>
      </div>`;
  };
})();
