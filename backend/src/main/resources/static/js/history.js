/**
 * history.js — History Page Logic
 * Renders: 30-day line chart, activity heatmap, full sessions table
 */

let historyLineChart = null;

/* ────────────────────────────────────────────
   MAIN ENTRY — called by app.js view switcher
──────────────────────────────────────────── */
window.loadHistory = async function loadHistory() {
    try {
        const [dailyHistory, allSessions, dash] = await Promise.all([
            Api.getHistory(),
            Api.getAllSessions(),
            Api.getDashboard()
        ]);

        renderHistoryLineChart(dailyHistory);
        renderHeatmap(dailyHistory);
        renderHistoryTable(allSessions);
        if (typeof renderPieChart === 'function') renderPieChart(allSessions);

        // Update Focus Score and Consistency Tracker
        updateHistoryMetrics(dash);

        // Animate in
        gsap.fromTo('#view-history .glass-card',
            { opacity: 0, y: 20 },
            { opacity: 1, y: 0, duration: 0.45, stagger: 0.1, ease: 'power2.out' }
        );
    } catch(e) {
        console.error('History load failed:', e);
        showToast('Could not load history data.', 'error');
    }
};

function updateHistoryMetrics(dash) {
    const gam = dash.gamification || {};
    const stats = dash.consistencyStats || { currentStreak: 0, goalCompletionRate: 0, totalDeepWorkMinutes: 0 };

    // 1. Focus Score
    const focusScore = gam.focusScore || 0;
    const focusScoreText = document.getElementById('historyFocusScoreText');
    const focusScoreCircle = document.getElementById('historyFocusScoreCircle');
    const focusScoreRating = document.getElementById('historyFocusScoreRating');

    if (focusScoreText) focusScoreText.textContent = focusScore;
    if (focusScoreCircle) {
        focusScoreCircle.style.background = `conic-gradient(var(--success) 0% ${focusScore}%, rgba(255,255,255,0.05) ${focusScore}% 100%)`;
    }
    if (focusScoreRating) {
        if (focusScore >= 80) focusScoreRating.textContent = 'Excellent';
        else if (focusScore >= 60) focusScoreRating.textContent = 'Good';
        else if (focusScore >= 40) focusScoreRating.textContent = 'Average';
        else focusScoreRating.textContent = 'Needs Work';
    }

    // 2. Consistency Tracker
    const currentStreak = stats.currentStreak || 0;
    const streakText = document.getElementById('historyCurrentStreakText');
    const streakProgress = document.getElementById('historyCurrentStreakProgress');
    if (streakText) streakText.textContent = `${currentStreak} Days`;
    if (streakProgress) {
        const streakPct = Math.min(100, Math.round((currentStreak / 7.0) * 100));
        streakProgress.style.width = `${streakPct}%`;
    }

    const completionRate = stats.goalCompletionRate || 0;
    const completionText = document.getElementById('historyGoalCompletionText');
    const completionProgress = document.getElementById('historyGoalCompletionProgress');
    if (completionText) completionText.textContent = `${completionRate}%`;
    if (completionProgress) {
        completionProgress.style.width = `${completionRate}%`;
    }

    const deepWorkMins = stats.totalDeepWorkMinutes || 0;
    const hours = Math.floor(deepWorkMins / 60);
    const mins = deepWorkMins % 60;
    const deepWorkText = document.getElementById('historyDeepWorkHoursText');
    const deepWorkProgress = document.getElementById('historyDeepWorkHoursProgress');
    if (deepWorkText) deepWorkText.textContent = `${hours}h ${mins}m`;
    if (deepWorkProgress) {
        const progressPct = Math.min(100, Math.round((deepWorkMins / 1440.0) * 100)); // 24 hours baseline
        deepWorkProgress.style.width = `${progressPct}%`;
    }
}

