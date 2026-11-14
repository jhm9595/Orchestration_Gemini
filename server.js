const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { DatabaseSync } = require('node:sqlite');

const { ensureSkillFiles, loadSkillForDept, saveSkillFile, listSkillFiles } = require('./.harness/skills-bundle');
const { runMechanicalFastGate } = require('./.harness/linters/fast-gate');
const { preToolUseHook, postToolUseHook, stopVerifierHook } = require('./.harness/hooks/lifecycle-hooks');
const { assembleHandoffPacket } = require('./.harness/handoff');
const { detectInstalledClis, testCliConnection, runDepartmentCli } = require('./.harness/cli-runner');

const PORT = Number(process.env.PORT || 3030);
const WORKSPACE_ROOT = __dirname;
const DB_PATH = path.join(WORKSPACE_ROOT, 'harness_factory.sqlite');
const PUBLIC_DIR = path.join(WORKSPACE_ROOT, 'public');
const AGENTS_MD_PATH = path.join(WORKSPACE_ROOT, 'AGENTS.md');
const AI_CONFIG_PATH = path.join(WORKSPACE_ROOT, '.harness', 'ai-config.json');
const WORKSPACES_DIR = path.join(WORKSPACE_ROOT, 'workspaces');
const PROJECT_PALETTE = ['indigo', 'emerald', 'amber', 'rose', 'violet', 'cyan'];

ensureSkillFiles();

// ---------------------------------------------------------------------------
// 1. 15-Department Registry & Stages
// ---------------------------------------------------------------------------
const STAGES = [
  { key: 'ideation', label: '💡 1. 기획·디자인' },
  { key: 'engineering', label: '🛠️ 2. 코어 개발·앱·🌏다국어' },
  { key: 'monetization', label: '💰 3. 광고·결제 수익화' },
  { key: 'qa_security', label: '🔒 4. Fast Gate·Codex 보안감사' },
  { key: 'launch_growth', label: '🚀 5. 배포·글로벌 마케팅' },
  { key: 'feedback_done', label: '🎧 6. 출시완료·CS 피드백루프' },
];

const DEPARTMENTS = [
  { key: 'ceo', order: 0, name: '👑 0. 총괄 디렉터', engine: 'Gemini', stage: 'ideation', hq: '제1본부: 기획·디자인', desc: '아이디어 분석, 15개 부서 동적 라우팅, 우선순위 조율' },
  { key: 'pm', order: 1, name: '📋 1. 기획 / PM', engine: 'Gemini', stage: 'ideation', hq: '제1본부: 기획·디자인', desc: 'PRD, 경쟁 분석, 기계적 합격 기준(DoD) 정의' },
  { key: 'ui', order: 2, name: '🎨 2. UI/UX 디자인', engine: 'Gemini', stage: 'ideation', hq: '제1본부: 기획·디자인', desc: '에디토리얼 라이트 토큰, 프로젝트 컬러 존, 반응형 규격' },
  { key: 'db', order: 3, name: '🗄️ 3. DB 아키텍트', engine: 'Gemini', stage: 'engineering', hq: '제2본부: 코어 개발·현지화', desc: 'SQLite WAL 스키마 설계, 인덱스, Up/Down 마이그레이션' },
  { key: 'be', order: 4, name: '⚙️ 4. BE / 자동화 개발', engine: 'Gemini', stage: 'engineering', hq: '제2본부: 코어 개발·현지화', desc: 'API, 크롤러/쇼츠 봇, 결제 웹훅, 비즈니스 로직' },
  { key: 'fe', order: 5, name: '💻 5. FE / 클라이언트', engine: 'Gemini', stage: 'engineering', hq: '제2본부: 코어 개발·현지화', desc: '모듈형 웹/게임 컴포넌트 분리, 상태관리, API 연동' },
  { key: 'app', order: 6, name: '📱 6. 앱 변환 패키징', engine: 'Gemini', stage: 'engineering', hq: '제2본부: 코어 개발·현지화', desc: 'Capacitor/Flutter/Tauri 기반 iOS·Android·PC 패키징' },
  { key: 'i18n', order: 7, name: '🌏 7. 다국어 / 글로벌 현지화', engine: 'Gemini', stage: 'engineering', hq: '제2본부: 코어 개발·현지화', desc: '다국어 번역 팩, 통화/타임존/RTL 변환, UI 오버플로우 방지' },
  { key: 'biz', order: 8, name: '💰 8. 광고 & 결제 수익화', engine: 'Gemini', stage: 'monetization', hq: '제3본부: 수익화·보안·심사', desc: 'AdSense/AdMob, Stripe/토스/인앱결제, 제휴링크 연동' },
  { key: 'sec', order: 9, name: '🔒 9. 보안 & QA 감사', engine: 'Codex', stage: 'qa_security', hq: '제3본부: 수익화·보안·심사', desc: 'Fast Gate(시크릿/린터/슬롭스쿼팅) + E2E·OWASP·치팅 감사' },
  { key: 'law', order: 10, name: '⚖️ 10. 약관 & 스토어 심사', engine: 'Codex', stage: 'qa_security', hq: '제3본부: 수익화·보안·심사', desc: '개인정보처리방침, 이용약관, 스토어 리젝 사유 사전 검열' },
  { key: 'inf', order: 11, name: '☁️ 11. 인프라 & 배포', engine: 'Gemini', stage: 'launch_growth', hq: '제4본부: 인프라·마케팅·CS', desc: '도메인/SSL, 클라우드 배포, 무료 터널링, 크론 스케줄러' },
  { key: 'ana', order: 12, name: '📊 12. 데이터 & 에러 추적', engine: 'Gemini', stage: 'launch_growth', hq: '제4본부: 인프라·마케팅·CS', desc: 'GA4 전환 퍼널, 실시간 에러 수집기 웹훅 장착' },
  { key: 'mkt', order: 13, name: '📣 13. 마케팅 & SNS 홍보', engine: 'Gemini', stage: 'launch_growth', hq: '제4본부: 인프라·마케팅·CS', desc: 'SEO 메타태그, 쇼츠/인스타/스레드/블로그 홍보 콘텐츠 생성' },
  { key: 'cs', order: 14, name: '🎧 14. 고객센터 & 피드백 루프', engine: 'Codex', stage: 'feedback_done', hq: '제4본부: 인프라·마케팅·CS', desc: '유저 불만·리뷰 분류 및 개발 개선 카드 자동 생성' },
];

