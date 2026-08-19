/**
 * app.js — Main Application Logic
 * GSAP animations + Chart.js + Particles.js + Timer
 */

 /* ────────────────────────────────────────────
    PARTICLES BACKGROUND
 ──────────────────────────────────────────── */
 function initParticles() {
    if (typeof particlesJS === 'undefined') return;
    particlesJS('particles-js', {
        particles: {
            number: { value: 60, density: { enable: true, value_area: 900 } },
            color: { value: ['#6366f1', '#06b6d4', '#818cf8'] },
            shape: { type: 'circle' },
            opacity: { value: 0.25, random: true, anim: { enable: true, speed: 0.8, opacity_min: 0.05 } },
            size: { value: 2.5, random: true },
            line_linked: { enable: true, distance: 140, color: '#6366f1', opacity: 0.08, width: 1 },
            move: { enable: true, speed: 0.6, direction: 'none', random: true, out_mode: 'out' }
        },
        interactivity: {
            detect_on: 'window',
            events: { onhover: { enable: true, mode: 'grab' }, onclick: { enable: true, mode: 'push' }, resize: true },
            modes: { grab: { distance: 160, line_linked: { opacity: 0.3 } }, push: { particles_nb: 2 } }
        },
        retina_detect: true
    });
}

/* ────────────────────────────────────────────
   TOAST SYSTEM
──────────────────────────────────────────── */
function showToast(msg, type = 'info', duration = 3500) {
    const toast = document.getElementById('toast');
    toast.textContent = msg;
    toast.className = `toast ${type} show`;
    clearTimeout(toast._timer);
    toast._timer = setTimeout(() => toast.classList.remove('show'), duration);
}

/* ────────────────────────────────────────────
   GREETING
──────────────────────────────────────────── */
function setGreeting() {
    const h = new Date().getHours();
    const greet = h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
    const el = document.getElementById('dashGreeting');
    if (el) el.textContent = `${greet} — let's make it count. 🚀`;

    const badge = document.getElementById('topbarDate');
    if (badge) badge.textContent = new Date().toLocaleDateString('en-US', { weekday:'long', month:'long', day:'numeric' });
}

/* ────────────────────────────────────────────
   QUOTES
──────────────────────────────────────────── */
/* ────────────────────────────────────────────
   THEME SYSTEM
──────────────────────────────────────────── */
// Theme logic removed to avoid conflict with theme.js

function handleLogout() {
    Api.logout();
}

/* ────────────────────────────────────────────
   AUTH CHECK
──────────────────────────────────────────── */
async function checkAuth() {
    try {
        let user = await Api.getMe();
        if (user && user.authenticated) {
            window.currentUser = user;
            const brandEl = document.querySelector('.brand-name');
            if (brandEl) brandEl.innerHTML = `Focus<em>AI</em> <small style="font-size:10px; opacity:0.5; display:block">Hi, ${user.displayName}</small>`;
            return true;
        }
    } catch (e) {
        console.warn('Auth check failed:', e);
    }

    // Redirect to login page
    window.location.href = '/login.html';
    return false;
}

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



/* ────────────────────────────────────────────
   CHART REGISTRY (prevent double-init)
──────────────────────────────────────────── */
const Charts = {};

function destroyChart(key) {
    if (Charts[key]) { Charts[key].destroy(); delete Charts[key]; }
}

/* ────────────────────────────────────────────
   XP RING CHART
──────────────────────────────────────────── */
function renderXpRing(currentXp, neededXp, level) {
    destroyChart('xpRing');
    const ctx = document.getElementById('xpRingChart');
    if (!ctx) return;

    Charts['xpRing'] = new Chart(ctx, {
        type: 'doughnut',
        data: {
            datasets: [{
                data: [currentXp, Math.max(neededXp - currentXp, 0)],
                backgroundColor: [
                    'rgba(99,102,241,0.9)',
                    'rgba(255,255,255,0.05)'
                ],
                borderWidth: 0,
                borderRadius: 4
            }]
        },
        options: {
            responsive: true,
            cutout: '78%',
            animation: { animateRotate: true, duration: 900 },
            hover: { mode: null },
            plugins: { legend: { display: false }, tooltip: { enabled: false } }
        }
    });

    const label = document.getElementById('ringLevelLabel');
    if (label) label.textContent = `Lvl ${level}`;
}

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

/* ────────────────────────────────────────────
   GAMIFICATION HUD & SIDEBAR UPDATE
──────────────────────────────────────────── */
function updateGamSidebar(gam, xpNeeded, levelTitle, xpHistory, recentTotals) {
    const pct = Math.min((gam.currentXp / xpNeeded) * 100, 100);

    animateNumber('sidebarLevel', gam.level);
    animateNumber('sidebarXpCurrent', gam.currentXp);
    document.getElementById('sidebarXpNeeded').textContent = xpNeeded;
    document.getElementById('sidebarXpBar').style.width = `${pct}%`;
    animateNumber('sidebarStreak', gam.currentStreak);
    animateNumber('sidebarCoins', gam.coins || 0);

    const scoreEl = document.getElementById('sidebarFocusScore');
    if (scoreEl) animateNumber('sidebarFocusScore', gam.focusScore || 0);
    
    const rankEl = document.getElementById('sidebarRank');
    if (rankEl) rankEl.textContent = `Rank: ${gam.productivityRank || 'Explorer'}`;

    const titleEl = document.getElementById('sidebarLevelTitle');
    if (titleEl) titleEl.textContent = levelTitle || 'Focus Rookie';

    // Avatar emoji based on level
    const avatars = ['🧠','⚡','🔥','💎','🚀','🏆','🌟','👑','🦾','🧬'];
    const avatarEl = document.getElementById('avatarEl');
    if (avatarEl) avatarEl.textContent = avatars[Math.min(Math.floor(gam.level / 3), avatars.length - 1)];

    // Weekly streak dots calculation using recentTotals
    const now = new Date();
    const currentDay = now.getDay(); // 0 is Sunday, 1 is Monday...
    const mondayDiff = currentDay === 0 ? -6 : 1 - currentDay;
    const monday = new Date(now);
    monday.setDate(now.getDate() + mondayDiff);
    monday.setHours(0,0,0,0);

    const activeDays = new Set();
    (recentTotals || []).forEach(total => {
        if (total.recordDate) {
            const parts = total.recordDate.split('-');
            if (parts.length === 3) {
                const date = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
                if (date >= monday && (total.totalSeconds > 0 || total.totalXpEarned > 0)) {
                    activeDays.add(date.getDay());
                }
            }
        }
    });

    document.querySelectorAll('#weeklyStreakDots .day-dot').forEach(el => {
        const day = parseInt(el.getAttribute('data-day'));
        const dot = el.querySelector('.dot-indicator');
        if (dot) {
            if (activeDays.has(day)) {
                dot.style.background = '#10b981';
                dot.style.boxShadow = '0 0 8px rgba(16,185,129,0.6)';
            } else {
                dot.style.background = 'rgba(255, 255, 255, 0.08)';
                dot.style.boxShadow = 'none';
            }
        }
    });
}

/* ────────────────────────────────────────────
   QUESTS & REWARDS SHOP
──────────────────────────────────────────── */
async function loadChallenges() {
    const container = document.getElementById('dailyChallengesList');
    if (!container) return;

    try {
        const challenges = await Api.getChallenges();
        container.innerHTML = challenges.map(c => {
            const check = c.completed ? '<i class="fa-solid fa-circle-check text-success fs-6"></i>' : '<i class="fa-regular fa-circle text-muted fs-6"></i>';
            const progressPct = Math.min((c.progress / c.target) * 100, 100);
            const progressText = `${c.progress}/${c.target}`;
            return `
                <div class="quest-card glass-inner p-2 d-flex align-items-center gap-2" style="border-radius: 8px; border: 1px solid rgba(255,255,255,0.03); background: rgba(0,0,0,0.12);">
                    <div class="quest-status d-flex align-items-center justify-content-center">${check}</div>
                    <div class="quest-body flex-grow-1" style="min-width:0;">
                        <div class="d-flex justify-content-between align-items-center mb-1">
                            <span class="quest-title text-light fw-bold" style="font-size: 10.5px; white-space: normal; word-break: break-word;" title="${escHtml(c.name)}">${escHtml(c.name)}</span>
                            <span class="quest-progress text-muted" style="font-size: 9px; font-family: var(--font-mono);">${progressText}</span>
                        </div>
                        <div class="progress" style="height: 4px; background: rgba(255,255,255,0.05); border-radius: 2px;">
                            <div class="progress-bar ${c.completed ? 'bg-success' : 'bg-primary'}" style="width: ${progressPct}%; height: 100%; transition: width 0.4s;"></div>
                        </div>
                    </div>
                    <div class="quest-reward" style="font-size: 8.5px; font-family: var(--font-mono); text-align: right; line-height: 1.2; flex-shrink:0;">
                        <div class="text-success">+${c.xpReward}xp</div>
                        <div class="text-warning">+${c.coinReward}c</div>
                    </div>
                </div>
            `;
        }).join('');
    } catch (e) {
        console.warn('Could not load challenges:', e);
        container.innerHTML = '<div class="text-center p-3 text-muted small">Quests temporarily unavailable.</div>';
    }
}

async function loadShop() {
    const container = document.getElementById('sidebarShopList');
    if (!container) return;

    try {
        const rewards = await Api.getRewards();
        container.innerHTML = rewards.map(r => {
            const owned = r.unlocked;
            const costText = owned ? 'OWNED' : `<i class="fa-solid fa-coins"></i> ${r.coinCost}`;
            const btnClass = owned ? 'btn-ghost' : 'btn-primary btn-glow';
            const disabled = owned ? 'disabled' : '';
            return `
                <div class="shop-card glass-inner p-2 d-flex align-items-center justify-content-between" style="border-radius: 8px; border: 1px solid rgba(255,255,255,0.03); background: rgba(0,0,0,0.12); gap: 8px;">
                    <div class="shop-body" style="flex: 1; min-width: 0;">
                        <div class="shop-title text-light fw-bold" style="font-size: 10.5px; width: 100%; white-space: normal; word-break: break-word;" title="${escHtml(r.title)}">${escHtml(r.title)}</div>
                        <div class="shop-desc text-muted" style="font-size: 9px; margin-top: 1px; width: 100%; white-space: normal; word-break: break-word;" title="${escHtml(r.description)}">${escHtml(r.description)}</div>
                    </div>
                    <button class="${btnClass} shop-buy-btn" style="padding: 2px 6px; font-size: 9.5px; font-family: var(--font-mono); min-width: 60px; height: 24px; border-radius: 6px; flex-shrink: 0;" 
                            ${disabled} onclick="purchaseShopItem(event, '${r.code}', ${r.coinCost})">
                        ${costText}
                    </button>
                </div>
            `;
        }).join('');
    } catch (e) {
        console.warn('Could not load shop:', e);
        container.innerHTML = '<div class="text-center p-3 text-muted small">Shop temporarily unavailable.</div>';
    }
}

window.purchaseShopItem = async function(event, rewardCode, coinCost) {
    try {
        const res = await Api.purchaseReward(rewardCode);
        if (res.success) {
            showToast(`🎉 Purchased: ${rewardCode}!`, 'success');
            
            // Floating coin deduction indicator
            if (event && event.target) {
                const rect = event.target.getBoundingClientRect();
                triggerXpPop(`-${coinCost} Coins`, rect.left + rect.width / 2, rect.top);
            }
            
            await loadDashboard();
        } else {
            showToast(res.error || 'Failed to purchase item.', 'error');
        }
    } catch (e) {
        console.error(e);
        showToast('Purchase failed.', 'error');
    }
};

function triggerXpPop(text, x, y) {
    const pop = document.createElement('div');
    pop.className = 'xp-float-indicator';
    pop.textContent = text;
    pop.style.position = 'fixed';
    pop.style.left = `${x}px`;
    pop.style.top = `${y}px`;
    pop.style.color = text.startsWith('-') ? '#ff5555' : '#00ff9d';
    pop.style.textShadow = '0 0 10px rgba(0,0,0,0.8)';
    pop.style.fontFamily = 'var(--font-mono)';
    pop.style.fontSize = '14px';
    pop.style.fontWeight = 'bold';
    pop.style.pointerEvents = 'none';
    pop.style.zIndex = '99999';
    document.body.appendChild(pop);

    if (typeof gsap !== 'undefined') {
        gsap.to(pop, {
            y: -50,
            opacity: 0,
            duration: 1.2,
            ease: 'power2.out',
            onComplete: () => pop.remove()
        });
    } else {
        setTimeout(() => pop.remove(), 1200);
    }
}

/* ────────────────────────────────────────────
   ACHIEVEMENTS RENDER (Center Redesign)
──────────────────────────────────────────── */
function renderAchievements(achievements) {
    const grid = document.getElementById('achievementsGrid');
    const card = document.getElementById('achievementCenterCard');
    if (!grid) return;

    if (!achievements || achievements.length === 0) {
        if (card) card.style.display = 'none';
        grid.innerHTML = '';
        return;
    }
    if (card) card.style.display = 'block';

    const total = achievements.length;
    const unlocked = achievements.filter(a => a.unlockedAt !== null).length;
    const pct = Math.round((unlocked / total) * 100) || 0;

    const complText = document.getElementById('achievementCompletionText');
    const progBar   = document.getElementById('achievementProgressBar');

    if (complText) complText.textContent = `${unlocked} / ${total} Unlocked (${pct}%)`;
    if (progBar) progBar.style.width = `${pct}%`;

    const rarityStyles = {
        'COMMON': { border: 'rgba(16,185,129,0.25)', bg: 'rgba(16,185,129,0.03)', glow: 'rgba(16,185,129,0.3)', color: '#10b981', badge: 'Bronze' },
        'RARE': { border: 'rgba(6,182,212,0.25)', bg: 'rgba(6,182,212,0.03)', glow: 'rgba(6,182,212,0.3)', color: '#06b6d4', badge: 'Silver' },
        'EPIC': { border: 'rgba(168,85,247,0.25)', bg: 'rgba(168,85,247,0.03)', glow: 'rgba(168,85,247,0.3)', color: '#a855f7', badge: 'Gold' },
        'LEGENDARY': { border: 'rgba(245,158,11,0.25)', bg: 'rgba(245,158,11,0.03)', glow: 'rgba(245,158,11,0.3)', color: '#f59e0b', badge: 'Platinum' }
    };

    const categoryIcons = {
        'TIMER': '🍅',
        'CHAT': '🤖',
        'NOTE': '📝',
        'STREAK': '🔥',
        'LEVEL': '🚀',
        'XP': '🧬'
    };

    grid.innerHTML = achievements.map(ach => {
        const isUnlocked = ach.unlockedAt !== null;
        const style = rarityStyles[ach.rarity] || rarityStyles['COMMON'];
        const icon = categoryIcons[ach.category] || '🏆';

        const opacity = isUnlocked ? '1' : '0.35';
        const filter  = isUnlocked ? 'none' : 'grayscale(0.6)';
        const glow    = isUnlocked ? `0 0 15px ${style.glow}` : 'none';
        const border  = isUnlocked ? `1px solid ${style.border}` : '1px solid rgba(255,255,255,0.04)';

        return `
            <div class="col-6">
                <div class="p-2.5 rounded glass-card hover-glow h-100 d-flex flex-column align-items-center justify-content-center text-center" 
                     style="background:${style.bg}; border:${border}; opacity:${opacity}; filter:${filter}; box-shadow:${glow}; transition: var(--t-fast); min-height: 100px;"
                     title="${escHtml(ach.title)}: ${escHtml(ach.description)}">
                    <div class="fs-4 mb-1" style="text-shadow: ${isUnlocked ? '0 0 8px ' + style.color : 'none'}">${icon}</div>
                    <div class="fw-bold text-light" style="font-size: 10px; line-height: 1.2;">${escHtml(ach.title)}</div>
                    <div class="text-muted" style="font-size: 8px; margin-top: 1px;">${style.badge}</div>
                    <div class="text-muted text-center" style="font-size: 8.5px; font-family: var(--font-mono); margin-top: 2px; color:${style.color}!important;">+${ach.xpReward} XP</div>
                </div>
            </div>
        `;
    }).join('');
}

/* ────────────────────────────────────────────
   AI INSIGHTS & ANALYTICS RENDER
 ──────────────────────────────────────────── */
async function loadAiInsights() {
    const container = document.getElementById('performanceInsightsList');
    if (!container) return;

    try {
        const [data, details] = await Promise.all([
            Api.getAiInsights(),
            Api.getDashboard()
        ]);

        const patterns = data.focusPatterns || {};
        const insights = data.insights || [];
        const weeklyComp = data.weeklyComparison || '0%';
        const isPositive = !weeklyComp.startsWith('-');
        const trendColor = isPositive ? 'var(--success)' : 'var(--danger)';
        const trendIcon = isPositive ? 'fa-arrow-trend-up' : 'fa-arrow-trend-down';
        const compHoursText = `Logged ${data.thisWeekHours || 0}h vs ${data.lastWeekHours || 0}h last week`;

        let html = `
            <div class="performance-insight-row d-flex align-items-center justify-content-between">
                <div>
                    <div class="fw-bold text-light" style="font-size: 11px;">Weekly Focus Trend</div>
                    <div class="text-muted" style="font-size: 9.5px; margin-top: 2px;">${compHoursText}</div>
                </div>
                <span class="badge d-flex align-items-center gap-1" style="background: rgba(0,0,0,0.2); border: 1px solid ${trendColor}; color: ${trendColor}; font-family: var(--font-mono); font-size: 11px; padding: 4px 8px;">
                    <i class="fa-solid ${trendIcon}"></i> ${weeklyComp}
                </span>
            </div>

            <div class="performance-insight-row d-flex justify-content-between align-items-center">
                <div>
                    <div class="fw-bold text-light" style="font-size: 11px;">Peak Interval & Category</div>
                    <div class="text-muted" style="font-size: 9.5px; margin-top: 2px;">Most active studying ${patterns.primaryCategory || 'General'}</div>
                </div>
                <div style="text-align: right;">
                    <span class="text-cyan fw-bold" style="font-size: 11px; font-family: var(--font-mono);">${patterns.peakHour || '—'}</span>
                </div>
            </div>

            <div class="performance-insight-row d-flex justify-content-between align-items-center">
                <div>
                    <div class="fw-bold text-light" style="font-size: 11px;">Consistency Rating</div>
                    <div class="text-muted" style="font-size: 9.5px; margin-top: 2px;">Active study days ratio</div>
                </div>
                <span class="text-warning fw-bold" style="font-size: 11.5px; font-family: var(--font-mono);">${patterns.consistencyScore || '0%'}</span>
            </div>
        `;

        if (insights.length > 0) {
            html += `
                <div class="p-2.5 rounded mt-2" style="background: rgba(99, 102, 241, 0.05); border: 1px solid rgba(99, 102, 241, 0.2); font-size: 10.5px;">
                    <div class="text-primary-lt fw-bold mb-1" style="font-family: var(--font-mono); font-size: 9px; text-transform: uppercase;">⚡ AI COGNITIVE COACH ALERT:</div>
                    <div class="text-light-subtle" style="line-height: 1.4;">${insights[0]}</div>
                </div>
            `;
        }

        container.innerHTML = html;
    } catch (e) {
        console.warn('AI Insights performance load failed:', e);
        container.innerHTML = '<div class="text-center p-3 text-muted small">Performance insights temporarily unavailable.</div>';
    }
}

