/**
 * monitor.js — Study Monitor page logic
 * Renders: today's site bar chart, category doughnut, full visit table
 */

let monitorBarChart  = null;
let monitorDonutChart = null;

window.loadMonitor = async function () {
    try {
        const sites = await Api.getTodaySites();
        renderMonitorBar(sites);
        renderCategoryDonut(sites);
        renderSiteTable(sites);
        updateMonitorStatus();

        gsap.fromTo('#view-monitor .glass-card',
            { opacity: 0, y: 20 },
            { opacity: 1, y: 0, duration: 0.45, stagger: 0.1, ease: 'power2.out' }
        );
    } catch (e) {
        console.error('Monitor load failed:', e);
    }
};

async function updateMonitorStatus() {
    try {
        const status = await Api.getAiStatus();
        const badge  = document.getElementById('monitorOllamaStatus');
        if (badge) {
            badge.textContent = status.ollamaRunning ? '🟢 Ollama Ready' : '🔴 Ollama Offline';
            badge.className   = `status-badge ${status.ollamaRunning ? 'online' : 'offline'}`;
        }
    } catch (e) {}

    const isOnline = navigator.onLine;
    const netBadge = document.getElementById('monitorNetStatus');
    if (netBadge) {
        netBadge.textContent = isOnline ? '🌐 Online' : '🔌 Offline';
        netBadge.className   = `status-badge ${isOnline ? 'online' : 'offline'}`;
    }
}

// ── Bar chart: time per domain ────────────────────────────────
function renderMonitorBar(sites) {
    if (monitorBarChart) { monitorBarChart.destroy(); monitorBarChart = null; }
    const ctx = document.getElementById('monitorBarChart');
    if (!ctx) return;

    if (!sites || sites.length === 0) {
        ctx.parentElement.innerHTML = '<p style="color:var(--text-400);text-align:center;padding:40px">No sites tracked today. Install and activate the Chrome Extension to start tracking.</p>';
        return;
    }

    const top = sites.slice(0, 10);
    const colors = top.map((_, i) => `hsl(${240 + i * 18}, 80%, 65%)`);

    monitorBarChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: top.map(s => s.domain || s.url),
            datasets: [{
                label: 'Minutes',
                data: top.map(s => Math.round(s.timeSpentSeconds / 60)),
                backgroundColor: colors,
                borderRadius: 8,
                borderSkipped: false
            }]
        },
        options: {
            indexAxis: 'y',
            responsive: true,
            animation: { duration: 700 },
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: 'rgba(14,16,24,0.95)',
                    borderColor: 'rgba(99,102,241,0.3)',
                    borderWidth: 1,
                    callbacks: { label: ctx => `${ctx.raw} min (${ctx.raw * 60}s)` }
                }
            },
            scales: {
                x: { grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { color: '#64748b' } },
                y: { grid: { display: false }, ticks: { color: '#cbd5e1', font: { size: 12 } } }
            }
        }
    });
}

// ── Donut chart: category breakdown ──────────────────────────
function renderCategoryDonut(sites) {
    if (monitorDonutChart) { monitorDonutChart.destroy(); monitorDonutChart = null; }
    const ctx = document.getElementById('monitorDonutChart');
    if (!ctx || !sites || sites.length === 0) return;

    const catMap = {};
    sites.forEach(s => {
        const cat = s.category || 'other';
        catMap[cat] = (catMap[cat] || 0) + s.timeSpentSeconds;
    });

    const catColors = {
        docs: '#6366f1', video: '#f59e0b', article: '#10b981',
        study: '#06b6d4', search: '#8b5cf6', other: '#475569'
    };

    const labels = Object.keys(catMap);
    const data   = Object.values(catMap).map(s => Math.round(s / 60));

    monitorDonutChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels,
            datasets: [{
                data,
                backgroundColor: labels.map(l => catColors[l] || '#6366f1'),
                borderWidth: 0,
                borderRadius: 4
            }]
        },
        options: {
            responsive: true,
            cutout: '65%',
            animation: { animateRotate: true, duration: 800 },
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: { color: '#cbd5e1', padding: 16, font: { size: 12 }, boxWidth: 12 }
                },
                tooltip: {
                    backgroundColor: 'rgba(14,16,24,0.95)',
                    callbacks: { label: ctx => ` ${ctx.label}: ${ctx.raw} min` }
                }
            }
        }
    });
}

// ── Site table ────────────────────────────────────────────────
function renderSiteTable(sites) {
    const tbody = document.getElementById('monitorTableBody');
    if (!tbody) return;

    if (!sites || sites.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" class="empty-row">No visits yet. Browse some study sites with the extension installed!</td></tr>';
        return;
    }

    tbody.innerHTML = sites.map(s => {
        const mins = Math.round(s.timeSpentSeconds / 60);
        const pct  = Math.min(Math.round((s.timeSpentSeconds / 3600) * 100), 100);
        return `<tr>
            <td>
                <div style="display:flex;align-items:center;gap:10px">
                    <img src="https://www.google.com/s2/favicons?domain=${s.domain}&sz=16" width="16" height="16" onerror="this.style.display='none'" style="border-radius:2px">
                    <span style="color:var(--text-100)">${escHtml(s.domain || s.url)}</span>
                </div>
            </td>
            <td>
                <div style="display:flex;align-items:center;gap:10px">
                    <div style="flex:1;height:6px;background:rgba(255,255,255,0.08);border-radius:3px;overflow:hidden">
                        <div style="width:${pct}%;height:100%;background:var(--primary);border-radius:3px"></div>
                    </div>
                    <span style="font-family:var(--font-mono);font-size:13px;color:var(--primary-lt);min-width:42px">${mins}m</span>
                </div>
            </td>
            <td><span class="badge" style="background:rgba(6,182,212,0.12);color:var(--secondary);border:1px solid rgba(6,182,212,0.2)">${s.category || 'study'}</span></td>
            <td style="font-size:12px;color:var(--text-400)">${s.lastSeen ? new Date(s.lastSeen).toLocaleTimeString() : '—'}</td>
        </tr>`;
    }).join('');
}

function escHtml(str) {
    if (!str) return '';
    return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
