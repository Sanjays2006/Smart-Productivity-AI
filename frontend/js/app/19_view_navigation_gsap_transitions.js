/* ────────────────────────────────────────────
   VIEW NAVIGATION (GSAP Transitions)
──────────────────────────────────────────── */
function switchView(viewId) {
    const lockOverlay = document.getElementById('appLockOverlay');
    if (lockOverlay && lockOverlay.style.display !== 'none') {
        return;
    }

    // Intercept redirects to old/merged views — all resolve into view-dashboard hub tabs
    let targetHubTab = null;
    if (viewId === 'view-history') {
        viewId = 'view-dashboard';
        targetHubTab = 'hub-history';
    } else if (viewId === 'view-db-monitor') {
        viewId = 'view-dashboard';
        targetHubTab = 'hub-database';
    } else if (viewId === 'view-activity-intelligence') {
        viewId = 'view-dashboard';
        targetHubTab = 'hub-activity-intel';
    }

    const views   = document.querySelectorAll('.view');
    const navItems = document.querySelectorAll('.nav-item');

    views.forEach(v => { v.classList.remove('active'); v.style.opacity = 0; });
    navItems.forEach(n => n.classList.remove('active'));

    const target  = document.getElementById(viewId);
    const navItem = document.querySelector(`[data-view="${viewId}"]`);

    if (target) {
        target.classList.add('active');
        // Smooth entrance for the view
        gsap.fromTo(target, 
            { opacity: 0, y: 20, scale: 0.98 }, 
            { opacity: 1, y: 0, scale: 1, duration: 0.5, ease: 'power4.out' }
        );
        
        // Update Topbar Title
        const topTitle = document.getElementById('topbarTitle');
        if (topTitle) {
            const titleMap = {
                'view-dashboard': 'Productivity Intelligence Hub',
                'view-timer': 'Deep Work Session',
                'view-ai': 'AI Assistant Core',
                'view-notes': 'Neural Notes',
                'view-monitor': 'Study Flow Monitor',
                'view-rag-validation': 'Hybrid RAG Monitor',
                'view-learning-hub': 'Cognitive Knowledge Hub'
            };
            topTitle.textContent = titleMap[viewId] || 'Workspace';
        }
    }
    if (navItem) navItem.classList.add('active');

    // Track view switch in activity log
    if (viewId) {
        Api.trackActivity('DASHBOARD', 'VIEW_SWITCH', `Navigated to view: ${viewId}`, viewId, '').catch(() => {});
    }

    // Load view-specific data
    if (viewId === 'view-dashboard') {
        loadDashboard();
        // If switching to a specific hub tab, activate it after dashboard loads
        if (targetHubTab) {
            setTimeout(() => switchHubTab(targetHubTab), 100);
        } else {
            // Default: activate hub-overview
            setTimeout(() => switchHubTab('hub-overview'), 100);
        }
    }
    if (viewId === 'view-timer')     loadActivities();
    if (viewId === 'view-notes')     loadNotes();
    if (viewId === 'view-monitor')   window.loadMonitor  && window.loadMonitor();
    if (viewId === 'view-rag-validation') loadRagValidation();
    if (viewId === 'view-learning-hub') loadLearningHub();

    // Trigger scroll reveal on new view
    setTimeout(() => { if (typeof applyScrollReveal === 'function') applyScrollReveal(); }, 300);
}

document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', e => {
        e.preventDefault();
        switchView(item.dataset.view);
        document.getElementById('sidebar')?.classList.remove('mobile-open');
    });
});

document.getElementById('viewAllBtn')?.addEventListener('click', () => switchView('view-history'));
