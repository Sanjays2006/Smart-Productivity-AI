/* ────────────────────────────────────────────
   GREETING
──────────────────────────────────────────── */
function setGreeting() {
    const h = new Date().getHours();
    const greet = h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
    const el = document.getElementById('dashGreeting');
    if (el) el.textContent = `${greet} — let's make it count. 🚀`;

    const badge = document.getElementById('topbarDate');
    if (badge) badge.textContent = new Date().toLocaleDateString('en-US', { weekday:'long', month:'long', day:'numeric' });
}
