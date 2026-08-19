/* ────────────────────────────────────────────
   WEEKLY BAR CHART
──────────────────────────────────────────── */
let timelineState = {
    page: 0,
    limit: 5,
    filter: 'ALL',
    sort: 'DESC'
};

function initTimelineListeners() {
    const filterSelect = document.getElementById('timelineFilterType');
    const sortSelect   = document.getElementById('timelineSortOrder');
    const prevBtn      = document.getElementById('timelinePrevPage');
    const nextBtn      = document.getElementById('timelineNextPage');

    if (filterSelect && !filterSelect._hasListener) {
        filterSelect._hasListener = true;
        filterSelect.addEventListener('change', (e) => {
            timelineState.filter = e.target.value;
            timelineState.page = 0;
            renderTimeline();
        });
    }
    if (sortSelect && !sortSelect._hasListener) {
        sortSelect._hasListener = true;
        sortSelect.addEventListener('change', (e) => {
            timelineState.sort = e.target.value;
            timelineState.page = 0;
            renderTimeline();
        });
    }
    if (prevBtn && !prevBtn._hasListener) {
        prevBtn._hasListener = true;
        prevBtn.addEventListener('click', () => {
            if (timelineState.page > 0) {
                timelineState.page--;
                renderTimeline();
            }
        });
    }
    if (nextBtn && !nextBtn._hasListener) {
        nextBtn._hasListener = true;
        nextBtn.addEventListener('click', () => {
            timelineState.page++;
            renderTimeline();
        });
    }
}

