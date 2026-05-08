/* eslint-disable */
// client.js — 단일 페이지 React 앱 (해시 라우터)
// 라우트:
//   #/                          목록 + 베스트3
//   #/c/:id                     콘텐츠 상세 (구매 안 했으면 잠금)
//   #/library                   마이페이지 — 구매한 콘텐츠 목록 + 영구 재열람 (로그인 필수)
//   #/login                     로그인
//   #/signup                    회원가입
//   #/payment/success?...       토스 결제 성공 콜백 (서버 confirm 호출)
//   #/payment/fail?...          토스 결제 실패 콜백

const { useState, useEffect, useMemo, useRef } = React;

// ─────────────────────────────────────────────────────────────
// Auth — 토큰·userId·email을 localStorage에 보관, 변경 시 커스텀 이벤트
//   이전 버전의 익명 'miniapp.userId'(`u_xxxx`)는 의미가 없으므로 첫 로드 때 정리.
// ─────────────────────────────────────────────────────────────
(function migrateLegacyAnonId() {
  const v = localStorage.getItem('miniapp.userId');
  if (v && !localStorage.getItem('miniapp.token')) {
    localStorage.removeItem('miniapp.userId');
    localStorage.removeItem('miniapp.email');
  }
})();

function readAuth() {
  const token = localStorage.getItem('miniapp.token');
  const userId = localStorage.getItem('miniapp.userId');
  const email = localStorage.getItem('miniapp.email');
  return token && userId ? { token, userId, email } : null;
}
function writeAuth(data) {
  if (data) {
    localStorage.setItem('miniapp.token', data.token);
    localStorage.setItem('miniapp.userId', data.userId);
    localStorage.setItem('miniapp.email', data.email);
  } else {
    localStorage.removeItem('miniapp.token');
    localStorage.removeItem('miniapp.userId');
    localStorage.removeItem('miniapp.email');
  }
  window.dispatchEvent(new Event('miniapp:auth-changed'));
}
function useAuth() {
  const [auth, setAuth] = useState(readAuth);
  useEffect(() => {
    const onChange = () => setAuth(readAuth());
    window.addEventListener('miniapp:auth-changed', onChange);
    window.addEventListener('storage', onChange); // 다른 탭 동기화
    return () => {
      window.removeEventListener('miniapp:auth-changed', onChange);
      window.removeEventListener('storage', onChange);
    };
  }, []);
  return auth;
}

// ─────────────────────────────────────────────────────────────
// fetch 헬퍼 — Bearer 토큰 자동 첨부
// ─────────────────────────────────────────────────────────────
async function apiFetch(url, opts = {}) {
  const token = localStorage.getItem('miniapp.token');
  const headers = { ...(opts.headers || {}) };
  if (opts.body && !headers['Content-Type']) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;
  const r = await fetch(url, { ...opts, headers });
  // 토큰을 들고 보냈는데 401이면 서버가 그 토큰을 모름(서버 재시작으로 sessions 초기화 등).
  // auth 라우트 자체는 401이 정상 응답일 수 있으니 제외.
  if (r.status === 401 && token && !url.startsWith('/api/auth/')) {
    writeAuth(null);
  }
  return r;
}
const api = {
  config: () => apiFetch('/api/config').then((r) => r.json()),
  list: () => apiFetch('/api/contents').then((r) => r.json()),
  popular: () => apiFetch('/api/popular').then((r) => r.json()),
  detail: (id) => apiFetch(`/api/contents/${id}`).then((r) => r.json()),
  purchases: () => apiFetch('/api/purchases').then((r) => r.json()),
  intent: (contentId) =>
    apiFetch('/api/payments/intent', {
      method: 'POST',
      body: JSON.stringify({ contentId }),
    }).then((r) => r.json()),
  confirm: (payload) =>
    apiFetch('/api/payments/confirm', {
      method: 'POST',
      body: JSON.stringify(payload),
    }).then(async (r) => ({ status: r.status, body: await r.json() })),
  signup: (email, password) =>
    apiFetch('/api/auth/signup', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }).then(async (r) => ({ status: r.status, body: await r.json() })),
  login: (email, password) =>
    apiFetch('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }).then(async (r) => ({ status: r.status, body: await r.json() })),
  logout: () => apiFetch('/api/auth/logout', { method: 'POST' }),
};

