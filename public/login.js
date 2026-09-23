(function () {
  const ICONS = {
    google: '<svg viewBox="0 0 48 48" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>',
    kakao: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="#000" d="M12 3C6.48 3 2 6.48 2 10.78c0 2.78 1.86 5.22 4.66 6.6l-.95 3.48c-.08.3.26.54.52.37l4.13-2.73c.54.07 1.09.11 1.64.11 5.52 0 10-3.48 10-7.83S17.52 3 12 3z"/></svg>',
    naver: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="#fff" d="M15.56 12.84 8.2 2.25H2.25v19.5h6.19V11.16l7.36 10.59h5.95V2.25h-6.19z"/></svg>',
  };
  const ERRORS = {
    denied: '로그인이 취소되었습니다.',
    state: '로그인 요청이 만료되었거나 올바르지 않습니다. 다시 시도해 주세요.',
    code: '로그인 응답이 올바르지 않습니다. 다시 시도해 주세요.',
    provider: '로그인 제공자와 통신하지 못했습니다. 잠시 후 다시 시도해 주세요.',
    session: '세션을 저장하지 못했습니다. 다시 시도해 주세요.',
  };

  const err = new URLSearchParams(location.search).get('error');
  if (err) {
    const box = document.getElementById('error');
    box.textContent = ERRORS[err] || '로그인에 실패했습니다.';
    box.hidden = false;
  }

  fetch('/auth/providers')
    .then((r) => r.json())
    .then((list) => {
      const root = document.getElementById('providers');
      if (!list.length) { document.getElementById('empty').hidden = false; return; }
      list.forEach((p) => {
        const a = document.createElement('a');
        a.className = 'btn ' + p.key;
        a.href = '/auth/' + encodeURIComponent(p.key);
        a.innerHTML = ICONS[p.key] || ''; // 고정된 아이콘 문자열만 innerHTML로 넣는다
        a.appendChild(document.createTextNode(p.label + '로 로그인'));
        root.appendChild(a);
      });
    })
    .catch(() => { document.getElementById('empty').hidden = false; });
})();