function renderTimeline() {
    const container = document.getElementById('timelineContainer');
    if (!container) return;

    if (!window.timelineData || window.timelineData.length === 0) {
        container.innerHTML = '<div class="text-center p-4 text-muted small">No activities logged yet. Get to work! ⚡</div>';
        updateTimelineControls(0);
        return;
    }

    // Filter
    let filtered = window.timelineData.filter(item => {
        if (timelineState.filter === 'ALL') return true;
        return item.category === timelineState.filter;
    });

    // Search filter
    const searchInput = document.getElementById('timelineSearchInput');
    const searchQuery = searchInput ? searchInput.value.trim().toLowerCase() : '';
    if (searchQuery) {
        filtered = filtered.filter(item => {
            const desc = (item.reason || '').toLowerCase();
            const cat = (item.category || '').toLowerCase();
            return desc.includes(searchQuery) || cat.includes(searchQuery);
        });
    }

    // Sort
    filtered.sort((a, b) => {
        if (timelineState.sort === 'DESC') {
            return new Date(b.timestamp) - new Date(a.timestamp);
        } else if (timelineState.sort === 'ASC') {
            return new Date(a.timestamp) - new Date(b.timestamp);
        } else if (timelineState.sort === 'XP') {
            return b.xpDelta - a.xpDelta;
        }
        return 0;
    });

    const totalItems = filtered.length;
    const totalPages = Math.max(1, Math.ceil(totalItems / timelineState.limit));
    
    // Boundary check for page
    if (timelineState.page >= totalPages) {
        timelineState.page = totalPages - 1;
    }
    if (timelineState.page < 0) {
        timelineState.page = 0;
    }

    const startIdx = timelineState.page * timelineState.limit;
    const endIdx = startIdx + timelineState.limit;
    const pageItems = filtered.slice(startIdx, endIdx);

    if (pageItems.length === 0) {
        container.innerHTML = '<div class="text-center p-4 text-muted small">No activities matching this filter. ⚡</div>';
    } else {
        const icons = {
            'TIMER': '<i class="fa-solid fa-clock text-cyan"></i>',
            'CHAT': '<i class="fa-solid fa-robot text-purple"></i>',
            'NOTE': '<i class="fa-solid fa-pen-to-square text-warning"></i>',
            'DOCUMENT': '<i class="fa-solid fa-folder-open text-info"></i>',
            'AUTH': '<i class="fa-solid fa-user-shield text-success"></i>',
            'LEARNING': '<i class="fa-solid fa-graduation-cap text-danger"></i>',
            'RAG': '<i class="fa-solid fa-network-wired text-primary"></i>'
        };

        const colors = {
            'TIMER': 'cyan',
            'CHAT': 'purple',
            'NOTE': 'yellow',
            'DOCUMENT': 'blue',
            'AUTH': 'green',
            'LEARNING': 'red',
            'RAG': 'primary'
        };

        container.innerHTML = pageItems.map(item => {
            const date = new Date(item.timestamp).toLocaleString('en-US', {
                month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
            });
            const cat = item.category || 'GENERAL';
            const icon = icons[cat] || '<i class="fa-solid fa-star text-warning"></i>';
            const colorClass = colors[cat] || 'secondary';

            // Custom metadata fields for accordion details
            let detailsHtml = '';
            if (cat === 'TIMER') {
                detailsHtml = `
                    <div style="display:flex; flex-direction:column; gap: 4px; font-family: var(--font-mono); font-size:10px;">
                        <div><span style="opacity: 0.5;">Event Type:</span> <span class="text-cyan fw-bold">${escHtml(item.activityType || 'SESSION')}</span></div>
                        ${item.metadata ? `<div><span style="opacity: 0.5;">Session Notes:</span> <span class="text-light-subtle">${escHtml(item.metadata)}</span></div>` : ''}
                        <div><span style="opacity: 0.5;">Record Link:</span> <span class="text-secondary">Session ID #${escHtml(item.relatedRecordId || 'N/A')}</span></div>
                    </div>
                `;
            } else if (cat === 'CHAT') {
                detailsHtml = `
                    <div style="display:flex; flex-direction:column; gap: 4px; font-family: var(--font-mono); font-size:10px;">
                        <div><span style="opacity: 0.5;">Model Engine:</span> <span class="text-purple fw-bold">Ollama / Phi-3</span></div>
                        <div><span style="opacity: 0.5;">Interact Action:</span> <span class="text-light-subtle">${escHtml(item.activityType || 'PROMPT')}</span></div>
                        ${item.metadata ? `<div><span style="opacity: 0.5;">Snippet:</span> <span class="text-muted" style="font-style:italic;">"${escHtml(item.metadata.length > 80 ? item.metadata.substring(0, 77) + '...' : item.metadata)}"</span></div>` : ''}
                    </div>
                `;
            } else if (cat === 'NOTE') {
                detailsHtml = `
                    <div style="display:flex; flex-direction:column; gap: 4px; font-family: var(--font-mono); font-size:10px;">
                        <div><span style="opacity: 0.5;">Persistence Core:</span> <span class="text-success fw-bold">PostgreSQL Storage</span></div>
                        <div><span style="opacity: 0.5;">Action:</span> <span class="text-light-subtle">${escHtml(item.activityType || 'NOTE_UPDATE')}</span></div>
                        <div><span style="opacity: 0.5;">Reference Link:</span> <span class="text-secondary">Note ID #${escHtml(item.relatedRecordId || 'N/A')}</span></div>
                    </div>
                `;
            } else {
                detailsHtml = `
                    <div style="display:flex; flex-direction:column; gap: 4px; font-family: var(--font-mono); font-size:10px;">
                        <div><span style="opacity: 0.5;">Category Core:</span> <span class="text-success fw-bold">${escHtml(cat)}</span></div>
                        <div><span style="opacity: 0.5;">Action Type:</span> <span class="text-light-subtle">${escHtml(item.activityType || 'SYSTEM')}</span></div>
                        ${item.metadata ? `<div><span style="opacity: 0.5;">Properties:</span> <span class="text-muted">${escHtml(item.metadata)}</span></div>` : ''}
                    </div>
                `;
            }
            
            return `
                <div class="timeline-item d-flex flex-column rounded hover-bg" style="animation: timeline-slide 0.4s ease-out; background: rgba(255,255,255,0.015); border-left: 3px solid var(--${colorClass}, var(--secondary)); cursor: pointer; overflow:hidden;" onclick="toggleTimelineItem(this)">
                    <div class="d-flex gap-3 align-items-start p-3">
                        <div class="timeline-icon fs-5 p-2 rounded-circle" style="background: rgba(255,255,255,0.03); width: 36px; height: 36px; display: flex; align-items: center; justify-content: center; flex-shrink:0;">
                            ${icon}
                        </div>
                        <div class="timeline-body flex-grow-1" style="min-width:0;">
                            <div class="d-flex justify-content-between align-items-center flex-wrap gap-1">
                                <span class="badge badge-activity" style="font-size: 9px; font-family: var(--font-mono);">${cat}</span>
                                <span class="timeline-time text-muted" style="font-size: 10px;">${date}</span>
                            </div>
                            <p class="timeline-desc text-light small mb-0 mt-1" style="white-space: normal; word-break: break-word;" title="${escHtml(item.reason)}">${escHtml(item.reason)}</p>
                        </div>
                        <div class="d-flex align-items-center gap-2 flex-shrink-0">
                            <span class="badge" style="background: rgba(0, 255, 157, 0.15); border: 1px solid rgba(0, 255, 157, 0.3); color: var(--success); font-family: var(--font-mono); font-size: 10px;">+${item.xpDelta} XP</span>
                            <i class="fa-solid fa-chevron-down expand-toggle-icon text-muted" style="font-size: 10px;"></i>
                        </div>
                    </div>
                    
                    <!-- Accordion Session Details -->
                    <div class="timeline-details">
                        ${detailsHtml}
                    </div>
                </div>
            `;
        }).join('');

        if (typeof gsap !== 'undefined') {
            gsap.fromTo('#timelineContainer > .timeline-item', 
                { opacity: 0, x: -10 },
                { opacity: 1, x: 0, duration: 0.3, stagger: 0.05 }
            );
        }
    }

    updateTimelineControls(totalPages);
}

