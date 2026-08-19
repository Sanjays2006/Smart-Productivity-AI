/**
 * chat.js — PhiChat Complete Frontend
 * Auth · Backend Sessions · SSE Streaming · Voice · Theme · Export
 */

/* ─── State ──────────────────────────────────────────── */
let currentUser  = null;   // { id, username, displayName }
let sessions     = [];     // backend session list
let activeSession= null;   // { id, title, messages:[] }
let isGenerating = false;
let currentSSE   = null;   // EventSource
let recognition  = null;
let isRecording  = false;
let guestMode    = false;
let ollamaOnline = false;

const $ = id => document.getElementById(id);

/* ─── Boot ───────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', async () => {
  // Theme initialized globally by theme.js
  bindEvents();
  await checkAuth();
  checkOllamaStatus();
  setInterval(checkOllamaStatus, 30_000);
  initParticles();
  initMobileNav();

  // Premium Entrance
  if (typeof gsap !== 'undefined') {
    gsap.from('.sidebar-brand', { opacity: 0, x: -20, duration: 0.6, ease: 'power2.out' });
    gsap.from('.nav-item',      { 
      opacity: 0, 
      x: -20, 
      duration: 0.5, 
      stagger: 0.05, 
      delay: 0.2, 
      ease: 'power2.out',
      clearProps: 'all'
    });
    gsap.from('.chat-main',     { opacity: 0, y: 20, duration: 0.8, ease: 'power4.out' });
  }
});

/* ─── Auth ───────────────────────────────────────────── */
function getAuthHeader() {
  const token = localStorage.getItem('focus_ai_token');
  return token ? { 'Authorization': `Bearer ${token}` } : {};
}

async function checkAuth() {
  try {
    const res = await fetch('/api/auth/me', { headers: getAuthHeader() });
    if (res.ok) {
      const data = await res.json();
      if (data.authenticated) { currentUser = data; guestMode = false; hideAuthModal(); await initApp(); return; }
    }
  } catch {}
  showAuthModal();
}

function showAuthModal() {
  $('authOverlay').style.display = 'flex';
  $('chatLayout').style.display  = 'none';
}
function hideAuthModal() {
  $('authOverlay').style.display = 'none';
  $('chatLayout').style.display  = 'flex';
}

function switchTab(tab) {
  const isLogin = tab === 'login';
  $('loginForm').classList.toggle('hidden', !isLogin);
  $('registerForm').classList.toggle('hidden', isLogin);
  $('tabLogin').classList.toggle('active', isLogin);
  $('tabRegister').classList.toggle('active', !isLogin);
}

async function submitLogin(e) {
  e.preventDefault();
  const username = $('loginUsername').value.trim();
  const password = $('loginPassword').value;
  $('loginError').textContent = '';
  const btn = $('loginBtn');
  btn.disabled = true;
  btn.querySelector('span').textContent = 'Signing in…';
  try {
    const res  = await fetch('/api/auth/login', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ username, password }) });
    const data = await res.json();
    if (res.ok && (data.authenticated || data.token)) {
      if (data.token) localStorage.setItem('focus_ai_token', data.token);
      currentUser = data; guestMode = false; hideAuthModal(); await initApp();
    }
    else $('loginError').textContent = data.error || 'Login failed';
  } catch { $('loginError').textContent = 'Cannot reach server'; }
  finally { btn.disabled = false; btn.querySelector('span').textContent = 'Sign In'; }
}

async function submitRegister(e) {
  e.preventDefault();
  const displayName = $('regDisplayName').value.trim();
  const username    = $('regUsername').value.trim();
  const email       = $('regEmail').value.trim();
  const password    = $('regPassword').value;
  $('registerError').textContent = '';
  const btn = $('registerBtn');
  btn.disabled = true;
  btn.querySelector('span').textContent = 'Creating…';
  try {
    const res  = await fetch('/api/auth/register', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ username, email, password, displayName }) });
    const data = await res.json();
    if (res.ok && (data.authenticated || data.token)) {
      if (data.token) localStorage.setItem('focus_ai_token', data.token);
      currentUser = data; guestMode = false; hideAuthModal(); await initApp();
    }
    else $('registerError').textContent = data.error || 'Registration failed';
  } catch { $('registerError').textContent = 'Cannot reach server'; }
  finally { btn.disabled = false; btn.querySelector('span').textContent = 'Create Account'; }
}