function renderDailyBriefing(dash) {
    const container = document.getElementById('dailyBriefingList');
    if (!container) return;
    
    const briefing = dash.briefing || {};
    const goals = briefing.activeGoals || [];
    const streak = briefing.currentStreak || 0;
    const topics = briefing.recommendedTopics || [];
    const pendings = briefing.pendingActivities || [];
    const prediction = briefing.productivityPrediction || "Neutral focus energy predicted.";
    const coaching = briefing.coachingRecommendations || "Maintain consistency with a focus block.";

    // Format active goals progress html
    let goalsHtml = goals.map(g => `
        <div style="margin-bottom: 8px;">
            <div class="d-flex justify-content-between" style="font-size: 10px; color: var(--text-200);">
                <span>${escHtml(g.name)}</span>
                <span class="fw-bold">${escHtml(g.current)} / ${escHtml(g.target)}</span>
            </div>
            <div class="progress mt-1.5" style="height: 4px; background: rgba(255,255,255,0.05); border-radius: 2px;">
                <div class="progress-bar bg-cyan" style="width: ${g.pct}%; height: 100%; transition: width 0.4s;"></div>
            </div>
        </div>
    `).join('');

    let pendingHtml = pendings.map(p => `
        <div class="d-flex align-items-center gap-2" style="font-size: 9.5px; color: var(--text-300);">
            <i class="fa-solid fa-circle-notch text-secondary" style="font-size: 6px;"></i>
            <span>${escHtml(p)}</span>
        </div>
    `).join('');

    let topicsHtml = topics.map(t => `<span class="badge" style="background: rgba(168, 85, 247, 0.08); border: 1px solid rgba(168, 85, 247, 0.2); color: var(--primary-lt); font-size: 8.5px; padding: 2px 6px; border-radius: 4px; font-family: var(--font-mono);">${escHtml(t)}</span>`).join(' ');

    container.innerHTML = `
        <!-- Focus Summary -->
        <div class="briefing-item">
            <div class="briefing-icon text-cyan"><i class="fa-solid fa-bullseye"></i></div>
            <div style="flex:1;">
                <div class="fw-bold text-light" style="font-size:11.5px; margin-bottom: 4px;">Daily Focus Summary</div>
                <div class="text-light-subtle" style="font-size:10px; line-height: 1.3;">${escHtml(briefing.dailyFocusSummary || "No sessions logged.")}</div>
            </div>
        </div>

        <!-- Active Goals -->
        <div class="briefing-item">
            <div class="briefing-icon text-info"><i class="fa-solid fa-flag-checkered"></i></div>
            <div style="flex:1;">
                <div class="fw-bold text-light" style="font-size:11.5px; margin-bottom: 6px;">Active Goals Progress</div>
                ${goalsHtml}
            </div>
        </div>
        
        <!-- Streak -->
        <div class="briefing-item">
            <div class="briefing-icon text-warning"><i class="fa-solid fa-fire"></i></div>
            <div style="flex:1; display:flex; justify-content:space-between; align-items:center;">
                <div>
                    <div class="fw-bold text-light" style="font-size:11.5px;">Consistency Streak</div>
                    <div class="text-muted" style="font-size:9.5px; margin-top:2px;">Active study streak logged.</div>
                </div>
                <span class="badge" style="background:rgba(234,179,8,0.1); border:1px solid rgba(234,179,8,0.25); color:var(--warning); font-family:var(--font-mono); font-size:11px; padding:4px 8px;">
                    ${streak} Days 🔥
                </span>
            </div>
        </div>

        <!-- Recommended Learning -->
        <div class="briefing-item">
            <div class="briefing-icon text-purple"><i class="fa-solid fa-graduation-cap"></i></div>
            <div style="flex:1;">
                <div class="fw-bold text-light" style="font-size:11.5px; margin-bottom: 6px;">Recommended Topics</div>
                <div class="d-flex flex-wrap gap-1.5">${topicsHtml}</div>
            </div>
        </div>

        <!-- Pending Activities -->
        <div class="briefing-item">
            <div class="briefing-icon text-pink"><i class="fa-solid fa-list-check"></i></div>
            <div style="flex:1;">
                <div class="fw-bold text-light" style="font-size:11.5px; margin-bottom: 6px;">Pending Activities</div>
                <div class="d-flex flex-column gap-1.5">${pendingHtml}</div>
            </div>
        </div>

        <!-- AI coaching recommendation -->
        <div class="briefing-item" style="border-left: 2px solid var(--success); padding-left: 10px; margin-left: 4px;">
            <div class="briefing-icon text-success"><i class="fa-solid fa-wand-magic-sparkles"></i></div>
            <div style="flex:1;">
                <div class="fw-bold text-success" style="font-size:10px; font-family:var(--font-mono); text-transform:uppercase; margin-bottom: 2px;">AI Focus Prediction</div>
                <div class="text-light-subtle" style="font-size:10px; line-height:1.4;">${escHtml(prediction)}</div>
                <div class="fw-bold text-cyan" style="font-size:9.5px; font-family:var(--font-mono); text-transform:uppercase; margin-top: 6px; margin-bottom: 2px;">Coaching Recommendation</div>
                <div class="text-light-subtle" style="font-size:10px; line-height:1.4;">${escHtml(coaching)}</div>
            </div>
        </div>
    `;
}

window.toggleGoalSettingsModal = function(event) {
    if (event) event.preventDefault();
    const modalEl = document.getElementById('goalSettingsModal');
    if (modalEl) {
        Api.getPreferences().then(prefs => {
            const select = document.getElementById('goalInput');
            if (select && prefs.dailyFocusGoal) {
                select.value = prefs.dailyFocusGoal.toString();
            }
            const modal = new bootstrap.Modal(modalEl);
            modal.show();
        }).catch(err => {
            console.error("Failed to load user preferences", err);
            const modal = new bootstrap.Modal(modalEl);
            modal.show();
        });
    }
};

window.saveGoalPreference = function() {
    const select = document.getElementById('goalInput');
    if (!select) return;
    const goalVal = parseInt(select.value);

    Api.updatePreferences({ dailyFocusGoal: goalVal }).then(res => {
        showToast('Daily study goal updated successfully!', 'success');
        const modalEl = document.getElementById('goalSettingsModal');
        const modal = bootstrap.Modal.getInstance(modalEl);
        if (modal) modal.hide();
        loadDashboard();
    }).catch(err => {
        console.error("Failed to save goal preference", err);
        showToast('Error saving goal preference.', 'error');
    });
};

window.triggerRecallQuery = function(query) {
    const input = document.getElementById('memoryQueryInput');
    if (input) {
        input.value = query;
        submitRecallQuery();
    }
};

window.submitRecallQuery = async function() {
    const input = document.getElementById('memoryQueryInput');
    const output = document.getElementById('memoryOutputBox');
    if (!input || !output) return;

    const query = input.value.trim();
    if (!query) return;

    output.innerHTML = `
        <div class="d-flex align-items-center gap-2 text-primary">
            <i class="fa-solid fa-spinner fa-spin"></i>
            <span>Querying PostgreSQL Cognitive Core memory...</span>
        </div>
    `;
    input.value = '';

    try {
        const data = await Api.askAi(query);
        
        let answer = data.answer || 'No answer returned.';
        
        if (answer.includes('⚠️ Ollama is not running') || answer.includes('Error contacting Ollama')) {
            answer = await getLocalRecallFallback(query);
        }
        
        output.innerHTML = `
            <div style="font-family: var(--font-sans); color: var(--text-100);">
                <div style="font-family: var(--font-mono); font-size: 9px; color: var(--primary-lt); margin-bottom: 6px;">⚡ COGNITIVE RECALL RESPONSE:</div>
                <div class="markdown-body" style="white-space: pre-wrap;">${answer}</div>
            </div>
        `;
    } catch (e) {
        console.warn('Memory core failed, loading direct PostgreSQL fallback...', e);
        const fallback = await getLocalRecallFallback(query);
        output.innerHTML = `
            <div style="font-family: var(--font-sans); color: var(--text-100);">
                <div style="font-family: var(--font-mono); font-size: 9px; color: var(--success); margin-bottom: 6px;">📊 DIRECT POSTGRESQL FALLBACK SUMMARY:</div>
                <div style="white-space: pre-wrap;">${fallback}</div>
            </div>
        `;
    }
};

async function getLocalRecallFallback(query) {
    try {
        const logs = await Api.searchActivities(query);
        
        if (!logs || logs.length === 0) {
            return `Ollama offline. Found 0 direct activity matches in PostgreSQL history for: "${query}".`;
        }
        
        let summary = `Ollama offline. Retrieved ${logs.length} logged activities directly from database:\n\n`;
        logs.slice(0, 5).forEach(log => {
            const date = new Date(log.timestamp).toLocaleString();
            summary += `• [${log.category}] **${log.description}** (${date})\n`;
        });
        if (logs.length > 5) {
            summary += `• ...and ${logs.length - 5} more records.`;
        }
        return summary;
    } catch (e) {
        return "Error loading database activity recall fallback: " + e.message;
    }
}

function renderProductivityHeatmap(monthlyHistory) {
    const grid = document.getElementById('heatmapGrid');
    if (!grid) return;

    const data = monthlyHistory || [];
    const sorted = [...data].sort((a,b) => new Date(a.recordDate) - new Date(b.recordDate));
    const blocks = sorted.slice(-30);
    
    while(blocks.length < 30) {
        const d = new Date();
        d.setDate(d.getDate() - (30 - blocks.length));
        blocks.unshift({ recordDate: d.toISOString().split('T')[0], totalSeconds: 0 });
    }

    grid.innerHTML = blocks.map(day => {
        const mins = Math.round(day.totalSeconds / 60);
        let lvl = 0;
        if (mins > 0 && mins <= 30) lvl = 1;
        else if (mins > 30 && mins <= 90) lvl = 2;
        else if (mins > 90) lvl = 3;

        const dateStr = new Date(day.recordDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        const tooltipText = `${dateStr}: ${mins} mins focus`;

        return `
            <div class="heatmap-block lvl-${lvl}" title="${tooltipText}" data-date="${day.recordDate}"></div>
        `;
    }).join('');
}

let kgPhysicsFrame = null;
function renderPersonalKnowledgeGraph(sessions) {
    const svg = document.getElementById('knowledgeGraphSvg');
    if (!svg) return;
    svg.innerHTML = ''; 

    const topicCounts = {};
    (sessions || []).forEach(s => {
        const name = s.activity ? s.activity.name : 'Study';
        topicCounts[name] = (topicCounts[name] || 0) + 1;
    });

    const topics = Object.keys(topicCounts);
    if (topics.length === 0) {
        svg.innerHTML = `
            <text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="var(--text-400)" font-size="11" font-family="var(--font-mono)">
                No focus topics recorded yet.
            </text>
        `;
        return;
    }

    const nodes = [
        { id: 0, label: 'ME', x: 160, y: 100, r: 18, color: '#8a2be2', glow: 'rgba(138,43,226,0.6)', isCenter: true }
    ];

    const colors = ['#06b6d4', '#10b981', '#f59e0b', '#ec4899', '#6366f1'];
    topics.slice(0, 5).forEach((topic, idx) => {
        const angle = (idx / Math.min(5, topics.length)) * 2 * Math.PI;
        const dist = 60 + Math.random() * 10;
        nodes.push({
            id: idx + 1,
            label: topic.toUpperCase(),
            x: 160 + dist * Math.cos(angle),
            y: 100 + dist * Math.sin(angle),
            vx: 0,
            vy: 0,
            r: 10 + Math.min(5, topicCounts[topic] || 1),
            color: colors[idx % colors.length],
            glow: colors[idx % colors.length] + '80',
            isCenter: false,
            angle: angle,
            baseDist: dist
        });
    });

    const links = [];
    for (let i = 1; i < nodes.length; i++) {
        links.push({ source: nodes[0], target: nodes[i] });
    }

    const gLinks = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    const gNodes = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    svg.appendChild(gLinks);
    svg.appendChild(gNodes);

    const svgLinks = links.map(link => {
        const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        line.setAttribute('class', 'kg-link');
        line.setAttribute('stroke', link.target.color);
        line.setAttribute('stroke-width', '1');
        line.setAttribute('opacity', '0.25');
        gLinks.appendChild(line);
        return { line, link };
    });

    const svgNodes = nodes.map(node => {
        const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        
        const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        circle.setAttribute('class', 'kg-node');
        circle.setAttribute('fill', 'rgba(0,0,0,0.4)');
        circle.setAttribute('stroke', node.color);
        circle.setAttribute('stroke-width', '2');
        circle.setAttribute('r', node.r);
        circle.style.setProperty('--glow-color', node.glow);
        
        const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        text.setAttribute('class', 'kg-label');
        text.setAttribute('text-anchor', 'middle');
        text.setAttribute('dy', node.isCenter ? '4' : '-12');
        text.textContent = node.label;

        group.appendChild(circle);
        group.appendChild(text);
        gNodes.appendChild(group);

        return { group, node };
    });

    if (kgPhysicsFrame) cancelAnimationFrame(kgPhysicsFrame);
    let time = 0;
    
    function updatePhysics() {
        time += 0.015;
        
        nodes.forEach(node => {
            if (node.isCenter) return;
            const driftAngle = node.angle + Math.sin(time + node.id) * 0.1;
            const driftDist = node.baseDist + Math.cos(time * 1.5 + node.id) * 4;
            
            const targetX = 160 + driftDist * Math.cos(driftAngle);
            const targetY = 100 + driftDist * Math.sin(driftAngle);
            
            node.x += (targetX - node.x) * 0.05;
            node.y += (targetY - node.y) * 0.05;
        });

        svgLinks.forEach(item => {
            item.line.setAttribute('x1', item.link.source.x);
            item.line.setAttribute('y1', item.link.source.y);
            item.line.setAttribute('x2', item.link.target.x);
            item.line.setAttribute('y2', item.link.target.y);
        });

        svgNodes.forEach(item => {
            item.group.setAttribute('transform', `translate(${item.node.x}, ${item.node.y})`);
        });

        kgPhysicsFrame = requestAnimationFrame(updatePhysics);
    }

    updatePhysics();
}

/* ────────────────────────────────────────────
   LEVEL-UP CELEBRATION STATE CHECK
──────────────────────────────────────────── */
let _currentLevelState = null;

function checkLevelUp(newLevel) {
    if (_currentLevelState === null) {
        _currentLevelState = newLevel;
        return;
    }

    if (newLevel > _currentLevelState) {
        const oldLevel = _currentLevelState;
        _currentLevelState = newLevel;
        
        const overlay = document.getElementById('levelUpOverlay');
        const oldEl   = document.getElementById('levelUpOld');
        const newEl   = document.getElementById('levelUpNew');
        const rankEl  = document.getElementById('levelUpRankName');

        if (oldEl) oldEl.textContent = oldLevel;
        if (newEl) newEl.textContent = newLevel;
        
        if (rankEl) {
            const titles = {
                1: 'Focus Rookie',
                5: 'Time Trainee',
                10: 'Productivity Pro',
                20: 'Deep Work Master',
                40: 'Flow State Legend',
                70: 'Zen Architect'
            };
            let matched = 'Focus Rookie';
            for (let l of Object.keys(titles).map(Number).sort((a,b)=>a-b)) {
                if (newLevel >= l) matched = titles[l];
            }
            rankEl.textContent = matched;
        }

        if (overlay) {
            overlay.style.display = 'flex';
            if (typeof gsap !== 'undefined') {
                gsap.killTweensOf('#levelUpOverlay .level-up-card');
                gsap.fromTo('#levelUpOverlay .level-up-card',
                    { scale: 0.5, rotation: -10, opacity: 0 },
                    { scale: 1, rotation: 0, opacity: 1, duration: 0.8, ease: 'back.out(1.5)' }
                );
            }
        }

        // Trigger confetti burst
        if (typeof spawnConfetti === 'function') {
            spawnConfetti(50);
        }
        
        // Holographic flip on avatar
        const avatar = document.getElementById('avatarEl');
        if (avatar && typeof gsap !== 'undefined') {
            gsap.fromTo(avatar, 
                { rotationY: 0 },
                { rotationY: 360, duration: 1.2, ease: 'power2.out' }
            );
        }
    }
}

window.closeLevelUpOverlay = function() {
    const overlay = document.getElementById('levelUpOverlay');
    if (overlay) {
        if (typeof gsap !== 'undefined') {
            gsap.to('#levelUpOverlay .level-up-card', {
                scale: 0.7, opacity: 0, duration: 0.4, ease: 'power2.in',
                onComplete: () => { overlay.style.display = 'none'; }
            });
        } else {
            overlay.style.display = 'none';
        }
    }
};

/* ────────────────────────────────────────────
   ANIMATED NUMBER COUNTUP
──────────────────────────────────────────── */
function animateNumber(id, target) {
    const el = document.getElementById(id);
    if (!el) return;
    const start = parseInt(el.textContent) || 0;
    if (start === target) return;
    const obj = { val: start };
    gsap.to(obj, { val: target, duration: 0.8, ease: 'power2.out',
        onUpdate: function() { el.textContent = Math.round(obj.val); }
    });
}

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

    } catch (e) {
        console.error('Dashboard load error:', e);
    }
}

/* ────────────────────────────────────────────
   ACTIVITIES & TIMER (DEEP WORK MANAGEMENT SYSTEM)
   ──────────────────────────────────────────── */
let currentSessionId = null;
let timerStart       = null;
let elapsedBeforePause = 0;
let timerInterval    = null;
let activeActivityId = null;
let activeActivityData = null;
let isDeepWorkMode   = false;
let sessionTargetSeconds = 1500;
let isTimerPaused    = false;
let focusTimerState  = 'IDLE'; // IDLE, ACTIVE, PAUSED
let pauseCount       = 0;
const RING_CIRC      = 596.9; // Matches r=95 in SVG progress circle

let loadedActivities = [];
let timelineSessions = [];
let timelinePage = 0;
const TIMELINE_PAGE_SIZE = 5;

let analyticsFocusTrendChartInstance = null;
let analyticsCategoryChartInstance = null;

// Helper to format seconds to hh:mm:ss
function formatTime(totalSeconds) {
    const hrs = Math.floor(totalSeconds / 3600);
    const mins = Math.floor((totalSeconds % 3600) / 60);
    const secs = totalSeconds % 60;
    return [hrs, mins, secs].map(v => v < 10 ? "0" + v : v).join(":");
}

// Helper to parse dates which could be string or array
function parseSessionDate(dateVal) {
    if (!dateVal) return new Date(0);
    if (Array.isArray(dateVal)) {
        const [yr, mo, dy, hr, mn, sc] = dateVal;
        return new Date(yr, (mo || 1) - 1, dy || 1, hr || 0, mn || 0, sc || 0);
    }
    const d = new Date(dateVal);
    return isNaN(d.getTime()) ? new Date(0) : d;
}

// Global states for workspace redesign
let isLoadingActivities = false;
let favoritesOnlyFilter = false;
let editingActivityId = null;

// 1. Load Activities
async function loadActivities() {
    if (isLoadingActivities) return;
    isLoadingActivities = true;
    try {
        let acts = await Api.getActivities();
        if (!acts || acts.length === 0) {
            await Api.createActivity('Core Coding', '#6366f1', 'fa-code', 'CODING', 'HARD', 45, 'HIGH');
            await Api.createActivity('System Study', '#06b6d4', 'fa-graduation-cap', 'LEARNING', 'MEDIUM', 25, 'MEDIUM');
            await Api.createActivity('Flow Exercise', '#10b981', 'fa-dumbbell', 'EXERCISE', 'EASY', 30, 'LOW');
            acts = await Api.getActivities();
        }
        loadedActivities = acts || [];
        renderWorkspaceActivities();
        
        if (loadedActivities.length > 0 && !activeActivityId) {
            selectActivity(loadedActivities[0].id);
        }
        
        loadTimerAnalytics();
        loadTimerTimeline();
    } catch(e) {
        console.error('Activities load failed:', e);
    } finally {
        isLoadingActivities = false;
    }
}

