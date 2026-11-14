const fs = require('node:fs');
const path = require('node:path');

function countInlineTagLines(html, tagName) {
  const regex = new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)<\\/${tagName}>`, 'gi');
  let maxLines = 0;
  let match;
  while ((match = regex.exec(html)) !== null) {
    const lines = match[1].trim() ? match[1].trim().split('\n').length : 0;
    if (lines > maxLines) maxLines = lines;
  }
  return maxLines;
}

function listModularComponents(workspaceRoot) {
  const compDir = path.join(workspaceRoot, 'public', 'js', 'components');
  if (!fs.existsSync(compDir)) return [];
  return fs.readdirSync(compDir).filter((f) => f.endsWith('.js'));
}

function runMechanicalFastGate(card, project, workspaceRoot) {
  const issues = [];
  const checks = [];
  const text = `${card?.title || ''}\n${card?.spec || ''}`;

  // 1. SECRET_SCAN
  const secretRegex = /(sk-[a-zA-Z0-9]{20,}|AIza[0-9A-Za-z\-_]{20,}|AKIA[0-9A-Z]{16}|password\s*=\s*['"][^'"]+['"])/;
  const hasDotEnvLeak = /\.env(?!\.example)\b/i.test(text) && /(cat|read|dump|print|log)\s+.*\.env\b/i.test(text);
  if (secretRegex.test(text) || hasDotEnvLeak) {
    issues.push({
      code: 'SECRET_SCAN',
      severity: 'CRITICAL',
      message: '🕵️ [LINTER: SECRET_SCAN] 시크릿/API 키 또는 .env 직접 읽기 패턴이 감지되었습니다.',
      hint: '하드코딩된 키를 즉시 제거하고 .env.example 참조 구조로 변경하세요.',
    });
  } else {
    checks.push({ code: 'SECRET_SCAN', ok: true, label: '시크릿 유출 0건' });
  }

  // 2. COMMAND_FIREWALL
  if (/rm\s+-rf|git\s+push\s+--force|\.\.[\\/]\.\./i.test(text)) {
    issues.push({
      code: 'COMMAND_FIREWALL',
      severity: 'CRITICAL',
      message: '🚧 [LINTER: COMMAND_FIREWALL] 파괴적 쉘 명령어나 워크스페이스 이탈 경로(..)가 감지되었습니다.',
      hint: '워크스페이스 내부 상대 경로만 사용하고 파괴적 명령을 제거하세요.',
    });
  } else {
    checks.push({ code: 'COMMAND_FIREWALL', ok: true, label: '명령어 방화벽 통과' });
  }

  // 3. SLOPSQUATTING_CHECK
  const pkgPath = path.join(workspaceRoot, 'package.json');
  if (fs.existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
      const deps = Object.keys({ ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) });
      if (deps.length > 0) {
        issues.push({
          code: 'SLOPSQUATTING_CHECK',
          severity: 'WARN',
          message: `📦 [LINTER: SLOPSQUATTING_CHECK] 미승인 외부 패키지(${deps.join(', ')})가 package.json에 추가되었습니다.`,
          hint: '9. sec 감사관의 존재 여부 검증 전까지 외부 패키지 없이 Node 내장 모듈을 사용하세요.',
        });
      } else {
        checks.push({ code: 'SLOPSQUATTING_CHECK', ok: true, label: '외부 패키지 0개 (Zero-Dependency 안전)' });
      }
    } catch {
      issues.push({
        code: 'SLOPSQUATTING_CHECK',
        severity: 'ERROR',
        message: '📦 [LINTER: SLOPSQUATTING_CHECK] package.json JSON 구문이 손상되었습니다.',
        hint: 'package.json 문법을 수정하세요.',
      });
    }
  } else {
    checks.push({ code: 'SLOPSQUATTING_CHECK', ok: true, label: '슬롭스쿼팅 위험 없음 (Zero-Dependency)' });
  }

  // 4. SELF_HOST_UI_MODULARITY_LINT
  const indexPath = path.join(workspaceRoot, 'public', 'index.html');
  const cssPath = path.join(workspaceRoot, 'public', 'css', 'styles.css');
  const components = listModularComponents(workspaceRoot);
  let indexLines = 0;
  let themeMode = 'UNKNOWN';

  if (fs.existsSync(indexPath)) {
    const html = fs.readFileSync(indexPath, 'utf8');
    indexLines = html.split('\n').length;
    const inlineStyleLines = countInlineTagLines(html, 'style');
    const inlineScriptLines = countInlineTagLines(html, 'script');

    const isSelfHostTarget =
      !card ||
      /관제탑|Self-Hosted|모듈화|컴포넌트|라이트|컬러|색깔|UI/i.test(`${project?.name || ''} ${card?.title || ''} ${card?.spec || ''}`);

    if (isSelfHostTarget && (indexLines > 150 || inlineStyleLines > 30 || inlineScriptLines > 30 || components.length < 5)) {
      issues.push({
        code: 'MONOLITH_HTML',
        severity: 'ERROR',
        message: `[LINTER: MONOLITH_HTML] public/index.html이 단일 파일(${indexLines}줄, 인라인 스타일 ${inlineStyleLines}줄, 인라인 스크립트 ${inlineScriptLines}줄, 컴포넌트 ${components.length}개)에 과밀 집중되어 있습니다.`,
        hint: '[수정 힌트] 스타일은 public/css/styles.css로, 화면 모듈은 public/js/components/{kanban,workforce,portfolio,harness,modals}.js로 분리하세요.',
      });
    } else {
      checks.push({ code: 'MODULAR_FE', ok: true, label: `모듈화 통과 (index.html ${indexLines}줄 · 컴포넌트 ${components.length}개)` });
    }
  }

  if (fs.existsSync(cssPath)) {
    const css = fs.readFileSync(cssPath, 'utf8');
    const usesDarkBg = /--bg:\s*#0b0f17/i.test(css);
    const hasLightBg = /--bg:\s*#f[0-9a-f]{5}/i.test(css);
    const hasProjThemes = /\.proj-theme-/i.test(css);
    themeMode = hasLightBg && !usesDarkBg ? 'EDITORIAL_LIGHT' : 'DARK';

    const isSelfHostTarget =
      !card ||
      /관제탑|Self-Hosted|모듈화|컴포넌트|라이트|컬러|색깔|UI/i.test(`${project?.name || ''} ${card?.title || ''} ${card?.spec || ''}`);

    if (isSelfHostTarget && (usesDarkBg || !hasLightBg || !hasProjThemes)) {
      issues.push({
        code: 'DARK_OR_UNTHEMED_UI',
        severity: 'ERROR',
        message: '[LINTER: DARK_OR_UNTHEMED_UI] 라이트 테마 및 프로젝트별 고유 컬러 토큰(.proj-theme-*)이 감지되지 않았습니다.',
        hint: '[수정 힌트] 밝은 에디토리얼 배경(#f6f8fb/#ffffff)과 프로젝트별 구분 컬러 팔레트(.proj-theme-*)를 public/css/styles.css에 정의하세요.',
      });
    } else {
      checks.push({ code: 'LIGHT_THEME_ZONES', ok: true, label: '에디토리얼 라이트 테마 + 프로젝트 컬러 존 적용됨' });
    }
  } else {
    const indexHasDark = fs.existsSync(indexPath) && /#0b0f17/i.test(fs.readFileSync(indexPath, 'utf8'));
    themeMode = indexHasDark ? 'DARK_MONOLITH' : 'MISSING_CSS';
    const isSelfHostTarget =
      !card ||
      /관제탑|Self-Hosted|모듈화|컴포넌트|라이트|컬러|색깔|UI/i.test(`${project?.name || ''} ${card?.title || ''} ${card?.spec || ''}`);
    if (isSelfHostTarget) {
      issues.push({
        code: 'DARK_OR_UNTHEMED_UI',
        severity: 'ERROR',
        message: '[LINTER: DARK_OR_UNTHEMED_UI] public/css/styles.css가 없고 다크 모노리스 스타일(#0b0f17)이 감지되었습니다.',
        hint: '[수정 힌트] 밝은 에디토리얼 배경(#f6f8fb/#ffffff)과 프로젝트별 구분 컬러 팔레트(.proj-theme-*)를 public/css/styles.css에 정의하세요.',
      });
    }
  }

  return {
    ok: issues.length === 0,
    issues,
    checks,
    metrics: {
      indexLines,
      componentsCount: components.length,
      components,
      themeMode,
    },
    reason: issues.length === 0
      ? `Fast Gate 전체 통과 (${checks.map((c) => c.label).join(' · ')})`
      : issues.map((i) => `${i.message}\n→ ${i.hint}`).join('\n\n'),
  };
}

module.exports = { runMechanicalFastGate };