function continueAsGuest() {
  guestMode = true;
  currentUser = { displayName: 'Guest', username: 'guest' };
  hideAuthModal();
  initGuestMode();
}

async function handleLogout() {
  try { await fetch('/api/auth/logout', { method: 'POST', headers: getAuthHeader() }); } catch {}
  localStorage.removeItem('focus_ai_token');
  currentUser = null; sessions = []; activeSession = null; guestMode = false;
  $('logoutBtn').style.display = 'none';
  $('userCard').style.display  = 'none';
  showAuthModal();
}

/* ─── App Init ───────────────────────────────────────── */
async function initApp() {
  updateUserUI();
  $('logoutBtn').style.display = 'flex';
  $('userCard').style.display  = 'flex';
  await loadSessions();
  if (sessions.length === 0) await createNewSession();
  else await switchToSession(sessions[0]);
}

function initGuestMode() {
  $('userCard').style.display  = 'flex';
  $('logoutBtn').style.display = 'none';
  $('userDisplayName').textContent = 'Guest';
  $('userAvatar').textContent = 'G';
  try { sessions = JSON.parse(localStorage.getItem('phi-guest') || '[]'); } catch { sessions = []; }
  renderSessionList();
  if (sessions.length === 0) createGuestSession();
  else switchToSession(sessions[0]);
}

function updateUserUI() {
  if (!currentUser) return;
  const name = currentUser.displayName || currentUser.username || 'User';
  $('userDisplayName').textContent = name;
  $('userAvatar').textContent = name.charAt(0).toUpperCase();
}

/* ─── Backend Sessions ───────────────────────────────── */
async function loadSessions() {
  try {
    const res = await fetch('/api/chat/sessions', { headers: getAuthHeader() });
    if (res.ok) { sessions = await res.json(); renderSessionList(); }
  } catch {}
}

async function createNewSession() {
  if (guestMode) { createGuestSession(); return; }
  try {
    const res  = await fetch('/api/chat/sessions', { method:'POST', headers:{'Content-Type':'application/json', ...getAuthHeader()}, body:'{}' });
    if (res.ok) {
      const s = await res.json();
      activeSession = { id: s.id, title: s.title || 'New Chat', messages: [] };
      sessions.unshift({ id: s.id, title: activeSession.title, updatedAt: s.createdAt });
      renderSessionList(); renderMessages(); setNavTitle(activeSession.title); closeSidebar();
    }
  } catch { showToast('Failed to create session', 'error'); }
}

async function switchToSession(summary) {
  if (guestMode) { loadGuestSession(summary); return; }
  if (currentSSE) { currentSSE.close(); currentSSE = null; }
  isGenerating = false; resetSendBtn();
  try {
    const res = await fetch(`/api/chat/sessions/${summary.id}/messages`, { headers: getAuthHeader() });
    if (res.ok) {
      const msgs = await res.json();
      activeSession = { id: summary.id, title: summary.title, messages: msgs };
      renderSessionList(); renderMessages(); setNavTitle(summary.title); closeSidebar();
    }
  } catch { showToast('Failed to load session', 'error'); }
}

async function deleteSessionById(id, e) {
  e.stopPropagation();
  if (guestMode) { deleteGuestSession(id); return; }
  try {
    await fetch(`/api/chat/sessions/${id}`, { method:'DELETE', headers: getAuthHeader() });
    sessions = sessions.filter(s => s.id !== id);
    renderSessionList();
    if (activeSession && activeSession.id === id) {
      sessions.length ? await switchToSession(sessions[0]) : await createNewSession();
    }
    showToast('Chat deleted', 'success');
  } catch { showToast('Delete failed', 'error'); }
}

