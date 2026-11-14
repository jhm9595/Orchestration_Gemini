window.VF = window.VF || {};

(function () {
  let appState = null;
  let harnessData = null;
  let selectedProjectId = 0;
  let boardMode = 'columns';
  let activeTab = 'kanban';
  let modalTab = 'timeline';
  let selectedSkillKey = 'ui';
  let currentCardId = null;

  function esc(str) {
    return String(str ?? '')
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  async function fetchState() {
    const res = await fetch('/api/state');
    appState = await res.json();
    renderAll();
  }

  async function refreshHarness() {
    const res = await fetch('/api/harness');
    harnessData = await res.json();
    if (activeTab === 'harness') window.VF.renderHarness(harnessData, selectedSkillKey, esc);
  }

  function connectSse() {
    const es = new EventSource('/api/stream');
    es.onmessage = (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.type === 'state') {
        appState = msg.state;
        renderAll();
        if (currentCardId && !document.getElementById('detailModal').classList.contains('hidden')) {
          loadCardDetail(currentCardId);
        }
      } else if (msg.type === 'log' && appState) {
        appState.engineState.terminalLogs.push(msg.line);
        if (appState.engineState.terminalLogs.length > 90) appState.engineState.terminalLogs.shift();
        const term = document.getElementById('dTerminal');
        if (term) {
          term.textContent = appState.engineState.terminalLogs.join('\n');
          term.scrollTop = term.scrollHeight;
        }
      }
    };
  }

  function renderAll() {
    if (!appState) return;
    const es = appState.engineState;
    const btn = document.getElementById('btnToggleListener');
    btn.textContent = es.listenerRunning ? '🟢 자동 리스너 가동 중' : '⏸️ 리스너 일시정지됨';
    btn.className = es.listenerRunning ? 'btn-green' : 'btn-amber';
    document.getElementById('execModeSelect').value = es.execMode;
    document.getElementById('lastActionText').textContent = es.lastAction;
    document.getElementById('tickCountText').textContent = es.tickCount;
    document.getElementById('lanUrlCode').textContent = `http://${appState.lanIp}:${appState.port}`;

    window.VF.renderProjectFilterBar(appState, selectedProjectId, boardMode, esc);
    window.VF.renderKanban(appState, selectedProjectId, boardMode, esc);
    window.VF.renderWorkforce(appState, esc);
    window.VF.renderPortfolio(appState, esc);
    if (harnessData && activeTab === 'harness') {
      window.VF.renderHarness(harnessData, selectedSkillKey, esc);
    }
  }

  function switchTab(tab) {
    activeTab = tab;
    document.querySelectorAll('.tab-btn').forEach((b) => b.classList.toggle('active', b.dataset.tab === tab));
    ['kanban', 'workforce', 'portfolio', 'harness'].forEach((t) => {
      document.getElementById('tab-' + t).classList.toggle('hidden', t !== tab);
    });
    document.getElementById('kanbanSubBar').classList.toggle('hidden', tab !== 'kanban');
    if (tab === 'harness') refreshHarness();
  }

  function switchModalTab(mtab) {
    modalTab = mtab;
    if (currentCardId) loadCardDetail(currentCardId);
  }

  async function openCardDetail(id) {
    currentCardId = id;
    await loadCardDetail(id);
    document.getElementById('detailModal').classList.remove('hidden');
  }

  async function loadCardDetail(id) {
    const res = await fetch(`/api/cards/${id}/history`);
    if (!res.ok) return;
    const detail = await res.json();
    window.VF.renderCardDetailModal(detail, appState, modalTab, esc);
  }

  function openIdeaModal(projId = '') {
    const sel = document.getElementById('ideaProjectId');
    sel.innerHTML = `<option value="">+ 새 프로젝트로 시작하기</option>` +
      appState.projects.map((p) => `<option value="${p.id}">${esc(p.name)}</option>`).join('');
    sel.value = projId ? String(projId) : '';
    toggleNewProjectFields();
    document.getElementById('ideaModal').classList.remove('hidden');
  }

  function toggleNewProjectFields() {
    const isNew = !document.getElementById('ideaProjectId').value;
    document.getElementById('newProjFields').classList.toggle('hidden', !isNew);
  }

  function closeModal(id) { document.getElementById(id).classList.add('hidden'); }

  async function toggleListener() {
    await fetch('/api/listener/toggle', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ toggleRunning: true }) });
  }
  async function changeExecMode(mode) {
    await fetch('/api/listener/toggle', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ execMode: mode }) });
  }
  async function stepOnce() {
    await fetch('/api/listener/step', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
  }
  async function stepCardOnce() {
    if (!currentCardId) return;
    await fetch('/api/listener/step', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ cardId: currentCardId }) });
  }

  async function createIdea() {
    const payload = {
      projectId: document.getElementById('ideaProjectId').value || undefined,
      projectName: document.getElementById('ideaProjName').value,
      category: document.getElementById('ideaCategory').value,
      locales: document.getElementById('ideaLocales').value,
      monetization: document.getElementById('ideaMonetization').value,
      color: document.getElementById('ideaColor').value,
      title: document.getElementById('ideaTitle').value,
      spec: document.getElementById('ideaSpec').value,
    };
    const res = await fetch('/api/ideas', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    if (res.ok) {
      closeModal('ideaModal');
      document.getElementById('ideaTitle').value = '';
      document.getElementById('ideaSpec').value = '';
    }
  }

  async function setProjectColor(pid, color) {
    await fetch(`/api/projects/${pid}/color`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ color }) });
  }

  async function steerCard(action) {
    if (!currentCardId) return;
    const comment = document.getElementById('steerComment').value;
    await fetch(`/api/cards/${currentCardId}/steer`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, comment }),
    });
    document.getElementById('steerComment').value = '';
    await loadCardDetail(currentCardId);
  }

  async function submitCsFeedback() {
    if (!currentCardId) return;
    const feedback = document.getElementById('csFeedbackInput').value;
    const res = await fetch(`/api/cards/${currentCardId}/feedback`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ feedback }),
    });
    if (res.ok) {
      const data = await res.json();
      await loadCardDetail(currentCardId);
      alert(`🎧 고객센터 접수 완료! 개선 카드 #${data.childId}가 생성되어 개발 파이프라인으로 자동 투입되었습니다.`);
    }
  }

  window.VF.setFilter = (pid) => { selectedProjectId = pid; renderAll(); };
  window.VF.setBoardMode = (mode) => { boardMode = mode; renderAll(); };
  window.VF.switchTab = switchTab;
  window.VF.switchModalTab = switchModalTab;
  window.VF.openCardDetail = openCardDetail;
  window.VF.openIdeaModal = openIdeaModal;
  window.VF.toggleNewProjectFields = toggleNewProjectFields;
  window.VF.openRemoteModal = () => document.getElementById('remoteModal').classList.remove('hidden');
  window.VF.closeModal = closeModal;
  window.VF.toggleListener = toggleListener;
  window.VF.changeExecMode = changeExecMode;
  window.VF.stepOnce = stepOnce;
  window.VF.stepCardOnce = stepCardOnce;
  window.VF.createIdea = createIdea;
  window.VF.setProjectColor = setProjectColor;
  window.VF.steerCard = steerCard;
  window.VF.submitCsFeedback = submitCsFeedback;
  window.VF.refreshHarness = refreshHarness;
  window.VF.selectHarnessSkill = (key) => {
    selectedSkillKey = key;
    if (harnessData) window.VF.renderHarness(harnessData, selectedSkillKey, esc);
  };
  window.VF.openSkillFromWorkforce = (key) => {
    selectedSkillKey = key;
    switchTab('harness');
  };

  fetchState().then(connectSse);
})();
