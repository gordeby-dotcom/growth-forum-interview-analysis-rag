/* Growth Forum Interview Analysis — client script */

const authOverlay = document.getElementById('auth-overlay');
const authForm    = document.getElementById('auth-form');
const authError   = document.getElementById('auth-error');
const passwordEl  = document.getElementById('password');
const app         = document.getElementById('app');
const messagesEl  = document.getElementById('messages');
const userInput   = document.getElementById('user-input');
const sendBtn     = document.getElementById('send-btn');
const clearBtn    = document.getElementById('clear-btn');
const tokenDisplay = document.getElementById('token-display');
const fileInput   = document.getElementById('file-input');
const uploadStatus = document.getElementById('upload-status');
const uploadedDocList = document.getElementById('uploaded-doc-list');
const conversationsList = document.getElementById('conversations-list');

let conversationHistory = [];
let totalInputTokens = 0;
let totalOutputTokens = 0;
let isLoading = false;
let currentConversationId = null;

const STORAGE_KEY = 'gf_conversations';

// ── Conversation persistence ──────────────────────────────────

function loadAllConversations() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  } catch {
    return [];
  }
}

function saveAllConversations(convos) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(convos));
}

function saveCurrentConversation() {
  if (conversationHistory.length === 0) return;

  const all = loadAllConversations();
  const firstUser = conversationHistory.find(m => m.role === 'user');
  const title = firstUser
    ? firstUser.content.slice(0, 60) + (firstUser.content.length > 60 ? '…' : '')
    : 'Conversation';

  const now = Date.now();

  if (currentConversationId) {
    const idx = all.findIndex(c => c.id === currentConversationId);
    if (idx !== -1) {
      all[idx].history = conversationHistory;
      all[idx].title = title;
      all[idx].updatedAt = now;
      saveAllConversations(all);
      renderConversationsList();
      return;
    }
  }

  currentConversationId = 'conv_' + now;
  all.unshift({
    id: currentConversationId,
    title,
    history: conversationHistory,
    createdAt: now,
    updatedAt: now,
  });
  saveAllConversations(all);
  renderConversationsList();
}

function renderConversationsList() {
  if (!conversationsList) return;
  const all = loadAllConversations();
  conversationsList.innerHTML = '';

  if (all.length === 0) {
    conversationsList.innerHTML = '<p class="conversations-empty">No saved conversations yet.</p>';
    return;
  }

  all.forEach(convo => {
    const item = document.createElement('div');
    item.className = 'conversation-item' + (convo.id === currentConversationId ? ' active' : '');
    item.dataset.id = convo.id;

    const date = new Date(convo.updatedAt);
    const dateStr = date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) +
      ' ' + date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });

    item.innerHTML = `
      <div class="conversation-item-body">
        <span class="conversation-title">${escapeHtml(convo.title)}</span>
        <span class="conversation-date">${dateStr}</span>
      </div>
      <button class="conversation-delete" data-id="${convo.id}" title="Delete">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      </button>
    `;

    item.querySelector('.conversation-item-body').addEventListener('click', () => {
      loadConversation(convo.id);
    });

    item.querySelector('.conversation-delete').addEventListener('click', (e) => {
      e.stopPropagation();
      deleteConversation(convo.id);
    });

    conversationsList.appendChild(item);
  });
}

function loadConversation(id) {
  const all = loadAllConversations();
  const convo = all.find(c => c.id === id);
  if (!convo) return;

  conversationHistory = convo.history;
  currentConversationId = id;
  totalInputTokens = 0;
  totalOutputTokens = 0;
  tokenDisplay.textContent = '';

  messagesEl.innerHTML = '';
  conversationHistory.forEach(msg => {
    appendMessage(msg.role, msg.content);
  });

  renderConversationsList();
  scrollToBottom();
}