// Helper to calculate XP reward based on duration (matching backend logic)
function calculateXpReward(estimatedDuration) {
    const hours = estimatedDuration / 60;
    let xp = Math.round(hours * 120);
    if (estimatedDuration === 25) xp += 50; // Pomodoro bonus
    return Math.max(10, xp);
}

// Relative time formatter for activities
function formatRelativeTime(date) {
    if (!date || isNaN(date.getTime())) return 'Never';
    const now = new Date();
    const diffMs = now - date;
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHr = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHr / 24);

    if (diffSec < 60) return 'Just now';
    if (diffMin < 60) return `${diffMin}m ago`;
    if (diffHr < 24) return `${diffHr}h ago`;
    if (diffDay === 1) return 'Yesterday';
    if (diffDay < 7) return `${diffDay}d ago`;
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

// Dynamic productivity rating calculator
function calculateProductivityRating(activityId) {
    const activitySessions = (window.timelineSessions || []).filter(s => s.activity && s.activity.id === activityId && s.status === 'COMPLETED');
    if (activitySessions.length === 0) return { label: 'New', class: 'new-pills' };
    
    let totalScore = 0;
    for (const s of activitySessions) {
        totalScore += (s.focusScore || 0);
    }
    const avgScore = totalScore / activitySessions.length;
    if (avgScore >= 90) return { label: 'Optimal', class: 'optimal' };
    if (avgScore >= 70) return { label: 'Good', class: 'good' };
    if (avgScore >= 50) return { label: 'Moderate', class: 'moderate' };
    return { label: 'Low', class: 'low' };
}

// Canvas Confetti Celebration Manager
class ConfettiEffect {
    constructor() {
        this.canvas = document.createElement('canvas');
        this.ctx = this.canvas.getContext('2d');
        this.particles = [];
        this.active = false;
        
        this.canvas.style.position = 'fixed';
        this.canvas.style.top = '0';
        this.canvas.style.left = '0';
        this.canvas.style.width = '100vw';
        this.canvas.style.height = '100vh';
        this.canvas.style.pointerEvents = 'none';
        this.canvas.style.zIndex = '99999';
    }
    
    start() {
        document.body.appendChild(this.canvas);
        this.resize();
        this._resizeHandler = () => this.resize();
        window.addEventListener('resize', this._resizeHandler);
        
        this.active = true;
        this.particles = [];
        const colors = ['#6366f1', '#06b6d4', '#10b981', '#fbbf24', '#f43f5e', '#a855f7'];
        
        for (let i = 0; i < 150; i++) {
            this.particles.push({
                x: Math.random() * this.canvas.width,
                y: this.canvas.height + Math.random() * 20,
                vx: (Math.random() - 0.5) * 8,
                vy: -Math.random() * 14 - 10,
                size: Math.random() * 8 + 4,
                color: colors[Math.floor(Math.random() * colors.length)],
                rotation: Math.random() * Math.PI * 2,
                rotationSpeed: (Math.random() - 0.5) * 0.2,
                opacity: 1
            });
        }
        
        this.animate();
    }
    
    resize() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
    }
    
    animate() {
        if (!this.active) return;
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        let alive = false;
        for (const p of this.particles) {
            p.x += p.vx;
            p.y += p.vy;
            p.vy += 0.35; // Gravity
            p.vx *= 0.98; // Drag
            p.rotation += p.rotationSpeed;
            
            if (p.vy > 2) {
                p.opacity -= 0.012; // Fade out as they fall
            }
            
            if (p.y < this.canvas.height && p.opacity > 0) {
                alive = true;
                this.ctx.save();
                this.ctx.translate(p.x, p.y);
                this.ctx.rotate(p.rotation);
                this.ctx.fillStyle = p.color;
                this.ctx.globalAlpha = Math.max(0, p.opacity);
                
                if (p.size % 2 === 0) {
                    this.ctx.fillRect(-p.size / 2, -p.size, p.size, p.size * 1.5);
                } else {
                    this.ctx.beginPath();
                    this.ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2);
                    this.ctx.fill();
                }
                this.ctx.restore();
            }
        }
        
        if (alive) {
            requestAnimationFrame(() => this.animate());
        } else {
            this.cleanup();
        }
    }
    
    cleanup() {
        this.active = false;
        window.removeEventListener('resize', this._resizeHandler);
        if (this.canvas.parentNode) {
            this.canvas.parentNode.removeChild(this.canvas);
        }
    }
}

window.triggerConfetti = function() {
    const effect = new ConfettiEffect();
    effect.start();
};

// Floating XP Gain animation
window.showFloatingXp = function(clientX, clientY, xpAmount) {
    const el = document.createElement('div');
    el.className = 'floating-xp-gain';
    el.innerHTML = `<i class="fa-solid fa-sparkles"></i> +${xpAmount} XP`;
    el.style.left = `${clientX}px`;
    el.style.top = `${clientY}px`;
    document.body.appendChild(el);
    setTimeout(() => {
        if (el.parentNode) el.parentNode.removeChild(el);
    }, 1200);
};

// Global click ripple handler
document.body.addEventListener('click', (e) => {
    const btn = e.target.closest('.ripple-btn');
    if (btn) {
        const rect = btn.getBoundingClientRect();
        const ripple = document.createElement('span');
        ripple.className = 'ripple-wave';
        const size = Math.max(rect.width, rect.height);
        ripple.style.width = ripple.style.height = `${size}px`;
        const x = e.clientX - rect.left - size / 2;
        const y = e.clientY - rect.top - size / 2;
        ripple.style.left = `${x}px`;
        ripple.style.top = `${y}px`;
        btn.appendChild(ripple);
        setTimeout(() => ripple.remove(), 500);
    }
});

// Card HTML template generator
function getCardHtml(a, isRecentOrRecommended = false) {
    const isSelected = activeActivityId === a.id;
    const isActiveSession = currentSessionId !== null && activeActivityId === a.id;
    const isFav = Boolean(a.isFavorite);
    const xpReward = calculateXpReward(a.estimatedDuration);
    const prioClass = (a.priority || 'MEDIUM').toLowerCase();
    const difficultyClass = (a.difficulty || 'MEDIUM').toLowerCase();
    const iconClass = a.icon || 'fa-briefcase';

    // Get last active time
    const activitySessions = (window.timelineSessions || []).filter(s => s.activity && s.activity.id === a.id);
    let lastSessionDateStr = 'Never';
    if (activitySessions.length > 0) {
        activitySessions.sort((x, y) => parseSessionDate(y.startTime) - parseSessionDate(x.startTime));
        const lastActiveDate = parseSessionDate(activitySessions[0].startTime);
        lastSessionDateStr = formatRelativeTime(lastActiveDate);
    } else {
        const createdDate = new Date(a.createdAt);
        if (!isNaN(createdDate.getTime())) {
            lastSessionDateStr = 'Created ' + formatRelativeTime(createdDate);
        }
    }

    const prodRating = calculateProductivityRating(a.id);
    const statusLabel = isActiveSession ? (isTimerPaused ? 'Paused' : 'Focusing') : 'Idle';
    const statusClass = isActiveSession ? (isTimerPaused ? 'paused' : 'focusing') : 'idle';
    const glowColor = a.colorCode || '#6366f1';

    let progressHtml = '';
    let toolbarHtml = '';
    
    if (isActiveSession) {
        const elapsedSec = elapsedBeforePause + (isTimerPaused ? 0 : Math.floor((Date.now() - timerStart) / 1000));
        const pct = Math.min(100, Math.round((elapsedSec / sessionTargetSeconds) * 100)) || 0;
        progressHtml = `
            <div class="card-live-progress-container">
                <div class="card-live-progress-bar" id="cardProgressBar-${a.id}" style="width: ${pct}%;"></div>
            </div>
        `;
        toolbarHtml = `
            <div class="live-session-toolbar" onclick="event.stopPropagation();">
                ${isTimerPaused ? 
                    `<button class="btn-inline-resume ripple-btn" onclick="window.resumeSession()"><i class="fa-solid fa-play"></i> Resume</button>` : 
                    `<button class="btn-inline-pause ripple-btn" onclick="window.pauseSession()"><i class="fa-solid fa-pause"></i> Pause</button>`
                }
                <button class="btn-inline-complete ripple-btn" onclick="window.endSession()"><i class="fa-solid fa-check"></i> Complete</button>
            </div>
        `;
    }

    return `
        <div class="workspace-activity-card select-activity-card ${isSelected ? 'selected' : ''} ${isActiveSession ? 'live-session-active' : ''}" 
             data-id="${a.id}" 
             style="border-top: 3px solid ${glowColor};"
             title="Click to select: ${escHtml(a.name)}">
            
            <div class="activity-card-header">
                <div class="activity-card-icon-box" style="background: ${glowColor};">
                    <i class="fa-solid ${iconClass}"></i>
                </div>
                
                <div class="d-flex align-items-center gap-1">
                    ${isActiveSession ? `
                        <div class="live-status-container ${statusClass}">
                            <span class="status-dot-sm animate-pulse" style="background: currentColor;"></span> ${statusLabel}
                        </div>
                    ` : `
                        <span class="badge" style="background: rgba(255,255,255,0.03); color: var(--text-400); font-size: 8px;">Idle</span>
                    `}
                    
                    <div class="dropdown">
                        <button class="btn btn-ghost p-0 d-flex align-items-center justify-content-center text-muted" 
                                type="button" 
                                data-bs-toggle="dropdown" 
                                aria-expanded="false" 
                                style="width: 20px; height: 20px; border: none; background: none;"
                                onclick="event.stopPropagation();"
                                title="Actions">
                            <i class="fa-solid fa-ellipsis-vertical" style="font-size: 11px;"></i>
                        </button>
                        <ul class="dropdown-menu dropdown-menu-dark dropdown-menu-end">
                            <li><a class="dropdown-item fav-activity-btn py-1" href="#" data-id="${a.id}" onclick="event.stopPropagation();" style="font-size: 10px; display:flex; align-items:center; gap:6px;"><i class="${isFav ? 'fa-solid text-warning' : 'fa-regular'} fa-star"></i> ${isFav ? 'Remove Favorite' : 'Mark Favorite'}</a></li>
                            <li><a class="dropdown-item edit-activity-btn py-1" href="#" data-id="${a.id}" onclick="event.stopPropagation();" style="font-size: 10px; display:flex; align-items:center; gap:6px;"><i class="fa-solid fa-pen"></i> Edit</a></li>
                            <li><hr class="dropdown-divider" style="margin: 4px 0; border-color: rgba(255,255,255,0.06);"></li>
                            <li><a class="dropdown-item delete-activity-btn text-danger py-1" href="#" data-id="${a.id}" onclick="event.stopPropagation();" style="font-size: 10px; display:flex; align-items:center; gap:6px;"><i class="fa-solid fa-trash-can"></i> Delete</a></li>
                        </ul>
                    </div>
                </div>
            </div>

            <div class="flex-grow-1" style="min-width:0;">
                <h4 class="activity-card-title text-truncate" title="${escHtml(a.name)}">${escHtml(a.name)}</h4>
                
                <div class="activity-card-meta">
                    <span class="category-badge-pills">${escHtml(a.category)}</span>
                    <span class="difficulty-badge-glow ${difficultyClass}">${escHtml(a.difficulty || 'MEDIUM')}</span>
                    <span class="productivity-badge-pills ${prodRating.class}">${prodRating.label}</span>
                </div>
                
                ${progressHtml}
                ${toolbarHtml}
            </div>

            <div class="activity-card-footer">
                <div class="activity-card-stats">
                    <span title="Estimated duration"><i class="fa-regular fa-clock"></i> ${a.estimatedDuration}m</span>
                    <span class="activity-card-xp" title="XP Reward"><i class="fa-solid fa-sparkles"></i> +${xpReward} XP</span>
                </div>
                
                ${!isActiveSession ? `
                    <button class="circular-play-btn pulse-active ripple-btn start-activity-btn" 
                            data-id="${a.id}"
                            style="background: ${glowColor};" 
                            title="Start Session">
                        <i class="fa-solid fa-play" style="font-size: 10px; margin-left: 1px;"></i>
                    </button>
                ` : `
                    <button class="circular-play-btn ripple-btn" 
                            style="background: rgba(239, 68, 68, 0.2); color: #ef4444; border: 1px solid rgba(239, 68, 68, 0.4);" 
                            onclick="event.stopPropagation(); window.stopSessionEarly()"
                            title="Stop Session Early">
                        <i class="fa-solid fa-stop" style="font-size: 9px;"></i>
                    </button>
                `}
            </div>
        </div>
    `;
}

// 2. Render Activities in Left Workspace Panel
function renderWorkspaceActivities() {
    const listEl = document.getElementById('workspaceActivitiesList');
    if (!listEl) return;

    if (isLoadingActivities) {
        listEl.innerHTML = `
            <div class="workspace-section-title">Active Workspace</div>
            <div class="workspace-grid">
                <div class="skeleton-card"></div>
                <div class="skeleton-card"></div>
                <div class="skeleton-card"></div>
            </div>
        `;
        return;
    }

    const searchVal = (document.getElementById('workspaceSearchInput')?.value || '').toLowerCase().trim();
    const catFilter = document.getElementById('workspaceCategoryFilter')?.value || '';

    // Safeguard deduplication by ID
    const seenIds = new Set();
    const uniqueActs = [];
    for (const act of loadedActivities) {
        if (!seenIds.has(act.id) && act.isActive !== false) {
            seenIds.add(act.id);
            uniqueActs.push(act);
        }
    }

    // Secondary client name-category deduplication
    const seenKeys = new Set();
    const filteredUniqueActs = [];
    for (const act of uniqueActs) {
        const key = act.name.trim().toLowerCase() + "||" + (act.category || 'CUSTOM').trim().toUpperCase();
        if (!seenKeys.has(key)) {
            seenKeys.add(key);
            filteredUniqueActs.push(act);
        }
    }

    // Filter active list matching user queries
    let filtered = filteredUniqueActs.filter(a => {
        const matchesSearch = a.name.toLowerCase().includes(searchVal);
        const matchesCat = !catFilter || a.category === catFilter;
        const matchesFav = !favoritesOnlyFilter || Boolean(a.isFavorite);
        return matchesSearch && matchesCat && matchesFav;
    });

    // Sort
    const sortVal = document.getElementById('workspaceSortOptions')?.value || 'recent';
    filtered.sort((x, y) => {
        if (sortVal === 'name') {
            return x.name.localeCompare(y.name);
        } else if (sortVal === 'duration') {
            return y.estimatedDuration - x.estimatedDuration;
        } else if (sortVal === 'priority') {
            const prioMap = { 'HIGH': 3, 'MEDIUM': 2, 'LOW': 1 };
            const pX = prioMap[x.priority] || 0;
            const pY = prioMap[y.priority] || 0;
            return pY - pX;
        } else if (sortVal === 'xp') {
            return calculateXpReward(y.estimatedDuration) - calculateXpReward(x.estimatedDuration);
        } else {
            return y.id - x.id;
        }
    });

    // Recent Focus Extraction
    const recentActs = [];
    const recentSeenIds = new Set();
    const sortedSessions = [...(window.timelineSessions || [])].sort((x, y) => parseSessionDate(y.startTime) - parseSessionDate(x.startTime));
    for (const s of sortedSessions) {
        if (s.activity && s.activity.id && s.activity.isActive !== false) {
            if (!recentSeenIds.has(s.activity.id)) {
                recentSeenIds.add(s.activity.id);
                const fullAct = filteredUniqueActs.find(la => la.id === s.activity.id);
                if (fullAct) {
                    recentActs.push(fullAct);
                }
                if (recentActs.length >= 3) break;
            }
        }
    }

    // Recommended Activities (High priority first)
    const recommendedActs = filteredUniqueActs.filter(a => a.priority === 'HIGH' && a.id !== activeActivityId).slice(0, 3);
    if (recommendedActs.length < 3) {
        const remaining = filteredUniqueActs.filter(a => !recommendedActs.includes(a) && a.id !== activeActivityId).slice(0, 3 - recommendedActs.length);
        recommendedActs.push(...remaining);
    }

    let finalHtml = '';

    // Section 1: Active Activities
    finalHtml += `<div class="workspace-section-title">Active Workspace</div>`;
    if (filtered.length === 0) {
        finalHtml += `<div class="text-center p-3 text-muted small bg-black bg-opacity-10 border border-secondary border-opacity-10 rounded mb-3">No active activities matching filters.</div>`;
    } else {
        finalHtml += `<div class="workspace-grid">${filtered.map(a => getCardHtml(a)).join('')}</div>`;
    }

    // Section 2: Recent Focus
    if (recentActs.length > 0) {
        finalHtml += `<div class="workspace-section-title">Recent Focus</div>`;
        finalHtml += `<div class="workspace-grid">${recentActs.map(a => getCardHtml(a, true)).join('')}</div>`;
    }

    // Section 3: Recommended Sprints
    if (recommendedActs.length > 0) {
        finalHtml += `<div class="workspace-section-title">Recommended Sprints</div>`;
        finalHtml += `<div class="workspace-grid">${recommendedActs.map(a => getCardHtml(a, true)).join('')}</div>`;
    }

    listEl.innerHTML = finalHtml;

    // Create Tooltip Overlay
    let cardTooltipEl = document.getElementById('card-preview-tooltip');
    if (!cardTooltipEl) {
        cardTooltipEl = document.createElement('div');
        cardTooltipEl.id = 'card-preview-tooltip';
        cardTooltipEl.style.position = 'fixed';
        cardTooltipEl.style.background = 'rgba(10, 12, 20, 0.96)';
        cardTooltipEl.style.border = '1px solid rgba(255, 255, 255, 0.1)';
        cardTooltipEl.style.color = '#fff';
        cardTooltipEl.style.padding = '10px 14px';
        cardTooltipEl.style.borderRadius = '8px';
        cardTooltipEl.style.fontSize = '10px';
        cardTooltipEl.style.pointerEvents = 'none';
        cardTooltipEl.style.zIndex = '99999';
        cardTooltipEl.style.display = 'none';
        cardTooltipEl.style.boxShadow = '0 10px 30px rgba(0,0,0,0.6)';
        cardTooltipEl.style.maxWidth = '260px';
        document.body.appendChild(cardTooltipEl);
    }

    // Bind Tooltip event listeners
    listEl.querySelectorAll('.workspace-activity-card').forEach(card => {
        card.addEventListener('mouseenter', (e) => {
            const id = parseInt(card.getAttribute('data-id'));
            const activity = loadedActivities.find(act => act.id === id);
            if (activity) {
                const tags = activity.tags ? activity.tags.split(',').map(t => `#${t.trim()}`).join(' ') : '#no-tags';
                const xp = calculateXpReward(activity.estimatedDuration);
                const prodRating = calculateProductivityRating(activity.id);
                cardTooltipEl.innerHTML = `
                    <div style="font-weight:800; margin-bottom:5px; color:${activity.colorCode || '#6366f1'}; font-size:11px;">${escHtml(activity.name)}</div>
                    <div style="margin-bottom:2px;"><strong style="color:var(--text-300);">Category:</strong> ${escHtml(activity.category)}</div>
                    <div style="margin-bottom:2px;"><strong style="color:var(--text-300);">Difficulty:</strong> ${escHtml(activity.difficulty)}</div>
                    <div style="margin-bottom:2px;"><strong style="color:var(--text-300);">Priority:</strong> ${escHtml(activity.priority)}</div>
                    <div style="margin-bottom:2px;"><strong style="color:var(--text-300);">Productivity:</strong> ${prodRating.label}</div>
                    <div style="margin-bottom:4px;"><strong style="color:var(--text-300);">Reward:</strong> <span style="color:#fbbf24; font-weight:700;">+${xp} XP</span></div>
                    <div style="color:rgba(255,255,255,0.4); font-size:9.5px; border-top:1px solid rgba(255,255,255,0.06); padding-top:4px;">${escHtml(tags)}</div>
                `;
                cardTooltipEl.style.display = 'block';
            }
        });
        card.addEventListener('mousemove', (e) => {
            cardTooltipEl.style.left = `${e.clientX + 14}px`;
            cardTooltipEl.style.top = `${e.clientY + 14}px`;
        });
        card.addEventListener('mouseleave', () => {
            cardTooltipEl.style.display = 'none';
        });
    });

    // Bind Card Selection Click
    listEl.querySelectorAll('.workspace-activity-card').forEach(card => {
        card.addEventListener('click', (e) => {
            if (e.target.closest('.dropdown') || e.target.closest('.dropdown-menu') || e.target.closest('.start-activity-btn') || e.target.closest('.live-session-toolbar') || e.target.closest('button')) {
                return;
            }
            const id = parseInt(card.getAttribute('data-id'));
            selectActivity(id);
        });
    });

    // Bind Favorite option clicks
    listEl.querySelectorAll('.fav-activity-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const id = parseInt(btn.getAttribute('data-id'));
            
            const cardEl = btn.closest('.workspace-activity-card');
            if (cardEl) {
                const starIcon = cardEl.querySelector('.fa-star');
                if (starIcon) {
                    gsap.fromTo(starIcon, { scale: 0.5, rotate: -45 }, { scale: 1.3, rotate: 0, duration: 0.3, ease: 'back.out(2)' });
                }
            }

            toggleFavoriteActivity(id);
        });
    });

    // Bind Edit option clicks
    listEl.querySelectorAll('.edit-activity-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const id = parseInt(btn.getAttribute('data-id'));
            startEditActivity(id);
        });
    });

    // Bind Delete option clicks
    listEl.querySelectorAll('.delete-activity-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const id = parseInt(btn.getAttribute('data-id'));
            handleDeleteActivity(id);
        });
    });

    // Bind Start Session clicks
    listEl.querySelectorAll('.start-activity-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const id = parseInt(btn.getAttribute('data-id'));
            
            gsap.fromTo(btn, { scale: 1 }, { scale: 0.8, duration: 0.15, yoyo: true, repeat: 1 });
            
            selectActivity(id);
            setTimeout(() => {
                startSession();
            }, 80);
        });
    });
}