// ─────────────────────────────────────────────────────────────
// 해시 라우터 훅
// ─────────────────────────────────────────────────────────────
function useHashRoute() {
  const [hash, setHash] = useState(() => window.location.hash || '#/');
  useEffect(() => {
    const onHash = () => setHash(window.location.hash || '#/');
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);
  return hash;
}

function parseRoute(hash) {
  const raw = hash.replace(/^#/, '');
  const [pathOnly, qs] = raw.split('?');
  const params = new URLSearchParams(qs || '');
  // 토스 v2가 successUrl(해시 라우터)로 redirect할 때 paymentKey/orderId/amount는
  // hash 안 query가 아니라 location.search 쪽에 붙는다. 둘 다 합쳐서 본다.
  const search = new URLSearchParams(window.location.search);
  search.forEach((v, k) => { if (!params.has(k)) params.set(k, v); });
  const segs = pathOnly.split('/').filter(Boolean);
  return { segs, params };
}

// ─────────────────────────────────────────────────────────────
// 공통 UI
// ─────────────────────────────────────────────────────────────
function Header({ auth }) {
  async function handleLogout() {
    await api.logout().catch(() => {});
    writeAuth(null);
    location.hash = '#/';
  }
  return (
    <header className="bg-white border-b border-slate-200">
      <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between">
        <a href="#/" className="text-lg font-bold text-slate-900">
          🥐 베이킹 지식 상점
        </a>
        <nav className="flex items-center gap-4 text-sm">
          <a href="#/" className="text-slate-600 hover:text-slate-900">홈</a>
          <a href="#/library" className="text-slate-600 hover:text-slate-900">마이페이지</a>
          {auth ? (
            <>
              <span className="text-xs text-slate-500 truncate max-w-[140px]">{auth.email}</span>
              <button
                onClick={handleLogout}
                className="text-xs text-slate-500 hover:text-slate-900 underline"
              >
                로그아웃
              </button>
            </>
          ) : (
            <a
              href="#/login"
              className="text-xs bg-slate-900 text-white px-3 py-1.5 rounded hover:bg-slate-700"
            >
              로그인
            </a>
          )}
        </nav>
      </div>
    </header>
  );
}

function Price({ won }) {
  return <span className="font-semibold">{won.toLocaleString('ko-KR')}원</span>;
}

// 토스 customerKey — 정책: 영문·숫자·`-_=.@`만, 2~50자.
// 서버 intent 응답의 customerKey 형식과 일치해야 동일 사용자로 매칭됨.
function customerKeyOf(userId) {
  return `miniapp_u_${userId}`;
}

function Thumb({ src, alt, className = '' }) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) {
    return (
      <div
        className={`bg-gradient-to-br from-slate-200 to-slate-300 flex items-center justify-center text-slate-400 text-2xl ${className}`}
      >
        🖼️
      </div>
    );
  }
  return (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      onError={() => setFailed(true)}
      className={`object-cover ${className}`}
    />
  );
}