function deleteConversation(id) {
  let all = loadAllConversations();
  all = all.filter(c => c.id !== id);
  saveAllConversations(all);

  if (currentConversationId === id) {
    currentConversationId = null;
    conversationHistory = [];
    totalInputTokens = 0;
    totalOutputTokens = 0;
    tokenDisplay.textContent = '';
    messagesEl.innerHTML = `
      <div class="welcome-message">
        <div class="welcome-icon">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#007B40" stroke-width="1.5">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
          </svg>
        </div>
        <h2>Growth Forum · Interview Analysis</h2>
        <p>Ask a question or use a Quick Prompt to begin.</p>
      </div>
    `;
  }

  renderConversationsList();
}

function escapeHtml(str) {
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ── Auth ─────────────────────────────────────────────────────

function getAuthToken() { return localStorage.getItem('gf_auth_token') || ''; }
function setAuthToken(t) { localStorage.setItem('gf_auth_token', t); }
function clearAuthToken() { localStorage.removeItem('gf_auth_token'); }
function authHeaders(extra = {}) {
  return { ...extra, 'X-Auth-Token': getAuthToken() };
}

async function checkAuth() {
  if (!getAuthToken()) return;
  const res = await fetch('/api/check-auth', { headers: authHeaders() });
  const data = await res.json();
  if (data.authenticated) showApp();
  else clearAuthToken();
}

authForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  authError.classList.add('hidden');
  const password = passwordEl.value;

  const res = await fetch('/api/auth', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password }),
  });

  if (res.ok) {
    const data = await res.json();
    setAuthToken(data.token);
    showApp();
  } else {
    authError.classList.remove('hidden');
    passwordEl.focus();
  }
});

function showApp() {
  authOverlay.classList.add('hidden');
  app.classList.remove('hidden');
  renderConversationsList();
  userInput.focus();
}

// ── Chat ─────────────────────────────────────────────────────

async function sendMessage(text) {
  if (isLoading || !text.trim()) return;
  isLoading = true;
  sendBtn.disabled = true;

  const welcome = messagesEl.querySelector('.welcome-message');
  if (welcome) welcome.remove();

  appendMessage('user', text);
  conversationHistory.push({ role: 'user', content: text });
  userInput.value = '';
  autoResize();

  const thinkingEl = showThinking();

  try {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ messages: conversationHistory }),
    });

    thinkingEl.remove();

    if (!res.ok) {
      const err = await res.json();
      appendError(err.error || 'Something went wrong. Please try again.');
      return;
    }

    const data = await res.json();
    appendMessage('assistant', data.content);
    conversationHistory.push({ role: 'assistant', content: data.content });

    totalInputTokens  += data.usage?.input_tokens  || 0;
    totalOutputTokens += data.usage?.output_tokens || 0;
    tokenDisplay.textContent =
      `${(totalInputTokens + totalOutputTokens).toLocaleString()} tokens`;

    saveCurrentConversation();

  } catch (err) {
    thinkingEl.remove();
    appendError('Network error. Please check your connection and try again.');
  } finally {
    isLoading = false;
    sendBtn.disabled = false;
    userInput.focus();
  }
}

function parseFollowups(content) {
  const match = content.match(/\[FOLLOWUPS\]([\s\S]*?)\[\/FOLLOWUPS\]/i);
  if (!match) return { body: content, followups: [] };
  const body = content.replace(match[0], '').trim();
  const followups = match[1]
    .split('\n')
    .map(l => l.replace(/^\s*[-*]\s*/, '').trim())
    .filter(Boolean)
    .map(line => {
      const [label, ...rest] = line.split('||');
      const prompt = rest.join('||').trim();
      return { label: label.trim(), prompt: prompt || label.trim() };
    })
    .filter(f => f.label);
  return { body, followups };
}

