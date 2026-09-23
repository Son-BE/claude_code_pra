# claude_code_pra

## 매출 대시보드 (`dashboard/`)

`dashboard/index.html`을 브라우저로 바로 열어도 되고(로그인 없이 미리보기),
아래 서버로 실행하면 소셜 로그인을 거쳐야 볼 수 있습니다.

- **KPI**: 총 매출 · 주문 수 · 평균 주문 금액 · 신규 고객 (직전 동일 기간 대비 증감, 스파크라인)
- **채널별 월 매출**: 선 그래프, 크로스헤어 툴팁, 키보드(←/→) 탐색, 표 보기
- **카테고리별 매출**: 가로 막대
- **지역별 매출**: 채널 구성 누적 막대, 표 보기
- **최근 주문**: 상태 아이콘 + 라벨
- **필터**: 기간(3/6/12/24개월) · 지역 · 카테고리 — 모든 차트와 지표에 동시 적용
- 라이트/다크 테마(시스템 설정 자동 + 수동 전환), 모바일 레이아웃

데이터는 `dashboard/data.js`에서 시드 고정 샘플로 생성됩니다. 실제 데이터를 쓰려면
`window.DASHBOARD_DATA`를 같은 형태(`months`, `channels`, `regions`, `categories`, `rows`, `orders`)로 채우면 됩니다.

## 소셜 로그인 (Google · 카카오 · 네이버)

Express 서버가 대시보드를 서빙하며, 로그인하지 않은 사용자는 `/login`으로 보냅니다.

```bash
npm install
cp .env.example .env   # SESSION_SECRET과 각 제공자의 CLIENT_ID/SECRET 입력
npm start              # http://localhost:3000
npm test               # 가짜 OAuth 서버로 로그인 흐름 전체를 검증
```

각 개발자 콘솔에 등록할 Redirect URI는 `{BASE_URL}/auth/{google|kakao|naver}/callback` 입니다.
`.env`에 키가 있는 제공자만 로그인 버튼이 표시됩니다.

| 경로 | 설명 |
|---|---|
| `GET /login` | 로그인 페이지 |
| `GET /auth/:provider` | 제공자 로그인 화면으로 이동 |
| `GET /auth/:provider/callback` | 코드 교환 → 프로필 조회 → 세션 생성 |
| `POST /auth/logout` | 로그아웃 |
| `GET /api/me` | 로그인 사용자 정보 (미로그인 시 401) |

보안 처리: 요청마다 새 `state`(1회용, 10분 만료)로 CSRF 방지, 로그인 시 세션 ID 재발급,
`httpOnly`·`SameSite=Lax` 쿠키, 운영(`NODE_ENV=production`)에서는 `secure` 쿠키와 `SESSION_SECRET` 필수.

운영 배포 전 확인할 것:
- 세션 저장소가 기본 메모리 저장소라 서버 재시작 시 로그아웃되고 서버를 여러 대 둘 수 없습니다. Redis 등(`connect-redis`)으로 교체하세요.
- 사용자 정보는 세션에만 저장합니다. 회원 DB가 필요하면 `server/auth.js`의 콜백에서 `provider + id`로 저장/조회하세요.
- 카카오 이메일은 비즈 앱 전환 후 동의 항목을 켜야 받을 수 있습니다.
