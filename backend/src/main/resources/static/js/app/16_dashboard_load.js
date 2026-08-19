/* ────────────────────────────────────────────
   DASHBOARD LOAD
──────────────────────────────────────────── */
async function loadDashboard() {
    try {
        const [dash, sessions, xpHistory, monthlyHistory] = await Promise.all([
            Api.getDashboard(),
            Api.getRecentSessions(),
            Api.getXpHistory(),
            Api.getHistory()
        ]);

        const gam  = dash.gamification;
        const today = dash.today;
        const xpNeeded = dash.xpNeeded || 100;
        window.sessionsData = sessions;

        // Update sidebar gamification and weekly streak dots
        updateGamSidebar(gam, xpNeeded, dash.levelTitle, xpHistory, dash.recentTotals);

        // KPI cards
        const h = Math.floor(today.totalSeconds / 3600);
        const m = Math.floor((today.totalSeconds % 3600) / 60);
        document.getElementById('kpiTime').textContent     = `${h}h ${m}m`;
        document.getElementById('kpiSessions').textContent = today.sessionsCompleted;
        document.getElementById('kpiXp').textContent       = today.totalXpEarned;
        document.getElementById('kpiStreak').textContent   = gam.currentStreak;

        const productivityScoreEl = document.getElementById('kpiProductivityScore');
        if (productivityScoreEl) {
            productivityScoreEl.textContent = `${gam.focusScore || 0}%`;
        }

        // Goal strip
        const GOAL_SECS = dash.dailyFocusGoal || 7200;
        const goalPct = Math.min(Math.round((today.totalSeconds / GOAL_SECS) * 100), 100);
        const goalBar = document.getElementById('goalBar');
        const goalPctEl = document.getElementById('goalPct');
        const goalFocus = document.getElementById('goalFocusDone');
        const goalTargetEl = document.getElementById('goalFocusTarget');
        const goalStatusDot = document.getElementById('goalStatusDot');
        const goalStatusText = document.getElementById('goalStatusText');

        if (goalBar) goalBar.style.width = goalPct + '%';
        if (goalPctEl) goalPctEl.textContent = goalPct + '%';
        if (goalFocus) goalFocus.textContent = `${h}h ${m}m`;
        if (goalTargetEl) {
            const targetH = Math.floor(GOAL_SECS / 3600);
            const targetM = Math.floor((GOAL_SECS % 3600) / 60);
            goalTargetEl.textContent = targetM > 0 ? `${targetH}h ${targetM}m` : `${targetH}h`;
        }
        if (goalStatusDot && goalStatusText) {
            if (goalPct >= 100) {
                goalStatusDot.style.background = 'var(--success)';
                goalStatusDot.style.boxShadow = '0 0 6px var(--success)';
                goalStatusText.textContent = 'Completed ✓';
            } else {
                goalStatusDot.style.background = 'var(--info)';
                goalStatusDot.style.boxShadow = '0 0 6px var(--info-glow)';
                goalStatusText.textContent = 'In Progress';
            }
        }

        // Status dot
        const dot = document.getElementById('dashStatusDot');
        const txt = document.getElementById('dashStatusText');
        if (dot) dot.style.cssText = 'display:inline-block;width:8px;height:8px;border-radius:50%;background:var(--success);box-shadow:0 0 6px var(--success);margin-right:4px';
        if (txt) txt.textContent = 'Backend connected';

        // Total stats
        const totalSess = document.getElementById('dashTotalSessions');
        const totalXp   = document.getElementById('dashTotalXp');
        const streak2   = document.getElementById('dashStreak2');
        if (totalSess) totalSess.textContent = gam.totalSessions || sessions.length || 0;
        if (totalXp)   totalXp.textContent   = gam.totalXp || gam.currentXp;
        if (streak2)   streak2.textContent   = (gam.currentStreak || 0) + ' 🔥';

        // Load System Summary statistics
        Promise.all([
            Api.getConversations().catch(() => []),
            Api.getNotes().catch(() => []),
            Api.getRagStatus().catch(() => ({ userChunks: 0, userDocuments: 0, ollamaRunning: false })),
            Api.getActivityAnalytics().catch(() => ({ totalAiRequests: 0, todayCount: 0 })),
            Api.getDbMetrics().catch(() => ({ tables: [], databaseType: 'h2' }))
        ]).then(([convs, notes, ragStatus, activityAnalytics, dbMetrics]) => {
            const convsEl = document.getElementById('sysTotalConvs');
            const notesEl = document.getElementById('sysTotalNotes');
            const docsEl = document.getElementById('sysTotalDocs');
            const sessionsEl = document.getElementById('sysTotalSessions');
            const aiRequestsEl = document.getElementById('sysAiRequests');
            const dbStatsEl = document.getElementById('sysDbStats');
            const activityMetricsEl = document.getElementById('sysActivityMetrics');

            if (convsEl) convsEl.textContent = convs.length || 0;
            if (notesEl) notesEl.textContent = notes.length || 0;
            if (docsEl) docsEl.textContent = ragStatus.userDocuments || 0;
            if (sessionsEl) sessionsEl.textContent = sessions.length || 0;
            if (aiRequestsEl) aiRequestsEl.textContent = activityAnalytics.totalAiRequests || 0;
            if (dbStatsEl) dbStatsEl.textContent = (dbMetrics.tables || []).length || 0;
            if (activityMetricsEl) activityMetricsEl.textContent = activityAnalytics.todayCount || 0;
        }).catch(e => console.warn('System summary load error:', e));

        // Populate Daily Focus Quests & Rewards Shop panels
        loadChallenges();
        loadShop();

    } catch (e) {
        console.error('Dashboard load error:', e);
    }
}
