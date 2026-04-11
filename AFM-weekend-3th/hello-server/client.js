// ---------------------------------------------------------------------------
// client.js  —  API call logic for the hello-server tester
// ---------------------------------------------------------------------------

const $ = (sel) => document.querySelector(sel);

// DOM references
const methodSelect = $('#method');
const urlInput = $('#url');
const bodyTextarea = $('#body');
const sendBtn = $('#send');
const statusBadge = $('#status');
const responsePre = $('#response');
const presetsContainer = $('#presets');
const bodySection = $('#body-section');

// ---------------------------------------------------------------------------
// Preset API buttons
// ---------------------------------------------------------------------------
const presets = [
  { label: 'GET /api/hello', method: 'GET', url: '/api/hello', body: '' },
  { label: 'GET /api/time', method: 'GET', url: '/api/time', body: '' },
  { label: 'GET all items', method: 'GET', url: '/api/items', body: '' },
  { label: 'GET item #1', method: 'GET', url: '/api/items/1', body: '' },
  { label: 'POST new item', method: 'POST', url: '/api/items', body: JSON.stringify({ name: 'New Task' }, null, 2) },
  { label: 'PUT item #1', method: 'PUT', url: '/api/items/1', body: JSON.stringify({ name: 'Updated Task', done: true }, null, 2) },
  { label: 'DELETE item #2', method: 'DELETE', url: '/api/items/2', body: '' },
  { label: 'POST echo', method: 'POST', url: '/api/echo', body: JSON.stringify({ hello: 'world', num: 42 }, null, 2) },
];

const methodColors = {
  GET: 'bg-emerald-500',
  POST: 'bg-blue-500',
  PUT: 'bg-amber-500',
  DELETE: 'bg-red-500',
};

function renderPresets() {
  presets.forEach((p) => {
    const btn = document.createElement('button');
    btn.className =
      'flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 hover:border-gray-400 ' +
      'text-sm transition-all hover:shadow-sm active:scale-95 bg-white';
    btn.innerHTML =
      `<span class="text-xs font-bold text-white px-1.5 py-0.5 rounded ${methodColors[p.method]}">${p.method}</span>` +
      `<span class="text-gray-700">${p.label.replace(p.method + ' ', '')}</span>`;
    btn.addEventListener('click', () => applyPreset(p));
    presetsContainer.appendChild(btn);
  });
}

function applyPreset(p) {
  methodSelect.value = p.method;
  urlInput.value = p.url;
  bodyTextarea.value = p.body;
  toggleBodyVisibility();
  sendRequest();
}

// ---------------------------------------------------------------------------
// Show / hide body based on method
// ---------------------------------------------------------------------------
function toggleBodyVisibility() {
  const needsBody = ['POST', 'PUT', 'PATCH'].includes(methodSelect.value);
  bodySection.classList.toggle('hidden', !needsBody);
}

methodSelect.addEventListener('change', toggleBodyVisibility);
toggleBodyVisibility();

// ---------------------------------------------------------------------------
// Send request
// ---------------------------------------------------------------------------
async function sendRequest() {
  const method = methodSelect.value;
  const url = urlInput.value.trim();

  if (!url) {
    statusBadge.textContent = 'Error';
    statusBadge.className = 'px-3 py-1 rounded-full text-sm font-mono font-bold bg-red-100 text-red-700';
    responsePre.textContent = 'URL is required';
    return;
  }

  // Reset UI
  statusBadge.textContent = '...';
  statusBadge.className = 'px-3 py-1 rounded-full text-sm font-mono font-bold bg-gray-100 text-gray-500';
  responsePre.textContent = 'Sending...';
  sendBtn.disabled = true;

  const options = { method, headers: {} };

  if (['POST', 'PUT', 'PATCH'].includes(method) && bodyTextarea.value.trim()) {
    options.headers['Content-Type'] = 'application/json';
    try {
      // Validate JSON before sending
      JSON.parse(bodyTextarea.value);
      options.body = bodyTextarea.value;
    } catch {
      statusBadge.textContent = 'Error';
      statusBadge.className = 'px-3 py-1 rounded-full text-sm font-mono font-bold bg-red-100 text-red-700';
      responsePre.textContent = 'Invalid JSON in request body';
      sendBtn.disabled = false;
      return;
    }
  }

  const startTime = performance.now();

  try {
    const res = await fetch(url, options);
    const elapsed = Math.round(performance.now() - startTime);

    // Status badge
    const code = res.status;
    let badgeColor = 'bg-emerald-100 text-emerald-700';
    if (code >= 400 && code < 500) badgeColor = 'bg-amber-100 text-amber-700';
    if (code >= 500) badgeColor = 'bg-red-100 text-red-700';
    statusBadge.textContent = `${code} ${res.statusText}  (${elapsed}ms)`;
    statusBadge.className = `px-3 py-1 rounded-full text-sm font-mono font-bold ${badgeColor}`;

    // Response body
    const contentType = res.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      const json = await res.json();
      responsePre.textContent = JSON.stringify(json, null, 2);
    } else {
      responsePre.textContent = await res.text();
    }
  } catch (err) {
    statusBadge.textContent = 'Network Error';
    statusBadge.className = 'px-3 py-1 rounded-full text-sm font-mono font-bold bg-red-100 text-red-700';
    responsePre.textContent = err.message;
  } finally {
    sendBtn.disabled = false;
  }
}

sendBtn.addEventListener('click', sendRequest);

// Allow Ctrl+Enter / Cmd+Enter to send
document.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
    sendRequest();
  }
});

// ---------------------------------------------------------------------------
// Init
// ---------------------------------------------------------------------------
renderPresets();
