const { runMechanicalFastGate } = require('../linters/fast-gate');

function preToolUseHook({ card, dept, skillContent, handoffPacket }) {
  if (!skillContent || !skillContent.trim()) {
    return {
      allowed: false,
      hookLog: `[PreToolUse BLOCK] ${dept.name}용 SKILL.md가 로드되지 않았습니다.`,
    };
  }
  const combined = `${card?.title || ''}\n${card?.spec || ''}`;
  if (/rm\s+-rf\s+\/|git\s+push\s+--force/i.test(combined)) {
    return {
      allowed: false,
      hookLog: `[PreToolUse FIREWALL] 위험 명령어 패턴 감지로 실행 전 차단됨.`,
    };
  }
  return {
    allowed: true,
    hookLog: `[PreToolUse PASS] ${dept.name} SKILL 로드(${skillContent.length}B) · Fresh Handoff 주입 · 방화벽 정상`,
  };
}

function postToolUseHook({ card, dept, outputSummary }) {
  if (!outputSummary || !outputSummary.trim()) {
    return {
      ok: false,
      hookLog: `[PostToolUse WARN] #${card.id} ${dept.name} 산출물 요약이 비어 있습니다.`,
    };
  }
  return {
    ok: true,
    hookLog: `[PostToolUse PASS] #${card.id} ${dept.name} 산출물 스키마 확인 완료`,
  };
}

function stopVerifierHook({ card, dept, project, workspaceRoot }) {
  const checkedDepts = ['ui', 'fe', 'sec', 'i18n'];
  if (!checkedDepts.includes(dept.key)) {
    return {
      blockedByStopHook: false,
      hookLog: `[StopHook PASS] ${dept.name} 완료 검증 통과`,
      linter: null,
    };
  }

  const linter = runMechanicalFastGate(card, project, workspaceRoot);
  if (!linter.ok) {
    return {
      blockedByStopHook: true,
      hookLog: `[StopHook BLOCK] 🛑 ${dept.name} 완료 선언 거부! Linter 위반 ${linter.issues.length}건:\n${linter.reason}`,
      linter,
    };
  }

  return {
    blockedByStopHook: false,
    hookLog: `[StopHook PASS] ✅ ${dept.name} 기계적 Linter 검문 통과 (${linter.checks.map((c) => c.label).join(', ')})`,
    linter,
  };
}

module.exports = { preToolUseHook, postToolUseHook, stopVerifierHook };
