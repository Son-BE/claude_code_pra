// 샘플 데이터 생성기 — 시드 고정이라 새로고침해도 같은 데이터가 나온다.
// 실제 데이터로 바꾸려면 window.DASHBOARD_DATA를 같은 형태로 채우면 된다.
(function () {
  function mulberry32(seed) {
    return function () {
      seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const rand = mulberry32(20260923);

  const channels = ['온라인', '매장', '파트너'];
  const regions = ['서울', '경기', '부산', '대구', '광주'];
  const categories = ['전자제품', '의류', '식품', '생활용품', '도서'];

  const channelWeight = { 온라인: 1.0, 매장: 0.75, 파트너: 0.4 };
  const channelGrowth = { 온라인: 0.022, 매장: 0.004, 파트너: 0.012 };
  const regionWeight = { 서울: 1.0, 경기: 0.85, 부산: 0.5, 대구: 0.38, 광주: 0.3 };
  const categoryBase = { 전자제품: 42e6, 의류: 28e6, 식품: 24e6, 생활용품: 18e6, 도서: 7e6 };
  const categoryPrice = { 전자제품: 380000, 의류: 72000, 식품: 31000, 생활용품: 44000, 도서: 18000 };

  // 2024-09 ~ 2026-08 (24개월)
  const months = [];
  for (let i = 0; i < 24; i++) {
    const d = new Date(2024, 8 + i, 1);
    months.push(d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'));
  }

  const rows = [];
  months.forEach((month, mi) => {
    const m = Number(month.slice(5));
    const season = 1 + 0.12 * Math.sin(((m - 3) / 12) * Math.PI * 2) + (m === 11 || m === 12 ? 0.18 : 0);
    channels.forEach((ch) => {
      const trend = Math.pow(1 + channelGrowth[ch], mi);
      regions.forEach((rg) => {
        categories.forEach((cat) => {
          const noise = 0.88 + rand() * 0.24;
          const revenue = Math.round(categoryBase[cat] * channelWeight[ch] * regionWeight[rg] * season * trend * noise);
          const orders = Math.max(1, Math.round(revenue / (categoryPrice[cat] * (0.9 + rand() * 0.2))));
          const newCustomers = Math.round(orders * (0.14 + rand() * 0.08));
          rows.push({ month, channel: ch, region: rg, category: cat, revenue, orders, newCustomers });
        });
      });
    });
  });

  const names = ['김민준', '이서연', '박도윤', '최지우', '정하준', '강서윤', '조은우', '윤지아', '장시우', '임하은', '한예준', '오수아'];
  const statuses = ['완료', '완료', '완료', '처리중', '처리중', '지연', '취소'];
  const orders = [];
  for (let i = 0; i < 60; i++) {
    const cat = categories[Math.floor(rand() * categories.length)];
    const day = 31 - Math.floor(i / 2);
    orders.push({
      id: 'ORD-' + String(260800 + 60 - i),
      date: '2026-08-' + String(Math.max(1, day)).padStart(2, '0'),
      customer: names[Math.floor(rand() * names.length)],
      region: regions[Math.floor(rand() * regions.length)],
      channel: channels[Math.floor(rand() * channels.length)],
      category: cat,
      amount: Math.round((categoryPrice[cat] * (0.5 + rand() * 2.5)) / 100) * 100,
      status: statuses[Math.floor(rand() * statuses.length)],
    });
  }

  window.DASHBOARD_DATA = { months, channels, regions, categories, rows, orders };
})();
