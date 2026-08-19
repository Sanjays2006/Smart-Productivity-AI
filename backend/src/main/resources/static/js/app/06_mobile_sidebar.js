/* ────────────────────────────────────────────
   MOBILE SIDEBAR
──────────────────────────────────────────── */
function initMobileNav() {
    const toggle = document.getElementById('sidebarToggle');
    const sidebar = document.getElementById('sidebar');
    if (toggle && sidebar) {
        toggle.addEventListener('click', () => {
            sidebar.classList.toggle('mobile-open');
        });
    }
}