function appendMessage(role, content) {
  const wrapper = document.createElement('div');
  wrapper.className = `message ${role}`;

  const roleLabel = document.createElement('div');
  roleLabel.className = 'message-role';
  roleLabel.textContent = role === 'user' ? 'You' : 'Analysis';

  const bubble = document.createElement('div');
  bubble.className = 'message-bubble';

  if (role === 'assistant') {
    const { body, followups } = parseFollowups(content);
    bubble.innerHTML = marked.parse(body);

    if (followups.length) {
      const followupsEl = document.createElement('div');
      followupsEl.className = 'followups';
      const heading = document.createElement('div');
      heading.className = 'followups-heading';
      heading.textContent = 'Explore further';
      followupsEl.appendChild(heading);
      followups.forEach(f => {
        const btn = document.createElement('button');
        btn.className = 'followup-btn';
        btn.type = 'button';
        btn.textContent = f.label;
        btn.addEventListener('click', () => {
          btn.disabled = true;
          btn.classList.add('used');
          sendMessage(f.prompt);
        });
        followupsEl.appendChild(btn);
      });
      bubble.appendChild(followupsEl);
    }

    const actions = document.createElement('div');
    actions.className = 'message-actions';
    const exportBtn = document.createElement('button');
    exportBtn.className = 'export-btn';
    exportBtn.type = 'button';
    exportBtn.innerHTML = `
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
        <polyline points="7 10 12 15 17 10"/>
        <line x1="12" y1="15" x2="12" y2="3"/>
      </svg>
      <span>Export to Word</span>`;
    exportBtn.addEventListener('click', () => exportToWord(content, exportBtn));
    actions.appendChild(exportBtn);
    bubble.appendChild(actions);
  } else {
    bubble.textContent = content;
  }

  wrapper.appendChild(roleLabel);
  wrapper.appendChild(bubble);
  messagesEl.appendChild(wrapper);
  scrollToBottom();
}

async function exportToWord(content, btn) {
  const labelSpan = btn.querySelector('span');
  const original = labelSpan ? labelSpan.textContent : '';
  if (labelSpan) labelSpan.textContent = 'Preparing…';
  btn.disabled = true;

  const firstUser = conversationHistory.find(m => m.role === 'user');
  let title = firstUser ? firstUser.content.trim() : 'Growth Forum Analysis';
  if (title.length > 80) title = title.slice(0, 80).trim() + '…';

  try {
    const res = await fetch('/api/export', {
      method: 'POST',
      headers: authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ title, content }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Export failed');
    }
    const blob = await res.blob();
    const disposition = res.headers.get('Content-Disposition') || '';
    const match = disposition.match(/filename="?([^"]+)"?/);
    const filename = match ? match[1] : 'growth_forum_analysis.docx';

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);

    if (labelSpan) labelSpan.textContent = 'Downloaded ✓';
    setTimeout(() => { if (labelSpan) labelSpan.textContent = original; btn.disabled = false; }, 2000);
  } catch (err) {
    if (labelSpan) labelSpan.textContent = 'Export failed';
    setTimeout(() => { if (labelSpan) labelSpan.textContent = original; btn.disabled = false; }, 2500);
  }
}

function appendError(msg) {
  const el = document.createElement('div');
  el.style.cssText =
    'color:#DC2626;font-size:13px;padding:10px 14px;background:#FEF2F2;border:1px solid #FECACA;border-radius:8px;max-width:820px;margin:0 auto;width:100%';
  el.textContent = msg;
  messagesEl.appendChild(el);
  scrollToBottom();
}

function showThinking() {
  const el = document.createElement('div');
  el.className = 'thinking';
  el.innerHTML = `
    <div class="thinking-dots"><span></span><span></span><span></span></div>
    <span class="thinking-label">Analyzing interview data…</span>
  `;
  messagesEl.appendChild(el);
  scrollToBottom();
  return el;
}

function scrollToBottom() {
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

// ── Input controls ───────────────────────────────────────────

sendBtn.addEventListener('click', () => {
  sendMessage(userInput.value.trim());
});

userInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendMessage(userInput.value.trim());
  }
});

