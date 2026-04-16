const promptInput = document.getElementById('promptInput');
const generateBtn = document.getElementById('generateBtn');
const statusMsg = document.getElementById('statusMsg');
const loadingBar = document.getElementById('loadingBar');
const heroImage = document.getElementById('heroImage');
const heroPlaceholder = document.getElementById('heroPlaceholder');
const heroTitle = document.getElementById('heroTitle');
const imagePrompt = document.getElementById('imagePrompt');
const gallery = document.getElementById('gallery');
const galleryGrid = document.getElementById('galleryGrid');
const historyCount = document.getElementById('historyCount');
const historyHeader = document.getElementById('historyHeader');
const historyEmpty = document.getElementById('historyEmpty');

const history = [];

promptInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    generateBtn.click();
  }
});

generateBtn.addEventListener('click', async () => {
  const prompt = promptInput.value.trim();
  if (!prompt) {
    statusMsg.textContent = '이미지 설명을 입력해주세요.';
    statusMsg.className = 'message error';
    return;
  }

  generateBtn.disabled = true;
  statusMsg.textContent = '이미지를 생성하고 있습니다... (약 10~30초 소요)';
  statusMsg.className = 'message';
  loadingBar.classList.add('active');

  try {
    const res = await fetch('/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt }),
    });

    const data = await res.json();

    if (!data.success) {
      throw new Error(data.message || '이미지 생성에 실패했습니다.');
    }

    const imageUrl = data.data.images[0].url;

    // Update hero
    heroImage.src = imageUrl;
    heroImage.style.display = 'block';
    heroPlaceholder.style.display = 'none';
    heroTitle.textContent = prompt;
    imagePrompt.textContent = prompt;
    imagePrompt.classList.add('visible');

    statusMsg.textContent = '';

    history.unshift({ prompt, url: imageUrl });
    renderGallery();
    promptInput.value = '';
  } catch (err) {
    statusMsg.textContent = err.message;
    statusMsg.className = 'message error';
  } finally {
    generateBtn.disabled = false;
    loadingBar.classList.remove('active');
  }
});

function renderGallery() {
  if (history.length < 2) {
    historyEmpty.style.display = 'flex';
    historyHeader.style.display = 'none';
    galleryGrid.style.display = 'none';
    return;
  }

  historyEmpty.style.display = 'none';
  historyHeader.style.display = 'flex';
  galleryGrid.style.display = 'grid';
  historyCount.textContent = `${history.length - 1}`;
  galleryGrid.innerHTML = '';

  history.slice(1, 5).forEach((item) => {
    const card = document.createElement('div');
    card.className = 'history-card fade-in';
    card.innerHTML = `
      <div class="history-card-img">
        <img src="${item.url}" alt="${item.prompt}" loading="lazy">
      </div>
      <div class="history-card-body">
        <div class="history-card-title">${item.prompt}</div>
      </div>
    `;
    card.addEventListener('click', () => {
      heroImage.src = item.url;
      heroImage.style.display = 'block';
      heroPlaceholder.style.display = 'none';
      heroTitle.textContent = item.prompt;
      imagePrompt.textContent = item.prompt;
      imagePrompt.classList.add('visible');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
    galleryGrid.appendChild(card);
  });
}