function updateTimelineControls(totalPages) {
    const prevBtn = document.getElementById('timelinePrevPage');
    const nextBtn = document.getElementById('timelineNextPage');
    const indicator = document.getElementById('timelinePageIndicator');

    if (indicator) {
        indicator.textContent = `Page ${timelineState.page + 1} of ${totalPages}`;
    }

    if (prevBtn) {
        prevBtn.disabled = timelineState.page === 0;
    }
    if (nextBtn) {
        nextBtn.disabled = timelineState.page >= totalPages - 1;
    }
}

window.toggleTimelineItem = function(element) {
    element.classList.toggle('expanded');
};

function renderExecutiveAnalytics(recentTotals, monthlyHistory, forceView = null) {
    if (recentTotals) window.recentTotalsData = recentTotals;
    if (monthlyHistory) window.monthlyTotalsData = monthlyHistory;

    const ctx = document.getElementById('executiveAnalyticsChart');
    if (!ctx) return;

    destroyChart('executiveAnalytics');

    const container = ctx.parentElement;
    const existingMsg = container.querySelector('.chart-no-data');
    if (existingMsg) existingMsg.remove();
    ctx.style.display = 'block';

    const view = forceView || window.currentAnalyticsView || 'weekly';
    window.currentAnalyticsView = view;

    let labels = [];
    let data = [];
    let chartType = 'bar';
    let datasetLabel = 'Minutes';
    let borderColor = 'rgba(6, 182, 212, 1)';
    let backgroundColor = 'rgba(6, 182, 212, 0.3)';

    if (view === 'weekly') {
        const days = [];
        const minuteMap = {};
        for (let i = 6; i >= 0; i--) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            const key = d.toISOString().split('T')[0];
            const label = d.toLocaleDateString('en-US', { weekday: 'short' });
            days.push({ key, label });
            minuteMap[key] = 0;
        }
        (window.recentTotalsData || []).forEach(t => {
            const key = t.recordDate;
            if (key in minuteMap) minuteMap[key] = Math.round(t.totalSeconds / 60);
        });
        labels = days.map(d => d.label);
        data = days.map(d => minuteMap[d.key]);
        chartType = 'bar';
        datasetLabel = 'Focus Minutes';
        borderColor = 'rgba(6, 182, 212, 1)';
        backgroundColor = 'rgba(6, 182, 212, 0.3)';
    } else if (view === 'productivity') {
        const days = [];
        const minuteMap = {};
        for (let i = 29; i >= 0; i--) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            const key = d.toISOString().split('T')[0];
            const label = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            days.push({ key, label });
            minuteMap[key] = 0;
        }
        (window.monthlyTotalsData || []).forEach(t => {
            const key = t.recordDate;
            if (key in minuteMap) minuteMap[key] = Math.round(t.totalSeconds / 60);
        });
        labels = days.map(d => d.label);
        data = days.map(d => minuteMap[d.key]);
        chartType = 'line';
        datasetLabel = 'Focus Minutes';
        borderColor = 'rgba(138, 43, 226, 1)';
        backgroundColor = 'rgba(138, 43, 226, 0.1)';
    } else if (view === 'learning') {
        const categories = {};
        (window.sessionsData || []).forEach(s => {
            const catName = s.activity ? s.activity.name : 'General Study';
            categories[catName] = (categories[catName] || 0) + Math.round(s.durationSeconds / 60);
        });
        labels = Object.keys(categories);
        data = Object.values(categories);
        if (labels.length === 0) {
            ctx.style.display = 'none';
            const msg = document.createElement('div');
            msg.className = 'chart-no-data text-center p-4 text-muted small';
            msg.style.cssText = 'height:240px; display:flex; align-items:center; justify-content:center; font-family:var(--font-mono);';
            msg.innerHTML = 'No study categories recorded yet. Start a focus session to see analysis! ⚡';
            container.appendChild(msg);
            return;
        }
        chartType = 'doughnut';
        datasetLabel = 'Study Minutes';
        borderColor = 'rgba(0, 0, 0, 0)';
        backgroundColor = ['rgba(6, 182, 212, 0.8)', 'rgba(138, 43, 226, 0.8)', 'rgba(16, 185, 129, 0.8)', 'rgba(245, 158, 11, 0.8)', 'rgba(236, 72, 153, 0.8)'];
    } else if (view === 'ai') {
        const days = [];
        const countMap = {};
        for (let i = 6; i >= 0; i--) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            const key = d.toISOString().split('T')[0];
            const label = d.toLocaleDateString('en-US', { weekday: 'short' });
            days.push({ key, label });
            countMap[key] = 0;
        }
        (window.timelineData || []).forEach(t => {
            if (t.category === 'CHAT' || t.category === 'RAG') {
                const key = new Date(t.timestamp).toISOString().split('T')[0];
                if (key in countMap) countMap[key]++;
            }
        });
        labels = days.map(d => d.label);
        data = days.map(d => countMap[d.key]);
        chartType = 'bar';
        datasetLabel = 'AI Requests';
        borderColor = 'rgba(236, 72, 153, 1)';
        backgroundColor = 'rgba(236, 72, 153, 0.4)';
    } else if (view === 'sessions') {
        const days = [];
        const countMap = {};
        for (let i = 6; i >= 0; i--) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            const key = d.toISOString().split('T')[0];
            const label = d.toLocaleDateString('en-US', { weekday: 'short' });
            days.push({ key, label });
            countMap[key] = 0;
        }
        (window.sessionsData || []).forEach(s => {
            const key = new Date(s.startTime).toISOString().split('T')[0];
            if (key in countMap) countMap[key]++;
        });
        labels = days.map(d => d.label);
        data = days.map(d => countMap[d.key]);
        chartType = 'line';
        datasetLabel = 'Sessions Completed';
        borderColor = 'rgba(16, 185, 129, 1)';
        backgroundColor = 'rgba(16, 185, 129, 0.15)';
    }

    const config = {
        type: chartType,
        data: {
            labels,
            datasets: [{
                label: datasetLabel,
                data,
                borderColor,
                backgroundColor,
                borderWidth: chartType === 'line' ? 2.5 : 0,
                borderRadius: chartType === 'bar' ? 6 : 0,
                fill: chartType === 'line',
                tension: 0.3
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: { duration: 600, easing: 'easeOutQuart' },
            plugins: {
                legend: { display: view === 'learning' },
                tooltip: {
                    backgroundColor: 'rgba(14,16,24,0.96)',
                    borderColor: 'rgba(255,255,255,0.08)',
                    borderWidth: 1,
                    titleColor: '#ffffff',
                    bodyColor: '#ffffff',
                    padding: 10,
                    cornerRadius: 6,
                    titleFont: { family: 'var(--font-sans)', weight: 'bold', size: 11 },
                    bodyFont: { family: 'var(--font-mono)', size: 11 }
                }
            }
        }
    };

    if (chartType !== 'doughnut') {
        config.options.scales = {
            x: {
                grid: { display: false },
                ticks: {
                    color: 'rgba(255,255,255,0.4)',
                    font: { size: 9, family: 'var(--font-mono)' }
                }
            },
            y: {
                grid: { color: 'rgba(255,255,255,0.04)' },
                ticks: {
                    color: 'rgba(255,255,255,0.4)',
                    font: { size: 9, family: 'var(--font-mono)' }
                },
                beginAtZero: true
            }
        };
    }

    Charts['executiveAnalytics'] = new Chart(ctx, config);
}

window.toggleAnalyticsView = function(viewMode) {
    const buttons = ['weekly', 'productivity', 'learning', 'ai', 'sessions'];
    buttons.forEach(b => {
        const el = document.getElementById('btnTrend' + b.charAt(0).toUpperCase() + b.slice(1));
        if (el) el.classList.remove('active');
    });

    const activeEl = document.getElementById('btnTrend' + viewMode.charAt(0).toUpperCase() + viewMode.slice(1));
    if (activeEl) activeEl.classList.add('active');

    window.currentAnalyticsView = viewMode;
    renderExecutiveAnalytics();
};

window.switchRightAnalyticsTab = function(tabId) {
    const btnHeatmap = document.getElementById('btnTabHeatmap');
    const btnGraph = document.getElementById('btnTabGraph');
    const contentHeatmap = document.getElementById('rightTabHeatmapContent');
    const contentGraph = document.getElementById('rightTabGraphContent');

    if (tabId === 'heatmap') {
        btnHeatmap && btnHeatmap.classList.add('active');
        btnGraph && btnGraph.classList.remove('active');
        contentHeatmap && (contentHeatmap.style.display = 'flex');
        contentGraph && (contentGraph.style.display = 'none');
        contentHeatmap && contentHeatmap.classList.add('active');
        contentGraph && contentGraph.classList.remove('active');
    } else {
        btnHeatmap && btnHeatmap.classList.remove('active');
        btnGraph && btnGraph.classList.add('active');
        contentHeatmap && (contentHeatmap.style.display = 'none');
        contentGraph && (contentGraph.style.display = 'flex');
        contentHeatmap && contentHeatmap.classList.remove('active');
        contentGraph && contentGraph.classList.add('active');
    }
};
