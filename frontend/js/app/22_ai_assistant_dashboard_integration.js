/* ────────────────────────────────────────────
   AI ASSISTANT (Dashboard Integration)
──────────────────────────────────────────── */
async function loadAiStatus() {
    try {
        const status = await Api.getAiStatus();
        const dot = document.getElementById('dashStatusDot');
        const txt = document.getElementById('dashStatusText');
        const pill = document.getElementById('monitorOllamaStatus');

        const isOnline = status.ollamaRunning;
        const color = isOnline ? 'var(--success)' : 'var(--danger)';
        const label = isOnline ? 'AI Ready' : 'AI Offline';

        if (dot) {
            dot.style.background = color;
            dot.style.boxShadow = `0 0 8px ${color}`;
        }
        if (txt) txt.textContent = label;
        if (pill) {
            pill.innerHTML = `<i class="fa-solid fa-robot"></i> ${isOnline ? 'Phi-3 Active' : 'Ollama Off'}`;
            pill.style.borderColor = isOnline ? 'rgba(0,255,157,0.3)' : 'rgba(255,0,60,0.3)';
        }
    } catch(e) { console.error('AI status check failed'); }
}

async function sendAiMessage() {
    const input = document.getElementById('aiInput');
    const btn   = document.getElementById('aiSendBtn');
    const feed  = document.getElementById('aiMessages');
    const text  = input.value.trim();
    if (!text) return;

    // Append User Msg
    const userRow = document.createElement('div');
    userRow.className = 'user-msg';
    userRow.innerHTML = `<div class="msg-bubble">${escHtml(text)}</div>`;
    feed.appendChild(userRow);
    
    input.value = '';
    btn.disabled = true;
    feed.scrollTop = feed.scrollHeight;

    // Append AI Typing
    const aiRow = document.createElement('div');
    aiRow.className = 'ai-msg';
    aiRow.innerHTML = `<div class="msg-avatar"><i class="fa-solid fa-robot"></i></div><div class="msg-bubble typing">Thinking...</div>`;
    feed.appendChild(aiRow);
    feed.scrollTop = feed.scrollHeight;

    try {
        const response = await Api.askAi(text, 'offline');
        aiRow.querySelector('.msg-bubble').innerHTML = renderMarkdown(response.answer);
    } catch(e) {
        aiRow.querySelector('.msg-bubble').textContent = "⚠️ Sorry, I'm having trouble connecting to the neural core.";
    } finally {
        btn.disabled = false;
        feed.scrollTop = feed.scrollHeight;
    }
}

function renderMarkdown(text) {
    // Simple markdown support
    return text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
               .replace(/\*(.*?)\*/g, '<em>$1</em>')
               .replace(/\n/g, '<br>');
}

document.getElementById('aiSendBtn')?.addEventListener('click', sendAiMessage);
document.getElementById('aiInput')?.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendAiMessage(); }
});