/* ─── Guest Sessions ─────────────────────────────────── */
function createGuestSession() {
  const s = { id: 'g_' + Date.now(), title: 'New Chat', messages: [] };
  sessions.unshift(s); saveGuest();
  activeSession = s; renderSessionList(); renderMessages(); setNavTitle('New Chat'); closeSidebar();
}
function loadGuestSession(summary) {
  const s = sessions.find(x => String(x.id) === String(summary.id));
  if (!s) return;
  activeSession = s; renderSessionList(); renderMessages(); setNavTitle(s.title); closeSidebar();
}
function deleteGuestSession(id) {
  sessions = sessions.filter(s => s.id !== id); saveGuest();
  renderSessionList();
  if (activeSession && activeSession.id === id) {
    sessions.length ? loadGuestSession(sessions[0]) : createGuestSession();
  }
  showToast('Chat deleted', 'success');
}
function saveGuest() {
  try { localStorage.setItem('phi-guest', JSON.stringify(sessions.slice(0,20).map(s => ({...s, messages: (s.messages||[]).slice(-30)})))); } catch {}
}

/* ─── Render ─────────────────────────────────────────── */
function renderSessionList() {
  const list = $('sessionList');
  if (!sessions || sessions.length === 0) {
    list.innerHTML = `<div class="sessions-empty"><i class="fa-regular fa-comment-dots"></i><p>No chats yet</p></div>`;
    return;
  }
  list.innerHTML = sessions.map(s => `
    <div class="session-item ${activeSession && activeSession.id === s.id ? 'active' : ''}" onclick="handleSessionClick('${s.id}')">
      <i class="fa-regular fa-message"></i>
      <span class="session-item-text">${escHtml(s.title || 'New Chat')}</span>
      <button class="session-delete-btn" onclick="deleteSessionById('${s.id}', event)" title="Delete">
        <i class="fa-solid fa-trash-can"></i>
      </button>
    </div>`).join('');
}

function handleSessionClick(id) {
  const s = sessions.find(x => String(x.id) === String(id));
  if (s) switchToSession(s);
}

function renderMessages() {
  const feed = $('messagesFeed');
  feed.innerHTML = '';
  if (!activeSession || activeSession.messages.length === 0) {
    feed.appendChild(buildWelcomeScreen()); return;
  }
  activeSession.messages.forEach(m => {
    const role = m.role === 'assistant' ? 'ai' : m.role;
    appendMessage(role, m.content, m.createdAt || m.time, null, false);
  });
  setTimeout(() => feed.scrollTop = feed.scrollHeight, 50);
}

function setNavTitle(title) {
  const el = $('sessionTitleNav');
  if (el) el.textContent = title;
}

/* ─── Send & Stream ──────────────────────────────────── */
async function sendMessage() {
  const input = $('chatInput');
  const text  = input.value.trim();
  if (!text || isGenerating) return;
  const ws = $('messagesFeed').querySelector('.welcome-screen');
  if (ws) ws.remove();
  isGenerating = true; setSendBtnLoading(true);
  input.value = ''; autoResize(input);
  $('charCount').textContent = '0 / 8000';
  appendMessage('user', text, fmtTime());
  if (guestMode) await sendGuest(text);
  else await streamMessage(text);
}

async function sendGuest(text) {
  if (activeSession) {
    if (!activeSession.messages.length) autoTitle(text);
    activeSession.messages.push({ role:'user', content:text, time:fmtTime() });
    saveGuest();
  }
  showTypingBar();
  try {
    const res  = await fetch('/api/ai/ask', { method:'POST', headers:{'Content-Type':'application/json', ...getAuthHeader()}, body: JSON.stringify({ question:text, mode:'offline' }) });
    const data = await res.json();
    hideTypingBar();
    const answer = data.answer || '⚠️ No response';
    if (activeSession) { activeSession.messages.push({ role:'assistant', content:answer, time:fmtTime() }); saveGuest(); }
    appendMessage('ai', answer, fmtTime());
  } catch (err) {
    hideTypingBar();
    appendMessage('ai', `⚠️ Error: ${err.message}`, fmtTime());
    showToast(err.message, 'error');
  } finally { isGenerating = false; resetSendBtn(); }
}

