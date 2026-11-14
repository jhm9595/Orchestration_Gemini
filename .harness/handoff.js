const PLANNING_DEPTS = new Set(['ceo', 'pm', 'law', 'mkt', 'ana', 'cs']);

function assembleHandoffPacket({ card, dept, project, workspaceDir = '', historyRows = [], skillContent = '', agentsMdContent = '' }) {
  const constitutionLines = (agentsMdContent || '')
    .split('\n')
    .filter((l) => l.startsWith('1.') || l.startsWith('2.') || l.startsWith('3.') || l.startsWith('4.') || l.startsWith('5.') || l.startsWith('`Agent'))
    .slice(0, 6)
    .join('\n');

  const prevHandoffs = historyRows
    .filter((h) => h.action !== 'REJECT' && h.action !== 'BLOCKED' && h.action !== 'STOP_HOOK_BLOCK')
    .slice(-3)
    .map((h) => `- [R${h.round} ${h.dept_name}] ${h.summary}`)
    .join('\n') || '- (초기 착수 단계)';

  const remediationRow = [...historyRows]
    .reverse()
    .find((h) => h.action === 'REJECT' || h.action === 'STOP_HOOK_BLOCK' || h.action === 'STEER');

  const remediationText = remediationRow
    ? `[R${remediationRow.round} ${remediationRow.dept_name}] ${remediationRow.summary}\n${remediationRow.details}`
    : '(반려/수정 힌트 없음)';

  const execScopeDirective = PLANNING_DEPTS.has(dept.key)
    ? '파일 전체 스캔이나 장황한 탐색 없이 요구사항과 SKILL.md 체크리스트를 바탕으로 핵심 판단과 설계를 즉시 도출하세요.'
    : `위 작업 디렉터리(${workspaceDir})의 관련 파일만 간결히 확인하여 필요한 코드 작성·수정·테스트 또는 감사를 직접 수행하세요.`;

  const prompt = [
    `=== [1. CONSTITUTION (AGENTS.md)] ===\n${constitutionLines || 'Secret Isolation · Slopsquatting Guard · Max Retries=3'}`,
    `=== [2. ON-DEMAND SKILL (${dept.name})] ===\n${skillContent.trim()}`,
    `=== [3. TARGET WORKSPACE & TASK] ===\n작업 디렉터리: ${workspaceDir}\n프로젝트: ${project.name} (${project.category} / 로케일: ${project.locales} / 수익화: ${project.monetization})\n카드 #${card.id}: ${card.title}\n요구사항(Spec): ${card.spec}`,
    `=== [4. PREVIOUS DEPT HANDOFFS] ===\n${prevHandoffs}`,
    `=== [5. REMEDIATION & QA FEEDBACK] ===\n${remediationText}`,
    `=== [6. EXECUTION DIRECTIVE] ===\n${execScopeDirective}\n절대 harness_factory.sqlite DB 파일을 직접 수정·삭제하거나 서버 프로세스를 종료하지 마세요.\n응답 마지막에는 반드시 아래 형식으로 요약하세요:\nVERDICT: PASS (또는 결함 발견 시 REJECT)\nSUMMARY: 한 줄 핵심 요약\nCHANGED_FILES: 수정하거나 검증한 파일 목록 (없으면 없음)\nDETAILS:\n구체적인 변경·검증 내용`,
  ].join('\n\n');

  return {
    round: card.retry_count + 1,
    deptKey: dept.key,
    deptName: dept.name,
    prevCount: historyRows.length,
    hasRemediation: Boolean(remediationRow),
    remediationSummary: remediationRow ? remediationRow.summary : null,
    preview: prompt.slice(0, 520) + (prompt.length > 520 ? '\n...(Fresh Context 주입 완료)' : ''),
    prompt,
  };
}

module.exports = { assembleHandoffPacket };