const DEPT_MAP = Object.fromEntries(DEPARTMENTS.map((d) => [d.key, d]));

function defaultAiConfig() {
  const deptEngines = {};
  for (const d of DEPARTMENTS) deptEngines[d.key] = d.engine;
  return {
    providers: {
      Gemini: {
        command: 'gemini',
        args: '-p "Read the harness constitution, SKILL.md, and task in stdin carefully. Perform the work directly in the workspace and output SUMMARY, VERDICT (PASS or REJECT), CHANGED_FILES, and DETAILS." --yolo --skip-trust',
        timeoutMs: 120000,
        autoBridge: true,
      },
      Codex: {
        command: 'codex',
        args: 'exec - -s workspace-write --ephemeral --skip-git-repo-check',
        timeoutMs: 120000,
      },
      Custom: {
        command: 'claude',
        args: '-p --dangerously-skip-permissions',
        timeoutMs: 120000,
      },
    },
    deptEngines,
  };
}

function loadAiConfig() {
  const base = defaultAiConfig();
  if (!fs.existsSync(AI_CONFIG_PATH)) {
    fs.writeFileSync(AI_CONFIG_PATH, JSON.stringify(base, null, 2), 'utf8');
    return base;
  }
  try {
    const saved = JSON.parse(fs.readFileSync(AI_CONFIG_PATH, 'utf8'));
    return {
      providers: { ...base.providers, ...(saved.providers || {}) },
      deptEngines: { ...base.deptEngines, ...(saved.deptEngines || {}) },
    };
  } catch {
    return base;
  }
}

let aiConfig = loadAiConfig();

function saveAiConfig(nextCfg) {
  const base = loadAiConfig();
  aiConfig = {
    providers: { ...base.providers, ...(nextCfg.providers || {}) },
    deptEngines: { ...base.deptEngines, ...(nextCfg.deptEngines || {}) },
  };
  fs.writeFileSync(AI_CONFIG_PATH, JSON.stringify(aiConfig, null, 2), 'utf8');
  return aiConfig;
}

function routeDepartments(category, locales = 'KR, EN', monetization = 'AdSense') {
  const hasGlobal = locales.split(',').map((s) => s.trim()).filter(Boolean).length > 1 || /EN|JP|ES|CN|GLOBAL/i.test(locales);
  const templates = {
    web_saas: ['ceo', 'pm', 'ui', 'db', 'be', 'fe', 'i18n', 'biz', 'sec', 'law', 'inf', 'ana', 'mkt', 'cs'],
    mobile_game: ['ceo', 'pm', 'ui', 'fe', 'app', 'i18n', 'biz', 'sec', 'law', 'inf', 'ana', 'mkt', 'cs'],
    shorts_bot: ['ceo', 'pm', 'db', 'be', 'i18n', 'biz', 'sec', 'inf', 'ana', 'mkt', 'cs'],
    global_commerce: ['ceo', 'pm', 'ui', 'db', 'be', 'fe', 'i18n', 'biz', 'sec', 'law', 'inf', 'ana', 'mkt', 'cs'],
  };
  let selected = templates[category] || templates.web_saas;
  if (!hasGlobal) selected = selected.filter((k) => k !== 'i18n');
  if (!/없음|무료|내부/i.test(monetization) && !selected.includes('biz')) selected.push('biz');
  if (/내부|자체|Self/i.test(monetization)) selected = selected.filter((k) => k !== 'biz' && k !== 'law' && k !== 'mkt');
  const set = new Set(selected);
  return DEPARTMENTS.filter((d) => set.has(d.key)).map((d) => d.key);
}

// ---------------------------------------------------------------------------
// 2. SQLite (WAL Mode) Setup & Project Workspaces
// ---------------------------------------------------------------------------
const db = new DatabaseSync(DB_PATH);
db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;

  CREATE TABLE IF NOT EXISTS projects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    monetization TEXT NOT NULL,
    locales TEXT NOT NULL,
    color TEXT,
    workspace_path TEXT,
    status TEXT NOT NULL DEFAULT 'ACTIVE',
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS cards (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    spec TEXT NOT NULL,
    stage TEXT NOT NULL,
    current_dept TEXT NOT NULL,
    route_depts TEXT NOT NULL,
    completed_depts TEXT NOT NULL,
    retry_count INTEGER NOT NULL DEFAULT 0,
    max_retries INTEGER NOT NULL DEFAULT 3,
    assigned_engine TEXT NOT NULL DEFAULT 'Gemini',
    last_verdict TEXT NOT NULL DEFAULT 'PENDING',
    parent_card_id INTEGER,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (project_id) REFERENCES projects(id)
  );

  CREATE TABLE IF NOT EXISTS history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    card_id INTEGER NOT NULL,
    round INTEGER NOT NULL DEFAULT 1,
    dept_key TEXT NOT NULL,
    dept_name TEXT NOT NULL,
    engine TEXT NOT NULL,
    action TEXT NOT NULL,
    summary TEXT NOT NULL,
    details TEXT NOT NULL,
    commit_hash TEXT NOT NULL,
    harness_meta TEXT DEFAULT '{}',
    created_at TEXT NOT NULL,
    FOREIGN KEY (card_id) REFERENCES cards(id)
  );
