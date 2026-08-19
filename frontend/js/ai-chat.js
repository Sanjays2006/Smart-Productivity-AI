/**
 * ai-chat.js — Floating AI Assistant Widget
 * Online mode: uses RAG context from live browsing
 * Offline mode: uses stored study history chunks
 */

let chatOpen    = false;
let isOnline    = navigator.onLine;
let ollamaReady = false;

// ── Boot ─────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    buildChatWidget();

    // Detect online/offline transitions
    window.addEventListener('online',  () => { isOnline = true;  updateNetworkBadge(); });
    window.addEventListener('offline', () => { isOnline = false; updateNetworkBadge(); });
});

// Expose a method to initialize status checking and history loading once user logs in
window.initAiChat = function() {
    checkStatus();
    loadConversationHistory();
    // Poll Ollama status every 60s
    if (!window._ollamaPollInterval) {
        window._ollamaPollInterval = setInterval(checkStatus, 60000);
    }
};

// ── Build Widget DOM ─────────────────────────────────────────
function buildChatWidget() {
    const widget = document.createElement('div');
    widget.id = 'aiWidget';
    widget.innerHTML = `
        <button class="chat-fab" id="chatFab" aria-label="Open AI Assistant">
            <span class="fab-icon">🤖</span>
            <span class="fab-label">Ask AI</span>
            <span class="fab-badge hidden" id="newMsgBadge">1</span>
        </button>
        <div class="chat-panel glass-card" id="chatPanel">
            <div class="chat-header">
                <div class="chat-title-row">
                    <span class="chat-logo">🧠</span>
                    <div>
                        <p class="chat-title">Study Assistant</p>
                        <p class="chat-sub" id="chatSubtitle">Powered by llama3.2:3b via Ollama</p>
                    </div>
                </div>
                <div class="chat-badges">
                    <span class="status-badge" id="chatNetBadge">🌐 Online</span>
                    <span class="status-badge" id="chatOllamaBadge">⏳ Checking...</span>
                </div>
                <button class="chat-close" id="chatClose" aria-label="Close chat">✕</button>
            </div>
            <div class="chat-mode-row" style="display: flex; background: rgba(var(--glass-rgb), 0.02); border-bottom: 1px solid var(--border-glass); padding: 8px 16px; gap: 8px; align-items: center; justify-content: space-between; flex-shrink: 0;">
                <span style="font-family: var(--font-mono); font-size: 10px; color: var(--text-300); text-transform: uppercase; letter-spacing: 0.5px;">RAG Mode:</span>
                <select id="chatModeSelect" class="styled-input" style="margin:0; padding: 2px 8px; font-size: 10px; min-width: 120px; width: auto; height: 22px; font-family: var(--font-mono); background: rgba(var(--glass-rgb), 0.05); color: var(--text-200); border: 1px solid var(--border-glass); border-radius: 6px; cursor: pointer;">
                    <option value="hybrid">Hybrid</option>
                    <option value="offline">Offline</option>
                    <option value="online">Online</option>
                </select>
            </div>
            <div class="chat-messages" id="chatMessages">
                <div class="chat-message assistant">
                    <div class="msg-bubble">
                        👋 Hi! I'm your AI study assistant powered by <strong>Ollama llama3.2:3b</strong> running locally on your machine.
                        <br><br>I use <strong>RAG</strong> — your browsing history and study material — to give accurate, contextual answers.
                        <br><br>Ask me anything about what you're studying!
                    </div>
                </div>
            </div>
            <div class="chat-input-row">
                <textarea class="chat-input" id="chatInput" rows="2"
                    placeholder="Ask a question about your study material..."></textarea>
                <button class="chat-send" id="chatSend" aria-label="Send question">
                    <span id="chatSendIcon">➤</span>
                </button>
            </div>
            <div class="chat-context-bar" id="chatContextBar">
                <span id="contextText">💡 RAG: using stored study context</span>
            </div>
        </div>
    `;
    document.body.appendChild(widget);

    // Events
    document.getElementById('chatFab').addEventListener('click', toggleChat);
    document.getElementById('chatClose').addEventListener('click', toggleChat);
    document.getElementById('chatSend').addEventListener('click', sendQuestion);
    document.getElementById('chatInput').addEventListener('keydown', e => {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendQuestion(); }
    });
}