// Select an Activity
function selectActivity(id) {
    if (focusTimerState !== 'IDLE') return; // Cannot switch activity while session running/paused

    activeActivityId = id;
    activeActivityData = loadedActivities.find(a => a.id === id);

    if (activeActivityData) {
        document.getElementById('activeTaskName').textContent = activeActivityData.name;
        document.getElementById('activeTaskCategory').textContent = 'Category: ' + activeActivityData.category;
        
        // Select matching or closest target duration
        const durationSelect = document.getElementById('sessionTargetDuration');
        if (durationSelect) {
            const targetSec = activeActivityData.estimatedDuration * 60;
            // Check if option exists
            let optionExists = false;
            for (let i = 0; i < durationSelect.options.length; i++) {
                if (parseInt(durationSelect.options[i].value) === targetSec) {
                    durationSelect.selectedIndex = i;
                    optionExists = true;
                    break;
                }
            }
            if (!optionExists) {
                // Create custom option
                const opt = document.createElement('option');
                opt.value = targetSec;
                opt.textContent = `${activeActivityData.estimatedDuration} Minutes (Custom Target)`;
                durationSelect.appendChild(opt);
                durationSelect.value = targetSec;
            }
            sessionTargetSeconds = targetSec;
        }

        // Live stats update
        document.getElementById('liveSessionGoalText').textContent = activeActivityData.estimatedDuration + 'm';
        document.getElementById('timerSessionXp').textContent = `+${Math.floor(sessionTargetSeconds / 60) * 4} XP`;
    }

    renderWorkspaceActivities(); // Re-render to highlight active border
}

// Delete Activity
async function handleDeleteActivity(id) {
    if (confirm('Are you sure you want to delete this activity?')) {
        try {
            await Api.deleteActivity(id);
            if (activeActivityId === id) {
                activeActivityId = null;
                activeActivityData = null;
                document.getElementById('activeTaskName').textContent = 'No Session Active';
                document.getElementById('activeTaskCategory').textContent = 'Category: None';
            }
            showToast('Activity deleted successfully.', 'success');
            await loadActivities();
        } catch(e) {
            console.error('Delete activity failed:', e);
            showToast('Could not delete activity.', 'error');
        }
    }
}

// Handle Form Submission for Create Activity
// Handle Form Submission for Create / Edit Activity
window.handleCreateActivity = async function() {
    const name = document.getElementById('actName').value.trim();
    const category = document.getElementById('actCategory').value;
    const duration = parseInt(document.getElementById('actDuration').value) || 25;
    
    // Read from the DOM advanced options
    const priority = document.getElementById('actPriority')?.value || 'MEDIUM';
    const difficulty = document.getElementById('actDifficulty')?.value || 'MEDIUM';
    const icon = document.getElementById('actIcon')?.value || 'fa-briefcase';
    const color = document.getElementById('actColor')?.value || '#6366f1';
    const tagsVal = (document.getElementById('actTags')?.value || '').trim();

    if (!name) return showToast('Please enter an activity name.', 'error');

    if (editingActivityId) {
        // Edit Mode
        try {
            await Api.updateActivity(editingActivityId, {
                name,
                category,
                colorCode: color,
                icon,
                difficulty,
                estimatedDuration: duration,
                priority,
                tags: tagsVal
            });
            showToast(`Activity "${name}" updated successfully!`, 'success');
            cancelEditActivity();
            await loadActivities();
        } catch(e) {
            console.error('Update activity failed:', e);
            showToast('Could not update activity.', 'error');
        }
        return;
    }

    // Create Mode
    try {
        const act = await Api.createActivity(name, color, icon, category, difficulty, duration, priority);
        showToast(`Activity "${name}" created!`, 'success');
        
        if (act && act.id && tagsVal) {
            try { await Api.updateActivityTags(act.id, tagsVal); } catch(e) { console.warn('Tags save failed:', e); }
        }

        // Reset form inputs & collapse
        document.getElementById('actName').value = '';
        if (document.getElementById('actTags')) {
            document.getElementById('actTags').value = '';
        }
        
        // Hide advanced options collapse if visible
        const collapseEl = document.getElementById('addActivityCollapse');
        if (collapseEl && collapseEl.classList.contains('show') && window.bootstrap) {
            const bsCollapse = bootstrap.Collapse.getInstance(collapseEl) || new bootstrap.Collapse(collapseEl, { toggle: false });
            bsCollapse.hide();
        }

        await loadActivities();
    } catch(e) {
        console.error('Create activity failed:', e);
        showToast('Could not create activity.', 'error');
    }
};

// Toggle the Favorites Filter on the Workspace Toolbar
window.toggleFavoriteFilter = function() {
    favoritesOnlyFilter = !favoritesOnlyFilter;
    const btn = document.getElementById('workspaceFavoriteFilterBtn');
    const icon = document.getElementById('favoriteFilterStarIcon');
    if (btn && icon) {
        if (favoritesOnlyFilter) {
            btn.style.background = 'rgba(245, 158, 11, 0.15)';
            btn.style.borderColor = 'rgba(245, 158, 11, 0.3)';
            icon.className = 'fa-solid fa-star text-warning';
        } else {
            btn.style.background = 'none';
            btn.style.borderColor = 'var(--border-glass)';
            icon.className = 'fa-solid fa-star';
        }
    }
    renderWorkspaceActivities();
};

// Start the Edit Activity inline-form flow
window.startEditActivity = function(id) {
    const act = loadedActivities.find(a => a.id === id);
    if (!act) return;

    editingActivityId = id;

    // Show the collapse form if it's hidden
    const collapseEl = document.getElementById('addActivityCollapse');
    if (collapseEl && !collapseEl.classList.contains('show') && window.bootstrap) {
        const bsCollapse = bootstrap.Collapse.getInstance(collapseEl) || new bootstrap.Collapse(collapseEl);
        bsCollapse.show();
    }

    // Set form title and pre-fill input values
    const formTitle = document.getElementById('createActivityFormTitle');
    if (formTitle) formTitle.innerHTML = '<i class="fa-solid fa-pen text-warning"></i> Edit Activity';

    const submitBtn = document.getElementById('createActivitySubmitBtn');
    if (submitBtn) {
        submitBtn.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Save Changes';
        submitBtn.className = 'btn btn-warning btn-sm w-100 justify-content-center mt-2';
    }

    // Add a cancel button if not already present
    let cancelBtn = document.getElementById('createActivityCancelBtn');
    if (!cancelBtn && submitBtn) {
        cancelBtn = document.createElement('button');
        cancelBtn.id = 'createActivityCancelBtn';
        cancelBtn.type = 'button';
        cancelBtn.className = 'btn btn-outline-secondary btn-sm w-100 justify-content-center mt-1';
        cancelBtn.innerHTML = '<i class="fa-solid fa-xmark"></i> Cancel';
        cancelBtn.onclick = () => cancelEditActivity();
        submitBtn.parentNode.appendChild(cancelBtn);
    }

    // Fill elements
    document.getElementById('actName').value = act.name;
    document.getElementById('actCategory').value = act.category;
    document.getElementById('actDuration').value = act.estimatedDuration;
    
    // Fill advanced options
    if (document.getElementById('actPriority')) document.getElementById('actPriority').value = act.priority;
    if (document.getElementById('actDifficulty')) document.getElementById('actDifficulty').value = act.difficulty;
    if (document.getElementById('actIcon')) document.getElementById('actIcon').value = act.icon || 'fa-briefcase';
    if (document.getElementById('actColor')) document.getElementById('actColor').value = act.colorCode || '#6366f1';
    if (document.getElementById('actTags')) document.getElementById('actTags').value = act.tags || '';
    
    // Scroll form into view
    const quickCreateCard = document.getElementById('actName').closest('.glass-card');
    if (quickCreateCard) quickCreateCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
};

// Cancel the editing flow and reset to Create Mode
window.cancelEditActivity = function() {
    editingActivityId = null;
    
    const formTitle = document.getElementById('createActivityFormTitle');
    if (formTitle) formTitle.innerHTML = '<i class="fa-solid fa-plus-circle text-primary-lt"></i> Create Activity';

    const submitBtn = document.getElementById('createActivitySubmitBtn');
    if (submitBtn) {
        submitBtn.innerHTML = '<i class="fa-solid fa-check"></i> Create Activity';
        submitBtn.className = 'btn btn-primary btn-sm w-100 justify-content-center mt-2';
    }

    const cancelBtn = document.getElementById('createActivityCancelBtn');
    if (cancelBtn) {
        cancelBtn.remove();
    }

    // Clear form
    document.getElementById('actName').value = '';
    document.getElementById('actCategory').value = 'CUSTOM';
    document.getElementById('actDuration').value = '25';
    if (document.getElementById('actTags')) document.getElementById('actTags').value = '';
    
    // Advanced options back to defaults
    if (document.getElementById('actPriority')) document.getElementById('actPriority').value = 'MEDIUM';
    if (document.getElementById('actDifficulty')) document.getElementById('actDifficulty').value = 'MEDIUM';
    if (document.getElementById('actIcon')) document.getElementById('actIcon').value = 'fa-briefcase';
    if (document.getElementById('actColor')) document.getElementById('actColor').value = '#6366f1';
    
    // Hide collapse
    const collapseEl = document.getElementById('addActivityCollapse');
    if (collapseEl && collapseEl.classList.contains('show') && window.bootstrap) {
        const bsCollapse = bootstrap.Collapse.getInstance(collapseEl) || new bootstrap.Collapse(collapseEl, { toggle: false });
        bsCollapse.hide();
    }
};

// 3. Focus Session Controls & Life Cycle
function updateRing(elapsedSec) {
    const progress = elapsedSec / sessionTargetSeconds;
    const offset = RING_CIRC * (1 - Math.min(progress, 1));
    const ring = document.getElementById('timerRingProgress');
    if (ring) ring.style.strokeDashoffset = offset;
}

function startInterval() {
    if (timerInterval) clearInterval(timerInterval);

    timerInterval = setInterval(() => {
        const elapsed = elapsedBeforePause + Math.floor((Date.now() - timerStart) / 1000);
        
        // Update display text
        const displayEl = document.getElementById('timerDisplay');
        if (displayEl) displayEl.textContent = formatTime(elapsed);

        // Update progress ring
        updateRing(elapsed);

        // Live focus score telemetry calculation
        let score = 100 - (pauseCount * 10);
        if (isDeepWorkMode && pauseCount === 0) {
            score += 10;
        }
        score = Math.max(0, Math.min(100, score));
        const focusScoreEl = document.getElementById('liveFocusScore');
        if (focusScoreEl) focusScoreEl.textContent = `${score}%`;

        // Live Productivity Rating based on score
        const liveProductivityRatingEl = document.getElementById('liveProductivityRating');
        if (liveProductivityRatingEl) {
            let rating = "Low";
            if (score >= 90) rating = "Optimal";
            else if (score >= 75) rating = "Good";
            else if (score >= 50) rating = "Neutral";
            liveProductivityRatingEl.textContent = rating;
            liveProductivityRatingEl.className = `fw-bold ${score >= 90 ? 'text-success' : score >= 75 ? 'text-info' : score >= 50 ? 'text-warning' : 'text-danger'}`;
        }

        // Live estimated completion time calculation
        const remainingSec = Math.max(0, sessionTargetSeconds - elapsed);
        const targetTime = new Date(Date.now() + remainingSec * 1000);
        const estCompletionEl = document.getElementById('estCompletionTime');
        if (estCompletionEl) {
            estCompletionEl.textContent = targetTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        }

        // Remaining Time Countdown
        const remainingEl = document.getElementById('liveRemainingTime');
        if (remainingEl) {
            remainingEl.textContent = formatTime(remainingSec);
        }

        // Live XP reward display
        const earnedXp = Math.floor(elapsed / 60) * 4;
        const xpEl = document.getElementById('timerSessionXp');
        if (xpEl) xpEl.textContent = `+${earnedXp} XP`;

        // Pauses Count
        const pausesEl = document.getElementById('livePausesCount');
        if (pausesEl) pausesEl.textContent = pauseCount;

        // Session Goal Text
        const goalEl = document.getElementById('liveSessionGoalText');
        if (goalEl) goalEl.textContent = `${Math.round(sessionTargetSeconds / 60)}m`;

        // Update active card progress bar
        if (activeActivityId) {
            const pct = Math.min(100, Math.round((elapsed / sessionTargetSeconds) * 100)) || 0;
            const bar = document.getElementById(`cardProgressBar-${activeActivityId}`);
            if (bar) {
                bar.style.width = `${pct}%`;
            }
        }

        // Deep Work Mode status
        const deepWorkStatusEl = document.getElementById('liveDeepWorkStatus');
        if (deepWorkStatusEl) {
            deepWorkStatusEl.textContent = isDeepWorkMode ? 'Active 🔴' : 'Disabled';
            deepWorkStatusEl.className = `fw-bold ${isDeepWorkMode ? 'text-danger animate-pulse' : 'text-muted'}`;
        }

    }, 1000);
}

window.startSession = async function() {
    if (!activeActivityId) return showToast('Please select an activity from the Workspace first!', 'error');

    sessionTargetSeconds = parseInt(document.getElementById('sessionTargetDuration').value) || 1500;
    isDeepWorkMode = document.getElementById('deepWorkModeToggle').checked;

    try {
        const session = await Api.startSession(activeActivityId, sessionTargetSeconds, isDeepWorkMode);
        currentSessionId = session.id;
        timerStart = Date.now();
        elapsedBeforePause = 0;
        isTimerPaused = false;
        focusTimerState = 'ACTIVE';
        pauseCount = 0;

        // Persist session state for crash recovery
        localStorage.setItem('timer_session_id', currentSessionId);
        localStorage.setItem('timer_start', timerStart);
        localStorage.setItem('timer_elapsed_before_pause', elapsedBeforePause);
        localStorage.setItem('timer_activity_id', activeActivityId);
        localStorage.setItem('timer_target_seconds', sessionTargetSeconds);
        localStorage.setItem('timer_deep_work_mode', isDeepWorkMode ? 'true' : 'false');
        localStorage.setItem('timer_is_paused', 'false');
        localStorage.setItem('timer_pause_count', '0');

        // UI toggles
        document.getElementById('startBtn').classList.add('hidden');
        document.getElementById('pauseBtn').classList.remove('hidden');
        document.getElementById('stopBtn').classList.remove('hidden');
        document.getElementById('endBtn').classList.remove('hidden');
        document.getElementById('targetDurationSelection').classList.add('hidden');

        // Status badge
        document.getElementById('timerStatus').innerHTML = '<span class="status-dot-sm" style="background:var(--success); box-shadow:0 0 6px var(--success);"></span> Focusing';

        // Deep Work Styling
        if (isDeepWorkMode) {
            document.getElementById('focusSessionCard').classList.add('deep-work-active');
        }

        startInterval();
        showToast('Deep Work session initiated. Eliminate distractions! 🧠', 'success');

        // GSAP animate
        gsap.fromTo('.timer-face', { scale: 0.8 }, { scale: 1, duration: 0.4, ease: 'back.out(1.7)' });
        
        renderWorkspaceActivities(); // Sync activity card state to active
    } catch(e) {
        console.error('Start session failed:', e);
        showToast('Could not start focus session.', 'error');
    }
};

window.pauseSession = async function() {
    if (!currentSessionId) return;

    try {
        await Api.pauseSession(currentSessionId);
        
        clearInterval(timerInterval);
        elapsedBeforePause += Math.floor((Date.now() - timerStart) / 1000);
        isTimerPaused = true;
        focusTimerState = 'PAUSED';
        pauseCount++;

        // Update storage
        localStorage.setItem('timer_elapsed_before_pause', elapsedBeforePause);
        localStorage.setItem('timer_is_paused', 'true');
        localStorage.setItem('timer_pause_count', pauseCount);

        // UI
        document.getElementById('pauseBtn').classList.add('hidden');
        document.getElementById('resumeBtn').classList.remove('hidden');
        document.getElementById('timerStatus').innerHTML = '<span class="status-dot-sm" style="background:var(--warning); box-shadow:0 0 6px var(--warning);"></span> Paused';

        showToast('Session paused.', 'info');
        
        renderWorkspaceActivities(); // Sync activity card state to paused
    } catch(e) {
        console.error('Pause session failed:', e);
        showToast('Could not pause session.', 'error');
    }
};

window.resumeSession = async function() {
    if (!currentSessionId) return;

    try {
        await Api.resumeSession(currentSessionId);

        timerStart = Date.now();
        isTimerPaused = false;
        focusTimerState = 'ACTIVE';

        // Update storage
        localStorage.setItem('timer_start', timerStart);
        localStorage.setItem('timer_is_paused', 'false');

        // UI
        document.getElementById('resumeBtn').classList.add('hidden');
        document.getElementById('pauseBtn').classList.remove('hidden');
        document.getElementById('timerStatus').innerHTML = '<span class="status-dot-sm" style="background:var(--success); box-shadow:0 0 6px var(--success);"></span> Focusing';

        startInterval();
        showToast('Resuming deep work state.', 'success');
        
        renderWorkspaceActivities(); // Sync activity card state to active
    } catch(e) {
        console.error('Resume session failed:', e);
        showToast('Could not resume session.', 'error');
    }
};