async function streamMessage(text) {
  if (!activeSession) { isGenerating = false; resetSendBtn(); return; }
  if (!activeSession.messages.length) autoTitle(text);
  showTypingBar();

  const msgRow = createStreamingBubble();
  const bubble  = msgRow.querySelector('.msg-bubble');
  let fullText  = '';
  hideTypingBar();

  try {
    const response = await fetch('/api/chat/stream-post', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', 'Accept': 'text/event-stream', ...getAuthHeader() },
      body: JSON.stringify({ message: text, sessionId: activeSession.id })
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      if (response.status === 401) {
        bubble.innerHTML = '<span style="color:var(--danger)">⚠️ Session expired — please log in again.</span>';
        showToast('Session expired — please log in', 'error');
      } else {
        bubble.innerHTML = `<span style="color:var(--danger)">⚠️ Server error ${response.status}</span>`;
      }
      isGenerating = false; resetSendBtn(); return;
    }

    const reader  = response.body.getReader();
    const decoder = new TextDecoder();
    let   buffer  = '';
    let   eventType = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop(); // keep incomplete last line

      for (const line of lines) {
        if (line.startsWith('event:')) {
          eventType = line.slice(6).trim();
        } else if (line.startsWith('data:')) {
          const raw = line.slice(5).trim();
          if (!raw) continue;

          if (eventType === 'done') {
            finishStream(bubble, msgRow, fullText, text);
            return;
          } else if (eventType === 'error') {
            try {
              const d = JSON.parse(raw);
              bubble.innerHTML = `<span style="color:var(--danger)">⚠️ ${escHtml(d.error || raw)}</span>`;
            } catch {
              bubble.innerHTML = `<span style="color:var(--danger)">⚠️ ${escHtml(raw)}</span>`;
            }
            isGenerating = false; resetSendBtn(); return;
          } else {
            // eventType === 'token' or unknown — treat as token
            fullText += raw;
            bubble.innerHTML = renderMarkdown(fullText) + '<span class="cursor-blink">|</span>';
            $('messagesFeed').scrollTop = $('messagesFeed').scrollHeight;
          }
          eventType = ''; // reset after consuming
        } else if (line === '') {
          eventType = ''; // blank line = event separator
        }
      }
    }

    // Stream ended normally
    finishStream(bubble, msgRow, fullText, text);

  } catch (err) {
    hideTypingBar();
    bubble.innerHTML = `<span style="color:var(--danger)">⚠️ Stream error: ${escHtml(err.message)}<br>Make sure Ollama is running: <code>ollama serve</code></span>`;
    isGenerating = false; resetSendBtn();
  }
}

function finishStream(bubble, msgRow, fullText, userText) {
  bubble.innerHTML = renderMarkdown(fullText || '(empty response)');
  bubble.dataset.raw = fullText;
  const copyBtn = document.createElement('button');
  copyBtn.className = 'copy-btn'; copyBtn.title = 'Copy';
  copyBtn.innerHTML = '<i class="fa-regular fa-copy"></i>';
  copyBtn.onclick = () => copyMsg(copyBtn);
  bubble.prepend(copyBtn);
  const ts = msgRow.querySelector('.msg-time');
  if (ts) ts.textContent = fmtTime();
  if (activeSession) {
    activeSession.messages.push({ role: 'user',      content: userText,  time: fmtTime() });
    activeSession.messages.push({ role: 'assistant', content: fullText,  time: fmtTime() });
    loadSessions();
  }
  isGenerating = false; resetSendBtn();
}