// ── Toggle Chat Panel ────────────────────────────────────────
function toggleChat() {
    chatOpen = !chatOpen;
    const panel = document.getElementById('chatPanel');

    if (chatOpen) {
        panel.classList.add('open');
        if (typeof gsap !== 'undefined') {
            gsap.fromTo(panel, { opacity: 0, y: 20, scale: 0.95 },
                { opacity: 1, y: 0, scale: 1, duration: 0.35, ease: 'back.out(1.5)' });
        }
        document.getElementById('chatInput').focus();
    } else {
        if (typeof gsap !== 'undefined') {
            gsap.to(panel, { opacity: 0, y: 20, scale: 0.95, duration: 0.25, ease: 'power2.in',
                onComplete: () => panel.classList.remove('open') });
        } else {
            panel.classList.remove('open');
        }
    }
}

// ── Send Question ────────────────────────────────────────────
async function sendQuestion() {
    const input = document.getElementById('chatInput');
    const question = input.value.trim();
    if (!question) return;

    input.value = '';
    input.disabled = true;

    const sendBtn  = document.getElementById('chatSend');
    const sendIcon = document.getElementById('chatSendIcon');
    sendBtn.disabled = true;
    sendIcon.textContent = '⏳';

    // Add user message
    appendMessage('user', question);
    const thinkingId = appendThinking();

    const modeSelect = document.getElementById('chatModeSelect');
    const mode = modeSelect ? modeSelect.value : 'hybrid';

    try {
        const result = await Api.askAi(question, mode);

        removeThinking(thinkingId);

        if (!result || !result.answer) {
            appendMessage('assistant', '⚠️ Received an empty response from the AI. Please try again.');
        } else {
            appendMessage('assistant', result.answer, result.sources);

            // Update context bar with diagnostics
            const activeMode = (result.retrievalMode || mode).toUpperCase();
            const timeMs = result.retrievalTimeMs || 0;
            const count = result.contextChunksUsed || 0;
            document.getElementById('contextText').textContent =
                `💡 [${activeMode}] Core retrieved ${count} sources in ${timeMs}ms`;
        }
    } catch (e) {
        removeThinking(thinkingId);
        const errMsg = e.message || 'Unknown error';
        if (errMsg.includes('timed out')) {
            appendMessage('assistant', '⏱️ Ollama is taking too long to respond. It may still be loading the model. Try again in a moment.');
        } else if (errMsg.includes('503') || errMsg.includes('ECONNREFUSED') || errMsg.includes('Failed to fetch')) {
            appendMessage('assistant', '⚠️ Cannot reach Ollama. Make sure it\'s running:\n1. Open a terminal\n2. Run: ollama serve\n3. Run: ollama pull llama3.2:3b');
        } else {
            appendMessage('assistant', `⚠️ Error: ${errMsg}`);
        }
        console.error('[AI Chat] sendQuestion error:', e);
    } finally {
        input.disabled = false;
        sendBtn.disabled = false;
        sendIcon.textContent = '➤';
        input.focus();
    }
}

