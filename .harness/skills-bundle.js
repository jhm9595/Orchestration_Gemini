const fs = require('node:fs');
const path = require('node:path');

const SKILLS_DIR = path.join(__dirname, 'skills');

const SKILL_TEMPLATES = {
  ceo: `# 👑 0. 총괄 디렉터 (Orchestrator Skill)
- 프로젝트 유형(web_saas, mobile_game, shorts_bot, global_commerce) 및 목표 로케일을 분석해 필요한 부서만 동적 배정한다.
- 불필요한 부서는 제외하되, 글로벌 로케일이 포함되면 반드시 \`7. i18n\`을 포함한다.
- 3회 이상 반복 실패(Circuit Breaker) 시 즉시 \`BLOCKED\`로 전환해 회장님 지시를 요청한다.
- DoD: 라우팅 사유, 우선순위, 예상 수익화 트랙이 카드 히스토리에 기록됨.`,

  pm: `# 📋 1. 기획 / PM (Product Spec Skill)
- 모호한 아이디어를 4~6개의 기계적으로 테스트 가능한 인수 조건(DoD)으로 분해한다.
- 수정 대상 파일/모듈 범위를 사전 명시하여 에이전트가 무관한 코드를 건드리지 않게 한다.
- DoD: 타겟 유저, 핵심 유저 플로우, 예외 케이스, 합격 기준이 명시됨.`,

  ui: `# 🎨 2. UI/UX 디자인 (Editorial Light Design Skill)
- **Editorial Light Mode**: 기본 캔버스는 \`#f6f8fb\`, 카드 표면은 \`#ffffff\`, 본문 잉크는 \`#0f172a\`를 사용한다.
- **Anti-AI-Cliché**: 과도한 다크 네온/글로우 효과를 배제하고 정갈한 타이포그래피와 여백으로 계층을 만든다.
- **프로젝트 컬러 존 구분**: 모든 프로젝트는 고유 컬러 토큰(\`indigo\`, \`emerald\`, \`amber\`, \`rose\`, \`violet\`, \`cyan\`) 중 하나를 부여받아 카드 좌측 스트라이프와 존 헤더로 즉시 식별되어야 한다.
- DoD: 375px 모바일과 1440px 데스크톱 모두 깨짐 없는 반응형 그리드 규격 제시.`,

  db: `# 🗄️ 3. DB 아키텍트 (SQLite WAL & Schema Skill)
- 칸반 상태 저장은 반드시 SQLite WAL 모드를 사용해 동시성 레이스 컨디션을 차단한다.
- 기존 테이블 변경 시 데이터 유실 없는 \`ALTER TABLE\` 방어 마이그레이션(Up/Down)을 검증한다.
- 테스트 실행은 반드시 격리된 테스트 DB(또는 인메모리 DB)만 바라보도록 강제한다.
- DoD: 스키마/인덱스 정의 및 마이그레이션 왕복 테스트 통과.`,

  be: `# ⚙️ 4. BE / 자동화 개발 (Backend & Crawler Skill)
- 모든 외부 입력은 스키마 검증을 거치고, CLI/크롤러 호출에는 타임아웃과 재시도 가드를 둔다.
- \`.env\` 직접 읽기 및 시크릿 하드코딩을 엄격히 금지한다.
- DoD: API 정상/예외 응답 코드 검증 및 단위 테스트 통과.`,

  fe: `# 💻 5. FE / 클라이언트 (Modular Component Skill)
- **엄격한 모듈 분리**: \`public/index.html\`은 140줄 이하의 깔끔한 껍데기만 유지한다.
- 스타일은 \`public/css/styles.css\`, 화면 컴포넌트는 \`public/js/components/{kanban,workforce,portfolio,harness,modals}.js\`, 앱 제어는 \`public/js/app.js\`로 반드시 분리한다.
- 한 화면에 모든 정보를 몰아넣지 말고, 상세 모달 내부도 탭(타임라인 / 라우팅 / 하네스 로그)으로 분할한다.
- DoD: 인라인 거대 스크립트/스타일 0건, 모든 동적 문자열 HTML 이스케이프(\`esc()\`) 적용.`,

  app: `# 📱 6. 앱 변환 패키징 (App Wrapper Skill)
- 웹/게임을 Capacitor, Flutter 또는 Tauri로 감쌀 때 안전 영역(\`safe-area-inset\`)과 딥링크를 설정한다.
- 권한 요청(카메라, 알림 등)은 최소 권한 원칙을 지키고 스토어 심사 설명문을 함께 작성한다.
- DoD: Android/iOS 빌드 매니페스트 및 스플래시/아이콘 규격 검증 완료.`,

  i18n: `# 🌏 7. 다국어 / 글로벌 현지화 (Global i18n Skill)
- 모든 UI 문자열은 로케일 키(\`ko\`, \`en\`, \`ja\`, \`es\` 등)로 관리하며 하드코딩된 문구를 남기지 않는다.
- 통화/날짜/숫자는 반드시 \`Intl.NumberFormat\` / \`Intl.DateTimeFormat\`을 사용한다.
- 일본어·독일어·스페인어 등 긴 번역 텍스트로 인한 버튼/카드 깨짐을 방지하는 \`flex-wrap\` 및 \`text-overflow\` 규칙을 적용한다.
- DoD: 타겟 로케일 키 100% 일치 및 모바일 375px 오버플로우 0건.`,

  biz: `# 💰 8. 광고 & 결제 수익화 (Monetization Skill)
- Stripe/토스페이먼츠 웹훅은 반드시 \`rawBody\` HMAC 서명 검증을 강제한다.
- AdSense/AdMob 슬롯은 레이아웃 시프트(CLS)를 막기 위해 고정 높이를 예약한다.
- 무료 티어 한도 초과 시 깔끔한 업그레이드 안내 모달과 제휴 링크 태그를 연결한다.
- DoD: 결제 테스트 모드 검증 및 금액 변조 차단 확인.`,

  sec: `# 🔒 9. 보안 & QA 감사 (Adversarial Codex Auditor Skill)
- **Fast Gate 선행**: 시크릿 패턴, 슬롭스쿼팅 패키지, 명령어 방화벽, UI 모듈성 린터를 먼저 통과해야 한다.
- **적대적 감사**: 개발자(Gemini)의 꼼수 통과(Reward Hacking) 여부, 인증 우회, XSS/SQLi, CORS 설정을 직접 검증한다.
- 결함 발견 시 막연한 설명 대신 "파일 경로 + 수정 방법(Remediation Hint)"을 명시해 반송한다.
- DoD: 치명적 보안/기능 결함 0건 및 E2E 시나리오 통과.`,

  law: `# ⚖️ 10. 약관 & 스토어 심사 (Compliance & Store Review Skill)
- 개인정보처리방침, 이용약관, 환불 규정, 회원탈퇴(계정 삭제) 경로 존재 여부를 검열한다.
- 다국어 서비스인 경우 타겟 국가 언어별 약관 및 GDPR/쿠키 동의 배너를 확인한다.
- DoD: 앱스토어/플레이스토어/결제사 주요 리젝 사유 0건.`,

  inf: `# ☁️ 11. 인프라 & 배포 (Infra & Tunnel Ops Skill)
- 로컬 서버 헬스체크 엔드포인트(\`/api/state\`) 및 SQLite WAL 자동 백업 정책을 확인한다.
- 외부 접속용 무료 Cloudflare Tunnel(\`cloudflared\`) 또는 클라우드 배포 설정을 검증한다.
- DoD: 무중단 기동 및 외부/모바일 헬스체크 200 OK 확인.`,

  ana: `# 📊 12. 데이터 & 에러 추적 (Analytics & Telemetry Skill)
- 방문 → 가입 → 핵심 행동 → 결제 전환 퍼널 이벤트를 삽입한다.
- 프론트엔드/백엔드 치명적 에러는 실시간 수집 웹훅을 통해 \`14. CS\` 루프로 연결한다.
- DoD: 전환 이벤트 3종 이상 및 에러 웹훅 작동 확인.`,

  mkt: `# 📣 13. 마케팅 & SNS 홍보 (Growth & Content Skill)
- 제품 핵심 가치와 타겟 로케일(\`KR, EN, JP, ES\`)에 맞춘 SEO 메타태그·오픈그래프를 작성한다.
- 유튜브 쇼츠/릴스 대본, X/Threads/블로그 런칭 포스트 초안을 언어별로 생성한다.
- DoD: 다국어 홍보 카피 3채널 이상 및 SEO 태그 검증.`,

  cs: `# 🎧 14. 고객센터 & 피드백 루프 (CS Triage & Auto-Loop Skill)
- 유입된 유저 불만/리뷰를 버그, UI/UX 깨짐, 다국어 오역, 기능 요청으로 즉시 분류한다.
- 해결이 필요한 피드백은 \`parent_card_id\`로 계보를 연결한 개선 카드를 생성해 개발 파이프라인에 즉시 투입한다.
- DoD: 1차 고객 응대 초안 + 파생 개선 카드 라우팅 완료.`,
};

