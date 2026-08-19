/* ────────────────────────────────────────────
   USER PROFILE DROPDOWN PANEL ORCHESTRATION
──────────────────────────────────────────── */
window.toggleProfileDropdown = async function() {
    const dropdown = document.getElementById('profileDropdown');
    if (!dropdown) return;
    
    if (dropdown.classList.contains('active')) {
        dropdown.classList.remove('active');
        return;
    }

    try {
        const user = await Api.getMe();
        if (user && user.authenticated) {
            document.getElementById('profileDropdownName').textContent = user.displayName || user.username;
            document.getElementById('profileDropdownEmail').textContent = user.email;
            document.getElementById('profileDropdownRole').textContent = (user.role || 'USER').toUpperCase();
            document.getElementById('profileDropdownCreated').textContent = user.createdAt || '-';
            
            const dbStatus = await Api.getDatabaseStatus();
            const dbPill = document.getElementById('profileDropdownDbStatus');
            if (dbPill) {
                if (dbStatus.database === 'postgresql' && dbStatus.configured) {
                    dbPill.textContent = 'PostgreSQL Core';
                    dbPill.style.color = 'var(--success)';
                } else {
                    dbPill.textContent = 'H2 Fallback Core';
                    dbPill.style.color = 'var(--warning)';
                }
            }
        }
    } catch (e) {
        console.error("Error populating profile dropdown:", e);
    }

    dropdown.classList.add('active');
};
