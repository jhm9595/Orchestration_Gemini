# Harness Engineering Root Constitution (`AGENTS.md`)

**Core Formula:**
`Agent = Model (Gemini / Codex) + Harness (15 Roles + Fast Gate + Stop Hook + SQLite State)`

This repository implements a multi-agent Venture Factory control tower using zero-dependency Node.js (`node:http`, `node:sqlite`, `node:child_process`) and subscription-based local CLIs (`gemini` & `codex`).

## 15 Specialized Departments (Agent Workforce)
- **제1본부 (기획 & 디자인)**
  - `0. ceo`: 👑 총괄 디렉터 (`Gemini`) - 아이디어 분석, 부서 동적 라우팅, 우선순위 관리
  - `1. pm`: 📋 기획 / PM (`Gemini`) - 시장 분석, PRD 및 기계적 합격 기준(DoD) 정의
  - `2. ui`: 🎨 UI/UX 디자인 (`Gemini`) - 디자인 토큰, 반응형 시안, 로고/에셋 규격화
- **제2본부 (코어 엔지니어링 & 글로벌 현지화)**
  - `3. db`: 🗄️ DB 아키텍트 (`Gemini`) - 스키마 설계, 인덱스, Up/Down 마이그레이션 검증
  - `4. be`: ⚙️ BE / 자동화 개발 (`Gemini`) - API, 크롤러/봇, 쇼츠 렌더링, 비즈니스 로직
  - `5. fe`: 💻 FE / 클라이언트 (`Gemini`) - 웹/게임 화면, 상태관리, API 연동
  - `6. app`: 📱 앱 변환 패키징 (`Gemini`) - Capacitor/Flutter/Tauri 모바일·데스크톱 패키징
  - `7. i18n`: 🌏 다국어 / 글로벌 현지화 (`Gemini`) - 다국어 번역 팩, RTL/통화/타임존 현지화, UI 깨짐 방지
- **제3본부 (수익화, 보안 & 심사)**
  - `8. biz`: 💰 광고 & 결제 수익화 (`Gemini`) - AdSense/AdMob, Stripe/토스/인앱결제, 제휴링크
  - `9. sec`: 🔒 보안 & QA 감사 (`Codex`) - Fast Gate 이후 E2E 테스트, 시크릿/OWASP/치팅 감사
  - `10. law`: ⚖️ 약관 & 스토어 심사 (`Codex`) - 개인정보처리방침, 이용약관, 앱스토어 리젝 사전 검열
- **제4본부 (인프라, 성장 & CS 피드백 루프)**
  - `11. inf`: ☁️ 인프라 & 배포 (`Gemini`) - 도메인/SSL, 서버/클라우드 배포, 크론 스케줄러
  - `12. ana`: 📊 데이터 & 에러 추적 (`Gemini`) - GA4/퍼널, 실시간 에러 웹훅 트래킹
  - `13. mkt`: 📣 마케팅 & SNS 홍보 (`Gemini`) - SEO, 유튜브 쇼츠/인스타/스레드/블로그 홍보 생성
  - `14. cs`: 🎧 고객센터 & 피드백 루프 (`Codex`) - 유저 불만/리뷰 분류 후 자동 개선 카드(`parent_card_id`) 생성

## Guardrails & Circuit Breakers
1. **Secret Isolation:** Agents MUST NOT read `.env` or hardcode API keys/tokens. Fast Gate blocks commit/progression on secret patterns.
2. **Slopsquatting Protection:** Any package addition in `package.json` / `requirements.txt` must pass existence & necessity audit in `9. sec`.
3. **Command Firewall:** Destructive shell commands (`rm -rf /`, `git push --force`) and paths outside workspace root are strictly blocked.
4. **Circuit Breaker (`Max Retries = 3`):** Ping-pong loops between Dev (`Gemini`) and QA (`Codex`) halt automatically at 3 failures (`blocked` state) for Human Steering.
5. **Stateless Fresh Context:** Every round starts a clean CLI session; handoff state lives strictly in `harness_factory.sqlite` (WAL mode) and structured history logs.
