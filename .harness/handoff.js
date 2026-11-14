function assembleHandoffPacket({ card, dept, project, historyRows = [], skillContent = '', agentsMdContent = '' }) {
  const constitutionLines = (agentsMdContent || '')
    .split('\n')
    .filter((l) => l.startsWith('1.') || l.startsWith('2.') || l.startsWith('3.') || l.startsWith('4.') || l.startsWith('5.') || l.startsWith('`Agent'))
    .slice(0, 6)
    .join('\n');

  const prevHandoffs = historyRows
    .filter((h) => h.action !== 'REJECT' && h.action !== 'BLOCKED')
    .slice(-3)
    .map((h) => `- [R${h.round} ${h.dept_name}] ${h.summary}`)
    .join('\n') || '- (초기 착수 단계)';

  const remediationRow = [...historyRows]
    .reverse()
    .find((h) => h.action === 'REJECT' || h.action === 'STOP_HOOK_BLOCK' || h.action === 'STEER');

  const remediationText = remediationRow
    ? `[R${remediationRow.round} ${remediationRow.dept_name}] ${remediationRow.summary}\n${remediationRow.details}`
    : '(반려/수정 힌트 없음)';

  const prompt = [
    `=== [1. CONSTITUTION (AGENTS.md)] ===\n${constitutionLines || 'Secret Isolation · Slopsquatting Guard · Max Retries=3'}`,
    `=== [2. ON-DEMAND SKILL (${dept.name})] ===\n${skillContent.trim()}`,
    `=== [3. TARGET TASK & PROJECT] ===\n프로젝트: ${project.name} (${project.category} / 로케일: ${project.locales} / 수익화: ${project.monetization})\n카드 #${card.id}: ${card.title}\n스펙: ${card.spec}`,
    `=== [4. PREVIOUS DEPT HANDOFFS] ===\n${prevHandoffs}`,
    `=== [5. REMEDIATION & QA FEEDBACK] ===\n${remediationText}`,
  ].join('\n\n');

  return {
    round: card.retry_count + 1,
    deptKey: dept.key,
    deptName: dept.name,
    prevCount: historyRows.length,
    hasRemediation: Boolean(remediationRow),
    remediationSummary: remediationRow ? remediationRow.summary : null,
    preview: prompt.slice(0, 480) + (prompt.length > 480 ? '\n...(Fresh Context 주입 완료)' : ''),
    prompt,
  };
}

module.exports = { assembleHandoffPacket };
