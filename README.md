# claude_code_pra

## 매출 대시보드 (`dashboard/`)

빌드나 의존성 없이 브라우저에서 바로 여는 정적 대시보드입니다.

```bash
open dashboard/index.html        # 또는 python3 -m http.server 후 /dashboard/ 접속
```

- **KPI**: 총 매출 · 주문 수 · 평균 주문 금액 · 신규 고객 (직전 동일 기간 대비 증감, 스파크라인)
- **채널별 월 매출**: 선 그래프, 크로스헤어 툴팁, 키보드(←/→) 탐색, 표 보기
- **카테고리별 매출**: 가로 막대
- **지역별 매출**: 채널 구성 누적 막대, 표 보기
- **최근 주문**: 상태 아이콘 + 라벨
- **필터**: 기간(3/6/12/24개월) · 지역 · 카테고리 — 모든 차트와 지표에 동시 적용
- 라이트/다크 테마(시스템 설정 자동 + 수동 전환), 모바일 레이아웃

데이터는 `dashboard/data.js`에서 시드 고정 샘플로 생성됩니다. 실제 데이터를 쓰려면
`window.DASHBOARD_DATA`를 같은 형태(`months`, `channels`, `regions`, `categories`, `rows`, `orders`)로 채우면 됩니다.