/* ────────────────────────────────────────────
   PIE CHART
──────────────────────────────────────────── */
let distPieChart = null;
function renderPieChart(sessions) {
    if (distPieChart) { distPieChart.destroy(); }
    const ctx = document.getElementById('distributionPieChart');
    if (!ctx) return;

    const counts = {};
    (sessions || []).forEach(s => {
        const name = s.activity ? s.activity.name : 'Unknown';
        counts[name] = (counts[name] || 0) + s.durationSeconds;
    });

    const labels = Object.keys(counts);
    const data = Object.values(counts).map(sec => Math.round(sec / 60));

    distPieChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels,
            datasets: [{
                data,
                backgroundColor: ['#8a2be2', '#00ffff', '#00ff9d', '#ffb800', '#ff003c'],
                borderWidth: 0,
                hoverOffset: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'right', labels: { color: '#e2e8f0', boxWidth: 12, padding: 15, font: { size: 11 } } }
            },
            cutout: '70%'
        }
    });
}

/* ────────────────────────────────────────────
   30-DAY LINE CHART
──────────────────────────────────────────── */
function renderHistoryLineChart(dailyHistory) {
    if (historyLineChart) { historyLineChart.destroy(); historyLineChart = null; }

    const ctx = document.getElementById('historyLineChart');
    if (!ctx) return;

    // Build last 30 days
    const days = [];
    const minuteMap = {};
    const xpMap = {};

    for (let i = 29; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const key = d.toISOString().split('T')[0];
        days.push({ key, label: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) });
        minuteMap[key] = 0;
        xpMap[key] = 0;
    }

    dailyHistory.forEach(t => {
        if (t.recordDate in minuteMap) {
            minuteMap[t.recordDate] = Math.round(t.totalSeconds / 60);
            xpMap[t.recordDate]     = t.totalXpEarned;
        }
    });

    const labels  = days.map(d => d.label);
    const minutes = days.map(d => minuteMap[d.key]);
    const xps     = days.map(d => xpMap[d.key]);

    historyLineChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels,
            datasets: [
                {
                    label: 'Focus (min)',
                    data: minutes,
                    borderColor: 'rgba(99,102,241,0.9)',
                    backgroundColor: 'rgba(99,102,241,0.08)',
                    borderWidth: 2.5,
                    fill: true,
                    tension: 0.4,
                    pointRadius: 3,
                    pointHoverRadius: 6,
                    pointBackgroundColor: '#6366f1',
                    pointBorderColor: '#0e1018',
                    pointBorderWidth: 2
                },
                {
                    label: 'XP Earned',
                    data: xps,
                    borderColor: 'rgba(6,182,212,0.8)',
                    backgroundColor: 'rgba(6,182,212,0.05)',
                    borderWidth: 2,
                    fill: true,
                    tension: 0.4,
                    pointRadius: 3,
                    pointHoverRadius: 6,
                    pointBackgroundColor: '#06b6d4',
                    pointBorderColor: '#0e1018',
                    pointBorderWidth: 2,
                    yAxisID: 'y2'
                }
            ]
        },
        options: {
            responsive: true,
            interaction: { mode: 'index', intersect: false },
            animation: { duration: 900 },
            plugins: {
                legend: {
                    labels: { color: '#cbd5e1', font: { size: 12 }, boxWidth: 12, padding: 20 }
                },
                tooltip: {
                    backgroundColor: 'rgba(14,16,24,0.95)',
                    borderColor: 'rgba(99,102,241,0.3)',
                    borderWidth: 1,
                    titleColor: '#f1f5f9',
                    bodyColor: '#cbd5e1',
                    padding: 12
                }
            },
            scales: {
                x: {
                    ticks: {
                        color: '#64748b', font: { size: 10 },
                        maxTicksLimit: 10, maxRotation: 0
                    },
                    grid: { color: 'rgba(255,255,255,0.04)' }
                },
                y: {
                    position: 'left',
                    ticks: { color: '#6366f1', font: { size: 11 }, callback: v => `${v}m` },
                    grid: { color: 'rgba(255,255,255,0.04)' },
                    beginAtZero: true
                },
                y2: {
                    position: 'right',
                    ticks: { color: '#06b6d4', font: { size: 11 }, callback: v => `${v} XP` },
                    grid: { drawOnChartArea: false },
                    beginAtZero: true
                }
            }
        }
    });
}

