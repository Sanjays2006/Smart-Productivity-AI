const BACKEND = 'http://localhost:8080';

function formatTime(seconds) {
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const h = Math.floor(m / 60);
  if (h > 0) return `${h}h ${m % 60}m`;
  return `${m}m`;
}

async function loadPopup() {
  const data = await chrome.storage.local.get('focus_ai_token');
  const token = data.focus_ai_token;

  if (!token) {
    document.getElementById('authView').style.display = 'block';
    document.getElementById('trackingView').style.display = 'none';
    return;
  }

  document.getElementById('authView').style.display = 'none';
  document.getElementById('trackingView').style.display = 'block';

  const dot  = document.getElementById('statusDot');
  const text = document.getElementById('statusText');
  const list = document.getElementById('sitesList');

  try {
    const res = await fetch(`${BACKEND}/api/tracking/today`, {
      headers: { 'Authorization': `Bearer ${token}` },
      signal: AbortSignal.timeout(3000)
    });

    if (res.status === 401) {
      chrome.storage.local.remove('focus_ai_token');
      return loadPopup();
    }

    const sites = await res.json();
    dot.className  = 'dot online';
    text.textContent = `Connected — tracking active`;

    if (!sites || sites.length === 0) {
      list.innerHTML = '<div class="empty">No sites tracked yet today.</div>';
      return;
    }

    list.innerHTML = sites.slice(0, 8).map(s => `
      <div class="site-row">
        <span class="site-name" title="${s.domain}">${s.domain || s.url}</span>
        <span class="site-time">${formatTime(s.timeSpentSeconds)}</span>
      </div>
    `).join('');

  } catch (e) {
    dot.className  = 'dot offline';
    text.textContent = 'Backend not running or offline';
    list.innerHTML = '<div class="empty">Start the Focus Tracker app to track.</div>';
  }
}

document.getElementById('loginBtn').onclick = async () => {
  const u = document.getElementById('username').value.trim();
  const p = document.getElementById('password').value;
  const errDiv = document.getElementById('popupErr');
  if (errDiv) errDiv.style.display = 'none';

  if (!u || !p) {
    if (errDiv) { errDiv.textContent = 'Please fill in username/email & password.'; errDiv.style.display = 'block'; }
    return;
  }

  try {
    const res = await fetch(`${BACKEND}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: u, password: p })
    });
    const data = await res.json();
    if (data.token) {
      await chrome.storage.local.set({ 'focus_ai_token': data.token });
      loadPopup();
    } else {
      if (errDiv) { errDiv.textContent = data.error || 'Login failed'; errDiv.style.display = 'block'; }
    }
  } catch (e) {
    if (errDiv) {
      errDiv.textContent = 'Cannot connect to Focus Tracker backend at http://localhost:8080.';
      errDiv.style.display = 'block';
    }
  }
};

document.getElementById('logoutBtn').onclick = async () => {
  await chrome.storage.local.remove('focus_ai_token');
  loadPopup();
};

loadPopup();
