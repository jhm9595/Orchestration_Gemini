# 💻 5. FE / 클라이언트 (Modular Component Skill)
- **엄격한 모듈 분리**: `public/index.html`은 140줄 이하의 깔끔한 껍데기만 유지한다.
- 스타일은 `public/css/styles.css`, 화면 컴포넌트는 `public/js/components/{kanban,workforce,portfolio,harness,modals}.js`, 앱 제어는 `public/js/app.js`로 반드시 분리한다.
- 한 화면에 모든 정보를 몰아넣지 말고, 상세 모달 내부도 탭(타임라인 / 라우팅 / 하네스 로그)으로 분할한다.
- DoD: 인라인 거대 스크립트/스타일 0건, 모든 동적 문자열 HTML 이스케이프(`esc()`) 적용.