function setSendBtnLoading(loading) {
  const btn = $('sendBtn');
  if (loading) { btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-circle-stop"></i>'; }
  else resetSendBtn();
}
function resetSendBtn() {
  const btn = $('sendBtn');
  if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-paper-plane" id="sendIcon"></i>'; }
}

/* ─── Message Rendering ──────────────────────────────── */
function appendMessage(role, content, time, sources, animate=true) {
  const feed = $('messagesFeed');
  const row  = document.createElement('div');
  row.className = `msg-row ${role}`;
  if (!animate) row.style.animation = 'none';
  const avatar   = role === 'user' ? '<i class="fa-solid fa-user"></i>' : '<i class="fa-solid fa-robot"></i>';
  const formatted = renderMarkdown(content);
  const srcHtml  = sources && sources.length ? `<div class="msg-sources">📚 <strong>Sources:</strong> ${sources.map(s=>`<span>${escHtml(s)}</span>`).join('')}</div>` : '';
  const copyBtn  = role === 'ai' ? `<button class="copy-btn" onclick="copyMsg(this)" title="Copy"><i class="fa-regular fa-copy"></i></button>` : '';
  row.innerHTML = `
    <div class="msg-avatar">${avatar}</div>
    <div class="msg-content">
      <div class="msg-bubble" data-raw="${escAttr(content)}">${copyBtn}${formatted}${srcHtml}</div>
      <span class="msg-time">${time||''}</span>
    </div>`;
  feed.appendChild(row);
  feed.scrollTop = feed.scrollHeight;
  return row;
}

function createStreamingBubble() {
  const feed = $('messagesFeed');
  const row  = document.createElement('div');
  row.className = 'msg-row ai';
  row.innerHTML = `<div class="msg-avatar"><i class="fa-solid fa-robot"></i></div><div class="msg-content"><div class="msg-bubble"></div><span class="msg-time"></span></div>`;
  feed.appendChild(row);
  feed.scrollTop = feed.scrollHeight;
  return row;
}

function buildWelcomeScreen() {
  const div = document.createElement('div');
  div.className = 'welcome-screen'; div.id = 'welcomeScreen';
  div.innerHTML = `
    <div class="welcome-glow"></div>
    <div class="welcome-icon"><i class="fa-solid fa-robot"></i></div>
    <h1>Hello, I'm Phi-3</h1>
    <p>Your private AI assistant running 100% offline via Ollama.<br>Ask me anything — code, analysis, writing, math.</p>
    <div class="quick-prompts">
      <button class="quick-btn" data-prompt="Explain the difference between REST and GraphQL APIs"><i class="fa-solid fa-network-wired"></i><span>REST vs GraphQL</span></button>
      <button class="quick-btn" data-prompt="Write a Python function to find all prime numbers using the Sieve of Eratosthenes"><i class="fa-brands fa-python"></i><span>Sieve of Eratosthenes</span></button>
      <button class="quick-btn" data-prompt="Give me 5 science-backed techniques to improve focus and deep work"><i class="fa-solid fa-brain"></i><span>5 focus techniques</span></button>
      <button class="quick-btn" data-prompt="What are the key principles of clean code? Give examples."><i class="fa-solid fa-code"></i><span>Clean code principles</span></button>
      <button class="quick-btn" data-prompt="Explain quantum computing in simple terms with a real-world analogy"><i class="fa-solid fa-atom"></i><span>Quantum computing</span></button>
      <button class="quick-btn" data-prompt="Create a SQL query to find the top 5 customers by total order value"><i class="fa-solid fa-database"></i><span>SQL: top customers</span></button>
    </div>`;
  div.querySelectorAll('.quick-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      $('chatInput').value = btn.dataset.prompt;
      autoResize($('chatInput'));
      $('charCount').textContent = `${btn.dataset.prompt.length} / 8000`;
      sendMessage();
    });
  });
  return div;
}

/* ─── Utility: clear / export ────────────────────────── */
function clearCurrentMessages() {
  if (!activeSession) return;
  activeSession.messages = [];
  if (guestMode) saveGuest();
  renderMessages(); setNavTitle('New Chat');
  if (activeSession) activeSession.title = 'New Chat';
  renderSessionList();
  showToast('Chat cleared', 'success');
}

