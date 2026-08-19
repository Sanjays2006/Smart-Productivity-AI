/* ────────────────────────────────────────────
   INITIALIZE DIAGNOSTICS BINDINGS
──────────────────────────────────────────── */
function initDiagnostics() {
    // 1. Profile Dropdown wire
    const topAvatar = document.querySelector('.topbar-avatar');
    if (topAvatar) {
        topAvatar.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleProfileDropdown();
        });
    }

    // Notifications Dropdown wire
    const notifBellBtn = document.getElementById('notifBellBtn');
    if (notifBellBtn) {
        notifBellBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleNotificationsDropdown(e);
        });
    }

    const notifCloseBtn = document.getElementById('notifCloseBtn');
    if (notifCloseBtn) {
        notifCloseBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const dropdown = document.getElementById('notificationsDropdown');
            if (dropdown) dropdown.classList.remove('active');
        });
    }

    document.addEventListener('click', (e) => {
        const profileDropdown = document.getElementById('profileDropdown');
        if (profileDropdown && profileDropdown.classList.contains('active') && !profileDropdown.contains(e.target) && !e.target.closest('.topbar-avatar')) {
            profileDropdown.classList.remove('active');
        }
        
        const notifDropdown = document.getElementById('notificationsDropdown');
        if (notifDropdown && notifDropdown.classList.contains('active') && !notifDropdown.contains(e.target) && !e.target.closest('#notifBellBtn')) {
            notifDropdown.classList.remove('active');
        }
    });

    // 2. Database Inspector wires
    const tableSelect = document.getElementById('dbInspectorTableSelect');
    if (tableSelect) {
        tableSelect.addEventListener('change', function() {
            loadTableData(this.value);
        });
    }

    const refreshBtn = document.getElementById('dbInspectorRefreshBtn');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', () => {
            const table = document.getElementById('dbInspectorTableSelect').value;
            loadTableData(table);
        });
    }

    // 3. Database Write Test wire
    const writeBtn = document.getElementById('dbTestWriteBtn');
    if (writeBtn) {
        writeBtn.addEventListener('click', async () => {
            const title = document.getElementById('dbTestNoteTitle').value.trim();
            const content = document.getElementById('dbTestNoteContent').value.trim();
            if (!title || !content) return showToast("Enter test record title and content.", "warning");
            
            writeBtn.disabled = true;
            writeBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> PERSISTING RECORD...';
            try {
                await Api.createNote(title, content);
                showToast("PostgreSQL Write Confirmed! Audit note persisted successfully.", "success");
                
                // Reset fields
                document.getElementById('dbTestNoteTitle').value = 'PostgreSQL Persistence Test';
                
                // Refresh Db metrics and active inspector table
                loadDbMonitor();
            } catch(e) {
                showToast("Persistence check failed: " + e.message, "error");
            } finally {
                writeBtn.disabled = false;
                writeBtn.innerHTML = '<i class="fa-solid fa-database"></i> Execute Save & Refresh';
            }
        });
    }

    // 4. RAG Retrieval wires
    const ragInput = document.getElementById('ragTestQuery');
    if (ragInput) {
        ragInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') testRagSimilaritySearch();
        });
    }
    const ragSearchBtn = document.getElementById('ragTestSearchBtn');
    if (ragSearchBtn) {
        ragSearchBtn.addEventListener('click', testRagSimilaritySearch);
    }
}
