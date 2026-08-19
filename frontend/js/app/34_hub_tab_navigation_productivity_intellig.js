/* ────────────────────────────────────────────
   HUB TAB NAVIGATION (Productivity Intelligence Hub)
──────────────────────────────────────────── */
window.switchHubTab = function(tabId) {
    const hubTabBtns = document.querySelectorAll('.hub-tab-btn');
    const hubTabContents = document.querySelectorAll('.hub-tab-content');

    hubTabBtns.forEach(btn => btn.classList.remove('active'));
    hubTabContents.forEach(c => c.classList.remove('active'));

    // Activate the correct button
    hubTabBtns.forEach(btn => {
        if (btn.getAttribute('onclick') && btn.getAttribute('onclick').includes(tabId)) {
            btn.classList.add('active');
        }
    });

    const activeContent = document.getElementById(tabId);
    if (activeContent) activeContent.classList.add('active');

    // Track tab switch
    Api.trackActivity('DASHBOARD', 'HUB_TAB_SWITCH', `Switched to hub tab: ${tabId}`, tabId, '').catch(() => {});

    // Load tab-specific data
    if (tabId === 'hub-overview') {
        // Dashboard data already loaded by loadDashboard(), also trigger intel overview
        loadIntelOverview();
    } else if (tabId === 'hub-activity-intel') {
        loadIntelOverview();
    } else if (tabId === 'hub-history') {
        window.loadHistory && window.loadHistory();
    } else if (tabId === 'hub-database') {
        window.loadDbMonitor && window.loadDbMonitor();
    }
};