function ensureSkillFiles() {
  fs.mkdirSync(SKILLS_DIR, { recursive: true });
  for (const [key, content] of Object.entries(SKILL_TEMPLATES)) {
    const filePath = path.join(SKILLS_DIR, `${key}.md`);
    fs.writeFileSync(filePath, content.trim() + '\n', 'utf8');
  }
}

function loadSkillForDept(deptKey) {
  ensureSkillFiles();
  const filePath = path.join(SKILLS_DIR, `${deptKey}.md`);
  if (!fs.existsSync(filePath)) return { key: deptKey, path: filePath, content: `# ${deptKey} 기본 스킬` };
  return {
    key: deptKey,
    path: `.harness/skills/${deptKey}.md`,
    content: fs.readFileSync(filePath, 'utf8'),
  };
}

function listSkillFiles() {
  ensureSkillFiles();
  return Object.keys(SKILL_TEMPLATES).map((key) => {
    const filePath = path.join(SKILLS_DIR, `${key}.md`);
    const content = fs.readFileSync(filePath, 'utf8');
    return {
      key,
      path: `.harness/skills/${key}.md`,
      bytes: Buffer.byteLength(content, 'utf8'),
      lines: content.trim().split('\n').length,
      content,
    };
  });
}

module.exports = { ensureSkillFiles, loadSkillForDept, listSkillFiles };