window.endSession = function() {
    clearInterval(timerInterval);

    // Show confirm panel
    document.getElementById('pauseBtn').classList.add('hidden');
    document.getElementById('resumeBtn').classList.add('hidden');
    document.getElementById('stopBtn').classList.add('hidden');
    document.getElementById('endBtn').classList.add('hidden');
    document.getElementById('confirmPanel').classList.remove('hidden');

    document.getElementById('timerStatus').innerHTML = '<span class="status-dot-sm" style="background:var(--info); box-shadow:0 0 6px var(--info);"></span> Log Reflection';

    gsap.fromTo('#confirmPanel', { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: 0.4, ease: 'power2.out' });
    
    renderWorkspaceActivities(); // Re-render to show active session reflecting logs state
};

window.cancelEnd = function() {
    document.getElementById('confirmPanel').classList.add('hidden');
    document.getElementById('endBtn').classList.remove('hidden');
    document.getElementById('stopBtn').classList.remove('hidden');

    if (isTimerPaused) {
        document.getElementById('resumeBtn').classList.remove('hidden');
        document.getElementById('timerStatus').innerHTML = '<span class="status-dot-sm" style="background:var(--warning); box-shadow:0 0 6px var(--warning);"></span> Paused';
    } else {
        document.getElementById('pauseBtn').classList.remove('hidden');
        document.getElementById('timerStatus').innerHTML = '<span class="status-dot-sm" style="background:var(--success); box-shadow:0 0 6px var(--success);"></span> Focusing';
        startInterval();
    }
    
    renderWorkspaceActivities();
};

window.confirmEnd = async function() {
    const isPomoChecked = document.getElementById('isPomodoro').checked;
    const notesVal = document.getElementById('sessionNotes').value;
    const savedActiveActivityId = activeActivityId;

    try {
        const result = await Api.completeSession(currentSessionId, isPomoChecked, notesVal);

        // XP Animation
        gsap.fromTo('.timer-face', { scale: 1 }, {
            scale: 1.25, yoyo: true, repeat: 1, duration: 0.3, ease: 'power1.inOut'
        });

        // Trigger floating reward xp points
        const earnedXp = result.earnedXp || 0;
        showToast(`🎉 Session complete! +${earnedXp} XP earned!`, 'success', 5000);

        // Trigger floating reward XP points at the active card
        if (savedActiveActivityId) {
            const cardEl = document.querySelector(`.workspace-activity-card[data-id="${savedActiveActivityId}"]`);
            if (cardEl) {
                const rect = cardEl.getBoundingClientRect();
                window.showFloatingXp(rect.left + rect.width / 2, rect.top + rect.height / 2, earnedXp);
            } else {
                window.showFloatingXp(window.innerWidth / 2, window.innerHeight / 2, earnedXp);
            }
        } else {
            window.showFloatingXp(window.innerWidth / 2, window.innerHeight / 2, earnedXp);
        }

        // Trigger Confetti explosion
        window.triggerConfetti();

        // Reset state
        currentSessionId = null;
        timerStart = null;
        elapsedBeforePause = 0;
        isTimerPaused = false;
        focusTimerState = 'IDLE';
        activeActivityId = null;
        activeActivityData = null;
        pauseCount = 0;

        // Clear storage
        localStorage.removeItem('timer_session_id');
        localStorage.removeItem('timer_start');
        localStorage.removeItem('timer_elapsed_before_pause');
        localStorage.removeItem('timer_activity_id');
        localStorage.removeItem('timer_target_seconds');
        localStorage.removeItem('timer_deep_work_mode');
        localStorage.removeItem('timer_is_paused');
        localStorage.removeItem('timer_pause_count');

        // Reset UI
        document.getElementById('confirmPanel').classList.add('hidden');
        document.getElementById('startBtn').classList.remove('hidden');
        document.getElementById('pauseBtn').classList.add('hidden');
        document.getElementById('resumeBtn').classList.add('hidden');
        document.getElementById('stopBtn').classList.add('hidden');
        document.getElementById('endBtn').classList.add('hidden');
        document.getElementById('targetDurationSelection').classList.remove('hidden');
        
        document.getElementById('timerDisplay').textContent = '00:00:00';
        document.getElementById('timerRingProgress').style.strokeDashoffset = RING_CIRC;
        document.getElementById('timerStatus').innerHTML = '<span class="status-dot-sm"></span> Ready';
        
        document.getElementById('activeTaskName').textContent = 'No Session Active';
        document.getElementById('activeTaskCategory').textContent = 'Category: None';
        document.getElementById('focusSessionCard').classList.remove('deep-work-active');

        // Reset telemetry labels
        document.getElementById('liveFocusScore').textContent = '100%';
        document.getElementById('liveProductivityRating').textContent = 'Optimal';
        document.getElementById('liveProductivityRating').className = 'fw-bold text-success';
        document.getElementById('liveRemainingTime').textContent = '25:00';
        document.getElementById('timerSessionXp').textContent = '+0 XP';
        document.getElementById('livePausesCount').textContent = '0';

        document.getElementById('isPomodoro').checked = false;
        document.getElementById('sessionNotes').value = '';

        // Refresh stats
        await loadTimerAnalytics();
        await loadTimerTimeline(0);
        await loadDashboard(); // sync global levels & stats
        renderWorkspaceActivities(); // Refresh activities to reset state
    } catch(e) {
        console.error('End session failed:', e);
        showToast('Could not complete session log.', 'error');
    }
};

window.popOutTimer = function() {
    const w = 340, h = 300;
    const left = (screen.width/2)-(w/2);
    const top = (screen.height/2)-(h/2);
    window.open('/timer-popout.html', 'FocusAITimer', `width=${w},height=${h},top=${top},left=${left},status=no,menubar=no,toolbar=no,location=no`);
};

window.stopSessionEarly = async function() {
    if (!currentSessionId) return;

    if (!confirm("Are you sure you want to stop this deep focus session early? You will only receive partial focus duration and XP.")) {
        return;
    }

    clearInterval(timerInterval);

    try {
        const result = await Api.stopSession(currentSessionId);
        showToast(`Focus session stopped. Received +${result.earnedXp || 0} XP.`, 'info');

        // Reset state
        currentSessionId = null;
        timerStart = null;
        elapsedBeforePause = 0;
        isTimerPaused = false;
        focusTimerState = 'IDLE';
        activeActivityId = null;
        activeActivityData = null;
        pauseCount = 0;

        // Clear storage
        localStorage.removeItem('timer_session_id');
        localStorage.removeItem('timer_start');
        localStorage.removeItem('timer_elapsed_before_pause');
        localStorage.removeItem('timer_activity_id');
        localStorage.removeItem('timer_target_seconds');
        localStorage.removeItem('timer_deep_work_mode');
        localStorage.removeItem('timer_is_paused');
        localStorage.removeItem('timer_pause_count');

        // Reset UI
        document.getElementById('startBtn').classList.remove('hidden');
        document.getElementById('pauseBtn').classList.add('hidden');
        document.getElementById('resumeBtn').classList.add('hidden');
        document.getElementById('stopBtn').classList.add('hidden');
        document.getElementById('endBtn').classList.add('hidden');
        document.getElementById('targetDurationSelection').classList.remove('hidden');
        
        document.getElementById('timerDisplay').textContent = '00:00:00';
        document.getElementById('timerRingProgress').style.strokeDashoffset = RING_CIRC;
        document.getElementById('timerStatus').innerHTML = '<span class="status-dot-sm"></span> Ready';
        
        document.getElementById('activeTaskName').textContent = 'No Session Active';
        document.getElementById('activeTaskCategory').textContent = 'Category: None';
        document.getElementById('focusSessionCard').classList.remove('deep-work-active');

        // Reset telemetry labels
        document.getElementById('liveFocusScore').textContent = '100%';
        document.getElementById('liveProductivityRating').textContent = 'Optimal';
        document.getElementById('liveProductivityRating').className = 'fw-bold text-success';
        document.getElementById('liveRemainingTime').textContent = '25:00';
        document.getElementById('timerSessionXp').textContent = '+0 XP';
        document.getElementById('livePausesCount').textContent = '0';

        // Refresh stats
        await loadTimerAnalytics();
        await loadTimerTimeline(0);
        await loadDashboard(); // sync global levels & stats
        renderWorkspaceActivities(); // Sync activity card representation back to idle
    } catch(e) {
        console.error('Stop session failed:', e);
        showToast('Could not stop focus session.', 'error');
    }
};

window.applyTemplate = async function(name, category, icon, priority, duration, difficulty) {
    try {
        const act = await Api.createActivity(name, '#6366f1', icon, category, difficulty, duration, priority);
        showToast(`Activity created from template: ${name}!`, 'success');
        // Save tags for this activity via backend
        const tags = name.toLowerCase().split(' ');
        try { await Api.updateActivityTags(act.id, tags.join(', ')); } catch(e) { console.warn('Tags save failed:', e); }
        
        // Auto-select the newly created activity
        await loadActivities();
        selectActivity(act.id);
        
        // Auto-close collapse if open
        const collapseEl = document.getElementById('addActivityCollapse');
        if (collapseEl && collapseEl.classList.contains('show')) {
            bootstrap.Collapse.getInstance(collapseEl).hide();
        }
    } catch(e) {
        console.error(e);
        showToast('Failed to create activity from template.', 'error');
    }
};

let currentQuickFilter = 'all';
window.setQuickFilter = function(filter) {
    currentQuickFilter = filter;
    
    // Toggle active classes on quick filter buttons
    const filterIds = {
        'all': 'quickFilterAll',
        'favorites': 'quickFilterFavs',
        'high': 'quickFilterHigh',
        'recent': 'quickFilterRecent'
    };
    
    Object.keys(filterIds).forEach(k => {
        const btn = document.getElementById(filterIds[k]);
        if (btn) {
            if (k === filter) {
                btn.classList.add('active');
                btn.classList.remove('btn-outline-primary');
                btn.classList.add('btn-primary-lt');
            } else {
                btn.classList.remove('active');
                btn.classList.add('btn-outline-primary');
                btn.classList.remove('btn-primary-lt');
            }
        }
    });
    
    renderWorkspaceActivities();
};

window.toggleFavoriteActivity = async function(activityId, event) {
    if (event) event.stopPropagation(); // prevent selecting card
    try {
        const result = await Api.toggleFavoriteActivity(activityId);
        showToast(result.message || (result.isFavorite ? 'Added to favorites' : 'Removed from favorites'), result.isFavorite ? 'success' : 'info');
        // Update local cache
        const act = loadedActivities.find(a => a.id === activityId);
        if (act) act.isFavorite = result.isFavorite;
        renderWorkspaceActivities();
    } catch(e) {
        console.error('Toggle favorite failed:', e);
        showToast('Could not update favorite status.', 'error');
    }
};

function isFavorite(activityId) {
    const act = loadedActivities.find(a => a.id === activityId);
    return act ? Boolean(act.isFavorite) : false;
}

// 4. Load & Resume Crash Recovery State
async function resumeTimerIfAny() {
    const savedId = localStorage.getItem('timer_session_id');
    const savedStart = localStorage.getItem('timer_start');
    const savedElapsed = localStorage.getItem('timer_elapsed_before_pause');
    const savedActId = localStorage.getItem('timer_activity_id');
    const savedTarget = localStorage.getItem('timer_target_seconds');
    const savedDeep = localStorage.getItem('timer_deep_work_mode');
    const savedIsPaused = localStorage.getItem('timer_is_paused');
    const savedPauseCount = localStorage.getItem('timer_pause_count');

    if (savedId && savedActId) {
        currentSessionId = savedId;
        activeActivityId = parseInt(savedActId);
        sessionTargetSeconds = parseInt(savedTarget) || 1500;
        isDeepWorkMode = savedDeep === 'true';
        elapsedBeforePause = parseInt(savedElapsed) || 0;
        isTimerPaused = savedIsPaused === 'true';
        pauseCount = parseInt(savedPauseCount) || 0;

        // Fetch/populate activities first
        await loadActivities();

        activeActivityData = loadedActivities.find(a => a.id === activeActivityId);
        if (activeActivityData) {
            document.getElementById('activeTaskName').textContent = activeActivityData.name;
            document.getElementById('activeTaskCategory').textContent = 'Category: ' + activeActivityData.category;
            
            // Set Target Duration value
            const durationSelect = document.getElementById('sessionTargetDuration');
            if (durationSelect) {
                // Ensure value exists in options
                let exists = false;
                for (let i = 0; i < durationSelect.options.length; i++) {
                    if (parseInt(durationSelect.options[i].value) === sessionTargetSeconds) {
                        durationSelect.selectedIndex = i;
                        exists = true;
                        break;
                    }
                }
                if (!exists) {
                    const opt = document.createElement('option');
                    opt.value = sessionTargetSeconds;
                    opt.textContent = `${Math.round(sessionTargetSeconds / 60)} Minutes (Restored)`;
                    durationSelect.appendChild(opt);
                    durationSelect.value = sessionTargetSeconds;
                }
            }
        }

        // Toggles
        document.getElementById('deepWorkModeToggle').checked = isDeepWorkMode;
        if (isDeepWorkMode) {
            document.getElementById('focusSessionCard').classList.add('deep-work-active');
        }

        document.getElementById('startBtn').classList.add('hidden');
        document.getElementById('targetDurationSelection').classList.add('hidden');
        document.getElementById('endBtn').classList.remove('hidden');

        if (isTimerPaused) {
            focusTimerState = 'PAUSED';
            document.getElementById('resumeBtn').classList.remove('hidden');
            document.getElementById('timerStatus').innerHTML = '<span class="status-dot-sm" style="background:var(--warning); box-shadow:0 0 6px var(--warning);"></span> Paused';
            
            // Update display values statically
            document.getElementById('timerDisplay').textContent = formatTime(elapsedBeforePause);
            updateRing(elapsedBeforePause);
        } else {
            focusTimerState = 'ACTIVE';
            timerStart = parseInt(savedStart) || Date.now();
            document.getElementById('pauseBtn').classList.remove('hidden');
            document.getElementById('timerStatus').innerHTML = '<span class="status-dot-sm" style="background:var(--success); box-shadow:0 0 6px var(--success);"></span> Focusing';

            startInterval();
        }
        
        showToast('Resumed active Deep Work session. ⏱️', 'info');
    }
}

// 5. Timer Analytics & Charts Rendering
async function loadTimerAnalytics() {
    try {
        const [data, dash] = await Promise.all([
            Api.getTimerAnalytics(),
            Api.getDashboard()
        ]);
        if (!data || !dash) return;

        // Populate KPIs
        const todayMins = data.focusTimeTodayMinutes || 0;
        const todayHrs = Math.floor(todayMins / 60);
        const todayRemMins = Math.round(todayMins % 60);
        document.getElementById('analyticsTotalToday').textContent = todayHrs > 0 ? `${todayHrs}h ${todayRemMins}m` : `${todayRemMins}m`;

        document.getElementById('analyticsWeeklyHours').textContent = `${data.weeklyFocusHours || 0.0}h`;

        const monthMins = data.monthlyFocusMinutes || 0;
        const monthHrs = Math.floor(monthMins / 60);
        const monthRemMins = Math.round(monthMins % 60);
        document.getElementById('analyticsMonthlyProductivity').textContent = monthHrs > 0 ? `${monthHrs}h ${monthRemMins}m` : `${monthRemMins}m`;

        document.getElementById('analyticsCompletedSessions').textContent = `${data.completedSessionsCount || 0} sessions`;
        document.getElementById('analyticsBestStreak').textContent = `${data.bestStreak || 0} days`;
        document.getElementById('analyticsAvgDuration').textContent = `${Math.round(data.averageSessionLengthMinutes || 0)}m`;

        // Productivity and Consistency Scores
        const productivityScoreEl = document.getElementById('analyticsProductivityScore');
        if (productivityScoreEl) {
            productivityScoreEl.textContent = `${data.productivityScore || 0.0}%`;
        }
        const consistencyScoreEl = document.getElementById('analyticsConsistencyScore');
        if (consistencyScoreEl) {
            consistencyScoreEl.textContent = `${data.focusConsistencyScore || 0.0}%`;
        }

        // AI Coaching Insight (uses briefing coaching recommendations)
        const briefing = dash.briefing || {};
        document.getElementById('analyticsAiRecommendation').textContent = briefing.coachingRecommendations || data.aiRecommendation || 'No Coaching updates.';

        // Smart Break Advisor
        document.getElementById('analyticsBreakSuggestion').textContent = data.breakRecommendation || 'Ready for action. Flow coaching break times are dynamically computed after session completions.';

        // Render Charts
        renderAnalyticsCharts(data);
    } catch(e) {
        console.error('Load timer analytics failed:', e);
    }
}

