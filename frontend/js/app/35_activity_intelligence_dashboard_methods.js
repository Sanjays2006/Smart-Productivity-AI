/* ────────────────────────────────────────────
   ACTIVITY INTELLIGENCE DASHBOARD METHODS
──────────────────────────────────────────── */
window.switchIntelTab = function(tabId) {
    // Map old tab IDs to new hub tab IDs for backward compatibility
    const tabIdMap = {
        'tab-overview': 'hub-activity-intel',
        'tab-history': 'hub-history',
        'tab-database': 'hub-database'
    };
    const mappedId = tabIdMap[tabId] || tabId;
    // Delegate to hub tab switcher
    switchHubTab(mappedId);
};

let intelDistributionChart = null;

window.loadIntelOverview = async function() {
    try {
        const [analytics, chunksInfo] = await Promise.all([
            Api.getActivityAnalytics(),
            Api.getRagStatus().catch(() => ({ userChunks: 0, userDocuments: 0, ollamaRunning: false }))
        ]);

        // Update KPI card counters
        document.getElementById('intelTodayCount').textContent = analytics.todayCount || 0;
        document.getElementById('intelFocusTime').innerHTML = `${analytics.focusTimeTodayMinutes || 0}<span style="font-size:12px; font-weight:normal; color:var(--text-400);">m</span>`;
        document.getElementById('intelAiRequests').textContent = analytics.totalAiRequests || 0;
        document.getElementById('intelProductivityScore').textContent = `${analytics.productivityScore || 0}%`;

        // Update Health metrics
        document.getElementById('intelHealthChunks').textContent = chunksInfo.userChunks || analytics.chunksCreated || 0;
        document.getElementById('intelHealthDocs').textContent = chunksInfo.userDocuments || analytics.documentsProcessed || 0;

        // Render doughnut chart
        renderIntelDistribution(analytics.categoryCounts);

        // Load timeline
        await refreshIntelTimeline();

        // Animate Cards
        gsap.fromTo('#hub-activity-intel .glass-card',
            { opacity: 0, y: 15 },
            { opacity: 1, y: 0, duration: 0.4, stagger: 0.05, ease: 'power2.out' }
        );
    } catch (e) {
        console.error("Error loading Activity Intelligence Overview:", e);
    }
};

function renderIntelDistribution(counts) {
    const ctx = document.getElementById('intelDistributionChart');
    if (!ctx || !counts) return;

    if (intelDistributionChart) {
        intelDistributionChart.destroy();
    }

    const labels = Object.keys(counts);
    const data = Object.values(counts);

    intelDistributionChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                data: data,
                backgroundColor: ['#6366f1', '#06b6d4', '#10b981', '#a855f7', '#f59e0b', '#ec4899', '#3b82f6', '#475569'],
                borderWidth: 0,
                borderRadius: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    backgroundColor: 'rgba(14,16,24,0.95)',
                    borderColor: 'rgba(255,255,255,0.05)',
                    borderWidth: 1
                }
            },
            cutout: '75%'
        }
    });
}

