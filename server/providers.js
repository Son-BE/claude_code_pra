// 소셜 로그인 제공자 설정.
// 각 제공자는 OAuth 2.0 Authorization Code 흐름을 쓰며, 엔드포인트와 프로필 응답 형태만 다르다.
// 환경 변수에 client id/secret이 있는 제공자만 활성화된다.

const DEFINITIONS = {
  google: {
    label: 'Google',
    authorizeUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    profileUrl: 'https://openidconnect.googleapis.com/v1/userinfo',
    scope: 'openid email profile',
    env: 'GOOGLE',
    toUser: (p) => ({
      id: String(p.sub),
      name: p.name || p.email || 'Google 사용자',
      email: p.email || null,
      avatar: p.picture || null,
    }),
  },
  kakao: {
    label: '카카오',
    authorizeUrl: 'https://kauth.kakao.com/oauth/authorize',
    tokenUrl: 'https://kauth.kakao.com/oauth/token',
    profileUrl: 'https://kapi.kakao.com/v2/user/me',
    // 동의 항목은 카카오 개발자 콘솔에서 설정한다 (scope를 비우면 콘솔 설정을 따름)
    scope: null,
    env: 'KAKAO',
    toUser: (p) => {
      const acc = p.kakao_account || {};
      const prof = acc.profile || {};
      return {
        id: String(p.id),
        name: prof.nickname || '카카오 사용자',
        email: acc.email || null,
        avatar: prof.profile_image_url || null,
      };
    },
  },
  naver: {
    label: '네이버',
    authorizeUrl: 'https://nid.naver.com/oauth2.0/authorize',
    tokenUrl: 'https://nid.naver.com/oauth2.0/token',
    profileUrl: 'https://openapi.naver.com/v1/nid/me',
    scope: null,
    env: 'NAVER',
    toUser: (p) => {
      const r = p.response || {};
      return {
        id: String(r.id),
        name: r.name || r.nickname || '네이버 사용자',
        email: r.email || null,
        avatar: r.profile_image || null,
      };
    },
  },
};

// overrides: 테스트에서 엔드포인트를 가짜 서버로 바꿀 때 사용
function loadProviders(env, overrides = {}) {
  const out = {};
  for (const [key, def] of Object.entries(DEFINITIONS)) {
    const clientId = env[`${def.env}_CLIENT_ID`];
    const clientSecret = env[`${def.env}_CLIENT_SECRET`];
    // 카카오는 client secret 사용이 선택 사항
    if (!clientId || (!clientSecret && key !== 'kakao')) continue;
    out[key] = { key, ...def, ...(overrides[key] || {}), clientId, clientSecret: clientSecret || null };
  }
  return out;
}

module.exports = { loadProviders, DEFINITIONS };