// ─────────────────────────────────────────────────────────────
// 페이지: 홈 (목록 + 베스트3)
// ─────────────────────────────────────────────────────────────
function HomePage() {
  const [contents, setContents] = useState([]);
  const [popular, setPopular] = useState([]);

  useEffect(() => {
    api.list().then(setContents);
    api.popular().then(setPopular);
  }, []);

  const hasAnyPurchase = popular.some((p) => p.purchase_count > 0);

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-2">간단한 베이킹 지식 상점</h1>
      <p className="text-slate-600 mb-8 text-sm">
        본문 앞 3줄을 미리 읽고, 가치를 판단한 뒤 단건 결제하세요. 한 번 사면 영구 소장.
      </p>

      {hasAnyPurchase && (
        <section className="mb-10">
          <h2 className="text-lg font-bold mb-3">🔥 인기 베스트 3</h2>
          <ol className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {popular.map((c, i) => (
              <li key={c.id}>
                <a
                  href={`#/c/${c.id}`}
                  className="block bg-white border border-amber-200 rounded-lg overflow-hidden hover:border-amber-400 hover:shadow-md transition"
                >
                  <Thumb src={c.thumbnail} alt={c.title} className="w-full aspect-[4/3]" />
                  <div className="p-3">
                    <div className="text-xs text-amber-700 font-bold mb-1">
                      {i + 1}위 · {c.purchase_count}회 구매
                    </div>
                    <div className="font-semibold text-slate-900 line-clamp-2 text-sm">{c.title}</div>
                    <div className="mt-2 text-sm text-slate-600">
                      <Price won={c.price} />
                    </div>
                  </div>
                </a>
              </li>
            ))}
          </ol>
        </section>
      )}

      <section>
        <h2 className="text-lg font-bold mb-3">전체 콘텐츠</h2>
        <ul className="space-y-4">
          {contents.map((c) => (
            <li key={c.id}>
              <a
                href={`#/c/${c.id}`}
                className="block bg-white border border-slate-200 rounded-xl overflow-hidden hover:border-slate-400 hover:shadow-md transition"
              >
                <div className="flex flex-col sm:flex-row">
                  <Thumb
                    src={c.thumbnail}
                    alt={c.title}
                    className="w-full sm:w-48 h-40 sm:h-auto sm:aspect-[4/3] flex-shrink-0"
                  />
                  <div className="p-4 flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-3">
                      <h3 className="font-semibold text-slate-900 leading-snug">{c.title}</h3>
                      <span className="flex-shrink-0">
                        <Price won={c.price} />
                      </span>
                    </div>
                    <p className="mt-2 text-sm text-slate-600 whitespace-pre-line line-clamp-3">
                      {c.preview}
                    </p>
                    <div className="mt-3 text-xs text-slate-400">미리보기 · 본문은 결제 후 열람</div>
                  </div>
                </div>
              </a>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// 페이지: 상세 (잠금 + 결제 위젯)
// ─────────────────────────────────────────────────────────────
function DetailPage({ id, auth }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);
  const widgetRef = useRef(null);
  const widgetMountedRef = useRef(false);

  useEffect(() => {
    setLoading(true);
    api.detail(id).then((d) => {
      setData(d);
      setLoading(false);
    });
  }, [id, auth?.token]);

  // 결제 위젯 mount — 로그인 + locked일 때만
  useEffect(() => {
    if (!auth || !data || data.locked === false) return;
    if (widgetMountedRef.current) return;
    let cancelled = false;

    (async () => {
      try {
        const cfg = await api.config();
        if (cancelled) return;
        const tossPayments = TossPayments(cfg.tossClientKey);
        const widgets = tossPayments.widgets({ customerKey: customerKeyOf(auth.userId) });
        await widgets.setAmount({ currency: 'KRW', value: data.price });
        await Promise.all([
          widgets.renderPaymentMethods({
            selector: '#payment-method',
            variantKey: 'DEFAULT',
          }),
          widgets.renderAgreement({ selector: '#agreement', variantKey: 'AGREEMENT' }),
        ]);
        widgetRef.current = widgets;
        widgetMountedRef.current = true;
      } catch (err) {
        console.error('widget mount failed', err);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [auth, data]);

  async function handlePay() {
    if (!widgetRef.current || paying) return;
    setPaying(true);
    try {
      const intent = await api.intent(id);
      if (!intent.orderId) {
        alert('주문 생성 실패: ' + (intent.error || '알 수 없음'));
        setPaying(false);
        return;
      }
      // contentId는 successUrl query에 끼우지 않고 sessionStorage로 전달.
      // (토스 v2는 hash 라우터일 때 successUrl 안 query 위치를 보장해주지 않음.)
      sessionStorage.setItem('miniapp.pending', JSON.stringify({ contentId: id, orderId: intent.orderId }));
      const base = `${location.origin}${location.pathname}`;
      await widgetRef.current.requestPayment({
        orderId: intent.orderId,
        orderName: intent.orderName,
        successUrl: `${base}#/payment/success`,
        failUrl: `${base}#/payment/fail`,
      });
    } catch (err) {
      console.error(err);
      alert('결제 호출 실패: ' + err.message);
      setPaying(false);
    }
  }

  if (loading) return <div className="max-w-3xl mx-auto px-4 py-8 text-slate-500">불러오는 중…</div>;
  if (!data || data.error) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-8">
        <p className="text-red-600">콘텐츠를 찾을 수 없습니다.</p>
        <a href="#/" className="text-blue-600 underline text-sm">← 목록으로</a>
      </div>
    );
  }

  const loginRedirect = `#/login?next=${encodeURIComponent(`#/c/${id}`)}`;

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <a href="#/" className="text-sm text-slate-500 hover:text-slate-800">← 목록으로</a>

      <div className="mt-3 rounded-2xl overflow-hidden border border-slate-200 bg-white">
        <Thumb src={data.thumbnail} alt={data.title} className="w-full aspect-[16/9]" />
        <div className="p-6">
          <h1 className="text-2xl font-bold leading-snug">{data.title}</h1>
          <div className="text-slate-500 mt-2 text-sm flex items-center gap-2">
            <Price won={data.price} />
            <span className="text-slate-300">·</span>
            <span>한 번 결제 영구 소장</span>
          </div>
        </div>
      </div>

      <article className="mt-6 bg-white border border-slate-200 rounded-lg p-6">
        <h2 className="text-sm font-bold text-slate-500 mb-3">미리보기 (앞 3줄)</h2>
        <p className="whitespace-pre-line text-slate-800 leading-relaxed">{data.preview}</p>

        <hr className="my-6 border-slate-200" />

        {data.locked ? (
          <>
            <h2 className="text-sm font-bold text-slate-500 mb-3">본문 (잠김)</h2>
            <div className="relative">
              <div className="blur-locked space-y-3 select-none">
                <p className="font-bold text-slate-800">【핵심 원리】</p>
                <p className="whitespace-pre-line text-slate-800 leading-relaxed">
                  ████████████████████████████████████████████████{'\n'}
                  ████████████ ████████████ ████████ ████████ ██████{'\n'}
                  ████████ ████████ ████████ ████████ ████████ ████
                </p>
                <p className="font-bold text-slate-800">【단계별 가이드】</p>
                <p className="whitespace-pre-line text-slate-800 leading-relaxed">
                  1) ████████████████████ ████████ ████████ ██████{'\n'}
                  2) ████████████ ████████████ ████████ ████████{'\n'}
                  3) ████████ ████████ ████████ ████████ ████████{'\n'}
                  4) ████████████████████████████ ████████ ████████{'\n'}
                  5) ██████████ ████████ ████████ ████████ ████████{'\n'}
                  6) ████████ ████████ ████████ ████████ ████████
                </p>
                <p className="font-bold text-slate-800">【자주 하는 실수】</p>
                <p className="whitespace-pre-line text-slate-800 leading-relaxed">
                  - ████████████████ ████████ ████████{'\n'}
                  - ████████ ████████ ████████ ████████{'\n'}
                  - ████████████ ████████ ████████ ████████
                </p>
                <p className="font-bold text-slate-800">【1줄 요약】</p>
                <p className="whitespace-pre-line text-slate-800 leading-relaxed">
                  ████████ ████████ ████████ ████████ ████████
                </p>
              </div>
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="bg-white/80 backdrop-blur-sm rounded-xl px-5 py-3 text-sm text-slate-700 border border-slate-300 shadow-sm">
                  🔒 결제 후 전체 본문이 열립니다 · 약 25줄 · 5섹션 구조
                </div>
              </div>
            </div>

            {auth ? (
              <>
                <div id="payment-method" className="mt-6"></div>
                <div id="agreement"></div>
                <button
                  onClick={handlePay}
                  disabled={paying}
                  className="mt-4 w-full bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white font-semibold py-3 rounded-lg"
                >
                  {paying ? '결제 진행 중…' : `${data.price.toLocaleString('ko-KR')}원 결제하기`}
                </button>
                <p className="text-xs text-slate-400 mt-3">
                  테스트 결제는 토스페이먼츠 데모 키로 진행됩니다. 카드 번호: 4330-1234-1234-1234 등 임의값.
                </p>
              </>
            ) : (
              <div className="mt-6 bg-slate-50 border border-slate-200 rounded-lg p-5 text-center">
                <p className="text-slate-700 font-medium">결제하려면 로그인이 필요합니다</p>
                <p className="text-xs text-slate-500 mt-1">로그인하면 한 번 결제로 영구 소장됩니다.</p>
                <div className="mt-3 flex gap-2 justify-center">
                  <a href={loginRedirect} className="bg-slate-900 text-white px-4 py-2 rounded text-sm font-semibold">
                    로그인
                  </a>
                  <a href={`#/signup?next=${encodeURIComponent(`#/c/${id}`)}`} className="bg-slate-200 px-4 py-2 rounded text-sm">
                    회원가입
                  </a>
                </div>
              </div>
            )}
          </>
        ) : (
          <>
            <h2 className="text-sm font-bold text-emerald-700 mb-3">✅ 구매 완료 — 전체 본문</h2>
            <p className="whitespace-pre-line text-slate-800 leading-relaxed">{data.body}</p>
          </>
        )}
      </article>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// 페이지: 결제 콜백 — success/fail
// ─────────────────────────────────────────────────────────────
function PaymentSuccessPage({ params, auth }) {
  const [state, setState] = useState({ phase: 'confirming', message: '결제 승인 중…' });

  useEffect(() => {
    const paymentKey = params.get('paymentKey');
    const orderId = params.get('orderId');
    const amount = Number(params.get('amount'));
    let contentId = params.get('contentId');

    // contentId는 sessionStorage에 보관해 둔 pending 주문에서 회수 (URL에는 없을 수 있음)
    if (!contentId) {
      try {
        const pending = JSON.parse(sessionStorage.getItem('miniapp.pending') || 'null');
        if (pending && pending.orderId === orderId) contentId = pending.contentId;
      } catch (_) {}
    }

    if (!paymentKey || !orderId || !amount || !contentId) {
      setState({ phase: 'fail', message: '필수 파라미터가 누락되었습니다.' });
      return;
    }
    if (!auth) {
      setState({ phase: 'fail', message: '세션이 만료되었습니다. 다시 로그인 후 시도해주세요.' });
      return;
    }

    api.confirm({ paymentKey, orderId, amount, contentId }).then(({ status, body }) => {
      if ((status === 200 && body.ok) || status === 409) {
        // URL의 토스 query 제거 + sessionStorage 정리 — 새로고침 시 중복 confirm 방지
        const cleanUrl = window.location.pathname + window.location.hash.split('?')[0];
        window.history.replaceState({}, '', cleanUrl);
        sessionStorage.removeItem('miniapp.pending');
        setState({
          phase: 'ok',
          message: status === 409 ? '이미 보유한 콘텐츠입니다.' : '결제가 완료되었습니다.',
          contentId,
        });
      } else {
        setState({ phase: 'fail', message: body.error || '서버 승인 실패', detail: body.detail });
      }
    });
  }, []);

  return (
    <div className="max-w-3xl mx-auto px-4 py-12 text-center">
      {state.phase === 'confirming' && <p className="text-slate-500">{state.message}</p>}
      {state.phase === 'ok' && (
        <>
          <h1 className="text-2xl font-bold text-emerald-700 mb-2">결제 완료 🎉</h1>
          <p className="text-slate-600">{state.message}</p>
          <div className="mt-6 flex gap-3 justify-center">
            <a href={`#/c/${state.contentId}`} className="bg-blue-600 text-white px-4 py-2 rounded">
              본문 읽으러 가기
            </a>
            <a href="#/library" className="bg-slate-200 px-4 py-2 rounded">마이페이지</a>
          </div>
        </>
      )}
      {state.phase === 'fail' && (
        <>
          <h1 className="text-2xl font-bold text-red-600 mb-2">결제 승인 실패</h1>
          <p className="text-slate-600">{state.message}</p>
          {state.detail && (
            <pre className="mt-4 text-xs bg-slate-100 p-3 rounded text-left overflow-auto">
              {JSON.stringify(state.detail, null, 2)}
            </pre>
          )}
          <a href="#/" className="text-blue-600 underline text-sm mt-4 inline-block">← 홈으로</a>
        </>
      )}
    </div>
  );
}

function PaymentFailPage({ params }) {
  return (
    <div className="max-w-3xl mx-auto px-4 py-12 text-center">
      <h1 className="text-2xl font-bold text-red-600 mb-2">결제 실패</h1>
      <p className="text-slate-600">{params.get('message') || '사용자가 취소했거나 결제가 거부되었습니다.'}</p>
      <a href="#/" className="text-blue-600 underline text-sm mt-4 inline-block">← 홈으로</a>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// 페이지: 마이페이지 (로그인 필수)
// ─────────────────────────────────────────────────────────────
function LibraryPage({ auth }) {
  const [items, setItems] = useState(null);
  useEffect(() => {
    if (!auth) return;
    api.purchases().then((d) => setItems(Array.isArray(d) ? d : []));
  }, [auth?.token]);

  if (!auth) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-12 text-center">
        <h1 className="text-2xl font-bold mb-2">마이페이지</h1>
        <p className="text-slate-600 mb-6">
          로그인하면 결제한 콘텐츠를 언제든 다시 볼 수 있어요.<br />
          다른 기기·브라우저에서도 동일하게 라이브러리에 접근됩니다.
        </p>
        <div className="flex gap-3 justify-center">
          <a
            href="#/login?next=%23%2Flibrary"
            className="bg-slate-900 text-white px-4 py-2 rounded text-sm font-semibold"
          >
            로그인
          </a>
          <a
            href="#/signup?next=%23%2Flibrary"
            className="bg-slate-200 px-4 py-2 rounded text-sm"
          >
            회원가입
          </a>
        </div>
      </div>
    );
  }

  if (items === null) return <div className="max-w-3xl mx-auto px-4 py-8 text-slate-500">불러오는 중…</div>;

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <div className="flex items-baseline justify-between mb-6">
        <h1 className="text-2xl font-bold">마이페이지</h1>
        <span className="text-xs text-slate-500">{auth.email}</span>
      </div>

      <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-sm text-emerald-800 mb-5">
        구매한 콘텐츠는 언제든 다시 열람할 수 있습니다. 추가 결제 없이 영구 소장.
      </div>

      <h2 className="text-lg font-bold mb-3">구매한 콘텐츠 ({items.length})</h2>
      {items.length === 0 ? (
        <p className="text-slate-500">
          아직 구매한 콘텐츠가 없습니다. <a href="#/" className="text-blue-600 underline">콘텐츠 둘러보기</a>
        </p>
      ) : (
        <ul className="space-y-3">
          {items.map((p) => (
            <li key={p.id} className="bg-white border border-slate-200 rounded-xl overflow-hidden hover:border-slate-400 hover:shadow-md transition">
              <a href={`#/c/${p.content_id}`} className="flex">
                <Thumb src={p.thumbnail} alt={p.title} className="w-28 h-28 flex-shrink-0" />
                <div className="p-4 flex-1 min-w-0">
                  <div className="flex items-baseline justify-between gap-2">
                    <h3 className="font-semibold truncate">{p.title}</h3>
                    <span className="text-xs text-slate-400 flex-shrink-0">
                      {new Date(p.paid_at).toLocaleDateString('ko-KR')}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-slate-600 whitespace-pre-line line-clamp-2">
                    {p.preview}
                  </p>
                  <div className="mt-2 flex items-center justify-between text-xs">
                    <span className="text-slate-500">
                      결제 금액 <Price won={p.amount} />
                    </span>
                    <span className="text-blue-600 font-medium">본문 다시 보기 →</span>
                  </div>
                </div>
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// 페이지: 로그인 / 회원가입
// ─────────────────────────────────────────────────────────────
function AuthForm({ mode, params }) {
  const [email, setEmail] = useState(mode === 'login' ? 'demo@local' : '');
  const [password, setPassword] = useState(mode === 'login' ? 'demo1234' : '');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const next = params.get('next') || '#/';

  async function submit(e) {
    e.preventDefault();
    setErr('');
    setBusy(true);
    try {
      const fn = mode === 'signup' ? api.signup : api.login;
      const { status, body } = await fn(email.trim(), password);
      if (status >= 200 && status < 300 && body.token) {
        writeAuth({ token: body.token, userId: body.userId, email: body.email });
        location.hash = next.startsWith('#') ? next : `#${next}`;
      } else {
        setErr(translateAuthError(body.error) || '실패했습니다');
      }
    } catch (e2) {
      setErr('네트워크 오류: ' + e2.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="max-w-sm mx-auto px-4 py-12">
      <h1 className="text-2xl font-bold text-center mb-2">
        {mode === 'signup' ? '회원가입' : '로그인'}
      </h1>
      <p className="text-center text-sm text-slate-500 mb-6">
        {mode === 'signup' ? '결제·라이브러리 사용을 위해 가입하세요' : '결제한 콘텐츠를 언제든 다시 보세요'}
      </p>

      {mode === 'login' && (
        <div className="bg-amber-50 border border-amber-200 rounded text-xs text-amber-800 p-3 mb-4">
          🧪 데모 계정이 자동 입력되어 있습니다. <code>demo@local / demo1234</code>
        </div>
      )}

      <form onSubmit={submit} className="space-y-3 bg-white border border-slate-200 rounded-xl p-5">
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1">이메일</label>
          <input
            type="text"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full border border-slate-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-slate-500"
            autoComplete="email"
            required
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1">비밀번호</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full border border-slate-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-slate-500"
            autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
            minLength={4}
            required
          />
        </div>

        {err && <p className="text-xs text-red-600">{err}</p>}

        <button
          type="submit"
          disabled={busy}
          className="w-full bg-slate-900 hover:bg-slate-700 disabled:bg-slate-400 text-white font-semibold py-2.5 rounded text-sm"
        >
          {busy ? '처리 중…' : mode === 'signup' ? '가입하기' : '로그인'}
        </button>
      </form>

      <p className="text-center text-xs text-slate-500 mt-4">
        {mode === 'signup' ? (
          <>이미 계정이 있나요? <a href={`#/login?next=${encodeURIComponent(next)}`} className="text-blue-600 underline">로그인</a></>
        ) : (
          <>계정이 없나요? <a href={`#/signup?next=${encodeURIComponent(next)}`} className="text-blue-600 underline">회원가입</a></>
        )}
      </p>
    </div>
  );
}

function translateAuthError(code) {
  switch (code) {
    case 'email_exists': return '이미 가입된 이메일입니다';
    case 'invalid_credentials': return '이메일 또는 비밀번호가 올바르지 않습니다';
    case 'invalid_email': return '이메일 형식이 올바르지 않습니다';
    case 'password_too_short': return '비밀번호는 4자 이상이어야 합니다';
    case 'missing_fields': return '이메일과 비밀번호를 입력해주세요';
    default: return '';
  }
}

// ─────────────────────────────────────────────────────────────
// 앱 루트
// ─────────────────────────────────────────────────────────────
function App() {
  const auth = useAuth();
  const hash = useHashRoute();
  const { segs, params } = parseRoute(hash);

  // 부트 시 토큰 유효성 사전 검증 — 무효(401)이면 즉시 정리하여 헤더가 곧장 "로그인" 상태로 바뀐다.
  useEffect(() => {
    if (!auth) return;
    apiFetch('/api/auth/me');
  }, []);

  let page;
  if (segs.length === 0) page = <HomePage />;
  else if (segs[0] === 'c' && segs[1]) page = <DetailPage id={segs[1]} auth={auth} />;
  else if (segs[0] === 'library') page = <LibraryPage auth={auth} />;
  else if (segs[0] === 'login') page = <AuthForm mode="login" params={params} />;
  else if (segs[0] === 'signup') page = <AuthForm mode="signup" params={params} />;
  else if (segs[0] === 'payment' && segs[1] === 'success')
    page = <PaymentSuccessPage params={params} auth={auth} />;
  else if (segs[0] === 'payment' && segs[1] === 'fail') page = <PaymentFailPage params={params} />;
  else page = <HomePage />;

  return (
    <>
      <Header auth={auth} />
      {page}
    </>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