`);

try { db.exec('ALTER TABLE projects ADD COLUMN color TEXT'); } catch {}
try { db.exec('ALTER TABLE projects ADD COLUMN workspace_path TEXT'); } catch {}
try { db.exec("ALTER TABLE history ADD COLUMN harness_meta TEXT DEFAULT '{}'"); } catch {}

function nowIso() {
  return new Date().toISOString();
}

function fakeHash(seed) {
  let h = 0x811c9dc5;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(7, '0').slice(0, 7);
}

function ensureProjectWorkspaces() {
  fs.mkdirSync(WORKSPACES_DIR, { recursive: true });
  const projs = db.prepare('SELECT * FROM projects ORDER BY id ASC').all();
  const updColor = db.prepare('UPDATE projects SET color = ? WHERE id = ?');
  const updWs = db.prepare('UPDATE projects SET workspace_path = ? WHERE id = ?');

  projs.forEach((p, idx) => {
    if (!p.color) updColor.run(PROJECT_PALETTE[idx % PROJECT_PALETTE.length], p.id);
    const isSelfHost = /Self-Hosted|관제탑/i.test(p.name);
    const targetWs = isSelfHost ? WORKSPACE_ROOT : path.join(WORKSPACES_DIR, `project-${p.id}`);
    if (p.workspace_path !== targetWs) updWs.run(targetWs, p.id);

    if (!isSelfHost) {
      fs.mkdirSync(targetWs, { recursive: true });
      const specPath = path.join(targetWs, 'PROJECT_SPEC.md');
      if (!fs.existsSync(specPath)) {
        fs.writeFileSync(
          specPath,
          `# ${p.name}\n\n- Category: ${p.category}\n- Locales: ${p.locales}\n- Monetization: ${p.monetization}\n- Created: ${p.created_at}\n`,
          'utf8'
        );
      }
    }
  });
}