// ── Message Rendering ────────────────────────────────────────
function appendMessage(role, text, sources) {
    const messages = document.getElementById('chatMessages');
    const div = document.createElement('div');
    div.className = `chat-message ${role}`;

    // Render markdown-like formatting: newlines → <br>, **bold**, `code`
    const formatted = renderMarkdown(text || '');

    let sourcesHtml = '';
    if (sources && sources.length > 0) {
        const links = sources.map((s, idx) => {
            if (typeof s === 'object' && s !== null) {
                const title = s.title || 'Source';
                const url = s.url || '';
                const type = (s.type || 'local').toUpperCase();
                const badgeColor = type === 'ONLINE' ? 'var(--secondary)' : 'var(--primary-lt)';
                
                if (url) {
                    return `<a href="${url}" target="_blank" class="source-link" style="text-decoration:none; margin: 2px 0; display:block;" title="${escHtml(s.snippet || '')}">
                        <span style="background: rgba(255,255,255,0.03); border: 1px solid var(--border-glass); padding: 3px 8px; border-radius: 4px; font-size: 10px; color: var(--text-200); display: flex; align-items: center; gap: 6px;">
                            <span style="color: ${badgeColor}; font-weight:700; font-size:9px; font-family:var(--font-mono)">[${type}]</span>
                            <span style="white-space: normal; word-break: break-word;">${escHtml(title)}</span>
                        </span>
                    </a>`;
                } else {
                    return `<span style="background: rgba(255,255,255,0.03); border: 1px solid var(--border-glass); padding: 3px 8px; border-radius: 4px; font-size: 10px; color: var(--text-200); margin: 2px 0; display:flex; align-items: center; gap: 6px;" title="${escHtml(s.snippet || '')}">
                        <span style="color: ${badgeColor}; font-weight:700; font-size:9px; font-family:var(--font-mono)">[${type}]</span>
                        <span style="white-space: normal; word-break: break-word;">${escHtml(title)}</span>
                    </span>`;
                }
            } else {
                // String fallback
                const str = String(s);
                let title = str;
                let url = '';
                const urlMatch = str.match(/(.*)\s+\[(.*)\]/);
                if (urlMatch) {
                    title = urlMatch[1];
                    url = urlMatch[2];
                }
                
                if (url) {
                    return `<a href="${url}" target="_blank" class="source-link" style="text-decoration:none; margin: 2px 0; display:block;">
                        <span style="background: rgba(255,255,255,0.03); border: 1px solid var(--border-glass); padding: 3px 8px; border-radius: 4px; font-size: 10px; color: var(--text-200); display: flex; align-items: center; gap: 6px;">
                            <span style="color: var(--primary-lt); font-weight:700; font-size:9px; font-family:var(--font-mono)">[SOURCE]</span>
                            <span style="white-space: normal; word-break: break-word;">${escHtml(title)}</span>
                        </span>
                    </a>`;
                } else {
                    return `<span style="background: rgba(255,255,255,0.03); border: 1px solid var(--border-glass); padding: 3px 8px; border-radius: 4px; font-size: 10px; color: var(--text-200); margin: 2px 0; display:flex; align-items: center; gap: 6px;">
                        <span style="color: var(--primary-lt); font-weight:700; font-size:9px; font-family:var(--font-mono)">[SOURCE]</span>
                        <span style="white-space: normal; word-break: break-word;">${escHtml(title)}</span>
                    </span>`;
                }
            }
        }).join('');

        sourcesHtml = `<div class="msg-sources" style="margin-top:12px; border-top:1px solid rgba(255,255,255,0.08); padding-top:8px;">
            <p style="margin: 0 0 6px 0; font-size: 9px; font-family: var(--font-mono); color: var(--text-400); text-transform: uppercase; letter-spacing: 0.5px;"><i class="fa-solid fa-book-open"></i> Citations:</p>
            <div style="display:flex; flex-direction:column; gap:4px;">${links}</div>
        </div>`;
    }

    div.innerHTML = `<div class="msg-bubble">${formatted}${sourcesHtml}</div>`;
    messages.appendChild(div);

    if (typeof gsap !== 'undefined') {
        gsap.fromTo(div, { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: 0.3, ease: 'power2.out' });
    }
    messages.scrollTop = messages.scrollHeight;
}

