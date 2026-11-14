const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { execFile, spawn } = require('node:child_process');

const IS_WIN = process.platform === 'win32';
const PLANNING_DEPTS = new Set(['ceo', 'pm', 'law', 'mkt', 'ana', 'cs']);

function stripAnsi(str) {
  return String(str || '').replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '').trim();
}

function resolveBin(name) {
  if (IS_WIN) {
    const npmDir = path.join(process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'), 'npm');
    const cmdPath = path.join(npmDir, `${name}.cmd`);
    if (fs.existsSync(cmdPath)) return cmdPath;
  }
  return name;
}

function execQuick(cmd, args, timeout = 6000) {
  return new Promise((resolve) => {
    const bin = IS_WIN && cmd.endsWith('.cmd') ? 'cmd.exe' : cmd;
    const finalArgs = IS_WIN && cmd.endsWith('.cmd') ? ['/c', cmd, ...args] : args;
    execFile(bin, finalArgs, { timeout, windowsHide: true, env: process.env }, (err, stdout, stderr) => {
      resolve({
        ok: !err,
        stdout: stripAnsi(stdout),
        stderr: stripAnsi(stderr),
        error: err ? err.message : null,
      });
    });
  });
}

function getGeminiSettingsInfo() {
  const gDir = path.join(os.homedir(), '.gemini');
  const info = { selectedType: null, hasMcp: false, activeAccount: null, hasRefreshToken: false };
  try {
    const settingsPath = path.join(gDir, 'settings.json');
    if (fs.existsSync(settingsPath)) {
      const s = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
      info.selectedType = s?.security?.auth?.selectedType || s?.selectedAuthType || null;
      info.hasMcp = Boolean(s?.mcpServers && Object.keys(s.mcpServers).length > 0);
    }
  } catch {}
  try {
    const accPath = path.join(gDir, 'google_accounts.json');
    if (fs.existsSync(accPath)) {
      const acc = JSON.parse(fs.readFileSync(accPath, 'utf8'));
      info.activeAccount = acc?.active || null;
    }
  } catch {}
  try {
    const credPath = path.join(gDir, 'oauth_creds.json');
    if (fs.existsSync(credPath)) {
      info.hasRefreshToken = fs.readFileSync(credPath, 'utf8').includes('refresh_token');
    }
  } catch {}
  return info;
}

function checkGeminiAuthStatus() {
  const info = getGeminiSettingsInfo();
  const hasApiKey = Boolean(process.env.GEMINI_API_KEY);

  if (hasApiKey) {
    return {
      signedIn: true,
      warning: false,
      detail: info.selectedType === 'oauth-personal'
        ? 'GEMINI_API_KEY 활성 (격리 프로필 · gemini-3.5-flash-lite 네이티브 실행 준비됨)'
        : 'GEMINI_API_KEY 환경변수 설정됨 (gemini-3.5-flash-lite)',
    };
  }
  if (info.selectedType === 'oauth-personal') {
    return {
      signedIn: Boolean(info.activeAccount || info.hasRefreshToken),
      warning: true,
      detail: 'Google OAuth (oauth-personal / Gemini CLI 0.40+ 개인 무료 티어 제한 가능 — GEMINI_API_KEY 또는 Codex/OpenCode 브릿지 지원)',
    };
  }
  if (info.activeAccount) {
    return { signedIn: true, warning: false, detail: `Google 계정 (${info.activeAccount})` };
  }
  if (info.hasRefreshToken) {
    return { signedIn: true, warning: false, detail: 'Google OAuth 로그인됨' };
  }
  return { signedIn: false, warning: true, detail: '로컬 로그인 확인 필요 (gemini 실행 후 로그인)' };
}

function buildGeminiExecEnv() {
  const info = getGeminiSettingsInfo();
  const env = { ...process.env, GEMINI_CLI_TRUST_WORKSPACE: 'true' };
  if (info.selectedType === 'oauth-personal' && process.env.GEMINI_API_KEY) {
    const isolatedHome = path.join(os.tmpdir(), 'venture_factory_gemini_home');
    const dotGemini = path.join(isolatedHome, '.gemini');
    fs.mkdirSync(dotGemini, { recursive: true });
    fs.writeFileSync(
      path.join(dotGemini, 'settings.json'),
      JSON.stringify({ security: { auth: { selectedType: 'gemini-api-key' } } }),
      'utf8'
    );
    env.GEMINI_CLI_HOME = isolatedHome;
  }
  return env;
}

async function detectInstalledClis() {
  const geminiBin = resolveBin('gemini');
  const codexBin = resolveBin('codex');
  const openCodeBin = resolveBin('opencode');
  const claudeBin = resolveBin('claude');
  const agyBin = resolveBin('agy');

  const [gVer, cVer, cAuth, ocVer, ocAuth, clVer, agyVer, gitVer] = await Promise.all([
    execQuick(geminiBin, ['-v']),
    execQuick(codexBin, ['-V']),
    execQuick(codexBin, ['login', 'status']),
    execQuick(openCodeBin, ['--version']),
    execQuick(openCodeBin, ['auth', 'list']),
    execQuick(claudeBin, ['--version']),
    execQuick(agyBin, ['--version']),
    execQuick('git', ['--version']),
  ]);

  const gAuth = checkGeminiAuthStatus();
  const ocSignedIn = ocVer.ok && /credential|env|api|oauth/i.test(`${ocAuth.stdout} ${ocAuth.stderr}`);
  const ocAuthCompact = `${ocAuth.stdout} ${ocAuth.stderr}`.split(/\r?\n/).filter(Boolean).slice(0, 4).join(' | ');

  return [
    {
      id: 'Gemini',
      cli: 'gemini',
      installed: gVer.ok && Boolean(gVer.stdout),
      version: gVer.stdout || '미설치',
      path: geminiBin,
      signedIn: gVer.ok && gAuth.signedIn,
      warning: gAuth.warning,
      authStatus: gVer.ok ? gAuth.detail : 'CLI 미설치 (npm i -g @google/gemini-cli)',
    },
    {
      id: 'Codex',
      cli: 'codex',
      installed: cVer.ok && Boolean(cVer.stdout),
      version: cVer.stdout || '미설치',
      path: codexBin,
      signedIn: cVer.ok && /logged in/i.test(`${cAuth.stdout} ${cAuth.stderr}`),
      warning: false,
      authStatus: cAuth.stdout || cAuth.stderr || (cVer.ok ? 'codex login 필요' : 'CLI 미설치 (npm i -g @openai/codex)'),
    },
    {
      id: 'OpenCode',
      cli: 'opencode',
      installed: ocVer.ok && Boolean(ocVer.stdout),
      version: ocVer.stdout || '미설치',
      path: openCodeBin,
      signedIn: ocSignedIn,
      warning: false,
      authStatus: ocVer.ok ? (ocAuthCompact || 'opencode auth login 확인 가능') : '선택 사항 (미설치)',
    },
    {
      id: 'Claude',
      cli: 'claude',
      installed: clVer.ok && Boolean(clVer.stdout),
      version: clVer.stdout || '미설치',
      path: claudeBin,
      signedIn: clVer.ok,
      warning: false,
      authStatus: clVer.ok ? '설치됨 (Custom 엔진으로 연결 가능)' : '선택 사항 (미설치)',
    },
    {
      id: 'Antigravity',
      cli: 'agy',
      installed: agyVer.ok && Boolean(agyVer.stdout),
      version: agyVer.stdout || 'IDE 내장 / 미설치',
      path: agyBin,
      signedIn: agyVer.ok,
      warning: false,
      authStatus: agyVer.ok ? 'CLI 사용 가능' : 'Antigravity IDE 세션 활성',
    },
    {
      id: 'Git',
      cli: 'git',
      installed: gitVer.ok,
      version: gitVer.stdout || '미설치',
      path: 'git',
      signedIn: true,
      warning: false,
      authStatus: gitVer.ok ? '변경 파일 추적(git diff) 준비됨' : 'Git 설치 필요',
    },
  ];
}

function splitArgs(str) {
  if (!str || !String(str).trim()) return [];
  const matches = String(str).match(/(?:[^\s"]+|"[^"]*")+/g) || [];
  return matches.map((m) => m.replace(/^"|"$/g, ''));
}

function spawnCliWithStdin({ command, args, stdinText, cwd, env, timeoutMs = 120000, onLine }) {
  return new Promise((resolve) => {
    const start = Date.now();
    const resolvedCmd = resolveBin(command);
    const spawnBin = IS_WIN ? 'cmd.exe' : resolvedCmd;
    const spawnArgs = IS_WIN ? ['/c', resolvedCmd, ...args] : args;

    const child = spawn(spawnBin, spawnArgs, {
      cwd,
      env: env || process.env,
      windowsHide: true,
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';
    let timedOut = false;
    let settled = false;

    const timer = setTimeout(() => {
      timedOut = true;
      try { child.kill('SIGTERM'); } catch {}
    }, timeoutMs);

    function feedLines(chunk, prefix) {
      const text = chunk.toString('utf8');
      for (const rawLine of text.split(/\r?\n/)) {
        const line = stripAnsi(rawLine);
        if (line && onLine) onLine(`${prefix}${line}`);
      }
      return text;
    }

    child.stdout.on('data', (chunk) => { stdout += feedLines(chunk, ''); });
    child.stderr.on('data', (chunk) => { stderr += feedLines(chunk, '[stderr] '); });

    child.on('error', (err) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({ ok: false, code: -1, durationMs: Date.now() - start, stdout: stripAnsi(stdout), stderr: err.message, timedOut });
    });

    child.on('close', (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({
        ok: code === 0 && !timedOut,
        code,
        durationMs: Date.now() - start,
        stdout: stripAnsi(stdout),
        stderr: stripAnsi(stderr),
        timedOut,
      });
    });

    try {
      if (stdinText) child.stdin.write(stdinText);
      child.stdin.end();
    } catch {}
  });
}

function snapshotWorkspace(dir) {
  const map = new Map();
  if (!dir || !fs.existsSync(dir)) return map;
  const ignore = new Set(['.git', 'node_modules', '.harness', 'harness_factory.sqlite', 'harness_factory.sqlite-wal', 'harness_factory.sqlite-shm']);
  function walk(curr, relBase) {
    let entries = [];
    try { entries = fs.readdirSync(curr, { withFileTypes: true }); } catch { return; }
    for (const ent of entries) {
      if (ignore.has(ent.name)) continue;
      const full = path.join(curr, ent.name);
      const rel = relBase ? `${relBase}/${ent.name}` : ent.name;
      if (ent.isDirectory()) walk(full, rel);
      else {
        try {
          const st = fs.statSync(full);
          map.set(rel, `${st.size}:${Math.floor(st.mtimeMs)}`);
        } catch {}
      }
    }
  }
  walk(dir, '');
  return map;
}

function diffSnapshots(before, after) {
  const changed = [];
  for (const [k, v] of after.entries()) {
    if (before.get(k) !== v) changed.push(k);
  }
  for (const k of before.keys()) {
    if (!after.has(k)) changed.push(`${k} (deleted)`);
  }
  return changed;
}

function buildCliInvocation(engine, providerCfg, workspaceDir, bridgeMode = false, deptKey = '') {
  if (bridgeMode) {
    return {
      command: 'codex',
      args: ['exec', '--skip-git-repo-check', '--dangerously-bypass-approvals-and-sandbox', '--ephemeral', '-C', workspaceDir, '-'],
    };
  }

  const cmd = providerCfg?.command || (engine === 'Codex' ? 'codex' : engine === 'OpenCode' ? 'opencode' : 'gemini');
  const rawFlags = providerCfg?.args || '';
  const extraFlags = splitArgs(rawFlags);
  const lower = cmd.toLowerCase();

  if (lower.includes('codex')) {
    const baseArgs = extraFlags.length
      ? extraFlags
      : ['exec', '-', '-s', 'workspace-write', '--ephemeral', '--skip-git-repo-check'];
    if (!baseArgs.includes('-C') && !baseArgs.includes('--cd')) baseArgs.push('-C', workspaceDir);
    return { command: cmd, args: baseArgs };
  }

  if (lower.includes('opencode')) {
    const baseArgs = extraFlags.length
      ? extraFlags
      : ['run', '--pure', '--auto', '--dir', workspaceDir, 'Execute the task packet provided on stdin and output SUMMARY, VERDICT, CHANGED_FILES, DETAILS.'];
    return { command: cmd, args: baseArgs };
  }

  if (lower.includes('gemini')) {
    let baseArgs = extraFlags.length
      ? [...extraFlags]
      : ['-m', 'gemini-3.5-flash-lite', '-p', 'Read the harness constitution, SKILL.md, and task in stdin carefully. Perform the work directly in the workspace and output SUMMARY, VERDICT (PASS or REJECT), CHANGED_FILES, and DETAILS.', '--yolo', '--skip-trust'];
    if (!baseArgs.includes('-m') && !baseArgs.includes('--model')) {
      baseArgs.unshift('-m', 'gemini-3.5-flash-lite');
    }
    if (PLANNING_DEPTS.has(deptKey)) {
      baseArgs = baseArgs.filter((a) => a !== '--yolo' && a !== '-y');
      if (!baseArgs.includes('--approval-mode')) {
        baseArgs.push('--approval-mode', 'plan');
      }
    }
    return { command: cmd, args: baseArgs };
  }

  return { command: cmd, args: extraFlags };
}

function extractModelFlag(args) {
  const idx = args.findIndex((a) => a === '-m' || a === '--model');
  return idx >= 0 && args[idx + 1] ? args[idx + 1] : null;
}

function classifyGeminiFailure(res) {
  const txt = `${res.stderr}\n${res.stdout}`;
  if (/IneligibleTierError/i.test(txt) || res.code === 55) {
    return 'IneligibleTierError (개인 OAuth 무료 티어 제한, Antigravity 전환 안내)';
  }
  if (/TerminalQuotaError|RESOURCE_EXHAUSTED|429/i.test(txt)) {
    return 'TerminalQuotaError (Gemini 무료 티어 일일 쿼터 429 제한)';
  }
  if (/ModelNotFoundError|404/i.test(txt)) {
    return 'ModelNotFoundError (모델 엔드포인트 404)';
  }
  if (res.timedOut) return 'CLI 응답 타임아웃';
  return `인증/실행 오류 (종료코드 ${res.code})`;
}

async function testCliConnection({ engine, providerConfig, workspaceDir, onLine }) {
  const prompt = `Ping test from AI Venture Factory Harness. Reply cleanly with one short line: OK - ${engine} CLI connected`;
  const cmdLower = (providerConfig?.command || engine).toLowerCase();
  const isGemini = engine === 'Gemini' || cmdLower.includes('gemini');
  const autoBridge = providerConfig?.autoBridge !== false;

  let inv;
  if (cmdLower.includes('codex')) {
    inv = {
      command: providerConfig?.command || 'codex',
      args: ['exec', '-', '-s', 'read-only', '--ephemeral', '--skip-git-repo-check', '-C', workspaceDir],
    };
  } else if (cmdLower.includes('opencode')) {
    inv = {
      command: providerConfig?.command || 'opencode',
      args: ['run', '--pure', '--dir', workspaceDir, `Reply with one short line: OK - ${engine} CLI connected`],
    };
  } else if (isGemini) {
    const cfgModel = extractModelFlag(splitArgs(providerConfig?.args || ''));
    inv = {
      command: providerConfig?.command || 'gemini',
      args: ['-m', cfgModel || 'gemini-3.5-flash-lite', '-p', 'Reply cleanly with one short line confirming connection.', '--approval-mode', 'plan', '--skip-trust'],
    };
  } else {
    inv = buildCliInvocation(engine, providerConfig, workspaceDir);
  }

  const execEnv = isGemini ? buildGeminiExecEnv() : process.env;
  const res = await spawnCliWithStdin({
    command: inv.command,
    args: inv.args,
    stdinText: prompt,
    cwd: workspaceDir,
    env: execEnv,
    timeoutMs: Number(providerConfig?.timeoutMs || 60000),
    onLine,
  });

  if (res.ok) {
    return {
      ok: true,
      engine,
      bridged: false,
      command: `${inv.command} ${inv.args.join(' ')}`,
      durationMs: res.durationMs,
      output: res.stdout || res.stderr || 'OK',
      timedOut: false,
    };
  }

  if (isGemini && autoBridge) {
    const reason = classifyGeminiFailure(res);
    if (onLine) onLine(`[Auto-Bridge] gemini.cmd ${reason} -> codex.cmd 실시간 CLI 브릿지 검증 시작...`);
    const bridgeArgs = ['exec', '-', '-s', 'read-only', '--ephemeral', '--skip-git-repo-check', '-C', workspaceDir];
    const bridgeRes = await spawnCliWithStdin({
      command: 'codex',
      args: bridgeArgs,
      stdinText: prompt,
      cwd: workspaceDir,
      env: process.env,
      timeoutMs: Number(providerConfig?.timeoutMs || 60000),
      onLine,
    });

    return {
      ok: bridgeRes.ok,
      engine,
      bridged: true,
      bridgeTarget: 'codex.cmd',
      command: `${inv.command} ... -> [Auto-Bridge] codex ${bridgeArgs.join(' ')}`,
      durationMs: res.durationMs + bridgeRes.durationMs,
      output: `[Gemini CLI 상태] ${reason}\n[Auto-Bridge -> Codex CLI 실제 응답] ${bridgeRes.stdout || bridgeRes.stderr || '응답 없음'}`,
      timedOut: bridgeRes.timedOut,
    };
  }

  return {
    ok: false,
    engine,
    bridged: false,
    command: `${inv.command} ${inv.args.join(' ')}`,
    durationMs: res.durationMs,
    output: res.stderr || res.stdout || (res.timedOut ? '타임아웃(60초 초과)' : '응답 없음'),
    timedOut: res.timedOut,
  };
}

function parseCliOutput(rawOutput, dept, changedFiles) {
  const text = (rawOutput || '').trim();
  const verdictMatch = text.match(/VERDICT:\s*(PASS|REJECT|FAIL|BLOCK)/i);
  const summaryMatch = text.match(/SUMMARY:\s*(.+)/i);
  const filesMatch = text.match(/CHANGED_FILES:\s*(.+)/i);
  const detailsIdx = text.search(/DETAILS:/i);

  const verdictRaw = verdictMatch ? verdictMatch[1].toUpperCase() : 'PASS';
  const verdict = verdictRaw === 'FAIL' ? 'REJECT' : verdictRaw;

  let summary = summaryMatch ? summaryMatch[1].trim() : '';
  if (!summary) {
    const firstUsefulLine = text
      .split(/\r?\n/)
      .map((l) => l.trim())
      .find((l) => l && !l.startsWith('```') && !/^tokens used/i.test(l));
    summary = firstUsefulLine ? firstUsefulLine.slice(0, 120) : `${dept.name} 실제 CLI 실행 완료`;
  }

  const details = detailsIdx >= 0 ? text.slice(detailsIdx).trim() : text.slice(0, 1800);
  const parsedFiles = filesMatch
    ? filesMatch[1].split(',').map((s) => s.trim()).filter((s) => s && !/없음|none/i.test(s))
    : [];

  return {
    verdict,
    summary,
    details,
    changedFiles: Array.from(new Set([...changedFiles, ...parsedFiles])),
  };
}

async function runDepartmentCli({ engine, providerConfig, promptText, workspaceDir, dept, onLine }) {
  fs.mkdirSync(workspaceDir, { recursive: true });
  const beforeSnap = snapshotWorkspace(workspaceDir);
  const inv = buildCliInvocation(engine, providerConfig, workspaceDir, false, dept?.key || '');
  const timeoutMs = Number(providerConfig?.timeoutMs || 120000);
  const cmdLower = inv.command.toLowerCase();
  const isGemini = engine === 'Gemini' || cmdLower.includes('gemini');
  const autoBridge = providerConfig?.autoBridge !== false;

  let res = await spawnCliWithStdin({
    command: inv.command,
    args: inv.args,
    stdinText: promptText,
    cwd: workspaceDir,
    env: isGemini ? buildGeminiExecEnv() : process.env,
    timeoutMs,
    onLine,
  });

  let usedCommand = `${inv.command} ${inv.args.join(' ')}`;
  let bridgeNote = '';
  let totalDuration = res.durationMs;

  if (!res.ok && isGemini && autoBridge) {
    const reason = classifyGeminiFailure(res);
    bridgeNote = `[Auto-Bridge: gemini.cmd ${reason} -> codex.cmd real CLI execution]\n`;
    if (onLine) onLine(`[Auto-Bridge] gemini.cmd ${reason} -> codex.cmd real CLI execution`);

    const bridgeInv = buildCliInvocation('Codex', null, workspaceDir, true);
    const bridgeRes = await spawnCliWithStdin({
      command: bridgeInv.command,
      args: bridgeInv.args,
      stdinText: promptText,
      cwd: workspaceDir,
      env: process.env,
      timeoutMs,
      onLine,
    });
    totalDuration += bridgeRes.durationMs;
    usedCommand = `${bridgeInv.command} ${bridgeInv.args.join(' ')} (Auto-Bridge from gemini.cmd)`;
    res = bridgeRes;
  }

  const afterSnap = snapshotWorkspace(workspaceDir);
  const changedFiles = diffSnapshots(beforeSnap, afterSnap);

  if (!res.ok) {
    return {
      ok: false,
      verdict: 'ERROR',
      durationMs: totalDuration,
      changedFiles,
      summary: `${engine} CLI 실행 실패 (${res.timedOut ? '타임아웃' : `종료코드 ${res.code}`})`,
      details: `${bridgeNote}${(res.stderr || res.stdout || 'CLI 실행 중 오류가 발생했습니다.').slice(0, 1500)}`,
      rawCommand: usedCommand,
    };
  }

  const parsed = parseCliOutput(res.stdout || res.stderr, dept, changedFiles);
  return {
    ok: true,
    verdict: parsed.verdict,
    durationMs: totalDuration,
    changedFiles: parsed.changedFiles,
    summary: parsed.summary,
    details: `${bridgeNote}${parsed.details}`.trim(),
    rawCommand: usedCommand,
  };
}

module.exports = {
  detectInstalledClis,
  testCliConnection,
  runDepartmentCli,
};
