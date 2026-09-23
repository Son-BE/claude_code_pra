const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const { createApp } = require('../server/index');

// 가짜 OAuth 제공자: 토큰/프로필 엔드포인트를 흉내 낸다
function startFakeProvider() {
  const app = express();
  app.use(express.urlencoded({ extended: false }));
  const seen = [];
  app.post('/:p/token', (req, res) => {
    seen.push({ provider: req.params.p, body: req.body });
    if (req.body.code !== 'good-code') return res.status(req.params.p === 'naver' ? 200 : 400).json({ error: 'invalid_grant' });
    res.json({ access_token: `tok-${req.params.p}`, token_type: 'bearer' });
  });
  app.get('/:p/me', (req, res) => {
    const p = req.params.p;
    if (req.get('authorization') !== `Bearer tok-${p}`) return res.status(401).end();
    if (p === 'google') return res.json({ sub: 'g1', name: '구글유저', email: 'g@example.com', picture: 'https://example.com/g.png' });
    if (p === 'kakao') return res.json({ id: 42, kakao_account: { email: 'k@example.com', profile: { nickname: '카카오유저' } } });
    res.json({ resultcode: '00', message: 'success', response: { id: 'n1', name: '네이버유저', email: 'n@example.com' } });
  });
  return new Promise((resolve) => {
    const srv = app.listen(0, () => resolve({ srv, url: `http://127.0.0.1:${srv.address().port}`, seen }));
  });
}

function startApp(fakeUrl) {
  const env = {
    SESSION_SECRET: 'test-secret',
    GOOGLE_CLIENT_ID: 'gid', GOOGLE_CLIENT_SECRET: 'gsec',
    KAKAO_CLIENT_ID: 'kid',
    NAVER_CLIENT_ID: 'nid', NAVER_CLIENT_SECRET: 'nsec',
  };
  const overrides = {};
  for (const p of ['google', 'kakao', 'naver']) {
    overrides[p] = { tokenUrl: `${fakeUrl}/${p}/token`, profileUrl: `${fakeUrl}/${p}/me` };
  }
  const log = { warn() {}, error() {} };
  return new Promise((resolve) => {
    let srv;
    const app = createApp({ env: { ...env, BASE_URL: 'http://app.test' }, providerOverrides: overrides, log });
    srv = app.listen(0, () => resolve({ srv, url: `http://127.0.0.1:${srv.address().port}` }));
  });
}

// 쿠키를 유지하는 간단한 클라이언트
function client(base) {
  let cookie = '';
  return async (path, opts = {}) => {
    const res = await fetch(base + path, { redirect: 'manual', ...opts, headers: { ...(opts.headers || {}), cookie } });
    const set = res.headers.getSetCookie();
    if (set.length) cookie = set.map((c) => c.split(';')[0]).join('; ');
    return res;
  };
}

let fake, app;
test.before(async () => { fake = await startFakeProvider(); app = await startApp(fake.url); });
test.after(() => { fake.srv.close(); app.srv.close(); });

test('로그인하지 않으면 대시보드 대신 로그인 페이지로 보낸다', async () => {
  const req = client(app.url);
  const res = await req('/');
  assert.equal(res.status, 302);
  assert.equal(res.headers.get('location'), '/login');
  assert.equal((await req('/app.js')).status, 302);
  assert.equal((await req('/api/me')).status, 401);
  assert.equal((await req('/login')).status, 200);
});

test('활성 제공자 목록을 돌려준다', async () => {
  const res = await fetch(app.url + '/auth/providers');
  assert.deepEqual((await res.json()).map((p) => p.key), ['google', 'kakao', 'naver']);
});

for (const [key, name] of [['google', '구글유저'], ['kakao', '카카오유저'], ['naver', '네이버유저']]) {
  test(`${key} 로그인 전체 흐름`, async () => {
    const req = client(app.url);
    const start = await req(`/auth/${key}`);
    assert.equal(start.status, 302);
    const authUrl = new URL(start.headers.get('location'));
    assert.equal(authUrl.searchParams.get('client_id'), { google: 'gid', kakao: 'kid', naver: 'nid' }[key]);
    assert.equal(authUrl.searchParams.get('redirect_uri'), `http://app.test/auth/${key}/callback`);
    const state = authUrl.searchParams.get('state');
    assert.ok(state && state.length >= 32);
    const preLoginCookie = start.headers.getSetCookie()[0].split(';')[0];

    const cb = await req(`/auth/${key}/callback?code=good-code&state=${encodeURIComponent(state)}`);
    assert.equal(cb.status, 302);
    assert.equal(cb.headers.get('location'), '/');
    // 로그인 후 세션 ID가 바뀌어야 한다 (세션 고정 방지)
    assert.notEqual(cb.headers.getSetCookie()[0].split(';')[0], preLoginCookie);

    const me = await (await req('/api/me')).json();
    assert.equal(me.name, name);
    assert.equal(me.provider, key);
    assert.equal((await req('/')).status, 200);

    const out = await req('/auth/logout', { method: 'POST' });
    assert.equal(out.status, 303);
    assert.equal((await req('/api/me')).status, 401);
  });
}

test('state가 다르면 로그인하지 않는다', async () => {
  const req = client(app.url);
  await req('/auth/google');
  const cb = await req('/auth/google/callback?code=good-code&state=wrong');
  assert.equal(cb.headers.get('location'), '/login?error=state');
  assert.equal((await req('/api/me')).status, 401);
});

test('state는 한 번만 쓸 수 있다', async () => {
  const req = client(app.url);
  const state = new URL((await req('/auth/kakao')).headers.get('location')).searchParams.get('state');
  const first = await req(`/auth/kakao/callback?code=bad-code&state=${state}`);
  assert.equal(first.headers.get('location'), '/login?error=provider');
  const replay = await req(`/auth/kakao/callback?code=good-code&state=${state}`);
  assert.equal(replay.headers.get('location'), '/login?error=state');
});

test('네이버가 200과 함께 에러를 주면 실패로 처리한다', async () => {
  const req = client(app.url);
  const state = new URL((await req('/auth/naver')).headers.get('location')).searchParams.get('state');
  const cb = await req(`/auth/naver/callback?code=bad-code&state=${state}`);
  assert.equal(cb.headers.get('location'), '/login?error=provider');
});

test('사용자가 동의를 거부하면 로그인 페이지로 돌아간다', async () => {
  const req = client(app.url);
  const state = new URL((await req('/auth/google')).headers.get('location')).searchParams.get('state');
  const cb = await req(`/auth/google/callback?error=access_denied&state=${state}`);
  assert.equal(cb.headers.get('location'), '/login?error=denied');
});

test('설정되지 않은 제공자는 404', async () => {
  assert.equal((await fetch(app.url + '/auth/facebook', { redirect: 'manual' })).status, 404);
});