function exportChat() {
  if (!activeSession || !activeSession.messages.length) { showToast('Nothing to export', 'info'); return; }
  const lines = activeSession.messages.map(m => `[${m.role.toUpperCase()}]\n${m.content}`).join('\n\n---\n\n');
  const blob  = new Blob([lines], { type: 'text/plain' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${(activeSession.title || 'chat').replace(/\s+/g,'-')}.txt`;
  a.click(); URL.revokeObjectURL(a.href);
  showToast('Chat exported!', 'success');
}

/* ─── Ollama Status ──────────────────────────────────── */
async function checkOllamaStatus() {
  try {
    const res  = await fetch('/api/ai/status');
    const data = await res.json();
    ollamaOnline = data.ollamaRunning;
    const dot = $('pillDot'), txt = $('pillText');
    if (dot) dot.className = `pulse-dot ${ollamaOnline ? 'online' : 'offline'}`;
    if (txt) txt.textContent = ollamaOnline ? 'Phi-3 Ready' : 'Ollama Offline';
    const sdot = $('statusDot'), stxt = $('statusLabel');
    if (sdot) sdot.className = `status-dot ${ollamaOnline ? 'online' : 'offline'}`;
    if (stxt) stxt.textContent = ollamaOnline ? 'phi3 · Online' : 'Run: ollama serve';
    const mt = $('modelTag');
    if (mt) mt.textContent = ollamaOnline ? 'Phi-3 · Ollama · Ready ✓' : 'Phi-3 · Ollama · Offline';
  } catch {
    const dot = $('pillDot'), txt = $('pillText');
    if (dot) dot.className = 'pulse-dot offline';
    if (txt) txt.textContent = 'Backend Down';
  }
}

// Theme handled globally by theme.js
/* ─── Sidebar ────────────────────────────────────────── */
function initMobileNav() {
  const toggle = $('sidebarToggle');
  const sidebar = $('sidebar');
  if (toggle && sidebar) {
    toggle.addEventListener('click', (e) => {
      e.stopPropagation();
      sidebar.classList.toggle('mobile-open');
    });
    
    // Clicking anywhere outside the sidebar should close it
    document.addEventListener('click', (e) => {
      if (sidebar.classList.contains('mobile-open') && !sidebar.contains(e.target) && !toggle.contains(e.target)) {
        closeSidebar();
      }
    });
  }

  // Close sidebar on clicking any nav item
  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', closeSidebar);
  });
}

function closeSidebar() { 
  $('sidebar')?.classList.remove('mobile-open'); 
}

/* ─── Voice ──────────────────────────────────────────── */
function toggleVoice() {
  if (!('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) { showToast('Voice not supported', 'error'); return; }
  if (isRecording) { recognition && recognition.stop(); stopRecording(); return; }
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  recognition = new SR(); recognition.lang = 'en-US'; recognition.interimResults = false;
  recognition.onresult = e => {
    const t = e.results[0][0].transcript;
    $('chatInput').value = t; autoResize($('chatInput'));
    $('charCount').textContent = `${t.length} / 8000`;
    showToast('Voice captured ✓', 'success');
  };
  recognition.onerror = () => { showToast('Voice error', 'error'); stopRecording(); };
  recognition.onend   = () => stopRecording();
  recognition.start(); isRecording = true;
  $('voiceBtn').classList.add('recording');
  $('micIcon').className = 'fa-solid fa-microphone-slash';
  showToast('Listening… speak now', 'info');
}
function stopRecording() {
  isRecording = false;
  const vb = $('voiceBtn'), mi = $('micIcon');
  if (vb) vb.classList.remove('recording');
  if (mi) mi.className = 'fa-solid fa-microphone';
}

/* ─── Auto-title ─────────────────────────────────────── */
function autoTitle(text) {
  if (!activeSession) return;
  activeSession.title = text.length > 42 ? text.slice(0, 42) + '…' : text;
  setNavTitle(activeSession.title);
  renderSessionList();
  if (guestMode) saveGuest();
}

/* ─── Markdown ───────────────────────────────────────── */
function renderMarkdown(text) {
  let h = escHtml(text)
    .replace(/```(\w*)\n?([\s\S]*?)```/g, (_, lang, code) => `<pre><code class="lang-${lang}">${code.trim()}</code></pre>`)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/^### (.*?)$/gm, '<h5 style="margin:12px 0 4px;color:var(--t1)">$1</h5>')
    .replace(/^## (.*?)$/gm,  '<h4 style="margin:14px 0 6px;color:var(--t1)">$1</h4>')
    .replace(/^# (.*?)$/gm,   '<h3 style="margin:16px 0 8px;color:var(--t1)">$1</h3>')
    .replace(/^[-*] (.*?)$/gm, '<li style="margin:3px 0;padding-left:4px">$1</li>')
    .replace(/\n\n/g, '</p><p style="margin:10px 0">')
    .replace(/\n/g, '<br>');
  return `<p style="margin:0">${h}</p>`;
}

/* ─── Copy ───────────────────────────────────────────── */
function copyMsg(btn) {
  const raw = btn.closest('.msg-bubble')?.dataset.raw || '';
  navigator.clipboard.writeText(raw).then(() => {
    btn.innerHTML = '<i class="fa-solid fa-check"></i>';
    setTimeout(() => btn.innerHTML = '<i class="fa-regular fa-copy"></i>', 1500);
  });
}

/* ─── Typing bar ─────────────────────────────────────── */
function showTypingBar() { const b = $('typingBar'); if (b) b.style.display = 'flex'; }
function hideTypingBar() { const b = $('typingBar'); if (b) b.style.display = 'none'; }

/* ─── Auto-resize ────────────────────────────────────── */
function autoResize(el) { el.style.height = 'auto'; el.style.height = Math.min(el.scrollHeight, 200) + 'px'; }

/* ─── Toast ──────────────────────────────────────────── */
function showToast(msg, type='info') {
  const c = $('toastContainer'); if (!c) return;
  const t = document.createElement('div');
  t.className = `chat-toast ${type} show`; t.textContent = msg;
  c.appendChild(t);
  setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 400); }, 3000);
}

/* ─── Helpers ────────────────────────────────────────── */
function fmtTime() { return new Date().toLocaleTimeString('en-US', { hour:'2-digit', minute:'2-digit' }); }
function escHtml(s) { return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function escAttr(s) { return escHtml(s).replace(/'/g,'&#39;'); }

/* ─── Event Binding ──────────────────────────────────── */
function bindEvents() {
  $('newChatBtn')?.addEventListener('click', createNewSession);
  $('sendBtn')?.addEventListener('click', sendMessage);
  
  const input = $('chatInput');
  if (input) {
    input.addEventListener('input', () => {
      autoResize(input);
      $('charCount').textContent = `${input.value.length} / 8000`;
      const btn = $('sendBtn');
      if (btn) btn.disabled = input.value.length === 0 || isGenerating;
    });
    input.addEventListener('keydown', e => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    });
  }
}

function initParticles() {
  if (typeof particlesJS !== 'undefined') {
    particlesJS('particles-js', {
      "particles": {
        "number": { "value": 80, "density": { "enable": true, "value_area": 800 } },
        "color": { "value": "#8a2be2" },
        "shape": { "type": "circle" },
        "opacity": { "value": 0.2, "random": false },
        "size": { "value": 3, "random": true },
        "line_linked": { "enable": true, "distance": 150, "color": "#8a2be2", "opacity": 0.1, "width": 1 },
        "move": { "enable": true, "speed": 1, "direction": "none", "random": false, "straight": false, "out_mode": "out", "bounce": false }
      },
      "interactivity": {
        "events": { "onhover": { "enable": true, "mode": "grab" }, "onclick": { "enable": true, "mode": "push" } },
        "modes": { "grab": { "distance": 140, "line_linked": { "opacity": 1 } }, "push": { "particles_nb": 4 } }
      },
      "retina_detect": true
    });
  }
}