function renderAnalyticsCharts(data) {
    // 1. Weekly Focus Trend Bar Chart
    const trendCtx = document.getElementById('analyticsFocusTrendChart');
    if (trendCtx) {
        if (analyticsFocusTrendChartInstance) {
            analyticsFocusTrendChartInstance.destroy();
        }

        const labels = Object.keys(data.weeklyFocusTrend || {});
        const values = Object.values(data.weeklyFocusTrend || {});

        analyticsFocusTrendChartInstance = new Chart(trendCtx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Minutes Focused',
                    data: values,
                    backgroundColor: '#06b6d4', // cyan matching theme
                    borderRadius: 4,
                    borderWidth: 0
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        backgroundColor: 'rgba(14,16,24,0.95)',
                        borderColor: 'rgba(255,255,255,0.05)',
                        borderWidth: 1
                    }
                },
                scales: {
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
                }
            }
        });
    }

    // 2. Category Split Doughnut Chart
    const catCtx = document.getElementById('analyticsCategoryChart');
    if (catCtx) {
        if (analyticsCategoryChartInstance) {
            analyticsCategoryChartInstance.destroy();
        }

        const labels = Object.keys(data.categoryDistribution || {});
        const values = Object.values(data.categoryDistribution || {});

        if (labels.length === 0) {
            // Draw empty placeholder donut
            analyticsCategoryChartInstance = new Chart(catCtx, {
                type: 'doughnut',
                data: {
                    labels: ['No Data'],
                    datasets: [{
                        data: [1],
                        backgroundColor: ['rgba(255,255,255,0.05)'],
                        borderWidth: 0
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { display: false } },
                    cutout: '70%'
                }
            });
        } else {
            analyticsCategoryChartInstance = new Chart(catCtx, {
                type: 'doughnut',
                data: {
                    labels: labels,
                    datasets: [{
                        data: values,
                        backgroundColor: ['#6366f1', '#06b6d4', '#10b981', '#a855f7', '#f59e0b', '#ec4899', '#3b82f6', '#475569'],
                        borderWidth: 0,
                        borderRadius: 3
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { display: false },
                        tooltip: {
                            backgroundColor: 'rgba(14,16,24,0.95)',
                            borderColor: 'rgba(255,255,255,0.05)',
                            borderWidth: 1
                        }
                    },
                    cutout: '70%'
                }
            });
        }
    }
}

// 6. Paginated & Filterable Timeline
async function loadTimerTimeline(page = 0) {
    try {
        timelineSessions = await Api.getAllSessions();
        timelinePage = page;
        renderTimelineTable();
    } catch(e) {
        console.error('Load sessions timeline failed:', e);
    }
}

function renderTimelineTable() {
    const tableBody = document.getElementById('timerTimelineTableBody');
    if (!tableBody) return;

    const query = (document.getElementById('timerTimelineSearch')?.value || '').toLowerCase().trim();
    const category = document.getElementById('timerTimelineCategoryFilter')?.value || '';
    const sortDir = document.getElementById('timerTimelineSortOrder')?.value || 'DESC';

    // 1. Filter
    let filtered = timelineSessions.filter(s => {
        const activityName = s.activity ? s.activity.name.toLowerCase() : 'unknown';
        const matchesSearch = activityName.includes(query);
        const matchesCat = !category || (s.activity && s.activity.category === category);
        return matchesSearch && matchesCat;
    });

    // 2. Sort
    filtered.sort((a, b) => {
        const dateA = parseSessionDate(a.startTime);
        const dateB = parseSessionDate(b.startTime);
        return sortDir === 'ASC' ? dateA - dateB : dateB - dateA;
    });

    // 3. Paginate
    const totalPages = Math.ceil(filtered.length / TIMELINE_PAGE_SIZE) || 1;
    if (timelinePage >= totalPages) timelinePage = totalPages - 1;
    if (timelinePage < 0) timelinePage = 0;

    const pageIndicator = document.getElementById('timerTimelinePageIndicator');
    if (pageIndicator) {
        pageIndicator.textContent = `Page ${timelinePage + 1} of ${totalPages} (${filtered.length} total logs)`;
    }

    const prevBtn = document.getElementById('timerTimelinePrevPage');
    const nextBtn = document.getElementById('timerTimelineNextPage');
    if (prevBtn) prevBtn.disabled = timelinePage === 0;
    if (nextBtn) nextBtn.disabled = timelinePage >= totalPages - 1;

    const startIdx = timelinePage * TIMELINE_PAGE_SIZE;
    const paginated = filtered.slice(startIdx, startIdx + TIMELINE_PAGE_SIZE);

    if (paginated.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="11" class="text-center p-4 text-muted small">No deep work logs resolved.</td></tr>';
        return;
    }

    const parseTimeOnly = (dateTimeStr) => {
        if (!dateTimeStr) return '-';
        try {
            const date = new Date(dateTimeStr);
            return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
        } catch(e) {
            return '-';
        }
    };
    const parseDateOnly = (dateTimeStr) => {
        if (!dateTimeStr) return '-';
        try {
            const date = new Date(dateTimeStr);
            return date.toISOString().split('T')[0];
        } catch(e) {
            return '-';
        }
    };

    tableBody.innerHTML = paginated.map(s => {
        const activeSecs = s.durationSeconds || 0;
        const mins = Math.floor(activeSecs / 60);
        const secs = activeSecs % 60;
        const durationStr = mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
        const color = s.activity ? s.activity.colorCode : '#ccc';
        const actName = s.activity ? s.activity.name : 'Unknown';
        const cat = s.activity ? s.activity.category : 'CUSTOM';
        
        let productivityRating = "Poor";
        let ratingClass = "bg-danger-subtle text-danger";
        if (s.focusScore >= 90) {
            productivityRating = "Optimal";
            ratingClass = "bg-success-subtle text-success";
        } else if (s.focusScore >= 75) {
            productivityRating = "Good";
            ratingClass = "bg-info-subtle text-info";
        } else if (s.focusScore >= 50) {
            productivityRating = "Neutral";
            ratingClass = "bg-warning-subtle text-warning";
        }

        let statusClass = "bg-success-subtle text-success";
        if (s.status === 'PAUSED') statusClass = "bg-warning-subtle text-warning";
        else if (s.status === 'STOPPED') statusClass = "bg-danger-subtle text-danger";
        else if (s.status === 'ACTIVE') statusClass = "bg-info-subtle text-info";

        return `
            <tr class="timeline-row-summary" data-id="${s.id}" style="cursor: pointer;">
                <td>
                    <div class="d-flex align-items-center gap-2">
                        <span style="display:inline-block; width:8px; height:8px; border-radius:50%; background:${color}; flex-shrink:0;"></span>
                        <span class="fw-bold text-light" style="word-break: break-all; white-space: normal;" title="${escHtml(actName)}">${escHtml(actName)}</span>
                    </div>
                </td>
                <td><span class="badge" style="background: rgba(255,255,255,0.03); color: var(--text-300); border: 1px solid rgba(255,255,255,0.08);">${escHtml(cat)}</span></td>
                <td style="font-family: var(--font-mono); font-size: 11px; color:var(--text-300);">${parseTimeOnly(s.startTime)}</td>
                <td style="font-family: var(--font-mono); font-size: 11px; color:var(--text-300);">${parseTimeOnly(s.endTime)}</td>
                <td style="font-family: var(--font-mono); font-size: 11px; color:var(--text-200);">${durationStr}</td>
                <td>
                    <div class="d-flex align-items-center gap-2">
                        <div class="progress" style="width: 42px; height: 4px; background: rgba(255,255,255,0.05); border-radius:2px; overflow:hidden;">
                            <div class="progress-bar ${s.focusScore >= 80 ? 'bg-success' : s.focusScore >= 50 ? 'bg-warning' : 'bg-danger'}" style="width: ${s.focusScore || 0}%;"></div>
                        </div>
                        <span style="font-family: var(--font-mono); font-size: 10px; color:var(--text-200);">${s.focusScore || 0}%</span>
                    </div>
                </td>
                <td class="text-success font-monospace" style="font-size: 11px; font-weight: bold;">+${s.earnedXp || 0} XP</td>
                <td>
                    <span class="badge ${ratingClass}" style="font-size: 9px; padding: 2px 6px; border: 1px solid currentColor; background:none;">
                        ${productivityRating}
                    </span>
                </td>
                <td>
                    <span class="badge ${statusClass}" style="font-size: 9px; padding: 2px 6px; border: 1px solid currentColor; background:none;">
                        ${s.status}
                    </span>
                </td>
                <td style="font-family: var(--font-mono); font-size: 11px; color:var(--text-300);">${parseDateOnly(s.startTime)}</td>
                <td><i class="fa-solid fa-chevron-down text-muted expand-chevron" style="transition: transform 0.25s ease; font-size:10px;"></i></td>
            </tr>
            <tr class="timeline-row-details hidden" id="details-${s.id}">
                <td colspan="11" class="p-0" style="border:none;">
                    <div class="p-3" style="background: rgba(0, 0, 0, 0.12); border-left: 3px solid ${color}; border-bottom: 1px solid var(--border-glass);">
                        <div class="row g-3">
                            <div class="col-12 col-md-5">
                                <div style="font-size: 10px; text-transform: uppercase; color: var(--text-400); margin-bottom: 6px; font-family: var(--font-mono);">Session Telemetry</div>
                                <div class="d-flex flex-column gap-2" style="font-size: 11px; font-family: var(--font-mono); color: var(--text-200);">
                                    <div>Priority Level: <span class="priority-pill ${s.activity ? s.activity.priority.toLowerCase() : 'medium'}">${s.activity ? s.activity.priority : 'MEDIUM'}</span></div>
                                    <div>Task Difficulty: <span class="badge" style="background:none; border:1px solid var(--border-glass); color:var(--text-300);">${s.activity ? s.activity.difficulty : 'MEDIUM'}</span></div>
                                    <div>Deep Work Mode: <span class="${s.deepWorkMode ? 'text-danger fw-bold' : 'text-muted'}">${s.deepWorkMode ? 'ENABLED 🔴' : 'DISABLED'}</span></div>
                                    <div>Interruptions: <span class="text-warning">${s.pauseCount || 0} pauses (${Math.round((s.totalPauseDurationSeconds || 0) / 60)}m elapsed)</span></div>
                                </div>
                            </div>
                            <div class="col-12 col-md-7">
                                <div style="font-size: 10px; text-transform: uppercase; color: var(--text-400); margin-bottom: 6px; font-family: var(--font-mono);">Focus Reflection Notes</div>
                                <div class="p-2 rounded text-light-subtle" style="background: rgba(255,255,255,0.01); border: 1px solid rgba(255,255,255,0.03); font-size: 12px; line-height: 1.5; min-height: 48px;">
                                    ${s.notes ? escHtml(s.notes) : '<em>No reflection notes logged.</em>'}
                                </div>
                            </div>
                        </div>
                    </div>
                </td>
            </tr>
        `;
    }).join('');

    // Expand / collapse details on click
    tableBody.querySelectorAll('.timeline-row-summary').forEach(row => {
        row.addEventListener('click', (e) => {
            const id = row.getAttribute('data-id');
            const detailsRow = document.getElementById(`details-${id}`);
            const chevron = row.querySelector('.expand-chevron');
            if (detailsRow) {
                const isHidden = detailsRow.classList.toggle('hidden');
                if (isHidden) {
                    chevron.style.transform = 'rotate(0deg)';
                } else {
                    chevron.style.transform = 'rotate(180deg)';
                }
            }
        });
    });
}

// 7. Event Handlers Setup for new controls
function initDeepWorkSystem() {
    // Workspace Filter Listeners
    document.getElementById('workspaceSearchInput')?.addEventListener('input', renderWorkspaceActivities);
    document.getElementById('workspaceCategoryFilter')?.addEventListener('change', renderWorkspaceActivities);
    document.getElementById('workspaceSortOptions')?.addEventListener('change', renderWorkspaceActivities);

    // Auto-sync category to advanced options defaults
    document.getElementById('actCategory')?.addEventListener('change', (e) => {
        const category = e.target.value;
        const categoryMappings = {
            'CODING': { icon: 'fa-code', color: '#6366f1', difficulty: 'HARD', priority: 'HIGH' },
            'LEARNING': { icon: 'fa-graduation-cap', color: '#10b981', difficulty: 'MEDIUM', priority: 'MEDIUM' },
            'READING': { icon: 'fa-book-open', color: '#3b82f6', difficulty: 'EASY', priority: 'LOW' },
            'RESEARCH': { icon: 'fa-magnifying-glass', color: '#f59e0b', difficulty: 'HARD', priority: 'HIGH' },
            'WRITING': { icon: 'fa-pen-nib', color: '#ec4899', difficulty: 'MEDIUM', priority: 'MEDIUM' },
            'MEETINGS': { icon: 'fa-handshake', color: '#8b5cf6', difficulty: 'EASY', priority: 'MEDIUM' },
            'EXERCISE': { icon: 'fa-dumbbell', color: '#ef4444', difficulty: 'MEDIUM', priority: 'LOW' },
            'CUSTOM': { icon: 'fa-briefcase', color: '#06b6d4', difficulty: 'MEDIUM', priority: 'MEDIUM' }
        };
        const mapping = categoryMappings[category] || categoryMappings['CUSTOM'];
        
        const iconEl = document.getElementById('actIcon');
        if (iconEl) iconEl.value = mapping.icon;
        
        const diffEl = document.getElementById('actDifficulty');
        if (diffEl) diffEl.value = mapping.difficulty;
        
        const prioEl = document.getElementById('actPriority');
        if (prioEl) prioEl.value = mapping.priority;
        
        const colorEl = document.getElementById('actColor');
        if (colorEl) colorEl.value = mapping.color;
    });

    // Timeline Filter Listeners
    document.getElementById('timerTimelineSearch')?.addEventListener('input', () => {
        timelinePage = 0;
        renderTimelineTable();
    });
    document.getElementById('timerTimelineCategoryFilter')?.addEventListener('change', () => {
        timelinePage = 0;
        renderTimelineTable();
    });
    document.getElementById('timerTimelineSortOrder')?.addEventListener('change', renderTimelineTable);

    // Timeline Pagination
    document.getElementById('timerTimelinePrevPage')?.addEventListener('click', () => {
        if (timelinePage > 0) {
            timelinePage--;
            renderTimelineTable();
        }
    });
    document.getElementById('timerTimelineNextPage')?.addEventListener('click', () => {
        timelinePage++;
        renderTimelineTable();
    });

    // Deep Work Toggle Style Switch live
    document.getElementById('deepWorkModeToggle')?.addEventListener('change', (e) => {
        isDeepWorkMode = e.target.checked;
        if (focusTimerState === 'ACTIVE') {
            if (isDeepWorkMode) {
                document.getElementById('focusSessionCard').classList.add('deep-work-active');
            } else {
                document.getElementById('focusSessionCard').classList.remove('deep-work-active');
            }
        }
    });
}

// Invoke deep work listener binds immediately
initDeepWorkSystem();

/* ────────────────────────────────────────────
   NOTES
──────────────────────────────────────────── */
function safeFmtDate(dateVal) {
    if (!dateVal) return 'Just now';
    if (Array.isArray(dateVal)) {
        const [yr, mo, dy, hr, mn, sc] = dateVal;
        return new Date(yr, (mo || 1) - 1, dy || 1, hr || 0, mn || 0, sc || 0).toLocaleString();
    }
    const d = new Date(dateVal);
    return isNaN(d.getTime()) ? 'Just now' : d.toLocaleString();
}

async function loadNotes() {
    try {
        const notes = await Api.getNotes();
        const feed  = document.getElementById('notesList');
        if (!feed) return;

        if (!notes || notes.length === 0) {
            feed.innerHTML = '<div class="glass-card" style="padding:24px;text-align:center;color:var(--text-400)">No notes yet. Write your first one! 📝</div>';
            return;
        }

        feed.innerHTML = notes.map(n => `
            <div class="glass-card note-card">
                <p class="note-card-title">${escHtml(n.title || 'Untitled')}</p>
                <p class="note-card-body">${escHtml(n.content || '')}</p>
                <p class="note-card-date">${safeFmtDate(n.createdAt)}</p>
            </div>
        `).join('');

        gsap.fromTo('.note-card', { opacity:0, y:15 }, { opacity:1, y:0, duration:0.4, stagger:0.08, ease:'power2.out' });
    } catch(e) {
        console.error(e);
    }
}

document.getElementById('saveNoteBtn')?.addEventListener('click', async () => {
    const btn = document.getElementById('saveNoteBtn');
    const origText = btn.innerHTML;
    
    try {
        const title   = document.getElementById('noteTitle').value.trim();
        const content = document.getElementById('noteContent').value.trim();
        if (!title || !content) return showToast('Fill in both title and content.', 'error');

        // Show premium loading state
        btn.disabled = true;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Saving...';

        await Api.createNote(title, content);

        document.getElementById('noteTitle').value   = '';
        document.getElementById('noteContent').value = '';
        showToast('Note saved! 📝', 'success');

        await loadNotes();
    } catch (e) {
        console.error('Failed to save note:', e);
        showToast('Failed to save note: ' + (e.message || 'Server error'), 'error');
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = origText;
        }
    }
});

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

/* ────────────────────────────────────────────
   PARA NAVIGATION
──────────────────────────────────────────── */
document.querySelectorAll('.para-item').forEach(item => {
    item.addEventListener('click', () => {
        document.querySelectorAll('.para-item').forEach(i => i.classList.remove('active'));
        item.classList.add('active');
        showToast(`${item.getAttribute('title')} context activated.`, 'info', 2000);
    });
});

/* ────────────────────────────────────────────
   DYNAMIC AI WIDGET
──────────────────────────────────────────── */
/* ────────────────────────────────────────────
   AI ASSISTANT (Dashboard Integration)
──────────────────────────────────────────── */
async function loadAiStatus() {
    try {
        const status = await Api.getAiStatus();
        const dot = document.getElementById('dashStatusDot');
        const txt = document.getElementById('dashStatusText');
        const pill = document.getElementById('monitorOllamaStatus');

        const isOnline = status.ollamaRunning;
        const color = isOnline ? 'var(--success)' : 'var(--danger)';
        const label = isOnline ? 'AI Ready' : 'AI Offline';

        if (dot) {
            dot.style.background = color;
            dot.style.boxShadow = `0 0 8px ${color}`;
        }
        if (txt) txt.textContent = label;
        if (pill) {
            pill.innerHTML = `<i class="fa-solid fa-robot"></i> ${isOnline ? 'Phi-3 Active' : 'Ollama Off'}`;
            pill.style.borderColor = isOnline ? 'rgba(0,255,157,0.3)' : 'rgba(255,0,60,0.3)';
        }
    } catch(e) { console.error('AI status check failed'); }
}

async function sendAiMessage() {
    const input = document.getElementById('aiInput');
    const btn   = document.getElementById('aiSendBtn');
    const feed  = document.getElementById('aiMessages');
    const text  = input.value.trim();
    if (!text) return;

    // Append User Msg
    const userRow = document.createElement('div');
    userRow.className = 'user-msg';
    userRow.innerHTML = `<div class="msg-bubble">${escHtml(text)}</div>`;
    feed.appendChild(userRow);
    
    input.value = '';
    btn.disabled = true;
    feed.scrollTop = feed.scrollHeight;

    // Append AI Typing
    const aiRow = document.createElement('div');
    aiRow.className = 'ai-msg';
    aiRow.innerHTML = `<div class="msg-avatar"><i class="fa-solid fa-robot"></i></div><div class="msg-bubble typing">Thinking...</div>`;
    feed.appendChild(aiRow);
    feed.scrollTop = feed.scrollHeight;

    try {
        const response = await Api.askAi(text, 'offline');
        aiRow.querySelector('.msg-bubble').innerHTML = renderMarkdown(response.answer);
    } catch(e) {
        aiRow.querySelector('.msg-bubble').textContent = "⚠️ Sorry, I'm having trouble connecting to the neural core.";
    } finally {
        btn.disabled = false;
        feed.scrollTop = feed.scrollHeight;
    }
}

function renderMarkdown(text) {
    // Simple markdown support
    return text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
               .replace(/\*(.*?)\*/g, '<em>$1</em>')
               .replace(/\n/g, '<br>');
}

document.getElementById('aiSendBtn')?.addEventListener('click', sendAiMessage);
document.getElementById('aiInput')?.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendAiMessage(); }
});



/* ────────────────────────────────────────────
   HELPERS
──────────────────────────────────────────── */
function formatTime(s) {
    const h = String(Math.floor(s / 3600)).padStart(2, '0');
    const m = String(Math.floor((s % 3600) / 60)).padStart(2, '0');
    const sc = String(s % 60).padStart(2, '0');
    return `${h}:${m}:${sc}`;
}

function formatDuration(s) {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sc = s % 60;
    if (h > 0) return `${h}h ${m}m`;
    if (m > 0) return `${m}m ${sc}s`;
    return `${sc}s`;
}