/* ────────────────────────────────────────────
   HEATMAP GRID (Last 90 days)
──────────────────────────────────────────── */
function renderHeatmap(dailyHistory) {
    // Target the history tab's heatmap grid (heatmapGridHistory) if available, else fallback to heatmapGrid
    const grid = document.getElementById('heatmapGridHistory') || document.getElementById('heatmapGrid');
    if (!grid) return;

    const minuteMap = {};
    let maxMin = 0;

    dailyHistory.forEach(t => {
        const mins = Math.round(t.totalSeconds / 60);
        minuteMap[t.recordDate] = mins;
        if (mins > maxMin) maxMin = mins;
    });

    const cells = [];
    for (let i = 89; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const key = d.toISOString().split('T')[0];
        const mins = minuteMap[key] || 0;
        cells.push({ key, mins, date: d });
    }

    const intensityColor = (mins) => {
        if (mins === 0) return 'rgba(99,102,241,0.06)';
        const ratio = Math.min(mins / Math.max(maxMin, 1), 1);
        if (ratio < 0.25)      return 'rgba(99,102,241,0.20)';
        else if (ratio < 0.5)  return 'rgba(99,102,241,0.45)';
        else if (ratio < 0.75) return 'rgba(99,102,241,0.70)';
        else                   return 'rgba(99,102,241,1.00)';
    };

    grid.innerHTML = cells.map(c => {
        const label = `${c.date.toLocaleDateString('en-US', { month:'short', day:'numeric' })}: ${c.mins}m`;
        return `<div class="heatmap-cell"
                     title="${label}"
                     style="background:${intensityColor(c.mins)};"
                     aria-label="${label}"></div>`;
    }).join('');
}

/* ────────────────────────────────────────────
   FULL SESSIONS TABLE
──────────────────────────────────────────── */
function renderHistoryTable(sessions) {
    const tbody = document.getElementById('historyTableBody');
    if (!tbody) return;

    if (!sessions || sessions.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="empty-row">No sessions recorded yet.</td></tr>';
        return;
    }

    tbody.innerHTML = sessions.map(s => {
        const dt      = new Date(s.startTime).toLocaleString('en-US', {
            month: 'short', day: 'numeric', year: 'numeric',
            hour: '2-digit', minute: '2-digit'
        });
        const dur     = formatDuration(s.durationSeconds);
        const name    = s.activity ? s.activity.name : 'Unknown';
        const pomo    = s.isPomodoro
            ? `<span class="badge badge-pomo">🍅 Yes</span>`
            : `<span class="badge badge-no">—</span>`;
        const notes   = s.notes
            ? `<span style="color:var(--text-400);font-size:12px;white-space:normal;word-break:break-word;">${escHtml(s.notes)}</span>`
            : '—';

        return `<tr>
            <td style="font-family:var(--font-mono);font-size:13px">${dt}</td>
            <td><span class="badge badge-activity">${escHtml(name)}</span></td>
            <td style="font-family:var(--font-mono)">${dur}</td>
            <td><span class="badge badge-xp">+${s.earnedXp}</span></td>
            <td>${pomo}</td>
            <td>${notes}</td>
        </tr>`;
    }).join('');
}

/* ────────────────────────────────────────────
   HELPERS (shared with app.js via globals)
──────────────────────────────────────────── */
function formatDuration(sec) {
    if (!sec) return '0s';
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    if (h > 0) return `${h}h ${m}m`;
    if (m > 0) return `${m}m ${s}s`;
    return `${s}s`;
}

function escHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g,'&amp;')
        .replace(/</g,'&lt;')
        .replace(/>/g,'&gt;')
        .replace(/"/g,'&quot;');
}
