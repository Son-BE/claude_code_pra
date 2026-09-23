const path = require('node:path');
const express = require('express');
const session = require('express-session');
const { loadProviders } = require('./providers');
const { createAuthRouter } = require('./auth');

const ROOT = path.join(__dirname, '..');

function createApp({ env = process.env, providerOverrides, log = console } = {}) {
  const isProd = env.NODE_ENV === 'production';
  const port = Number(env.PORT) || 3000;
  const baseUrl = (env.BASE_URL || `http://localhost:${port}`).replace(/\/$/, '');

  if (!env.SESSION_SECRET) {
    if (isProd) throw new Error('SESSION_SECRET 환경 변수가 필요합니다.');
    log.warn('SESSION_SECRET이 없어 개발용 임시 값을 사용합니다. 서버를 재시작하면 모든 세션이 끊깁니다.');
  }

  const providers = loadProviders(env, providerOverrides);
  if (!Object.keys(providers).length) {
    log.warn('활성화된 소셜 로그인 제공자가 없습니다. .env에 CLIENT_ID/SECRET을 설정하세요.');
  }

  const app = express();
  app.disable('x-powered-by');
  if (isProd) app.set('trust proxy', 1); // HTTPS 프록시 뒤에서 secure 쿠키 사용

  app.use(session({
    name: 'sid',
    secret: env.SESSION_SECRET || require('node:crypto').randomBytes(32).toString('hex'),
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      // lax: OAuth 콜백(다른 사이트에서의 GET 리다이렉트)에는 쿠키가 실리고, 외부 사이트의 POST에는 실리지 않는다
      sameSite: 'lax',
      secure: isProd,
      maxAge: 7 * 24 * 60 * 60 * 1000,
    },
    // 기본 MemoryStore는 개발용이다. 운영에서는 Redis 등 외부 저장소를 연결할 것.
  }));

  app.use(createAuthRouter({ providers, baseUrl, log }));

  // 로그인 페이지 (공개)
  app.get('/login', (req, res) => {
    if (req.session.user) return res.redirect('/');
    res.sendFile(path.join(ROOT, 'public', 'login.html'));
  });
  app.use('/public', express.static(path.join(ROOT, 'public')));

  // 여기부터는 로그인 필요
  app.use((req, res, next) => {
    if (req.session.user) return next();
    if (req.accepts(['html', 'json']) === 'json' || req.path.startsWith('/api/')) {
      return res.status(401).json({ error: 'unauthenticated' });
    }
    res.redirect('/login');
  });
  app.use(express.static(path.join(ROOT, 'dashboard')));

  return app;
}

if (require.main === module) {
  try { process.loadEnvFile(path.join(ROOT, '.env')); } catch { /* .env 없음 */ }
  const port = Number(process.env.PORT) || 3000;
  createApp().listen(port, () => console.log(`http://localhost:${port}`));
}

module.exports = { createApp };