userInput.addEventListener('input', autoResize);

function autoResize() {
  userInput.style.height = 'auto';
  userInput.style.height = Math.min(userInput.scrollHeight, 200) + 'px';
  const len = userInput.value.length;
  const charCount = document.getElementById('char-count');
  charCount.textContent = len > 0 ? `${len} chars` : '';
}

clearBtn.addEventListener('click', () => {
  if (conversationHistory.length === 0) return;
  if (!confirm('Clear the conversation? This cannot be undone.')) return;

  currentConversationId = null;
  conversationHistory = [];
  totalInputTokens = 0;
  totalOutputTokens = 0;
  tokenDisplay.textContent = '';
  renderConversationsList();

  messagesEl.innerHTML = `
    <div class="welcome-message">
      <div class="welcome-icon">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#007B40" stroke-width="1.5">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
        </svg>
      </div>
      <h2>Growth Forum · Interview Analysis</h2>
      <p>Conversation cleared. Ask a question or use a Quick Prompt to begin.</p>
    </div>
  `;
});

// ── Quick prompts ─────────────────────────────────────────────

document.querySelectorAll('.quick-prompt').forEach((btn) => {
  btn.addEventListener('click', () => {
    userInput.value = btn.dataset.prompt;
    autoResize();
    sendMessage(btn.dataset.prompt);
  });
});

// ── File upload ───────────────────────────────────────────────

document.querySelector('.upload-btn').addEventListener('click', () => {
  fileInput.click();
});

fileInput.addEventListener('change', async () => {
  const file = fileInput.files[0];
  if (!file) return;

  uploadStatus.textContent = 'Uploading…';

  const formData = new FormData();
  formData.append('file', file);

  try {
    const res = await fetch('/api/upload', { method: 'POST', headers: authHeaders(), body: formData });
    const data = await res.json();

    if (res.ok) {
      uploadStatus.textContent = `✓ ${file.name} added`;
      addUploadedDocToSidebar(file.name);
      setTimeout(() => (uploadStatus.textContent = ''), 3000);
    } else {
      uploadStatus.style.color = '#DC2626';
      uploadStatus.textContent = data.error || 'Upload failed';
    }
  } catch {
    uploadStatus.style.color = '#DC2626';
    uploadStatus.textContent = 'Upload failed';
  }

  fileInput.value = '';
});

function addUploadedDocToSidebar(filename) {
  const li = document.createElement('li');
  li.className = 'doc-item uploaded';
  li.title = filename;
  li.innerHTML = `
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6366F1" stroke-width="2.5">
      <polyline points="20 6 9 17 4 12"/>
    </svg>
    <span>${filename.replace(/_/g, ' ').replace(/\.(md|txt)$/, '')}</span>
  `;
  uploadedDocList.appendChild(li);
}

// ── Sidebar toggle (mobile) ───────────────────────────────────

const sidebarEl = document.getElementById('sidebar');
const sidebarToggle = document.getElementById('sidebar-toggle');
const sidebarBackdrop = document.getElementById('sidebar-backdrop');

function openSidebar() {
  sidebarEl.classList.add('open');
  sidebarBackdrop.classList.add('open');
}
function closeSidebar() {
  sidebarEl.classList.remove('open');
  sidebarBackdrop.classList.remove('open');
}

sidebarToggle?.addEventListener('click', () => {
  if (sidebarEl.classList.contains('open')) closeSidebar();
  else openSidebar();
});
sidebarBackdrop?.addEventListener('click', closeSidebar);

// Auto-close sidebar after picking a quick prompt or conversation on mobile
sidebarEl?.addEventListener('click', (e) => {
  if (window.innerWidth > 768) return;
  const target = e.target.closest('.quick-prompt, .conversation-item');
  if (target) closeSidebar();
});

// ── Init ──────────────────────────────────────────────────────

checkAuth();
