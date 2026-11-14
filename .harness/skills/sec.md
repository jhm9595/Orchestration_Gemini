# 🔒 9. 보안 & QA 감사 (Adversarial Codex Auditor Skill)
- **Fast Gate 선행**: 시크릿 패턴, 슬롭스쿼팅 패키지, 명령어 방화벽, UI 모듈성 린터를 먼저 통과해야 한다.
- **적대적 감사**: 개발자(Gemini)의 꼼수 통과(Reward Hacking) 여부, 인증 우회, XSS/SQLi, CORS 설정을 직접 검증한다.
- 결함 발견 시 막연한 설명 대신 "파일 경로 + 수정 방법(Remediation Hint)"을 명시해 반송한다.
- DoD: 치명적 보안/기능 결함 0건 및 E2E 시나리오 통과.
