/* ────────────────────────────────────────────
   AUTH CHECK
──────────────────────────────────────────── */
async function checkAuth() {
    try {
        let user = await Api.getMe();
        if (user && user.authenticated) {
            window.currentUser = user;
            const brandEl = document.querySelector('.brand-name');
            if (brandEl) brandEl.innerHTML = `Focus<em>AI</em> <small style="font-size:10px; opacity:0.5; display:block">Hi, ${user.displayName}</small>`;
            return true;
        }
    } catch (e) {
        console.warn('Auth check failed:', e);
    }

    // Redirect to login page
    window.location.href = '/login.html';
    return false;
}
