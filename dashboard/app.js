(function () {
  const D = window.DASHBOARD_DATA;
  const NS = 'http://www.w3.org/2000/svg';
  const SERIES = ['var(--series-1)', 'var(--series-2)', 'var(--series-3)'];
  const channelColor = {};
  D.channels.forEach((c, i) => { channelColor[c] = SERIES[i]; }); // 색은 엔티티를 따른다 (필터와 무관)

  const state = { period: 12, region: '전체', category: '전체' };
  const $ = (id) => document.getElementById(id);
  const tooltip = $('tooltip');

  // ---------- 포맷 ----------
  function won(v) {
    const a = Math.abs(v);
    if (a >= 1e8) return '₩' + (v / 1e8).toFixed(a >= 1e10 ? 0 : 1) + '억';
    if (a >= 1e6) return '₩' + Math.round(v / 1e4).toLocaleString('ko-KR') + '만';
    return '₩' + Math.round(v).toLocaleString('ko-KR');
  }
  function wonAxis(v) {
    if (v === 0) return '0';
    if (v >= 1e8) return (v / 1e8).toLocaleString('ko-KR', { maximumFractionDigits: 1 }) + '억';
    return Math.round(v / 1e4).toLocaleString('ko-KR') + '만';
  }
  const num = (v) => Math.round(v).toLocaleString('ko-KR');
  const monthLabel = (m) => m.slice(2, 4) + '.' + m.slice(5);

  // ---------- DOM helpers ----------
  function el(tag, attrs, parent, text) {
    const n = tag.startsWith('svg:') ? document.createElementNS(NS, tag.slice(4)) : document.createElement(tag);
    for (const k in attrs || {}) n.setAttribute(k, attrs[k]);
    if (text != null) n.textContent = text;
    if (parent) parent.appendChild(n);
    return n;
  }
  const s = (tag, attrs, parent, text) => el('svg:' + tag, attrs, parent, text);

  function niceStep(max, count) {
    const raw = max / count;
    const mag = Math.pow(10, Math.floor(Math.log10(raw)));
    const f = raw / mag;
    return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * mag;
  }
  function ticks(max, count) {
    if (max <= 0) return [0, 1];
    const step = niceStep(max, count);
    const out = [];
    for (let v = 0; v <= Math.ceil(max / step) * step + 1e-9; v += step) out.push(v);
    return out;
  }

  // 막대: 기준선 쪽은 각지고 데이터 끝은 4px 라운드
  function hBarPath(x0, x1, y, h, rounded) {
    const w = x1 - x0;
    if (w <= 0) return '';
    const r = rounded ? Math.min(4, w, h / 2) : 0;
    return `M${x0},${y}H${x1 - r}Q${x1},${y} ${x1},${y + r}V${y + h - r}Q${x1},${y + h} ${x1 - r},${y + h}H${x0}Z`;
  }

  // ---------- 툴팁 ----------
  function showTip(evt, title, rows) {
    tooltip.textContent = '';
    el('div', { class: 't-title' }, tooltip, title);
    rows.forEach((r) => {
      const row = el('div', { class: 'row' }, tooltip);
      const key = el('i', {}, row);
      key.style.background = r.color || 'transparent';
      el('b', {}, row, r.value);
      el('span', {}, row, r.label);
    });
    tooltip.hidden = false;
    moveTip(evt);
  }
  function moveTip(evt) {
    let x, y;
    if (evt.clientX != null) { x = evt.clientX; y = evt.clientY; }
    else { const b = evt.target.getBoundingClientRect(); x = b.right; y = b.top; }
    const w = tooltip.offsetWidth, h = tooltip.offsetHeight;
    let left = x + 14, top = y + 14;
    if (left + w > window.innerWidth - 8) left = x - w - 14;
    if (top + h > window.innerHeight - 8) top = y - h - 14;
    tooltip.style.left = Math.max(8, left) + 'px';
    tooltip.style.top = Math.max(8, top) + 'px';
  }
  const hideTip = () => { tooltip.hidden = true; };

  function bindTip(node, title, rowsFn) {
    node.setAttribute('tabindex', '0');
    node.classList.add('mark');
    const show = (e) => showTip(e, title, rowsFn());
    node.addEventListener('pointerenter', show);
    node.addEventListener('pointermove', moveTip);
    node.addEventListener('pointerleave', hideTip);
    node.addEventListener('focus', show);
    node.addEventListener('blur', hideTip);
  }

  // ---------- 데이터 슬라이스 ----------
  function rangeMonths(offset) {
    const end = D.months.length - offset * state.period;
    const start = end - state.period;
    if (start < 0) return null;
    return D.months.slice(start, end);
  }
  function filterRows(months, opts) {
    const set = new Set(months);
    const o = opts || {};
    return D.rows.filter((r) =>
      set.has(r.month) &&
      (o.ignoreRegion || state.region === '전체' || r.region === state.region) &&
      (o.ignoreCategory || state.category === '전체' || r.category === state.category));
  }
  function sum(rows, key) { return rows.reduce((a, r) => a + r[key], 0); }
  function groupSum(rows, by, key) {
    const out = {};
    rows.forEach((r) => { out[r[by]] = (out[r[by]] || 0) + r[key]; });
    return out;
  }

  // ---------- KPI ----------
  function renderKpis(cur, prev, months) {
    const root = $('kpis');
    root.textContent = '';
    const byMonth = (key) => months.map((m) => sum(cur.filter((r) => r.month === m), key));
    const defs = [
      { label: '총 매출', hero: true, v: sum(cur, 'revenue'), p: prev && sum(prev, 'revenue'), fmt: won, spark: byMonth('revenue') },
      { label: '주문 수', v: sum(cur, 'orders'), p: prev && sum(prev, 'orders'), fmt: num, spark: byMonth('orders') },
      { label: '평균 주문 금액', v: sum(cur, 'revenue') / Math.max(1, sum(cur, 'orders')), p: prev && sum(prev, 'revenue') / Math.max(1, sum(prev, 'orders')), fmt: won },
      { label: '신규 고객', v: sum(cur, 'newCustomers'), p: prev && sum(prev, 'newCustomers'), fmt: num, spark: byMonth('newCustomers') },
    ];
    defs.forEach((d) => {
      const card = el('div', { class: 'kpi' + (d.hero ? ' hero' : '') }, root);
      el('div', { class: 'label' }, card, d.label);
      el('div', { class: 'value' }, card, d.fmt(d.v));
      const delta = el('div', { class: 'delta' }, card);
      if (d.p) {
        const pct = ((d.v - d.p) / d.p) * 100;
        const up = pct >= 0;
        el('b', { class: up ? 'up' : 'down' }, delta, (up ? '▲ +' : '▼ ') + pct.toFixed(1) + '%');
        delta.appendChild(document.createTextNode(' 직전 ' + state.period + '개월 대비'));
      } else {
        delta.textContent = '비교 기간 데이터 없음';
      }
      if (d.spark && d.spark.length > 1) sparkline(card, d.spark);
    });
  }
  function sparkline(parent, vals) {
    const W = 200, H = 32, pad = 4;
    const svg = s('svg', { viewBox: `0 0 ${W} ${H}`, preserveAspectRatio: 'none', 'aria-hidden': 'true' }, parent);
    const min = Math.min(...vals), max = Math.max(...vals);
    const x = (i) => pad + (i / (vals.length - 1)) * (W - pad * 2);
    const y = (v) => H - pad - ((v - min) / (max - min || 1)) * (H - pad * 2);
    s('path', {
      d: vals.map((v, i) => (i ? 'L' : 'M') + x(i) + ',' + y(v)).join(''),
      fill: 'none', stroke: 'var(--text-muted)', 'stroke-width': 1.5,
      'vector-effect': 'non-scaling-stroke', 'stroke-linejoin': 'round',
    }, svg);
    // 현재 월 강조 (viewBox가 늘어나므로 점 대신 짧은 세그먼트로 표시)
    const n = vals.length - 1;
    s('path', {
      d: `M${x(n - 1)},${y(vals[n - 1])}L${x(n)},${y(vals[n])}`,
      fill: 'none', stroke: 'var(--series-1)', 'stroke-width': 2.5,
      'vector-effect': 'non-scaling-stroke', 'stroke-linecap': 'round',
    }, svg);
  }

  // ---------- 범례 ----------
  function legend(id, items, box) {
    const root = $(id);
    root.textContent = '';
    items.forEach((it) => {
      const sp = el('span', {}, root);
      const i = el('i', { class: box ? 'box' : '' }, sp);
      i.style.background = it.color;
      sp.appendChild(document.createTextNode(it.label));
    });
  }

  // ---------- 라인 차트: 채널별 월 매출 ----------
  function renderLine(cur, months) {
    const root = $('chart-line');
    root.textContent = '';
    legend('legend-line', D.channels.map((c) => ({ label: c, color: channelColor[c] })));

    const series = D.channels.map((c) => {
      const rows = cur.filter((r) => r.channel === c);
      const g = groupSum(rows, 'month', 'revenue');
      return { name: c, color: channelColor[c], vals: months.map((m) => g[m] || 0) };
    });

    const W = root.clientWidth || 600, H = 280;
    const M = { t: 12, r: 64, b: 28, l: 52 };
    const iw = W - M.l - M.r, ih = H - M.t - M.b;
    const max = Math.max(1, ...series.flatMap((x) => x.vals));
    const tk = ticks(max, 4);
    const top = tk[tk.length - 1];
    const x = (i) => M.l + (months.length === 1 ? iw / 2 : (i / (months.length - 1)) * iw);
    const y = (v) => M.t + ih - (v / top) * ih;

    const svg = s('svg', { width: W, height: H, role: 'img', 'aria-label': '채널별 월 매출 선 그래프' }, root);
    const ax = s('g', { class: 'axis' }, svg);
    tk.forEach((v) => {
      s('line', { class: v === 0 ? 'baseline' : 'gridline', x1: M.l, x2: M.l + iw, y1: y(v), y2: y(v) }, ax);
      s('text', { x: M.l - 8, y: y(v) + 4, 'text-anchor': 'end' }, ax, wonAxis(v));
    });
    const every = Math.ceil(months.length / Math.max(2, Math.floor(iw / 56)));
    months.forEach((m, i) => {
      if (i % every === 0 || i === months.length - 1) {
        if (i !== months.length - 1 && months.length - 1 - i < every) return;
        s('text', { x: x(i), y: H - 8, 'text-anchor': 'middle' }, ax, monthLabel(m));
      }
    });

    series.forEach((se) => {
      s('path', {
        d: se.vals.map((v, i) => (i ? 'L' : 'M') + x(i) + ',' + y(v)).join(''),
        fill: 'none', stroke: se.color, 'stroke-width': 2, 'stroke-linejoin': 'round', 'stroke-linecap': 'round',
      }, svg);
      const n = se.vals.length - 1;
      s('circle', { cx: x(n), cy: y(se.vals[n]), r: 4, fill: se.color, stroke: 'var(--surface-1)', 'stroke-width': 2 }, svg);
    });

    // 끝 라벨: 서로 겹치면 생략 (범례 + 툴팁이 대신함)
    const ends = series.map((se) => ({ name: se.name, y: y(se.vals[se.vals.length - 1]) })).sort((a, b) => a.y - b.y);
    const fits = ends.every((e, i) => i === 0 || e.y - ends[i - 1].y >= 14);
    if (fits) ends.forEach((e) => s('text', { class: 'lbl', x: x(months.length - 1) + 10, y: e.y + 4 }, svg, e.name));

    // 크로스헤어
    const cross = s('line', { x1: 0, x2: 0, y1: M.t, y2: M.t + ih, stroke: 'var(--axis)', 'stroke-width': 1, visibility: 'hidden' }, svg);
    const dots = series.map((se) => s('circle', { r: 4, fill: se.color, stroke: 'var(--surface-1)', 'stroke-width': 2, visibility: 'hidden' }, svg));
    const hit = s('rect', { x: M.l, y: M.t, width: iw, height: ih, fill: 'transparent', tabindex: 0, 'aria-label': '월별 값 탐색 (좌우 화살표)' }, svg);
    let idx = months.length - 1;
    function show(i, evt) {
      idx = i;
      cross.setAttribute('x1', x(i)); cross.setAttribute('x2', x(i));
      cross.setAttribute('visibility', 'visible');
      dots.forEach((d, k) => { d.setAttribute('cx', x(i)); d.setAttribute('cy', y(series[k].vals[i])); d.setAttribute('visibility', 'visible'); });
      const total = series.reduce((a, se) => a + se.vals[i], 0);
      showTip(evt, months[i] + ' · 합계 ' + won(total), series.map((se) => ({ color: se.color, value: won(se.vals[i]), label: se.name })));
    }
    function hide() {
      cross.setAttribute('visibility', 'hidden');
      dots.forEach((d) => d.setAttribute('visibility', 'hidden'));
      hideTip();
    }
    hit.addEventListener('pointermove', (e) => {
      const b = svg.getBoundingClientRect();
      const px = e.clientX - b.left - M.l;
      const i = months.length === 1 ? 0 : Math.round((px / iw) * (months.length - 1));
      show(Math.max(0, Math.min(months.length - 1, i)), e);
    });
    hit.addEventListener('pointerleave', hide);
    hit.addEventListener('focus', (e) => show(idx, e));
    hit.addEventListener('blur', hide);
    hit.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        e.preventDefault();
        show(Math.max(0, Math.min(months.length - 1, idx + (e.key === 'ArrowRight' ? 1 : -1))), { target: hit });
      }
    });

    // 표 보기
    table('table-line', ['월', ...D.channels, '합계'], months.map((m, i) => {
      const vals = series.map((se) => se.vals[i]);
      return [m, ...vals.map(won), won(vals.reduce((a, b) => a + b, 0))];
    }), [false, true, true, true, true]);
  }

  // ---------- 카테고리 가로 막대 ----------
  function renderCategory(months) {
    const root = $('chart-category');
    root.textContent = '';
    const rows = filterRows(months, { ignoreCategory: true });
    const g = groupSum(rows, 'category', 'revenue');
    const data = D.categories.map((c) => ({ name: c, v: g[c] || 0 })).sort((a, b) => b.v - a.v);
    const total = data.reduce((a, d) => a + d.v, 0);

    const W = root.clientWidth || 400, band = 40;
    const M = { t: 4, r: 72, b: 4, l: 68 };
    const H = M.t + M.b + band * data.length;
    const iw = W - M.l - M.r;
    const max = Math.max(1, ...data.map((d) => d.v));
    const svg = s('svg', { width: W, height: H, role: 'img', 'aria-label': '카테고리별 매출 막대 그래프' }, root);
    s('line', { class: 'baseline', x1: M.l, x2: M.l, y1: M.t, y2: H - M.b }, svg);
    data.forEach((d, i) => {
      const y0 = M.t + i * band, bh = 20, by = y0 + (band - bh) / 2;
      const x1 = M.l + (d.v / max) * iw;
      const dim = state.category !== '전체' && state.category !== d.name;
      const g2 = s('g', { class: dim ? 'dim' : '' }, svg);
      s('text', { class: 'lbl', x: M.l - 10, y: by + 14, 'text-anchor': 'end' }, g2, d.name);
      s('path', { d: hBarPath(M.l, x1, by, bh, true), fill: 'var(--series-1)' }, g2);
      s('text', { class: 'lbl-strong', x: x1 + 8, y: by + 14 }, g2, won(d.v));
      const hitR = s('rect', { x: 0, y: y0, width: W, height: band, fill: 'transparent' }, g2);
      bindTip(hitR, d.name, () => [
        { color: 'var(--series-1)', value: won(d.v), label: '매출' },
        { value: (total ? (d.v / total) * 100 : 0).toFixed(1) + '%', label: '비중' },
      ]);
    });
  }

  // ---------- 지역별 누적 막대 ----------
  function renderRegion(months) {
    const root = $('chart-region');
    root.textContent = '';
    legend('legend-region', D.channels.map((c) => ({ label: c, color: channelColor[c] })), true);
    const rows = filterRows(months, { ignoreRegion: true });
    const data = D.regions.map((rg) => {
      const byCh = groupSum(rows.filter((r) => r.region === rg), 'channel', 'revenue');
      const parts = D.channels.map((c) => ({ ch: c, v: byCh[c] || 0 }));
      return { name: rg, parts, total: parts.reduce((a, p) => a + p.v, 0) };
    });

    const W = root.clientWidth || 400, band = 40;
    const M = { t: 4, r: 72, b: 4, l: 44 };
    const H = M.t + M.b + band * data.length;
    const iw = W - M.l - M.r;
    const max = Math.max(1, ...data.map((d) => d.total));
    const svg = s('svg', { width: W, height: H, role: 'img', 'aria-label': '지역별 채널 구성 누적 막대 그래프' }, root);
    s('line', { class: 'baseline', x1: M.l, x2: M.l, y1: M.t, y2: H - M.b }, svg);
    data.forEach((d, i) => {
      const y0 = M.t + i * band, bh = 20, by = y0 + (band - bh) / 2;
      const dim = state.region !== '전체' && state.region !== d.name;
      const g2 = s('g', { class: dim ? 'dim' : '' }, svg);
      s('text', { class: 'lbl', x: M.l - 10, y: by + 14, 'text-anchor': 'end' }, g2, d.name);
      let x0 = M.l;
      const visible = d.parts.filter((p) => p.v > 0);
      visible.forEach((p, k) => {
        const w = (p.v / max) * iw;
        const last = k === visible.length - 1;
        const seg = s('path', { d: hBarPath(x0, x0 + w - (last ? 0 : 2), by, bh, last), fill: channelColor[p.ch] }, g2);
        bindTip(seg, d.name + ' · ' + p.ch, () => [
          { color: channelColor[p.ch], value: won(p.v), label: p.ch },
          { value: ((p.v / d.total) * 100).toFixed(1) + '%', label: '지역 내 비중' },
        ]);
        x0 += w;
      });
      s('text', { class: 'lbl-strong', x: x0 + 8, y: by + 14 }, g2, won(d.total));
    });

    table('table-region', ['지역', ...D.channels, '합계'],
      data.map((d) => [d.name, ...d.parts.map((p) => won(p.v)), won(d.total)]),
      [false, true, true, true, true]);
  }

  // ---------- 주문 테이블 ----------
  const STATUS = {
    완료: { color: 'var(--status-good)', ico: '✓' },
    처리중: { color: 'var(--status-warning)', ico: '…' },
    지연: { color: 'var(--status-serious)', ico: '!' },
    취소: { color: 'var(--status-critical)', ico: '✕' },
  };
  function renderOrders() {
    const root = $('orders');
    root.textContent = '';
    const list = D.orders.filter((o) =>
      (state.region === '전체' || o.region === state.region) &&
      (state.category === '전체' || o.category === state.category)).slice(0, 8);
    if (!list.length) { el('p', { class: 'card-sub' }, root, '조건에 맞는 주문이 없습니다.'); return; }
    const t = el('table', {}, root);
    const hr = el('tr', {}, el('thead', {}, t));
    ['주문번호', '일자', '고객', '지역', '채널', '카테고리', '금액', '상태'].forEach((h, i) =>
      el('th', { class: i === 6 ? 'num' : '' }, hr, h));
    const tb = el('tbody', {}, t);
    list.forEach((o) => {
      const tr = el('tr', {}, tb);
      [o.id, o.date, o.customer, o.region, o.channel, o.category].forEach((v) => el('td', {}, tr, v));
      el('td', { class: 'num' }, tr, '₩' + o.amount.toLocaleString('ko-KR'));
      const st = el('span', { class: 'status' }, el('td', {}, tr));
      const ico = el('span', { class: 'ico', 'aria-hidden': 'true' }, st, STATUS[o.status].ico);
      ico.style.background = STATUS[o.status].color;
      st.appendChild(document.createTextNode(o.status));
    });
  }

  function table(id, head, rows, numeric) {
    const root = $(id);
    root.textContent = '';
    const t = el('table', {}, root);
    const hr = el('tr', {}, el('thead', {}, t));
    head.forEach((h, i) => el('th', { class: numeric[i] ? 'num' : '' }, hr, h));
    const tb = el('tbody', {}, t);
    rows.forEach((r) => {
      const tr = el('tr', {}, tb);
      r.forEach((v, i) => el('td', { class: numeric[i] ? 'num' : '' }, tr, v));
    });
  }

  // ---------- 렌더 ----------
  function render() {
    hideTip();
    const months = rangeMonths(0);
    const prevMonths = rangeMonths(1);
    const cur = filterRows(months);
    const prev = prevMonths ? filterRows(prevMonths) : null;
    $('range-label').textContent = months[0] + ' ~ ' + months[months.length - 1] +
      ' · ' + (state.region === '전체' ? '전체 지역' : state.region) +
      ' · ' + (state.category === '전체' ? '전체 카테고리' : state.category) + ' · 샘플 데이터';
    renderKpis(cur, prev, months);
    renderLine(cur, months);
    renderCategory(months);
    renderRegion(months);
    renderOrders();
  }

  function initFilters() {
    const fill = (sel, items) => ['전체', ...items].forEach((v) => el('option', { value: v }, sel, v));
    fill($('f-region'), D.regions);
    fill($('f-category'), D.categories);
    $('f-period').addEventListener('change', (e) => { state.period = Number(e.target.value); render(); });
    $('f-region').addEventListener('change', (e) => { state.region = e.target.value; render(); });
    $('f-category').addEventListener('change', (e) => { state.category = e.target.value; render(); });
  }

  function initTheme() {
    const btn = $('theme-toggle');
    const modes = ['auto', 'light', 'dark'];
    const names = { auto: '자동', light: '라이트', dark: '다크' };
    let mode = 'auto';
    try { mode = localStorage.getItem('dash-theme') || 'auto'; } catch (e) { /* 저장소 없음 */ }
    const apply = () => {
      if (mode === 'auto') document.documentElement.removeAttribute('data-theme');
      else document.documentElement.setAttribute('data-theme', mode);
      btn.textContent = '테마: ' + names[mode];
    };
    btn.addEventListener('click', () => {
      mode = modes[(modes.indexOf(mode) + 1) % modes.length];
      try { localStorage.setItem('dash-theme', mode); } catch (e) { /* 저장소 없음 */ }
      apply();
    });
    apply();
  }

  let rt;
  window.addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(render, 120); });

  initTheme();
  initFilters();
  render();
})();