function seedIfNeeded() {
  const count = db.prepare('SELECT COUNT(*) AS cnt FROM projects').get().cnt;
  if (count === 0) {
    const t = nowIso();
    const insProj = db.prepare(
      'INSERT INTO projects (name, category, monetization, locales, color, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
    );
    const p1 = insProj.run('🌐 글로벌 해외직구 AI 소싱 & 쇼츠 봇', 'global_commerce', '제휴마케팅 + Stripe Pro 구독', 'KR, EN, JP, ES', 'indigo', 'ACTIVE', t).lastInsertRowid;
    const p2 = insProj.run('🏠 [Self-Hosted] AI 벤처 팩토리 관제탑', 'web_saas', '내부 전용 하네스 관제탑', 'KR', 'violet', 'ACTIVE', t).lastInsertRowid;

    const insCard = db.prepare(
      `INSERT INTO cards (project_id, title, spec, stage, current_dept, route_depts, completed_depts, retry_count, max_retries, assigned_engine, last_verdict, parent_card_id, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );
    insCard.run(
      p1,
      '다국어 해외직구 마진계산기 MVP 스캐폴드',
      'KR/EN/JP/ES 환율 계산 모듈과 단위 테스트 파일을 생성하세요.',
      'ideation',
      'ceo',
      JSON.stringify(routeDepartments('global_commerce', 'KR, EN, JP, ES', 'Stripe')),
      '[]',
      0, 3, 'Gemini', 'PENDING', null, t
    );
    insCard.run(
      p2,
      '각종 문구 템플릿 변경',
      '핑퐁타임라인, 피드백, 로그 등이 인간 친화적인 템플릿으로 가독성좋게, 깔끔하게, 컴팩트하게 구성되어있으면 좋겠어.',
      'engineering',
      'fe',
      JSON.stringify(['ceo', 'pm', 'ui', 'fe', 'sec', 'inf', 'cs']),
      JSON.stringify(['ceo', 'pm', 'ui']),
      0, 3, 'Gemini', 'PENDING', null, t
    );
  }
  ensureProjectWorkspaces();
}

seedIfNeeded();

// ---------------------------------------------------------------------------
// 3. Engine State (Quota-Safe: real_cli by default, listener paused until started)
// ---------------------------------------------------------------------------
const engineState = {
  listenerRunning: false,
  execMode: 'real_cli', // 'real_cli' | 'simulation'
  tickCount: 0,
  lastAction: '실제 CLI 모드 준비 완료 (쿼터 보호를 위해 자동 반복은 대기 상태 · 1스텝 실행 또는 리스너 ON 가능)',
  terminalLogs: [
    `[${nowIso().slice(11, 19)}] [HARNESS] 15개 프로덕션 SKILL.md(YAML+SOP+체크리스트) 업그레이드 완료`,
    `[${nowIso().slice(11, 19)}] [CLI] 실제 Gemini / Codex CLI 러너 및 git/파일 변경 추적 활성화`,
    `[${nowIso().slice(11, 19)}] [SAFEGUARD] 구독 할당량 보호를 위해 자동 반복은 수동 대기 중입니다`,
  ],
};

const sseClients = new Set();

function pushLog(line) {
  const entry = `[${nowIso().slice(11, 19)}] ${line}`;
  engineState.terminalLogs.push(entry);
  if (engineState.terminalLogs.length > 120) engineState.terminalLogs.shift();
  broadcastSse({ type: 'log', line: entry });
}

function broadcastSse(payload) {
  const data = `data: ${JSON.stringify(payload)}\n\n`;
  for (const res of sseClients) {
    try { res.write(data); } catch { sseClients.delete(res); }
  }
}

function getLocalLanIp() {
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name] || []) {
      if (net.family === 'IPv4' && !net.internal) return net.address;
    }
  }
  return '127.0.0.1';
}

function getFullState() {
  const projects = db.prepare('SELECT * FROM projects ORDER BY id DESC').all();
  const cards = db.prepare('SELECT * FROM cards ORDER BY id DESC').all().map((c) => ({
    ...c,
    route_depts: JSON.parse(c.route_depts),
    completed_depts: JSON.parse(c.completed_depts),
  }));
  const deptCounts = db.prepare('SELECT dept_key, COUNT(*) AS cnt FROM history GROUP BY dept_key').all();
  const countMap = Object.fromEntries(deptCounts.map((r) => [r.dept_key, r.cnt]));
  return {
    projects,
    cards,
    stages: STAGES,
    departments: DEPARTMENTS.map((d) => ({
      ...d,
      engine: aiConfig.deptEngines[d.key] || d.engine,
      completedActions: countMap[d.key] || 0,
    })),
    engineState,
    aiConfig,
    lanIp: getLocalLanIp(),
    port: PORT,
  };
}

function broadcastFullState() {
  broadcastSse({ type: 'state', state: getFullState() });
}

function buildSimResult(card, dept, project, handoff) {
  const rnd = card.retry_count + 1;
  const summary = `[시뮬레이션 체험] ${dept.name} 단계 완료 (Round ${rnd})`;
  const details = `※ 현재 모드가 '시뮬레이션 데모'여서 실제 AI CLI를 호출하지 않았습니다.\n실제 코드 작성/검증을 수행하려면 상단 모드를 '⚡ 실제 Gemini/Codex CLI 호출'로 유지하세요.\n대상: ${project.name} / ${card.title}${handoff?.hasRemediation ? `\n반영 힌트: ${handoff.remediationSummary}` : ''}`;
  return { summary, details, changedFiles: [] };
}

let isTicking = false;

async function tickListener(forcedCardId = null) {
  if (isTicking) return { progressed: false, reason: '이미 다른 에이전트 스텝이 실행 중입니다.' };
  isTicking = true;
  try {
    const allCards = db.prepare('SELECT * FROM cards ORDER BY updated_at ASC, id ASC').all();
    const target = allCards.find((c) => {
      if (forcedCardId && c.id !== forcedCardId) return false;
      if (c.last_verdict === 'BLOCKED') return false;
      const route = JSON.parse(c.route_depts);
      const done = JSON.parse(c.completed_depts);
      return done.length < route.length;
    });

    if (!target) {
      engineState.lastAction = '대기 중인 작업 없음 (모든 카드 완료 또는 Blocked 상태)';
      return { progressed: false, reason: engineState.lastAction };
    }

    const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(target.project_id);
    const workspaceDir = project.workspace_path || WORKSPACE_ROOT;
    const route = JSON.parse(target.route_depts);
    const done = JSON.parse(target.completed_depts);
    const nextDeptKey = route.find((k) => !done.includes(k)) || target.current_dept;
    const dept = DEPT_MAP[nextDeptKey];
    const activeEngine = aiConfig.deptEngines[dept.key] || dept.engine;
    const round = target.retry_count + 1;
    const t = nowIso();

    const skill = loadSkillForDept(dept.key);
    const agentsMd = fs.existsSync(AGENTS_MD_PATH) ? fs.readFileSync(AGENTS_MD_PATH, 'utf8') : '';
    const historyRows = db.prepare('SELECT * FROM history WHERE card_id = ? ORDER BY id ASC').all(target.id);
    const handoff = assembleHandoffPacket({
      card: target,
      dept,
      project,
      workspaceDir,
      historyRows,
      skillContent: skill.content,
      agentsMdContent: agentsMd,
    });

    const preHook = preToolUseHook({ card: target, dept, skillContent: skill.content, handoffPacket: handoff });
    pushLog(`[${activeEngine}] #${target.id} "${target.title}" → ${dept.name} (R${round}) 착수`);

    if (!preHook.allowed) {
      return handleQaFailure(target, dept, activeEngine, round, preHook.hookLog, route, done, t, {
        skillLoaded: skill.path,
        preHook: preHook.hookLog,
        stopHook: 'PreToolUse 차단',
        linterIssues: [],
        handoffPreview: handoff.preview,
      }, 'STOP_HOOK_BLOCK');
    }

    let summary = '';
    let details = '';
    let changedFiles = [];
    let durationMs = 0;
    let rawCommand = '';
    let cliVerdict = 'PASS';

    if (engineState.execMode === 'real_cli') {
      const providerCfg = aiConfig.providers[activeEngine] || aiConfig.providers.Gemini;
      engineState.lastAction = `⚡ [${activeEngine} CLI 실제 실행 중] #${target.id} ${dept.name}...`;
      broadcastFullState();

      const cliRes = await runDepartmentCli({
        engine: activeEngine,
        providerConfig: providerCfg,
        promptText: handoff.prompt,
        workspaceDir,
        dept,
        onLine: (line) => pushLog(`[${activeEngine}] ${line.slice(0, 220)}`),
      });

      durationMs = cliRes.durationMs;
      changedFiles = cliRes.changedFiles || [];
      rawCommand = cliRes.rawCommand;
      cliVerdict = cliRes.verdict;

      if (!cliRes.ok) {
        const meta = {
          realCli: true,
          durationMs,
          rawCommand,
          changedFiles,
          skillLoaded: skill.path,
          preHook: preHook.hookLog,
          stopHook: 'CLI 실행 오류',
          handoffPreview: handoff.preview,
        };
        return handleQaFailure(target, dept, activeEngine, round, `${cliRes.summary}\n${cliRes.details}`, route, done, t, meta, 'REJECT');
      }

      summary = cliRes.summary;
      details = cliRes.details;
    } else {
      const sim = buildSimResult(target, dept, project, handoff);
      summary = sim.summary;
      details = sim.details;
    }

    const postHook = postToolUseHook({ card: target, dept, outputSummary: summary });
    const stopHook = stopVerifierHook({ card: target, dept, project, workspaceRoot: WORKSPACE_ROOT });

    const harnessMeta = {
      realCli: engineState.execMode === 'real_cli',
      durationMs,
      rawCommand,
      changedFiles,
      skillLoaded: skill.path,
      preHook: preHook.hookLog,
      postHook: postHook.hookLog,
      stopHook: stopHook.hookLog,
      linterIssues: stopHook.linter?.issues || [],
      handoffPreview: handoff.preview,
    };

    if (stopHook.blockedByStopHook) {
      pushLog(`[STOP HOOK BLOCK] #${target.id} ${dept.name} 완료 거부! Linter 위반 감지`);
      return handleQaFailure(target, dept, activeEngine, round, stopHook.linter.reason, route, done, t, harnessMeta, 'STOP_HOOK_BLOCK');
    }

    if ((dept.key === 'sec' || dept.key === 'law') && cliVerdict === 'REJECT') {
      pushLog(`[${activeEngine} AUDIT REJECT] #${target.id} 감사관 반려 판정!`);
      return handleQaFailure(target, dept, activeEngine, round, details, route, done, t, harnessMeta, 'REJECT');
    }

    const updatedDone = Array.from(new Set([...done, dept.key]));
    const upcomingKey = route.find((k) => !updatedDone.includes(k));
    const nextStage = upcomingKey ? DEPT_MAP[upcomingKey].stage : 'feedback_done';
    const nextDept = upcomingKey || 'cs';
    const nextEngine = upcomingKey ? (aiConfig.deptEngines[upcomingKey] || DEPT_MAP[upcomingKey].engine) : (aiConfig.deptEngines.cs || 'Codex');

    db.prepare(
      `UPDATE cards SET stage = ?, current_dept = ?, completed_depts = ?, assigned_engine = ?, last_verdict = 'PASS', updated_at = ? WHERE id = ?`
    ).run(nextStage, nextDept, JSON.stringify(updatedDone), nextEngine, t, target.id);

    db.prepare(
      `INSERT INTO history (card_id, round, dept_key, dept_name, engine, action, summary, details, commit_hash, harness_meta, created_at)
       VALUES (?, ?, ?, ?, ?, 'COMPLETE', ?, ?, ?, ?, ?)`
    ).run(target.id, round, dept.key, dept.name, activeEngine, summary, details, fakeHash(`${target.id}-${dept.key}-${round}-${t}`), JSON.stringify(harnessMeta), t);

    engineState.tickCount += 1;
    engineState.lastAction = `#${target.id} ${dept.name} (${activeEngine}) 완료${changedFiles.length ? ` · 파일 ${changedFiles.length}건 변경` : ''} → 다음: ${upcomingKey ? DEPT_MAP[upcomingKey].name : '🎉 전체 파이프라인 완료'}`;
    pushLog(`[DONE] ${engineState.lastAction}`);
    broadcastFullState();
    return { progressed: true, cardId: target.id, dept: dept.name, engine: activeEngine, durationMs, changedFiles, summary, stopHook };
  } finally {
    isTicking = false;
  }
}

function handleQaFailure(card, dept, activeEngine, round, reason, route, done, t, harnessMeta = {}, actionType = 'REJECT') {
  const nextRetry = card.retry_count + 1;
  if (nextRetry >= card.max_retries) {
    db.prepare(
      `UPDATE cards SET retry_count = ?, assigned_engine = 'Blocked', last_verdict = 'BLOCKED', updated_at = ? WHERE id = ?`
    ).run(nextRetry, t, card.id);
    db.prepare(
      `INSERT INTO history (card_id, round, dept_key, dept_name, engine, action, summary, details, commit_hash, harness_meta, created_at)
       VALUES (?, ?, ?, ?, ?, 'BLOCKED', ?, ?, ?, ?, ?)`
    ).run(card.id, round, dept.key, dept.name, activeEngine, `🚨 서킷 브레이커 발동 (${nextRetry}/${card.max_retries}회 실패)`, reason, fakeHash(`blk-${card.id}-${t}`), JSON.stringify(harnessMeta), t);
    engineState.lastAction = `🚨 #${card.id} 3회 실패로 Blocked (회장님 개입 필요)`;
    pushLog(`[CIRCUIT BREAKER] ${engineState.lastAction}`);
    broadcastFullState();
    return { progressed: true, blocked: true, cardId: card.id };
  }

  const reworkDept = ['fe', 'i18n', 'be', 'ui', 'db'].find((k) => route.includes(k)) || 'fe';
  const trimmedDone = done.filter((k) => DEPARTMENTS.findIndex((d) => d.key === k) < DEPARTMENTS.findIndex((d) => d.key === reworkDept));
  const reworkEngine = aiConfig.deptEngines[reworkDept] || DEPT_MAP[reworkDept].engine;

  db.prepare(
    `UPDATE cards SET stage = 'engineering', current_dept = ?, completed_depts = ?, retry_count = ?, assigned_engine = ?, last_verdict = 'FAIL', updated_at = ? WHERE id = ?`
  ).run(reworkDept, JSON.stringify(trimmedDone), nextRetry, reworkEngine, t, card.id);

  db.prepare(
    `INSERT INTO history (card_id, round, dept_key, dept_name, engine, action, summary, details, commit_hash, harness_meta, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(card.id, round, dept.key, dept.name, activeEngine, actionType, `❌ Round ${round} 반려 → ${DEPT_MAP[reworkDept].name}로 재수정 이관`, reason, fakeHash(`rej-${card.id}-${round}-${t}`), JSON.stringify(harnessMeta), t);

  engineState.tickCount += 1;
  engineState.lastAction = `🔄 #${card.id} 반려 → ${reworkEngine}(${DEPT_MAP[reworkDept].name}) 자동 수정 대기`;
  pushLog(`[PING-PONG] ${engineState.lastAction}`);
  broadcastFullState();
  return { progressed: true, rework: true, cardId: card.id };
}

setInterval(() => {
  if (engineState.listenerRunning) {
    tickListener().catch((e) => pushLog(`[ERROR] 리스너 오류: ${e.message}`));
  }
}, 5000);

// ---------------------------------------------------------------------------
// 4. HTTP Server & REST + SSE API
// ---------------------------------------------------------------------------
function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', (chunk) => {
      raw += chunk;
      if (raw.length > 1e6) reject(new Error('Body too large'));
    });
    req.on('end', () => {
      try { resolve(raw ? JSON.parse(raw) : {}); } catch (e) { reject(e); }
    });
  });
}

