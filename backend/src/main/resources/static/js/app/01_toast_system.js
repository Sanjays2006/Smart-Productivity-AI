/* ────────────────────────────────────────────
   TOAST SYSTEM
──────────────────────────────────────────── */
function showToast(msg, type = 'info', duration = 3500) {
    const toast = document.getElementById('toast');
    toast.textContent = msg;
    toast.className = `toast ${type} show`;
    clearTimeout(toast._timer);
    toast._timer = setTimeout(() => toast.classList.remove('show'), duration);
}