function escHtml(str) {
    return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

/* ────────────────────────────────────────────
   DATABASE ONBOARDING SETUP WIZARD
──────────────────────────────────────────── */
/* ────────────────────────────────────────────
   DATABASE ONBOARDING SETUP WIZARD
──────────────────────────────────────────── */
async function initDbSetup() {
    try {
        const config = await Api.getDatabaseStatus();
        if (config.configured) {
            bootstrapApp();
            return true;
        }

        const dbSetupOverlay = document.getElementById('dbSetupOverlay');
        if (dbSetupOverlay) {
            dbSetupOverlay.style.display = 'flex';
            gsap.fromTo(dbSetupOverlay, { opacity: 0 }, { opacity: 1, duration: 0.5 });
        }

        if (config.configFileExists) {
            const errorBox = document.getElementById('dbSetupError');
            const errorMsg = document.getElementById('dbSetupErrorMsg');
            if (errorBox && errorMsg) {
                errorMsg.textContent = config.error || "Failed to connect to PostgreSQL with saved configuration. Please repair credentials below.";
                errorBox.style.display = 'flex';
            }
        }

        const setupBtn = document.getElementById('dbSetupBtn');
        if (setupBtn) {
            const newSetupBtn = setupBtn.cloneNode(true);
            setupBtn.parentNode.replaceChild(newSetupBtn, setupBtn);
            
            newSetupBtn.addEventListener('click', async () => {
                const host = document.getElementById('dbHost').value.trim();
                const port = document.getElementById('dbPort').value.trim();
                const dbName = document.getElementById('dbName').value.trim();
                const username = document.getElementById('dbUsername').value.trim();
                const password = document.getElementById('dbPassword').value;

                const errorBox = document.getElementById('dbSetupError');
                const errorMsg = document.getElementById('dbSetupErrorMsg');
                const statusBox = document.getElementById('dbSetupStatus');
                const statusMsg = document.getElementById('dbSetupStatusMsg');

                if (errorBox) errorBox.style.display = 'none';
                if (!host || !port || !dbName || !username) {
                    if (errorBox && errorMsg) {
                        errorMsg.textContent = "All fields except password are required.";
                        errorBox.style.display = 'flex';
                    }
                    return;
                }

                if (statusBox && statusMsg) {
                    statusMsg.textContent = "VALIDATING CONNECTION & PROVISIONING DATABASE...";
                    statusBox.style.display = 'flex';
                }
                newSetupBtn.disabled = true;

                const inputs = document.querySelectorAll('.db-setup-form .styled-input');
                inputs.forEach(inp => inp.disabled = true);

                try {
                    const res = await Api.setupDatabase(host, port, dbName, username, password);
                    if (res.success) {
                        if (statusMsg) {
                            statusMsg.textContent = "REBOOTING NEURAL SERVER CONTEXT... PLEASE WAIT.";
                        }
                        
                        let pollAttempts = 0;
                        const pollInterval = setInterval(async () => {
                            pollAttempts++;
                            try {
                                const pollStatus = await Api.getDatabaseStatus();
                                if (pollStatus.configured) {
                                    clearInterval(pollInterval);
                                    if (statusMsg) {
                                        statusMsg.textContent = "CORE SYNC SUCCESSFUL! LAUNCHING WORKSPACE...";
                                    }
                                    setTimeout(() => {
                                        if (dbSetupOverlay) {
                                            gsap.to(dbSetupOverlay, { opacity: 0, duration: 0.5, onComplete: () => {
                                                dbSetupOverlay.style.display = 'none';
                                            }});
                                        }
                                        bootstrapApp();
                                    }, 1500);
                                }
                            } catch (e) {
                                console.warn("Waiting for context reboot...", e);
                            }
                            
                            if (pollAttempts > 30) {
                                clearInterval(pollInterval);
                                if (statusBox) statusBox.style.display = 'none';
                                inputs.forEach(inp => inp.disabled = false);
                                newSetupBtn.disabled = false;
                                if (errorBox && errorMsg) {
                                    errorMsg.textContent = "Reboot timeout. Please check your console/logs or try again.";
                                    errorBox.style.display = 'flex';
                                }
                            }
                        }, 1500);

                    } else {
                        throw new Error(res.error || "Setup failed");
                    }
                } catch (err) {
                    console.error("Setup failed:", err);
                    if (statusBox) statusBox.style.display = 'none';
                    inputs.forEach(inp => inp.disabled = false);
                    newSetupBtn.disabled = false;
                    if (errorBox && errorMsg) {
                        errorMsg.textContent = err.message || "Failed to initialize database. Verify host and port link.";
                        errorBox.style.display = 'flex';
                    }
                }
            });
        }

        return false;
    } catch (e) {
        console.error("Database status check failed:", e);
        return true;
    }
}

/* ────────────────────────────────────────────
   AUTHENTICATION FORMS & ONBOARDING LIFE-CYCLE
──────────────────────────────────────────── */
function initAuthForms() {
    const loginBtn = document.getElementById('btnLogin');
    const loginErr = document.getElementById('loginErrorMsg');
    if (loginBtn) {
        loginBtn.addEventListener('click', async () => {
            const email = document.getElementById('loginEmail').value.trim();
            const password = document.getElementById('loginPassword').value;
            
            if (loginErr) loginErr.style.display = 'none';

            if (!email || !password) {
                if (loginErr) { loginErr.textContent = 'Please enter username/email and password.'; loginErr.style.display = 'block'; }
                return showToast('Please enter username/email and password.', 'error');
            }
            
            loginBtn.disabled = true;
            loginBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> AUTHENTICATING...';
            
            try {
                const res = await Api.login(email, password);
                if (res.token) {
                    showToast('Explorer session authenticated!', 'success');
                    
                    const status = await Api.getDatabaseStatus();
                    
                    const lockOverlay = document.getElementById('appLockOverlay');
                    if (lockOverlay) {
                        gsap.to(lockOverlay, { opacity: 0, duration: 0.5, onComplete: () => {
                            lockOverlay.style.display = 'none';
                        }});
                    }

                    if (status.configured) {
                        bootstrapApp();
                    } else {
                        initDbSetup();
                    }
                } else {
                    throw new Error("Authentication failed");
                }
            } catch (err) {
                const msg = err.message || 'Login failed.';
                if (loginErr) { loginErr.textContent = msg; loginErr.style.display = 'block'; }
                showToast(msg, 'error');
                loginBtn.disabled = false;
                loginBtn.innerHTML = '<i class="fa-solid fa-arrow-right-to-bracket"></i> SIGN IN';
            }
        });
    }

    const registerBtn = document.getElementById('btnRegister');
    const regErr = document.getElementById('regErrorMsg');
    if (registerBtn) {
        registerBtn.addEventListener('click', async () => {
            const username = document.getElementById('regUsername').value.trim();
            const email = document.getElementById('regEmail').value.trim();
            const password = document.getElementById('regPassword').value;
            
            if (regErr) regErr.style.display = 'none';

            if (!username || !email || !password) {
                if (regErr) { regErr.textContent = 'Please fill all registration fields.'; regErr.style.display = 'block'; }
                return showToast('Please fill all registration fields.', 'error');
            }
            
            registerBtn.disabled = true;
            registerBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> ESTABLISHING PROFILE...';
            
            try {
                const res = await Api.register(username, email, password);
                if (res.token) {
                    showToast('Profile established successfully!', 'success');
                    
                    const status = await Api.getDatabaseStatus();
                    
                    const lockOverlay = document.getElementById('appLockOverlay');
                    if (lockOverlay) {
                        gsap.to(lockOverlay, { opacity: 0, duration: 0.5, onComplete: () => {
                            lockOverlay.style.display = 'none';
                        }});
                    }

                    if (status.configured) {
                        bootstrapApp();
                    } else {
                        initDbSetup();
                    }
                } else {
                    throw new Error("Registration failed to return token");
                }
            } catch (err) {
                const msg = err.message || 'Registration failed.';
                if (regErr) { regErr.textContent = msg; regErr.style.display = 'block'; }
                showToast(msg, 'error');
                registerBtn.disabled = false;
                registerBtn.innerHTML = '<i class="fa-solid fa-user-plus"></i> SIGN UP';
            }
        });
    }
}

window.toggleAuth = function(e) {
    if (e) e.preventDefault();
    const login = document.getElementById('loginForm');
    const register = document.getElementById('registerForm');
    const title = document.querySelector('#authCard h2');
    const subtitle = document.querySelector('#authCard .sub-text');
    
    if (login.style.display === 'none') {
        gsap.to(register, { opacity: 0, y: 10, duration: 0.3, onComplete: () => {
            register.style.display = 'none';
            login.style.display = 'block';
            if (title) title.textContent = "COGNITIVE SIGN IN";
            if (subtitle) subtitle.textContent = "Authenticate your explorer profile to boot workspace cores.";
            gsap.fromTo(login, { opacity: 0, y: -10 }, { opacity: 1, y: 0, duration: 0.3 });
        }});
    } else {
        gsap.to(login, { opacity: 0, y: 10, duration: 0.3, onComplete: () => {
            login.style.display = 'none';
            register.style.display = 'block';
            if (title) title.textContent = "ESTABLISH PROFILE";
            if (subtitle) subtitle.textContent = "Create an explorer identity to initialize the system.";
            gsap.fromTo(register, { opacity: 0, y: -10 }, { opacity: 1, y: 0, duration: 0.3 });
        }});
    }
};



/* ────────────────────────────────────────────
   BOOTSTRAP APPLICATION SERVICES
──────────────────────────────────────────── */
async function bootstrapApp() {
    if (window.appBootstrapped) return;

    // Check onboarding status
    if (window.currentUser && !window.currentUser.onboarded) {
        const onboardOverlay = document.getElementById('onboardingOverlay');
        if (onboardOverlay) {
            onboardOverlay.style.display = 'flex';
            const brandLogo = document.querySelector('.brand-logo');
            if (brandLogo) brandLogo.classList.remove('brand-logo-pulsing');
            return;
        }
    }

    window.appBootstrapped = true;

    // Theme initialized globally by theme.js
    setGreeting();
    initParticles();
    injectTimerGradient();
    initMobileNav();
    loadAiStatus();
    setInterval(loadAiStatus, 30000);
    if (window.initAiChat) window.initAiChat();
    initDiagnostics();

    // Sidebar entrance
    gsap.from('.logo',     { opacity: 0, x: -20, duration: 0.6, ease: 'power2.out' });
    gsap.from('.gam-card', { opacity: 0, x: -20, duration: 0.6, delay: 0.1, ease: 'power2.out' });
    gsap.from('.nav-item', { 
        opacity: 0, 
        x: -20, 
        duration: 0.5, 
        stagger: 0.07, 
        delay: 0.2, 
        ease: 'power2.out',
        clearProps: 'all'
    });

    // Load data
    loadActivities();
    loadNotifications();
    resumeTimerIfAny();

    // Load first view
    await loadDashboard();
    gsap.set('#view-dashboard', { opacity: 1 });
}

/* ────────────────────────────────────────────
   BOOT
──────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', async () => {
    // Attach brand logo guide pulse
    const brandLogo = document.querySelector('.brand-logo');
    let logoClick = () => {};
    
    if (brandLogo) {
        brandLogo.classList.add('brand-logo-pulsing');
        
        logoClick = () => {
            const prompt = document.getElementById('lockPromptCard');
            const auth = document.getElementById('authCard');
            if (prompt && auth && prompt.style.display !== 'none') {
                gsap.to(prompt, { opacity: 0, y: 15, duration: 0.4, onComplete: () => {
                    prompt.style.display = 'none';
                    auth.style.display = 'block';
                    gsap.fromTo(auth, { opacity: 0, y: -15, scale: 0.98 }, { opacity: 1, y: 0, scale: 1, duration: 0.5, ease: 'power3.out' });
                }});
                brandLogo.classList.remove('brand-logo-pulsing');
            }
        };

        brandLogo.addEventListener('click', logoClick);
        document.querySelector('.sidebar-brand')?.addEventListener('click', logoClick);
        document.getElementById('lockPromptCard')?.addEventListener('click', logoClick);
    }

    // Initialize forms
    initAuthForms();

    // Silent background authentication check on start
    const lockOverlay = document.getElementById('appLockOverlay');
    try {
        const user = await Api.getMe();
        if (user && user.authenticated) {
            // Session exists! Silently bypass lock screen
            if (lockOverlay) {
                lockOverlay.style.display = 'none';
            }
            if (brandLogo) {
                brandLogo.classList.remove('brand-logo-pulsing');
            }
            
            // Check PG state
            const status = await Api.getDatabaseStatus();
            if (status.configured) {
                bootstrapApp();
            } else {
                initDbSetup(); // Shows the PostgreSQL Setup card and binds form handlers!
            }
        } else {
            // Not logged in: enforce lock overlay
            if (lockOverlay) {
                lockOverlay.style.display = 'flex';
            }
        }
    } catch (e) {
        // Enforce lock overlay on errors
        if (lockOverlay) {
            lockOverlay.style.display = 'flex';
        }
    }
});

/* Inject SVG gradient for timer ring */
function injectTimerGradient() {
    const svg = document.querySelector('.timer-ring-svg');
    if (!svg || svg.querySelector('defs')) return;
    const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
    defs.innerHTML = `
        <linearGradient id="timerGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%"   stop-color="#6366f1"/>
            <stop offset="100%" stop-color="#06b6d4"/>
        </linearGradient>`;
    svg.insertBefore(defs, svg.firstChild);
}

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

/* ────────────────────────────────────────────
   DATABASE CORE MONITORING CONSOLE
──────────────────────────────────────────── */
window.loadDbMonitor = async function() {
    try {
        const metrics = await Api.getDbMetrics();
        
        document.getElementById('dbMetricUsers').textContent = metrics.totalUsers || 0;
        document.getElementById('dbMetricConvs').textContent = metrics.totalConversations || 0;
        document.getElementById('dbMetricChunks').textContent = metrics.totalRagChunks || 0;
        document.getElementById('dbMetricTables').textContent = metrics.tables ? metrics.tables.length : 0;
        
        document.getElementById('dbMetaName').textContent = metrics.databaseName || '-';
        document.getElementById('dbMetaUrl').textContent = metrics.databaseUrl || '-';
        
        const statusPill = document.getElementById('dbMonStatus');
        const typePill = document.getElementById('dbMonType');
        if (metrics.databaseType === 'postgresql') {
            if (statusPill) statusPill.innerHTML = '<i class="fa-solid fa-server"></i> PostgreSQL Active';
            if (typePill) typePill.textContent = 'Production PostgreSQL';
        } else {
            if (statusPill) statusPill.innerHTML = '<i class="fa-solid fa-triangle-exclamation"></i> H2 Fallback Core';
            if (typePill) typePill.textContent = 'Development H2 Engine';
        }

        const tableSelect = document.getElementById('dbInspectorTableSelect');
        if (tableSelect) {
            loadTableData(tableSelect.value);
        }
    } catch (e) {
        console.error("Error loading Database Monitor:", e);
        showToast("Error retrieving database metrics", "error");
    }
};

window.loadTableData = async function(tableName) {
    const headEl = document.getElementById('dbInspectorHead');
    const bodyEl = document.getElementById('dbInspectorBody');
    if (!headEl || !bodyEl) return;

    headEl.innerHTML = '';
    bodyEl.innerHTML = '<tr><td colspan="10" style="text-align:center; padding:30px;"><i class="fa-solid fa-spinner fa-spin"></i> QUERYING DATABASE TABLE...</td></tr>';

    try {
        const rows = await Api.getTableData(tableName);
        headEl.innerHTML = '';
        bodyEl.innerHTML = '';

        if (!rows || rows.length === 0) {
            bodyEl.innerHTML = '<tr><td colspan="10" class="empty-row" style="text-align:center; padding:30px; color:var(--text-400);">No records found in this table.</td></tr>';
            return;
        }

        const headers = Object.keys(rows[0]);
        const trHead = document.createElement('tr');
        headers.forEach(h => {
            const th = document.createElement('th');
            th.textContent = h.toUpperCase();
            th.style.padding = '12px 16px';
            th.style.textAlign = 'left';
            trHead.appendChild(th);
        });
        headEl.appendChild(trHead);

        rows.forEach(row => {
            const tr = document.createElement('tr');
            headers.forEach(h => {
                const td = document.createElement('td');
                const val = row[h];
                if (val === null || val === undefined) {
                    td.textContent = 'NULL';
                    td.style.opacity = 0.3;
                } else if (typeof val === 'object') {
                    td.textContent = JSON.stringify(val);
                    td.style.fontFamily = 'var(--font-mono)';
                    td.style.fontSize = '10px';
                } else {
                    td.textContent = val.toString();
                }
                td.style.padding = '12px 16px';
                tr.appendChild(td);
            });
            bodyEl.appendChild(tr);
        });
    } catch (e) {
        console.error("Error loading table data:", e);
        bodyEl.innerHTML = `<tr><td colspan="10" class="empty-row" style="text-align:center; padding:30px; color:var(--danger);"><i class="fa-solid fa-triangle-exclamation"></i> Error: ${e.message}</td></tr>`;
    }
};

/* ────────────────────────────────────────────
   RAG VALIDATION CONTROL CENTER
──────────────────────────────────────────── */
window.loadRagValidation = async function() {
    try {
        const metrics = await Api.getRagMetrics();
        const sourcesList = document.getElementById('ragSourcesList');
        if (!sourcesList) return;

        sourcesList.innerHTML = '';
        
        const aiStatus = await Api.getAiStatus();
        const ollamaStatusEl = document.getElementById('ragOllamaStatus');
        if (ollamaStatusEl) {
            if (aiStatus.ollamaRunning) {
                ollamaStatusEl.innerHTML = '<i class="fa-solid fa-robot"></i> Ollama Active';
                ollamaStatusEl.style.color = 'var(--success)';
            } else {
                ollamaStatusEl.innerHTML = '<i class="fa-solid fa-triangle-exclamation"></i> Ollama Offline';
                ollamaStatusEl.style.color = 'var(--danger)';
            }
        }

        const sources = metrics.sources || [];
        if (sources.length === 0) {
            sourcesList.innerHTML = '<div class="empty-sources" style="text-align:center; padding:30px; color:var(--text-400); border: 1px dashed var(--border-glass); border-radius:12px;">No sources indexed yet. Browse websites with the Chrome Extension or save Notes to populate RAG index.</div>';
            return;
        }

        sources.forEach(src => {
            const card = document.createElement('div');
            card.className = 'sources-list-card glass-card';
            card.style.display = 'flex';
            card.style.justifyContent = 'space-between';
            card.style.alignItems = 'center';
            card.style.padding = '12px 16px';
            card.style.background = 'rgba(var(--glass-rgb), 0.02)';
            card.style.border = '1px solid var(--border-glass)';
            card.style.borderRadius = '10px';

            const title = src.source_title || src.source_url || 'Untitled Document';
            const cleanUrl = src.source_url || '';
            const isNote = cleanUrl.startsWith('note:');
            
            let icon = '<i class="fa-solid fa-globe" style="color:var(--secondary); font-size:16px;"></i>';
            if (isNote) {
                icon = '<i class="fa-solid fa-sticky-note" style="color:var(--warning); font-size:16px;"></i>';
            } else if (cleanUrl.startsWith('session:')) {
                icon = '<i class="fa-solid fa-clock" style="color:var(--primary-lt); font-size:16px;"></i>';
            }

            card.innerHTML = `
                <div style="display:flex; align-items:center; gap:12px; flex:1;">
                    ${icon}
                    <div>
                        <h4 style="margin:0; font-size:12px; color:var(--text-200); white-space:normal; word-break:break-word;">${title}</h4>
                        <p style="margin:0; font-size:10px; color:var(--text-400); white-space:normal; word-break:break-word; font-family:var(--font-mono);">${cleanUrl}</p>
                    </div>
                </div>
                <span class="badge" style="background:rgba(6, 182, 212, 0.1); border:1px solid rgba(6, 182, 212, 0.2); color:var(--secondary); padding:2px 8px; border-radius:4px; font-size:10px; font-family:var(--font-mono); font-weight:700;">${src.chunks_count} chunks</span>
            `;
            sourcesList.appendChild(card);
        });
    } catch (e) {
        console.error("Error loading RAG validation:", e);
        showToast("Error retrieving RAG validation data", "error");
    }
};

window.testRagSimilaritySearch = async function() {
    const queryInput = document.getElementById('ragTestQuery');
    const resultsContainer = document.getElementById('ragTestResults');
    const searchBtn = document.getElementById('ragTestSearchBtn');
    const modeSelect = document.getElementById('ragTestModeSelect');
    
    if (!queryInput || !resultsContainer || !searchBtn) return;
    
    const query = queryInput.value.trim();
    if (!query) {
        showToast("Please enter a concept or query to match.", "warning");
        return;
    }
    
    const mode = modeSelect ? modeSelect.value : 'hybrid';
    
    searchBtn.disabled = true;
    searchBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Embedding & Retrieval...';
    resultsContainer.innerHTML = '<div style="text-align:center; padding:40px;"><i class="fa-solid fa-spinner fa-spin fa-2x" style="color:var(--secondary);"></i><p style="margin-top:12px; font-size:11px; font-family:var(--font-mono); color:var(--text-400);">CONNECTING TO OLLAMA CORE & RETRIEVING EMBEDDED CHUNKS...</p></div>';

    try {
        const response = await Api.testRagSimilarity(query, mode);
        resultsContainer.innerHTML = '';

        if (response.error) {
            resultsContainer.innerHTML = `<div style="text-align:center; padding:30px; color:var(--danger); border:1px dashed rgba(255,85,85,0.3); border-radius:12px;">
                <i class="fa-solid fa-triangle-exclamation fa-2x"></i>
                <h4 style="margin-top:10px; font-size:13px;">Semantic Search Failed</h4>
                <p style="margin:6px 0 0; font-size:11px; color:var(--text-400);">${response.error}</p>
            </div>`;
            return;
        }

        const results = response.results || [];
        if (results.length === 0) {
            resultsContainer.innerHTML = '<div class="empty-results" style="text-align:center; padding:40px; color:var(--text-400); font-size:12px; border:1px dashed var(--border-glass); border-radius:12px;">No matching vector chunks found. (Embedding thresholds > 0.5)</div>';
            return;
        }

        results.forEach(res => {
            const card = document.createElement('div');
            card.className = 'rag-result-card glass-card';
            card.style.marginBottom = '12px';
            
            const pct = Math.round((parseFloat(res.similarity) || 0) * 100);
            let barColor = 'var(--primary)';
            if (pct >= 80) barColor = 'var(--success)';
            else if (pct < 60) barColor = 'var(--warning)';

            const type = (res.type || 'local').toUpperCase();
            const badgeColor = type === 'ONLINE' ? 'rgba(6, 182, 212, 0.2)' : 'rgba(99, 102, 241, 0.2)';
            const badgeTextColor = type === 'ONLINE' ? 'var(--secondary)' : 'var(--primary-lt)';
            const simLabel = type === 'ONLINE' ? 'SEARCH RELEVANCE' : 'COSINE SIMILARITY';

            card.innerHTML = `
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px; font-family:var(--font-mono); font-size:11px;">
                    <span style="color:var(--text-100); font-weight:700; display:flex; align-items:center; gap:6px; flex-wrap:wrap; max-width: 70%;">
                        <span style="background:${badgeColor}; color:${badgeTextColor}; padding:1px 6px; border-radius:4px; font-size:9px; border:1px solid rgba(255,255,255,0.05); font-weight:700;">${type}</span>
                        <i class="fa-solid fa-file-invoice"></i> ${res.sourceTitle || 'Source Chunk'}
                    </span>
                    <span style="color:${pct >= 70 ? 'var(--secondary)' : 'var(--text-300)'}; font-weight:700;">${simLabel}: ${pct}%</span>
                </div>
                <p style="margin:0; font-size:11px; color:var(--text-200); line-height:1.5; font-family:var(--font-sans);">${res.chunkText || res.snippet || ''}</p>
                <div class="rag-score-bar-wrap" style="height:4px; background:rgba(255,255,255,0.05); border-radius:2px; margin-top:8px; overflow:hidden;">
                    <div class="rag-score-bar" style="width:${pct}%; height:100%; background:${barColor}; transition: width 0.4s ease;"></div>
                </div>
                <div style="margin-top:6px; font-size:9px; font-family:var(--font-mono); color:var(--text-400); white-space:normal; word-break:break-word;">
                    URI: ${res.sourceUrl || res.url || ''}
                </div>
            `;
            resultsContainer.appendChild(card);
        });
    } catch (e) {
        console.error("Error executing semantic retrieval search:", e);
        resultsContainer.innerHTML = `<div style="text-align:center; padding:30px; color:var(--danger); border:1px dashed var(--border-glass); border-radius:12px;"><i class="fa-solid fa-triangle-exclamation"></i> Search Failed: ${e.message}</div>`;
    } finally {
        searchBtn.disabled = false;
        searchBtn.innerHTML = '<i class="fa-solid fa-bolt"></i> Run Cosine Search';
    }
};

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

/* ────────────────────────────────────────────
   COGNITIVE LEARNING HUB & ONBOARDING SYSTEM
──────────────────────────────────────────── */

window.submitOnboarding = async function(e) {
    if (e) e.preventDefault();
    
    const useCase = document.getElementById('onboardUseCase').value;
    const customInterests = document.getElementById('onboardCustomInterests').value.trim();
    const crawlAllowed = document.getElementById('onboardCrawlAllowed').checked;
    
    const checkedBoxes = document.querySelectorAll('input[name="onboardTopics"]:checked');
    const topicsList = Array.from(checkedBoxes).map(cb => cb.value).join(',');
    
    if (!topicsList && !customInterests) {
        showToast("Please select at least one topic or enter custom interests.", "warning");
        return;
    }
    
    const submitBtn = e.target.closest('button');
    const origText = submitBtn.innerHTML;
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fa-solid fa-brain fa-spin"></i> INITIALIZING HUB...';
    
    try {
        await Api.saveOnboarding(useCase, topicsList, customInterests, crawlAllowed);
        showToast("Cognitive learning profile successfully initialized! Syncing knowledge core...", "success");
        addNotification("Profile Initialized", "Cognitive focus profile configured successfully.", "success");
        
        const overlay = document.getElementById('onboardingOverlay');
        if (overlay) overlay.style.display = 'none';
        
        if (window.currentUser) {
            window.currentUser.onboarded = true;
            window.currentUser.useCase = useCase;
            window.currentUser.selectedTopics = topicsList;
            window.currentUser.customInterests = customInterests;
            window.currentUser.resourceCollectionAllowed = crawlAllowed;
        }
        
        bootstrapApp();
    } catch (err) {
        showToast("Failed to initialize profile: " + err.message, "error");
    } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = origText;
    }
};

