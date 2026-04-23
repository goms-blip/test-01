/* Quest All — shared header/footer + utilities */
(function () {
  const SERVICES = [
    { key: 'home',       href: '/',                        label: 'HOME' },
    { key: 'board',      href: '/pages/board.html',        label: '익명 게시판' },
    { key: 'balance',    href: '/pages/balance.html',      label: '밸런스 게임' },
    { key: 'salary',     href: '/pages/salary.html',       label: '연봉 비교' },
    { key: 'refrigerator', href: '/pages/refrigerator.html', label: '냉장고 관리' },
    { key: 'refri-ai',   href: '/pages/refri-ai.html',     label: 'AI 레시피' },
    { key: 'skill',      href: '/pages/skill.html',        label: 'Skill' },
  ];

  function renderHeader(activeKey) {
    const items = SERVICES
      .filter(s => s.key !== 'home')
      .map(s => `<a href="${s.href}" class="${s.key === activeKey ? 'active' : ''}">${s.label}</a>`).join('');
    const mobileItems = SERVICES
      .map(s => `<a href="${s.href}" class="${s.key === activeKey ? 'active' : ''}">${s.label}</a>`).join('');
    return `
      <header class="site-header">
        <div class="nav">
          <a href="/" class="brand"><span class="dot"></span>QUEST</a>
          <nav class="nav-menu" aria-label="주요 메뉴">${items}</nav>
          <button class="nav-toggle" aria-label="메뉴 열기" id="navToggle"><span></span></button>
        </div>
        <div class="nav-mobile" id="navMobile">${mobileItems}</div>
      </header>
    `;
  }

  function renderFooter() {
    return `
      <footer class="site-footer">
        <div class="container">
          <div class="footer-grid">
            <div>
              <div class="footer-brand">QUEST</div>
              <p class="footer-tagline">Week-4 Quest 6개의 미니 서비스를 미니멀한 통합 인터페이스로 묶었습니다. 모바일 우선, 데스크톱까지 매끄러운 경험.</p>
            </div>
            <div class="footer-col">
              <h4>커뮤니티</h4>
              <ul>
                <li><a href="/pages/board.html">익명 게시판</a></li>
                <li><a href="/pages/balance.html">밸런스 게임</a></li>
                <li><a href="/pages/salary.html">연봉 비교</a></li>
              </ul>
            </div>
            <div class="footer-col">
              <h4>주방</h4>
              <ul>
                <li><a href="/pages/refrigerator.html">냉장고 관리</a></li>
                <li><a href="/pages/refri-ai.html">AI 레시피</a></li>
                <li><a href="/pages/skill.html">Skill</a></li>
              </ul>
            </div>
            <div class="footer-col">
              <h4>지원</h4>
              <ul>
                <li><a href="/api/health">서버 상태</a></li>
                <li><a href="https://github.com" target="_blank" rel="noreferrer">GitHub</a></li>
              </ul>
            </div>
          </div>
          <div class="footer-bottom">
            <span>© ${new Date().getFullYear()} QUEST. Built for week-4 mission.</span>
            <span>Minimal · Mobile-first</span>
          </div>
        </div>
      </footer>
    `;
  }

  function mount(activeKey) {
    document.querySelectorAll('[data-quest-header]').forEach(el => { el.outerHTML = renderHeader(activeKey); });
    document.querySelectorAll('[data-quest-footer]').forEach(el => { el.outerHTML = renderFooter(); });

    const toggle = document.getElementById('navToggle');
    const mobile = document.getElementById('navMobile');
    if (toggle && mobile) {
      toggle.addEventListener('click', () => mobile.classList.toggle('open'));
    }
  }

  // ---- API helper ----
  async function api(path, opts = {}) {
    const res = await fetch(path, {
      method: opts.method || 'GET',
      headers: { 'Content-Type': 'application/json', ...(opts.headers || {}) },
      body: opts.body ? JSON.stringify(opts.body) : undefined,
    });
    let data;
    try { data = await res.json(); } catch { data = { success: false, message: 'invalid response' }; }
    if (!res.ok || !data.success) {
      const msg = (data && data.message) || `HTTP ${res.status}`;
      throw new Error(msg);
    }
    return data.data;
  }

  // ---- Toast ----
  function toast(message, type = 'info') {
    const el = document.createElement('div');
    el.className = 'toast' + (type === 'error' ? ' error' : '');
    el.textContent = message;
    document.body.appendChild(el);
    requestAnimationFrame(() => el.classList.add('show'));
    setTimeout(() => {
      el.classList.remove('show');
      setTimeout(() => el.remove(), 300);
    }, 2400);
  }

  function fmtTime(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    const now = new Date();
    const diff = (now - d) / 1000;
    if (diff < 60) return '방금 전';
    if (diff < 3600) return `${Math.floor(diff / 60)}분 전`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}시간 전`;
    if (diff < 86400 * 30) return `${Math.floor(diff / 86400)}일 전`;
    return d.toLocaleDateString('ko-KR');
  }

  function fmtMoney(n) {
    if (n === null || n === undefined) return '-';
    const v = Math.round(Number(n));
    if (!Number.isFinite(v)) return '-';
    return v.toLocaleString('ko-KR') + '원';
  }

  function escapeHtml(str) {
    return String(str ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
  }

  window.Quest = { mount, api, toast, fmtTime, fmtMoney, escapeHtml, SERVICES };
})();
