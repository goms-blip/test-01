(() => {
  const messagesEl = document.getElementById('messages');
  const chatArea = document.getElementById('chat-area');
  const input = document.getElementById('message-input');
  const sendBtn = document.getElementById('send-btn');
  const clearBtn = document.getElementById('clear-btn');
  const welcome = document.getElementById('welcome');

  let chatHistory = [];
  let isLoading = false;

  // Auto-resize textarea
  input.addEventListener('input', () => {
    input.style.height = 'auto';
    input.style.height = Math.min(input.scrollHeight, 120) + 'px';
    sendBtn.classList.toggle('active', input.value.trim().length > 0);
  });

  // Send on Enter (Shift+Enter for newline)
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });

  sendBtn.addEventListener('click', sendMessage);

  clearBtn.addEventListener('click', () => {
    chatHistory = [];
    messagesEl.innerHTML = '';
    messagesEl.appendChild(createWelcome());
    input.focus();
  });

  // Suggestion buttons
  document.addEventListener('click', (e) => {
    if (e.target.classList.contains('suggestion')) {
      const msg = e.target.dataset.msg;
      if (msg) {
        input.value = msg;
        sendBtn.classList.add('active');
        sendMessage();
      }
    }
  });

  function createWelcome() {
    const div = document.createElement('div');
    div.className = 'welcome';
    div.id = 'welcome';
    div.innerHTML = `
      <div class="welcome-avatar">&#x1f43b;</div>
      <h2>성질급한 곰</h2>
      <p>거칠지만 따뜻한 마음을 가진 곰에게 뭐든 물어봐.<br>디자인, 음식, 디저트는 특히 잘 알아.</p>
      <div class="suggestions">
        <button class="suggestion" data-msg="요즘 유행하는 디저트 뭐야?">디저트 추천</button>
        <button class="suggestion" data-msg="깔끔한 웹 디자인 팁 좀 알려줘">디자인 팁</button>
        <button class="suggestion" data-msg="오늘 저녁 뭐 해먹지?">저녁 메뉴</button>
        <button class="suggestion" data-msg="귀여운 곰 그림 그려줘">그림 그려줘</button>
      </div>`;
    return div;
  }

  async function sendMessage() {
    const text = input.value.trim();
    if (!text || isLoading) return;

    // Hide welcome
    const welcomeEl = document.getElementById('welcome');
    if (welcomeEl) welcomeEl.remove();

    // Add user message
    appendMessage('user', text);
    chatHistory.push({ role: 'user', content: text });

    // Clear input
    input.value = '';
    input.style.height = 'auto';
    sendBtn.classList.remove('active');

    // Show typing
    const typingEl = showTyping();
    isLoading = true;

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: chatHistory })
      });

      const data = await res.json();
      typingEl.remove();

      if (data.success) {
        const { reply, imageUrl } = data.data;
        appendMessage('ai', reply, imageUrl);
        chatHistory.push({ role: 'assistant', content: reply });
      } else {
        appendMessage('ai', '에이... 뭔가 문제가 생겼어. 다시 해봐.');
      }
    } catch (err) {
      typingEl.remove();
      appendMessage('ai', '으... 서버 연결이 안 돼. 잠깐 기다려봐.');
    }

    isLoading = false;
    input.focus();
  }

  function appendMessage(role, text, imageUrl) {
    const div = document.createElement('div');
    div.className = `message message-${role}`;

    if (role === 'user') {
      div.innerHTML = `<div class="bubble bubble-user">${escapeHtml(text)}</div>`;
    } else {
      let content = formatText(text);
      if (imageUrl) {
        content += `<img src="${escapeHtml(imageUrl)}" alt="Generated image" loading="lazy">`;
      }
      div.innerHTML = `
        <div class="message-avatar">&#x1f43b;</div>
        <div class="bubble bubble-ai">${content}</div>`;
    }

    messagesEl.appendChild(div);
    scrollToBottom();
  }

  function showTyping() {
    const div = document.createElement('div');
    div.className = 'message message-ai';
    div.innerHTML = `
      <div class="message-avatar">&#x1f43b;</div>
      <div class="bubble bubble-ai typing">
        <span></span><span></span><span></span>
      </div>`;
    messagesEl.appendChild(div);
    scrollToBottom();
    return div;
  }

  function scrollToBottom() {
    requestAnimationFrame(() => {
      chatArea.scrollTop = chatArea.scrollHeight;
    });
  }

  function escapeHtml(str) {
    const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
    return str.replace(/[&<>"']/g, c => map[c]);
  }

  function formatText(text) {
    // Simple markdown-like formatting
    let html = escapeHtml(text);

    // Bold: **text**
    html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');

    // Code blocks: ```code```
    html = html.replace(/```([\s\S]*?)```/g, '<pre style="background:#e8e8ed;padding:12px;border-radius:8px;margin:8px 0;overflow-x:auto;font-size:13px">$1</pre>');

    // Inline code: `code`
    html = html.replace(/`(.+?)`/g, '<code style="background:#e8e8ed;padding:2px 6px;border-radius:4px;font-size:13px">$1</code>');

    // Line breaks
    html = html.replace(/\n/g, '<br>');

    // Wrap in paragraphs (split by double line breaks)
    return html;
  }

  // Focus input on load
  input.focus();
})();