/** Lightweight markdown renderer: bold, inline code, line breaks */
function renderMarkdown(text) {
    return escHtml(text)
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/`([^`]+)`/g, '<code style="background:rgba(99,102,241,0.15);padding:1px 5px;border-radius:4px;font-family:monospace;font-size:0.9em">$1</code>')
        .replace(/\n/g, '<br>');
}

function appendThinking() {
    const messages = document.getElementById('chatMessages');
    const id = 'thinking-' + Date.now();
    const div = document.createElement('div');
    div.className = 'chat-message assistant thinking';
    div.id = id;
    div.innerHTML = `<div class="msg-bubble"><span class="typing-dots"><span></span><span></span><span></span></span> Thinking with RAG...</div>`;
    messages.appendChild(div);
    messages.scrollTop = messages.scrollHeight;
    return id;
}

function removeThinking(id) {
    const el = document.getElementById(id);
    if (el) el.remove();
}

// ── Load Conversation History ────────────────────────────────
async function loadConversationHistory() {
    try {
        const conversations = await Api.getConversations();
        // Only show last 3 previous conversations as context
        if (conversations && conversations.length > 0) {
            const recent = conversations.slice(0, 3).reverse();
            recent.forEach(c => {
                appendMessage('user', c.question);
                appendMessage('assistant', c.answer, c.sources ? c.sources.split('|').filter(Boolean) : []);
            });
        }
    } catch (e) {
        // Silently ignore — conversation history is non-critical
        console.warn('[AI Chat] Could not load conversation history:', e.message);
    }
}

// ── Status Check ─────────────────────────────────────────────
async function checkStatus() {
    try {
        const status = await Api.getAiStatus();
        ollamaReady = status.ollamaRunning;

        const badge = document.getElementById('chatOllamaBadge');
        if (badge) {
            badge.textContent = ollamaReady ? '🟢 Ollama Ready' : '🔴 Start Ollama';
            badge.className   = `status-badge ${ollamaReady ? 'online' : 'offline'}`;
        }

        const sub = document.getElementById('chatSubtitle');
        if (sub) {
            sub.textContent = ollamaReady
                ? 'Powered by llama3.2:3b via Ollama ✓'
                : 'Ollama offline — run: ollama serve';
            sub.style.color = ollamaReady ? 'var(--success, #10b981)' : 'var(--error, #f87171)';
        }

        // Update topbar and AI view labels
        const labels = ['ollamaLabel', 'aiViewLabel'];
        labels.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.textContent = ollamaReady ? 'AI Ready' : 'AI Offline';
        });
        const dots = ['ollamaDot', 'aiViewDot'];
        dots.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.style.background = ollamaReady ? 'var(--success)' : 'var(--error)';
        });

    } catch (e) {
        const badge = document.getElementById('chatOllamaBadge');
        if (badge) {
            badge.textContent = '🔴 Offline';
            badge.className   = 'status-badge offline';
        }
        const labels = ['ollamaLabel', 'aiViewLabel'];
        labels.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.textContent = 'AI Offline';
        });
        const dots = ['ollamaDot', 'aiViewDot'];
        dots.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.style.background = 'var(--error)';
        });
    }
    updateNetworkBadge();
}

function updateNetworkBadge() {
    isOnline = navigator.onLine;
    const badge = document.getElementById('chatNetBadge');
    if (badge) {
        badge.textContent = isOnline ? '🌐 Online' : '🔌 Offline';
        badge.className   = `status-badge ${isOnline ? 'online' : 'offline'}`;
    }
    const ctx = document.getElementById('contextText');
    if (ctx) {
        ctx.textContent = isOnline
            ? '💡 RAG: live context from your current browsing (extension required)'
            : '🔌 Offline: using stored study history as RAG context';
    }
}

function escHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g,'&amp;')
        .replace(/</g,'&lt;')
        .replace(/>/g,'&gt;')
        .replace(/"/g,'&quot;');
}
