const crypto = require('node:crypto');
const express = require('express');

function safeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const ba = Buffer.from(a), bb = Buffer.from(b);
  return ba.length === bb.length && crypto.timingSafeEqual(ba, bb);
}

async function exchangeCode(provider, code, state, redirectUri) {
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: provider.clientId,
    redirect_uri: redirectUri,
    code,
  });
  if (provider.clientSecret) body.set('client_secret', provider.clientSecret);
  if (provider.key === 'naver') body.set('state', state);

  const res = await fetch(provider.tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8', Accept: 'application/json' },
    body,
  });
  const data = await res.json().catch(() => ({}));
  // 네이버는 실패해도 200과 함께 error 필드를 돌려준다
  if (!res.ok || !data.access_token) {
    throw new Error(`토큰 교환 실패 (${provider.key}): ${res.status} ${data.error || ''}`.trim());
  }
  return data.access_token;
}

async function fetchProfile(provider, accessToken) {
  const res = await fetch(provider.profileUrl, {
    headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || (provider.key === 'naver' && data.resultcode !== '00')) {
    throw new Error(`프로필 조회 실패 (${provider.key}): ${res.status}`);
  }
  const user = provider.toUser(data);
  if (!user.id || user.id === 'undefined') throw new Error(`프로필에 사용자 ID가 없음 (${provider.key})`);
  return { provider: provider.key, ...user };
}

function createAuthRouter({ providers, baseUrl, log = console }) {
  const router = express.Router();
  const redirectUri = (key) => `${baseUrl}/auth/${key}/callback`;
  const fail = (res, code) => res.redirect(`/login?error=${encodeURIComponent(code)}`);

  // 로그인 화면에 표시할 활성 제공자 목록
  router.get('/auth/providers', (req, res) => {
    res.json(Object.values(providers).map((p) => ({ key: p.key, label: p.label })));
  });

  router.get('/auth/:provider', (req, res) => {
    const provider = providers[req.params.provider];
    if (!provider) return res.status(404).send('지원하지 않는 로그인 제공자입니다.');

    const state = crypto.randomBytes(32).toString('base64url');
    req.session.oauth = { provider: provider.key, state, createdAt: Date.now() };

    const url = new URL(provider.authorizeUrl);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('client_id', provider.clientId);
    url.searchParams.set('redirect_uri', redirectUri(provider.key));
    url.searchParams.set('state', state);
    if (provider.scope) url.searchParams.set('scope', provider.scope);
    if (provider.key === 'google') url.searchParams.set('prompt', 'select_account');

    req.session.save((err) => {
      if (err) return fail(res, 'session');
      res.redirect(url.toString());
    });
  });

  router.get('/auth/:provider/callback', async (req, res) => {
    const provider = providers[req.params.provider];
    if (!provider) return res.status(404).send('지원하지 않는 로그인 제공자입니다.');

    const pending = req.session.oauth;
    delete req.session.oauth; // state는 한 번만 사용

    if (req.query.error) return fail(res, 'denied');
    const expired = !pending || Date.now() - pending.createdAt > 10 * 60 * 1000;
    if (expired || pending.provider !== provider.key || !safeEqual(pending.state, req.query.state)) {
      return fail(res, 'state');
    }
    if (typeof req.query.code !== 'string') return fail(res, 'code');

    let user;
    try {
      const token = await exchangeCode(provider, req.query.code, pending.state, redirectUri(provider.key));
      user = await fetchProfile(provider, token);
    } catch (err) {
      log.error(err.message);
      return fail(res, 'provider');
    }

    // 세션 고정 공격 방지: 로그인 시 세션 ID를 새로 발급
    req.session.regenerate((err) => {
      if (err) return fail(res, 'session');
      req.session.user = user;
      req.session.save((err2) => {
        if (err2) return fail(res, 'session');
        res.redirect('/');
      });
    });
  });

  router.post('/auth/logout', (req, res) => {
    req.session.destroy(() => {
      res.clearCookie('sid');
      res.redirect(303, '/login');
    });
  });

  router.get('/api/me', (req, res) => {
    if (!req.session.user) return res.status(401).json({ error: 'unauthenticated' });
    const { provider, name, email, avatar } = req.session.user;
    res.json({ provider, name, email, avatar });
  });

  return router;
}

module.exports = { createAuthRouter };
