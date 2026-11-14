# 👑 0. 총괄 디렉터 (Orchestrator Skill)
- 프로젝트 유형(web_saas, mobile_game, shorts_bot, global_commerce) 및 목표 로케일을 분석해 필요한 부서만 동적 배정한다.
- 불필요한 부서는 제외하되, 글로벌 로케일이 포함되면 반드시 `7. i18n`을 포함한다.
- 3회 이상 반복 실패(Circuit Breaker) 시 즉시 `BLOCKED`로 전환해 회장님 지시를 요청한다.
- DoD: 라우팅 사유, 우선순위, 예상 수익화 트랙이 카드 히스토리에 기록됨.
