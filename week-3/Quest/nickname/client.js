// ── DOM 요소 ──
const form = document.getElementById('nickname-form');
const btnSubmit = document.getElementById('btn-submit');
const resultArea = document.getElementById('result-area');
const historyContainer = document.getElementById('history-container');
const btnClear = document.getElementById('btn-clear');
const toast = document.getElementById('toast');
const characterCard = document.getElementById('character-card');
const characterLoading = document.getElementById('character-loading');
const characterWrapper = document.getElementById('character-wrapper');
const characterImage = document.getElementById('character-image');

// ── 토스트 메시지 ──
function showToast(message, type = 'error') {
  toast.textContent = message;
  toast.className = `toast toast-${type} show`;
  setTimeout(() => toast.classList.remove('show'), 3000);
}

// ── 별명 생성 요청 ──
form.addEventListener('submit', async (e) => {
  e.preventDefault();

  const name = document.getElementById('name').value.trim();
  const personality = document.getElementById('personality').value;
  const hobby = document.getElementById('hobby').value.trim();

  if (!name || !personality || !hobby) {
    showToast('모든 항목을 입력해주세요.');
    return;
  }

  // 로딩 상태
  btnSubmit.classList.add('loading');
  btnSubmit.disabled = true;

  // 캐릭터 로딩 표시
  characterCard.classList.add('visible');
  characterLoading.classList.add('visible');
  characterWrapper.style.display = 'none';

  try {
    const res = await fetch('/api/generate-nickname', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, personality, hobby }),
    });

    const data = await res.json();

    if (!data.success) {
      showToast(data.message || '별명 생성에 실패했습니다.');
      characterCard.classList.remove('visible');
      return;
    }

    renderResult(data.data);
    renderCharacter(data.data.imageUrl);
    showToast('별명과 캐릭터가 생성되었습니다!', 'success');
    loadHistory();
  } catch (err) {
    showToast('서버 연결에 실패했습니다. 다시 시도해주세요.');
    characterCard.classList.remove('visible');
  } finally {
    btnSubmit.classList.remove('loading');
    btnSubmit.disabled = false;
    characterLoading.classList.remove('visible');
  }
});

// ── 캐릭터 이미지 렌더링 ──
function renderCharacter(imageUrl) {
  characterLoading.classList.remove('visible');
  if (imageUrl) {
    characterImage.src = imageUrl;
    characterWrapper.style.display = 'inline-block';
    characterCard.classList.add('visible');
  } else {
    characterCard.classList.remove('visible');
  }
}

// ── 결과 렌더링 ──
const tagStyles = ['tag-funny', 'tag-cute', 'tag-cool', 'tag-persona', 'tag-fire'];
const tagLabels = ['😄 웃긴', '🥰 귀여운', '😎 쿨한', '🎯 찰떡', '🤣 드립'];

function renderResult(record) {
  const nicknames = record.nicknames;

  resultArea.innerHTML = `
    <div class="nickname-list">
      ${nicknames.map((item, i) => `
        <div class="nickname-item">
          <span class="nickname-tag ${tagStyles[i] || 'tag-fire'}">${tagLabels[i] || 'Special'}</span>
          <div class="nickname-name">${escapeHtml(item.nickname)}</div>
          <div class="nickname-reason">${escapeHtml(item.reason)}</div>
        </div>
      `).join('')}
      <div class="result-meta">
        <span>${escapeHtml(record.name)} · ${escapeHtml(record.personality)}</span>
        <span>${new Date(record.createdAt).toLocaleTimeString('ko-KR')}</span>
      </div>
    </div>
  `;
}

// ── 히스토리 로드 ──
async function loadHistory() {
  try {
    const res = await fetch('/api/history');
    const data = await res.json();

    if (!data.success || data.data.length === 0) {
      historyContainer.innerHTML = '<div class="history-empty">아직 생성 기록이 없습니다.</div>';
      btnClear.style.display = 'none';
      return;
    }

    btnClear.style.display = 'block';
    historyContainer.innerHTML = `
      <div class="history-grid">
        ${data.data.map(record => `
          <div class="history-card">
            ${record.imageUrl ? `<img src="${escapeHtml(record.imageUrl)}" class="history-thumb" alt="character" />` : ''}
            <div class="history-card-name">${escapeHtml(record.name)}</div>
            <div class="history-card-info">${escapeHtml(record.personality)} · ${escapeHtml(record.hobby)}</div>
            <div class="history-card-nicknames">
              ${record.nicknames.map(n => `<span class="history-chip">${escapeHtml(n.nickname)}</span>`).join('')}
            </div>
          </div>
        `).join('')}
      </div>
    `;
  } catch {
    // 히스토리 로드 실패 시 무시
  }
}

// ── 히스토리 초기화 ──
btnClear.addEventListener('click', async () => {
  try {
    await fetch('/api/history', { method: 'DELETE' });
    loadHistory();
    characterCard.classList.remove('visible');
    showToast('히스토리가 초기화되었습니다.', 'success');
  } catch {
    showToast('초기화에 실패했습니다.');
  }
});

// ── XSS 방지 ──
function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// ── 초기 로드 ──
loadHistory();