function sendJson(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(data));
}

const MIME_MAP = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
};

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = url.pathname;

  try {
    if (req.method === 'GET' && pathname === '/api/state') {
      return sendJson(res, 200, getFullState());
    }

    if (req.method === 'GET' && pathname === '/api/ai-config') {
      const detected = await detectInstalledClis();
      return sendJson(res, 200, { config: aiConfig, detected, departments: DEPARTMENTS });
    }

    if (req.method === 'POST' && pathname === '/api/ai-config') {
      const body = await readJsonBody(req);
      const updated = saveAiConfig(body);
      pushLog('[AI CONFIG] AI 엔진 연결 설정 및 부서별 매핑이 저장되었습니다.');
      broadcastFullState();
      return sendJson(res, 200, { ok: true, config: updated });
    }

    if (req.method === 'POST' && pathname === '/api/ai-config/test') {
      const body = await readJsonBody(req);
      const engine = body.engine || 'Gemini';
      const providerConfig = body.providerConfig || aiConfig.providers[engine];
      pushLog(`[PING TEST] ${engine} CLI 실제 연결 테스트 시작...`);
      const result = await testCliConnection({
        engine,
        providerConfig,
        workspaceDir: WORKSPACE_ROOT,
        onLine: (line) => pushLog(`[PING ${engine}] ${line}`),
      });
      pushLog(`[PING RESULT] ${engine}: ${result.ok ? '성공' : '실패'} (${result.durationMs}ms)`);
      return sendJson(res, 200, result);
    }

    if (req.method === 'GET' && pathname === '/api/harness') {
      const skills = listSkillFiles();
      const linter = runMechanicalFastGate(null, null, WORKSPACE_ROOT);
      const constitution = fs.existsSync(AGENTS_MD_PATH) ? fs.readFileSync(AGENTS_MD_PATH, 'utf8') : '';
      return sendJson(res, 200, {
        skills,
        linter,
        constitution,
        hooks: [
          { name: 'PreToolUse Hook', file: '.harness/hooks/lifecycle-hooks.js', desc: '실행 전 SKILL.md 로드 확인 + 위험 명령어/경로 방화벽' },
          { name: 'PostToolUse Hook', file: '.harness/hooks/lifecycle-hooks.js', desc: '산출물 비어있음 방지 및 구조화 검증' },
          { name: 'Stop Verifier Hook', file: '.harness/hooks/lifecycle-hooks.js', desc: 'ui/fe/i18n/sec 완료 선언 시 실제 파일 Linter 검문 후 미달 시 반려(Block)' },
          { name: 'Fresh-Context Handoff', file: '.harness/handoff.js', desc: '세션 초기화 시 AGENTS.md + SKILL.md + 이전 이력 + 반려 힌트 + 작업폴더 경로 주입' },
        ],
      });
    }

    const skillSaveMatch = pathname.match(/^\/api\/harness\/skills\/([a-z0-9_]+)$/);
    if (req.method === 'POST' && skillSaveMatch) {
      const key = skillSaveMatch[1];
      const body = await readJsonBody(req);
      const saved = saveSkillFile(key, body.content);
      pushLog(`[SKILL SAVED] ${saved.path} 저장 완료`);
      return sendJson(res, 200, { ok: true, skill: saved });
    }

    if (req.method === 'GET' && pathname === '/api/stream') {
      res.writeHead(200, {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      });
      res.write(`data: ${JSON.stringify({ type: 'state', state: getFullState() })}\n\n`);
      sseClients.add(res);
      req.on('close', () => sseClients.delete(res));
      return;
    }

    const histMatch = pathname.match(/^\/api\/cards\/(\d+)\/history$/);
    if (req.method === 'GET' && histMatch) {
      const id = Number(histMatch[1]);
      const card = db.prepare('SELECT * FROM cards WHERE id = ?').get(id);
      if (!card) return sendJson(res, 404, { error: 'Card not found' });
      const parentCard = card.parent_card_id ? db.prepare('SELECT id, title, stage FROM cards WHERE id = ?').get(card.parent_card_id) : null;
      const childCards = db.prepare('SELECT id, title, stage, current_dept FROM cards WHERE parent_card_id = ? ORDER BY id DESC').all(id);
      const history = db.prepare('SELECT * FROM history WHERE card_id = ? ORDER BY id ASC').all(id).map((h) => {
        let meta = {};
        try { meta = JSON.parse(h.harness_meta || '{}'); } catch {}
        return { ...h, harness_meta: meta };
      });
      return sendJson(res, 200, {
        card: { ...card, route_depts: JSON.parse(card.route_depts), completed_depts: JSON.parse(card.completed_depts) },
        parentCard,
        childCards,
        history,
      });
    }

    if (req.method === 'POST' && pathname === '/api/ideas') {
      const body = await readJsonBody(req);
      const t = nowIso();
      let projectId = Number(body.projectId || 0);
      let project;
      if (!projectId) {
        const name = (body.projectName || body.title || '새 AI 벤처 프로젝트').trim();
        const category = body.category || 'web_saas';
        const monetization = body.monetization || 'AdSense + Stripe 구독';
        const locales = body.locales || 'KR, EN, JP';
        const projCnt = db.prepare('SELECT COUNT(*) AS cnt FROM projects').get().cnt;
        const color = PROJECT_PALETTE.includes(body.color) ? body.color : PROJECT_PALETTE[projCnt % PROJECT_PALETTE.length];
        projectId = db.prepare(
          'INSERT INTO projects (name, category, monetization, locales, color, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
        ).run(name, category, monetization, locales, color, 'ACTIVE', t).lastInsertRowid;
        ensureProjectWorkspaces();
        project = db.prepare('SELECT * FROM projects WHERE id = ?').get(projectId);
      } else {
        project = db.prepare('SELECT * FROM projects WHERE id = ?').get(projectId);
      }

      if (!project) return sendJson(res, 400, { error: '유효하지 않은 프로젝트입니다.' });

      const title = (body.title || `${project.name} MVP 구축`).trim();
      const spec = (body.spec || `${title} - 다국어(${project.locales}), 수익화(${project.monetization}) 포함 자동 구축`).trim();
      const route = routeDepartments(project.category, project.locales, project.monetization);
      const firstEngine = aiConfig.deptEngines.ceo || 'Gemini';
      const cardId = db.prepare(
        `INSERT INTO cards (project_id, title, spec, stage, current_dept, route_depts, completed_depts, retry_count, max_retries, assigned_engine, last_verdict, parent_card_id, updated_at)
         VALUES (?, ?, ?, 'ideation', 'ceo', ?, '[]', 0, 3, ?, 'PENDING', NULL, ?)`
      ).run(projectId, title, spec, JSON.stringify(route), firstEngine, t).lastInsertRowid;

      db.prepare(
        `INSERT INTO history (card_id, round, dept_key, dept_name, engine, action, summary, details, commit_hash, harness_meta, created_at)
         VALUES (?, 1, 'ceo', '👑 0. 총괄 디렉터', ?, 'INTAKE', ?, ?, ?, ?, ?)`
      ).run(
        cardId,
        firstEngine,
        `새 아이디어 접수 → ${route.length}개 전문 부서 배정 완료`,
        `배정 루트: ${route.map((k) => DEPT_MAP[k].name).join(' → ')}\n작업 디렉터리: ${project.workspace_path || WORKSPACE_ROOT}`,
        fakeHash(`new-${cardId}-${t}`),
        JSON.stringify({ skillLoaded: '.harness/skills/ceo.md', preHook: '[PreToolUse PASS] 아이디어 접수 검증 완료' }),
        t
      );

      pushLog(`[IDEA INTAKE] 회장님 새 아이디어 #${cardId} "${title}" 등록 (${route.length}개 부서 대기)`);
      broadcastFullState();
      return sendJson(res, 201, { cardId, projectId, route });
    }

    const colorMatch = pathname.match(/^\/api\/projects\/(\d+)\/color$/);
    if (req.method === 'POST' && colorMatch) {
      const pid = Number(colorMatch[1]);
      const body = await readJsonBody(req);
      if (!PROJECT_PALETTE.includes(body.color)) return sendJson(res, 400, { error: 'Invalid palette color' });
      db.prepare('UPDATE projects SET color = ? WHERE id = ?').run(body.color, pid);
      broadcastFullState();
      return sendJson(res, 200, { ok: true });
    }

    if (req.method === 'POST' && pathname === '/api/listener/toggle') {
      const body = await readJsonBody(req);
      if (typeof body.listenerRunning === 'boolean') engineState.listenerRunning = body.listenerRunning;
      else if (body.toggleRunning) engineState.listenerRunning = !engineState.listenerRunning;
      if (body.execMode === 'simulation' || body.execMode === 'real_cli') engineState.execMode = body.execMode;
      engineState.lastAction = `리스너 ${engineState.listenerRunning ? '가동 중' : '대기 중'} · 실행 모드: ${engineState.execMode === 'real_cli' ? '⚡ 실제 CLI' : '🛡️ 시뮬레이션'}`;
      pushLog(`[CONTROL] ${engineState.lastAction}`);
      broadcastFullState();
      return sendJson(res, 200, engineState);
    }

    if (req.method === 'POST' && pathname === '/api/listener/step') {
      const body = await readJsonBody(req).catch(() => ({}));
      const result = await tickListener(body.cardId ? Number(body.cardId) : null);
      return sendJson(res, 200, result);
    }

    const steerMatch = pathname.match(/^\/api\/cards\/(\d+)\/steer$/);
    if (req.method === 'POST' && steerMatch) {
      const id = Number(steerMatch[1]);
      const body = await readJsonBody(req);
      const card = db.prepare('SELECT * FROM cards WHERE id = ?').get(id);
      if (!card) return sendJson(res, 404, { error: 'Card not found' });
      const t = nowIso();
      const route = JSON.parse(card.route_depts);
      const done = JSON.parse(card.completed_depts);

      if (body.action === 'send_back') {
        const targetDept = ['fe', 'be', 'i18n', 'ui'].find((k) => route.includes(k)) || route[0];
        const newDone = done.filter((k) => route.indexOf(k) < route.indexOf(targetDept));
        const eng = aiConfig.deptEngines[targetDept] || DEPT_MAP[targetDept].engine;
        db.prepare(
          `UPDATE cards SET stage = ?, current_dept = ?, completed_depts = ?, retry_count = 0, assigned_engine = ?, last_verdict = 'PENDING', updated_at = ? WHERE id = ?`
        ).run(DEPT_MAP[targetDept].stage, targetDept, JSON.stringify(newDone), eng, t, id);
        db.prepare(
          `INSERT INTO history (card_id, round, dept_key, dept_name, engine, action, summary, details, commit_hash, harness_meta, created_at)
           VALUES (?, ?, 'ceo', '👤 회장님(Human Steering)', 'Human', 'STEER', ?, ?, ?, '{}', ?)`
        ).run(id, card.retry_count + 1, `회장님 수정 지시 → ${DEPT_MAP[targetDept].name}로 재투입`, body.comment || '직접 수정 지시', fakeHash(`str-${id}-${t}`), t);
      } else if (body.action === 'force_approve') {
        const nextIdx = Math.min(done.length + 1, route.length);
        const newDone = route.slice(0, nextIdx);
        const nextDept = route[nextIdx] || 'cs';
        const nextStage = route[nextIdx] ? DEPT_MAP[nextDept].stage : 'feedback_done';
        const eng = aiConfig.deptEngines[nextDept] || DEPT_MAP[nextDept].engine;
        db.prepare(
          `UPDATE cards SET stage = ?, current_dept = ?, completed_depts = ?, retry_count = 0, assigned_engine = ?, last_verdict = 'PASS', updated_at = ? WHERE id = ?`
        ).run(nextStage, nextDept, JSON.stringify(newDone), eng, t, id);
        db.prepare(
          `INSERT INTO history (card_id, round, dept_key, dept_name, engine, action, summary, details, commit_hash, harness_meta, created_at)
           VALUES (?, ?, 'ceo', '👤 회장님(Human Steering)', 'Human', 'APPROVE', ?, ?, ?, '{}', ?)`
        ).run(id, card.retry_count + 1, `회장님 강제 승인 → ${DEPT_MAP[nextDept].name}`, body.comment || '수동 승인 및 차단 해제', fakeHash(`app-${id}-${t}`), t);
      } else {
        db.prepare(
          `INSERT INTO history (card_id, round, dept_key, dept_name, engine, action, summary, details, commit_hash, harness_meta, created_at)
           VALUES (?, ?, 'ceo', '👤 회장님 코멘트', 'Human', 'COMMENT', '회장님 지시사항 추가', ?, ?, '{}', ?)`
        ).run(id, card.retry_count + 1, body.comment || '', fakeHash(`cmt-${id}-${t}`), t);
      }

      pushLog(`[STEER] 회장님이 카드 #${id}에 개입 (${body.action || 'comment'})`);
      broadcastFullState();
      return sendJson(res, 200, { ok: true });
    }

    const fbMatch = pathname.match(/^\/api\/cards\/(\d+)\/feedback$/);
    if (req.method === 'POST' && fbMatch) {
      const id = Number(fbMatch[1]);
      const body = await readJsonBody(req);
      const card = db.prepare('SELECT * FROM cards WHERE id = ?').get(id);
      if (!card) return sendJson(res, 404, { error: 'Card not found' });

      const feedbackText = (body.feedback || '일본어 결제 화면에서 버튼 글씨가 깨져서 결제가 안 됩니다.').trim();
      const t = nowIso();
      const isI18n = /다국어|번역|일본어|영어|스페인어|중국어|글씨|언어|로케일/i.test(feedbackText);
      const isUi = /화면|버튼|ui|css|디자인|모바일|레이아웃|깨|라이트|컬러|색|문구|템플릿/i.test(feedbackText);
      const childRoute = Array.from(new Set([
        'ceo', ...(isUi ? ['ui'] : []), 'be', 'fe', ...(isI18n ? ['i18n'] : []), 'sec', 'inf', 'cs',
      ])).sort((a, b) => DEPT_MAP[a].order - DEPT_MAP[b].order);

      const startDept = isI18n ? 'i18n' : (isUi ? 'fe' : 'be');
      const preDone = childRoute.slice(0, childRoute.indexOf(startDept));
      const eng = aiConfig.deptEngines[startDept] || DEPT_MAP[startDept].engine;

      const childId = db.prepare(
        `INSERT INTO cards (project_id, title, spec, stage, current_dept, route_depts, completed_depts, retry_count, max_retries, assigned_engine, last_verdict, parent_card_id, updated_at)
         VALUES (?, ?, ?, 'engineering', ?, ?, ?, 0, 3, ?, 'PENDING', ?, ?)`
      ).run(
        card.project_id,
        `[피드백 개선] ${feedbackText.slice(0, 32)}${feedbackText.length > 32 ? '...' : ''}`,
        `원본 카드 #${id}(${card.title})에서 유입된 실제 유저 피드백:\n"${feedbackText}"`,
        startDept,
        JSON.stringify(childRoute),
        JSON.stringify(preDone),
        eng,
        id,
        t
      ).lastInsertRowid;

      db.prepare(
        `INSERT INTO history (card_id, round, dept_key, dept_name, engine, action, summary, details, commit_hash, harness_meta, created_at)
         VALUES (?, 1, 'cs', '🎧 14. 고객센터 & 피드백 루프', 'Codex', 'FEEDBACK_SPAWN', ?, ?, ?, ?, ?)`
      ).run(id, `유저 피드백 접수 → 개선 카드 #${childId} 자동 생성`, `유저 원문: "${feedbackText}"\n담당 분류: ${DEPT_MAP[startDept].name}`, fakeHash(`fb-${id}-${t}`), JSON.stringify({ skillLoaded: '.harness/skills/cs.md' }), t);

      db.prepare(
        `INSERT INTO history (card_id, round, dept_key, dept_name, engine, action, summary, details, commit_hash, harness_meta, created_at)
         VALUES (?, 1, 'cs', '🎧 14. 고객센터 & 피드백 루프', 'Codex', 'SPAWNED', ?, ?, ?, ?, ?)`
      ).run(childId, `원본 카드 #${id}의 유저 피드백으로부터 자동 파생됨`, `자동 배정 부서: ${childRoute.map((k) => DEPT_MAP[k].name).join(' → ')}`, fakeHash(`ch-${childId}-${t}`), JSON.stringify({ skillLoaded: '.harness/skills/cs.md' }), t);

      pushLog(`[CS FEEDBACK LOOP] 카드 #${id} 유저 피드백 접수 → 개선 카드 #${childId} 자동 생성 (${DEPT_MAP[startDept].name} 착수)`);
      broadcastFullState();
      return sendJson(res, 201, { childId, startDept });
    }

    const safePath = pathname === '/' ? '/index.html' : pathname;
    const filePath = path.normalize(path.join(PUBLIC_DIR, safePath));
    if (!filePath.startsWith(PUBLIC_DIR) || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
      res.writeHead(404);
      return res.end('Not Found');
    }
    const ext = path.extname(filePath);
    res.writeHead(200, { 'Content-Type': MIME_MAP[ext] || 'text/plain; charset=utf-8' });
    fs.createReadStream(filePath).pipe(res);
  } catch (err) {
    sendJson(res, 500, { error: err.message });
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 AI Venture Factory Control Tower running on http://localhost:${PORT} (LAN: http://${getLocalLanIp()}:${PORT})`);
});