window.refreshIntelTimeline = async function() {
    const timelineEl = document.getElementById('intelTimeline');
    if (!timelineEl) return;

    const category = document.getElementById('intelCategoryFilter').value;
    const timeVal = document.getElementById('intelTimeFilter').value;
    const query = document.getElementById('intelSearchQuery').value.trim();

    let startDate = null;
    let endDate = null;
    const now = new Date();

    if (timeVal === 'today') {
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
        endDate = now.toISOString();
    } else if (timeVal === 'yesterday') {
        const yesterday = new Date(now);
        yesterday.setDate(now.getDate() - 1);
        startDate = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate()).toISOString();
        endDate = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate(), 23, 59, 59).toISOString();
    } else if (timeVal === 'week') {
        const weekAgo = new Date(now);
        weekAgo.setDate(now.getDate() - 7);
        startDate = weekAgo.toISOString();
        endDate = now.toISOString();
    } else if (timeVal === 'month') {
        const monthAgo = new Date(now);
        monthAgo.setDate(now.getDate() - 30);
        startDate = monthAgo.toISOString();
        endDate = now.toISOString();
    }

    const formatToLocalISO = (isoString) => {
        if (!isoString) return null;
        return isoString.split('.')[0];
    };

    timelineEl.innerHTML = '<div style="text-align:center; padding:30px; color:var(--text-400);"><i class="fa-solid fa-spinner fa-spin"></i> QUERYING POSTGRESQL ACTIVITIES...</div>';

    try {
        const logs = await Api.searchActivities(query, category, formatToLocalISO(startDate), formatToLocalISO(endDate));
        timelineEl.innerHTML = '';

        if (!logs || logs.length === 0) {
            timelineEl.innerHTML = '<div style="text-align:center; padding:40px; color:var(--text-400); font-size:12px;"><i class="fa-solid fa-folder-open" style="font-size:24px; margin-bottom:12px; opacity:0.2;"></i><br>No matching activities logged during this period.</div>';
            return;
        }

        logs.forEach(log => {
            const timeStr = new Date(log.timestamp).toLocaleString('en-US', {
                month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
            });

            const iconMap = {
                'AUTH': 'fa-key',
                'CHAT': 'fa-comment-dots',
                'DOCUMENT': 'fa-file-shield',
                'RAG': 'fa-network-wired',
                'NOTE': 'fa-pen-to-square',
                'TIMER': 'fa-hourglass-half',
                'LEARNING': 'fa-graduation-cap',
                'DASHBOARD': 'fa-gauge-high'
            };
            const icon = iconMap[log.category] || 'fa-bolt';

            const colorMap = {
                'AUTH': '#f59e0b',
                'CHAT': '#6366f1',
                'DOCUMENT': '#06b6d4',
                'RAG': '#a855f7',
                'NOTE': '#10b981',
                'TIMER': '#ef4444',
                'LEARNING': '#ec4899',
                'DASHBOARD': '#94a3b8'
            };
            const color = colorMap[log.category] || 'var(--primary)';

            const timelineItem = document.createElement('div');
            timelineItem.className = 'timeline-item';
            timelineItem.style.cssText = 'display:flex; gap:16px; margin-bottom:20px; position:relative;';

            timelineItem.innerHTML = `
                <div class="timeline-node" style="width:34px; height:34px; border-radius:50%; background:rgba(255,255,255,0.02); border:1px solid rgba(255,255,255,0.05); display:flex; align-items:center; justify-content:center; flex-shrink:0; color:${color}; z-index: 1;">
                    <i class="fa-solid ${icon}" style="font-size: 12px;"></i>
                </div>
                <div class="timeline-content glass-card" style="flex:1; padding:12px 16px; margin:0; border-left: 3px solid ${color}; background: rgba(var(--glass-rgb), 0.015);">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px; flex-wrap:wrap; gap:6px;">
                        <span class="badge" style="background:rgba(255,255,255,0.04); color:${color}; font-size:9px; font-family:var(--font-mono); font-weight:bold; letter-spacing:0.5px; border:1px solid rgba(255,255,255,0.03); border-radius:4px; padding: 2px 6px;">${log.category} : ${log.activityType}</span>
                        <span style="font-family:var(--font-mono); font-size:10px; color:var(--text-400);">${timeStr}</span>
                    </div>
                    <p style="margin:0; font-size:12px; color:var(--text-100); line-height:1.5;">${escHtml(log.description)}</p>
                    ${log.metadata ? `<div class="timeline-meta" style="margin-top:8px; padding:6px 10px; background:rgba(0,0,0,0.12); border-radius:4px; font-family:var(--font-mono); font-size:10px; color:var(--text-350); word-break:break-all; max-height:80px; overflow-y:auto; border:1px solid rgba(255,255,255,0.02); line-height:1.4;">${escHtml(log.metadata)}</div>` : ''}
                </div>
            `;
            timelineEl.appendChild(timelineItem);
        });
    } catch (e) {
        console.error("Error refreshing timeline:", e);
        timelineEl.innerHTML = '<div style="text-align:center; padding:30px; color:var(--danger);">Error retrieving activity logs from database.</div>';
    }
};

// Bind Activity Intelligence listeners when document is ready
window.addEventListener('DOMContentLoaded', () => {
    // Apply Filter Button
    document.getElementById('intelSearchBtn')?.addEventListener('click', () => {
        refreshIntelTimeline();
    });

    // Also trigger on change of category or time filter directly
    document.getElementById('intelCategoryFilter')?.addEventListener('change', () => {
        refreshIntelTimeline();
    });
    document.getElementById('intelTimeFilter')?.addEventListener('change', () => {
        refreshIntelTimeline();
    });
});