window.loadLearningHub = async function() {
    const useCaseVal = document.getElementById('learnUseCaseVal');
    const crawlAllowedCheckbox = document.getElementById('learnCrawlAllowedCheckbox');
    const topicsPills = document.getElementById('learnTopicsPills');
    const coverageContainer = document.getElementById('learnCoverageContainer');
    const recsContainer = document.getElementById('learnRecsContainer');
    const docsList = document.getElementById('learnDocsList');
    
    if (!useCaseVal) return;
    
    try {
        const profile = await Api.getLearningProfile();
        const stats = await Api.getLearningStats();
        
        useCaseVal.value = profile.useCase || 'N/A';
        if (crawlAllowedCheckbox) {
            crawlAllowedCheckbox.checked = profile.resourceCollectionAllowed;
            const statusPill = document.getElementById('crawlPermStatusPill');
            if (statusPill) statusPill.textContent = profile.resourceCollectionAllowed ? 'Enabled' : 'Disabled';
        }
        
        let topics = [];
        if (profile.selectedTopics) topics.push(...profile.selectedTopics.split(','));
        if (profile.customInterests) topics.push(...profile.customInterests.split(','));
        topics = topics.map(t => t.trim()).filter(Boolean);
        
        if (topics.length === 0) {
            topicsPills.innerHTML = '<span class="small text-muted">No focus topics active. Add interests below.</span>';
        } else {
            topicsPills.innerHTML = topics.map(t => `
                <span class="badge" style="background: rgba(99, 102, 241, 0.15); border: 1px solid rgba(99, 102, 241, 0.25); color: var(--primary-lt); font-family: var(--font-mono); font-size: 10px; padding: 4px 8px; border-radius: 4px; display: flex; align-items: center; gap: 6px;">
                    ${t}
                </span>
            `).join('');
        }
        
        const coverage = stats.coverage || {};
        if (Object.keys(coverage).length === 0) {
            coverageContainer.innerHTML = '<div class="text-center p-3 text-muted small">No knowledge indices available. Sync to collect documentation chunks.</div>';
        } else {
            coverageContainer.innerHTML = Object.entries(coverage).map(([topic, chunkCount]) => {
                const limitMax = 50;
                const pct = Math.min(Math.round((chunkCount / limitMax) * 100), 100);
                let barColor = 'var(--warning)';
                if (pct >= 80) barColor = 'var(--success)';
                else if (pct >= 30) barColor = 'var(--primary)';
                
                return `
                    <div>
                        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px; font-size:11px; font-family:var(--font-mono)">
                            <span class="text-light fw-bold">${topic}</span>
                            <span class="text-muted">${chunkCount} chunks (${pct}% coverage)</span>
                        </div>
                        <div style="height:6px; background:rgba(255,255,255,0.05); border-radius:3px; overflow:hidden;">
                            <div style="width:${pct}%; height:100%; background:${barColor}; box-shadow: 0 0 10px ${barColor}; transition: width 0.6s ease;"></div>
                        </div>
                    </div>
                `;
            }).join('');
        }
        
        const recs = stats.recommendations || [];
        if (recs.length === 0) {
            recsContainer.innerHTML = '<div class="small text-muted">All recommended areas indexed!</div>';
        } else {
            recsContainer.innerHTML = recs.map(r => `
                <div class="glass-card hover-glow" style="display:flex; justify-content:space-between; align-items:center; padding:10px 14px; border-radius:8px; background:rgba(255,255,255,0.02); border:1px solid var(--border-glass);">
                    <span style="font-size:11px; color:var(--text-100); font-weight:600;"><i class="fa-solid fa-compass" style="color:var(--secondary)"></i> ${r}</span>
                    <button class="btn-primary" onclick="quickAddTopic(event, '${r}')" style="font-size:9px; height:24px; padding:0 8px; font-family:var(--font-mono)"><i class="fa-solid fa-plus"></i> Add</button>
                </div>
            `).join('');
        }
        
        window._indexedDocs = stats.documents || [];
        renderDocsList(window._indexedDocs);
    } catch (e) {
        console.error('Failed to load learning hub metrics:', e);
        showToast('Error retrieving learning hub status', 'error');
    }
};

function renderDocsList(docs) {
    const docsList = document.getElementById('learnDocsList');
    if (!docsList) return;
    
    if (docs.length === 0) {
        docsList.innerHTML = '<div class="empty-sources text-center p-3 text-muted small">Your RAG index is empty. Add references or crawl topics.</div>';
        return;
    }
    
    docsList.innerHTML = docs.map(d => {
        const shortUrl = d.url.length > 35 ? d.url.substring(0, 35) + '...' : d.url;
        const icon = d.url.startsWith('mentor:') ? '<i class="fa-solid fa-brain" style="color:var(--primary-lt)"></i>' : '<i class="fa-solid fa-globe" style="color:var(--secondary)"></i>';
        return `
            <div class="glass-card p-3 d-flex justify-content-between align-items-center" style="background:rgba(255,255,255,0.02); border-radius:8px; gap: 10px; border:1px solid var(--border-glass);">
                <div style="flex:1;">
                    <h4 style="margin:0; font-size:11px; color:var(--text-100); white-space:normal; word-break:break-word;" title="${escHtml(d.title)}">${escHtml(d.title)}</h4>
                    <span style="font-size:9px; font-family:var(--font-mono); color:var(--text-400); white-space:normal; word-break:break-word; display:block;" title="${d.url}">${d.url}</span>
                </div>
                <span class="badge" style="background:rgba(6,182,212,0.1); border:1px solid rgba(6,182,212,0.25); color:var(--secondary); font-family:var(--font-mono); font-size:9px; font-weight:700; padding:2px 6px; border-radius:4px; flex-shrink:0;">${d.chunksCount} chunks</span>
            </div>
        `;
    }).join('');
}

window.filterLearningDocs = function() {
    const query = document.getElementById('learnDocSearch').value.toLowerCase().trim();
    const docs = window._indexedDocs || [];
    if (!query) {
        renderDocsList(docs);
        return;
    }
    const filtered = docs.filter(d => 
        (d.title && d.title.toLowerCase().includes(query)) || 
        (d.url && d.url.toLowerCase().includes(query))
    );
    renderDocsList(filtered);
};

window.toggleCrawlPermission = async function(e) {
    const allowed = e.target.checked;
    const statusPill = document.getElementById('crawlPermStatusPill');
    if (statusPill) statusPill.textContent = allowed ? 'Enabled' : 'Disabled';
    
    try {
        const profile = await Api.getLearningProfile();
        await Api.saveOnboarding(profile.useCase, profile.selectedTopics, profile.customInterests, allowed);
        showToast(`Resource crawler permission ${allowed ? 'enabled' : 'disabled'}`, "success");
    } catch(err) {
        showToast("Failed to update crawling options: " + err.message, "error");
    }
};

window.addCustomInterests = async function(e) {
    const input = document.getElementById('learnCustomInterestsInput');
    const interests = input.value.trim();
    if (!interests) return;
    
    const btn = e.target;
    btn.disabled = true;
    
    try {
        const profile = await Api.getLearningProfile();
        let current = profile.customInterests ? profile.customInterests.split(',').map(s=>s.trim()).filter(Boolean) : [];
        const added = interests.split(',').map(s=>s.trim()).filter(Boolean);
        
        added.forEach(item => {
            if (!current.includes(item)) current.push(item);
        });
        
        await Api.saveOnboarding(profile.useCase, profile.selectedTopics, current.join(','), profile.resourceCollectionAllowed);
        showToast("Interests updated! Starting RAG background synchronization...", "success");
        addNotification("Focus Topics Updated", "Added new interests to your learning tracker.", "success");
        input.value = '';
        loadLearningHub();
    } catch(err) {
        showToast("Failed to add interests: " + err.message, "error");
    } finally {
        btn.disabled = false;
    }
};

window.quickAddTopic = async function(e, topic) {
    const btn = e.target;
    btn.disabled = true;
    
    try {
        const profile = await Api.getLearningProfile();
        let current = profile.selectedTopics ? profile.selectedTopics.split(',').map(s=>s.trim()).filter(Boolean) : [];
        if (!current.includes(topic)) {
            current.push(topic);
        }
        await Api.saveOnboarding(profile.useCase, current.join(','), profile.customInterests, profile.resourceCollectionAllowed);
        showToast(`Added recommended topic: ${topic}`, "success");
        loadLearningHub();
    } catch(err) {
        showToast("Failed to add recommended topic: " + err.message, "error");
    } finally {
        btn.disabled = false;
    }
};

window.submitCustomDocument = async function(e) {
    const input = document.getElementById('learnCustomDocInput');
    const val = input.value.trim();
    if (!val) {
        showToast("Please enter an educational URL or topic.", "warning");
        return;
    }
    
    const btn = e.target;
    const origText = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Ingesting Source...';
    
    try {
        const res = await Api.indexCustomDocument(val);
        showToast(res.message || "Custom indexing task submitted successfully", "success");
        addNotification("Source Ingestion Started", "Crawling and indexing resource: " + val, "info");
        input.value = '';
        setTimeout(loadLearningHub, 3000);
    } catch(err) {
        showToast("Indexing failed: " + err.message, "error");
    } finally {
        btn.disabled = false;
        btn.innerHTML = origText;
    }
};

window.triggerManualCrawl = async function(e) {
    const btn = document.getElementById('btnSyncKnowledge');
    if (!btn) return;
    
    const origText = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Synchronizing Knowledge...';
    
    try {
        const res = await Api.triggerManualCrawl();
        showToast(res.message || "Synchronization task initiated.", "info");
        addNotification("Knowledge Sync Initiated", "RAG synchronizer started dynamic document crawls.", "info");
        setTimeout(loadLearningHub, 5000);
    } catch(err) {
        showToast("Sync failed: " + err.message, "error");
    } finally {
        btn.disabled = false;
        btn.innerHTML = origText;
    }
};


/* ────────────────────────────────────────────
   GLOBAL NOTIFICATION SYSTEM
   ──────────────────────────────────────────── */
window.notifications = [];

// Helper to format notification created_at time
function formatNotifTime(dateStr) {
    if (!dateStr) return 'Just now';
    const date = new Date(dateStr);
    const diffMs = Date.now() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

window.loadNotifications = async function() {
    try {
        const notifs = await Api.getNotifications();
        window.notifications = (notifs || []).map(n => ({
            id: n.id,
            title: n.title,
            desc: n.description,
            type: n.type,
            isRead: n.isRead,
            time: formatNotifTime(n.createdAt)
        }));
        
        const hasUnread = (notifs || []).some(n => !n.isRead);
        const notifDot = document.getElementById('notifDot');
        if (notifDot) {
            notifDot.style.display = hasUnread ? 'block' : 'none';
        }
    } catch (e) {
        console.warn('Failed to load notifications from database:', e);
    }
};

window.addNotification = async function(title, desc, type = "info") {
    try {
        await Api.saveNotification(title, desc, type);
        await loadNotifications();
        
        const dropdown = document.getElementById('notificationsDropdown');
        if (dropdown && dropdown.classList.contains('active')) {
            renderNotifications();
        }
    } catch (e) {
        console.warn('Failed to save notification to database:', e);
        const newNotif = {
            id: Date.now(),
            title: title,
            desc: desc,
            type: type,
            isRead: false,
            time: "Just now"
        };
        window.notifications.unshift(newNotif);
        if (window.notifications.length > 15) {
            window.notifications.pop();
        }
        const notifDot = document.getElementById('notifDot');
        if (notifDot) {
            notifDot.style.display = 'block';
        }
        const dropdown = document.getElementById('notificationsDropdown');
        if (dropdown && dropdown.classList.contains('active')) {
            renderNotifications();
        }
    }
};

window.renderNotifications = function() {
    const list = document.getElementById('notificationsList');
    if (!list) return;
    
    if (window.notifications.length === 0) {
        list.innerHTML = `
            <div style="text-align: center; padding: 24px 12px; color: var(--text-600); font-size: 11px; font-family: var(--font-mono);">
                <i class="fa-regular fa-bell-slash" style="font-size: 20px; margin-bottom: 8px; opacity: 0.5; display: block; color: var(--text-400);"></i>
                No notifications active
            </div>
        `;
        return;
    }
    
    list.innerHTML = window.notifications.map(n => {
        let iconHtml = '<i class="fa-solid fa-info"></i>';
        if (n.type === 'success') iconHtml = '<i class="fa-solid fa-check"></i>';
        if (n.type === 'warning') iconHtml = '<i class="fa-solid fa-triangle-exclamation"></i>';
        if (n.type === 'danger')  iconHtml = '<i class="fa-solid fa-circle-exclamation"></i>';
        
        const opacityStyle = n.isRead ? 'opacity: 0.6;' : '';
        return `
            <div class="notif-item" style="${opacityStyle}">
                <div class="notif-item-icon ${n.type}">
                    ${iconHtml}
                </div>
                <div class="notif-item-content">
                    <span class="notif-item-title">${n.title}</span>
                    <span class="notif-item-desc">${n.desc}</span>
                    <span class="notif-item-time">${n.time}</span>
                </div>
            </div>
        `;
    }).join('');
};

window.toggleNotificationsDropdown = async function(e) {
    if (e) {
        e.preventDefault();
        e.stopPropagation();
    }
    const dropdown = document.getElementById('notificationsDropdown');
    if (!dropdown) return;
    
    if (dropdown.classList.contains('active')) {
        dropdown.classList.remove('active');
        return;
    }
    
    const notifDot = document.getElementById('notifDot');
    if (notifDot) {
        notifDot.style.display = 'none';
    }

    try {
        const unreadNotifs = window.notifications.filter(n => !n.isRead);
        for (const n of unreadNotifs) {
            await Api.markNotificationAsRead(n.id);
        }
        await loadNotifications();
    } catch (err) {
        console.warn('Failed to mark notifications as read:', err);
    }
    
    renderNotifications();
    
    const profile = document.getElementById('profileDropdown');
    if (profile) profile.classList.remove('active');
    
    dropdown.classList.add('active');
};

window.clearAllNotifications = async function() {
    try {
        await Api.clearNotifications();
        window.notifications = [];
        renderNotifications();
        const notifDot = document.getElementById('notifDot');
        if (notifDot) {
            notifDot.style.display = 'none';
        }
        showToast('All notifications cleared.', 'success');
    } catch (e) {
        console.warn('Failed to clear notifications in database:', e);
        showToast('Could not clear notifications.', 'error');
    }
};

// Listen to browser connectivity changes to post system notifications
window.addEventListener('online', () => {
    window.addNotification("Network Connected", "Internet connection restored. Hybrid RAG mode enabled.", "success");
});
window.addEventListener('offline', () => {
    window.addNotification("Network Offline", "Switched automatically to offline RAG mode.", "warning");
});

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

