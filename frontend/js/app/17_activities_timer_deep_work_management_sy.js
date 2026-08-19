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

        // Safety valve: a session running longer than 12h is stale (e.g. tab left open
        // or a corrupt restored start time). Auto-reset instead of showing 1263h.
        if (elapsed > 12 * 3600 || isNaN(elapsed) || elapsed < 0) {
            clearInterval(timerInterval);
            ['timer_session_id','timer_start','timer_elapsed_before_pause','timer_activity_id',
             'timer_target_seconds','timer_deep_work_mode','timer_is_paused','timer_pause_count']
                .forEach(k => localStorage.removeItem(k));
            currentSessionId = null; timerStart = null; elapsedBeforePause = 0;
            isTimerPaused = false; focusTimerState = 'IDLE'; pauseCount = 0;
            const d = document.getElementById('timerDisplay');
            if (d) d.textContent = '00:00:00';
            if (typeof showToast === 'function') showToast('Stale session cleared. Please start a new session.', 'info');
            return;
        }

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

    // Hard reset before starting: kill any running interval and clear stale timer state
    // so a new session ALWAYS begins at 00:00:00 (never inherits a stale 1264h session).
    if (timerInterval) clearInterval(timerInterval);
    ['timer_session_id','timer_start','timer_elapsed_before_pause','timer_activity_id',
     'timer_target_seconds','timer_deep_work_mode','timer_is_paused','timer_pause_count']
        .forEach(k => localStorage.removeItem(k));
    elapsedBeforePause = 0;
    pauseCount = 0;
    isTimerPaused = false;
    const dispReset = document.getElementById('timerDisplay');
    if (dispReset) dispReset.textContent = '00:00:00';

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

// ── Shared helpers for session completion (used by endSession, confirmEnd, stopSessionEarly) ──
function resetTimerUI() {
    clearInterval(timerInterval);
    currentSessionId = null; timerStart = null; elapsedBeforePause = 0;
    isTimerPaused = false; focusTimerState = 'IDLE'; activeActivityId = null;
    activeActivityData = null; pauseCount = 0;

    ['timer_session_id','timer_start','timer_elapsed_before_pause','timer_activity_id',
     'timer_target_seconds','timer_deep_work_mode','timer_is_paused','timer_pause_count']
        .forEach(k => localStorage.removeItem(k));

    document.getElementById('confirmPanel')?.classList.add('hidden');
    document.getElementById('startBtn')?.classList.remove('hidden');
    ['pauseBtn','resumeBtn','stopBtn','endBtn'].forEach(id => document.getElementById(id)?.classList.add('hidden'));
    document.getElementById('targetDurationSelection')?.classList.remove('hidden');
    document.getElementById('timerDisplay').textContent = '00:00:00';
    document.getElementById('timerRingProgress').style.strokeDashoffset = RING_CIRC;
    document.getElementById('timerStatus').innerHTML = '<span class="status-dot-sm"></span> Ready';
    document.getElementById('activeTaskName').textContent = 'No Session Active';
    document.getElementById('activeTaskCategory').textContent = 'Category: None';
    document.getElementById('focusSessionCard')?.classList.remove('deep-work-active');
    document.getElementById('liveFocusScore').textContent = '100%';
    document.getElementById('liveProductivityRating').textContent = 'Optimal';
    document.getElementById('liveProductivityRating').className = 'fw-bold text-success';
    document.getElementById('liveRemainingTime').textContent = '25:00';
    document.getElementById('timerSessionXp').textContent = '+0 XP';
    document.getElementById('livePausesCount').textContent = '0';
    if (document.getElementById('isPomodoro')) document.getElementById('isPomodoro').checked = false;
    if (document.getElementById('sessionNotes')) document.getElementById('sessionNotes').value = '';
    renderWorkspaceActivities();
}

async function onSessionSaveSuccess(result, savedActiveActivityId) {
    const earnedXp = result.earnedXp || 0;

    // XP Animation
    gsap.fromTo('.timer-face', { scale: 1 }, {
        scale: 1.25, yoyo: true, repeat: 1, duration: 0.3, ease: 'power1.inOut'
    });

    showToast(`🎉 Session complete! +${earnedXp} XP earned!`, 'success', 5000);

    // Floating XP at the activity card
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

    // Confetti
    window.triggerConfetti();

    // Reset everything
    resetTimerUI();

    // Refresh stats
    await loadTimerAnalytics();
    await loadTimerTimeline(0);
    await loadDashboard();
}

window.endSession = async function() {
    clearInterval(timerInterval);

    if (!currentSessionId) {
        showToast('No active session.', 'info');
        resetTimerUI();
        return;
    }

    // Hide timer controls immediately
    document.getElementById('pauseBtn').classList.add('hidden');
    document.getElementById('resumeBtn').classList.add('hidden');
    document.getElementById('stopBtn').classList.add('hidden');
    document.getElementById('endBtn').classList.add('hidden');

    document.getElementById('timerStatus').innerHTML = '<span class="status-dot-sm" style="background:var(--info); box-shadow:0 0 6px var(--info);"></span> Saving...';

    // Immediately save to backend — no two-step dance
    const isPomoChecked = document.getElementById('isPomodoro')?.checked || false;
    const notesVal = document.getElementById('sessionNotes')?.value || '';
    const savedActiveActivityId = activeActivityId;

    try {
        const result = await Api.completeSession(currentSessionId, isPomoChecked, notesVal);
        onSessionSaveSuccess(result, savedActiveActivityId);
    } catch(e) {
        console.error('End session failed:', e);
        const msg = e.message || '';
        if (msg.toLowerCase().includes('already ended') || msg.toLowerCase().includes('already completed')) {
            showToast('Session was already saved!', 'success', 3000);
        } else {
            showToast('Could not save: ' + (msg || 'unknown error'), 'error', 5000);
        }
        resetTimerUI();
    }
}

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
    // confirmEnd now just delegates to endSession (the End button already saves)
    // This handles the case where the confirm panel is still showing from old flow
    if (!currentSessionId) {
        resetTimerUI();
        return;
    }
    // If somehow the confirm panel is visible and session is still active, save it
    const isPomoChecked = document.getElementById('isPomodoro')?.checked || false;
    const notesVal = document.getElementById('sessionNotes')?.value || '';
    const savedActiveActivityId = activeActivityId;

    try {
        const result = await Api.completeSession(currentSessionId, isPomoChecked, notesVal);
        await onSessionSaveSuccess(result, savedActiveActivityId);
    } catch(e) {
        console.error('Save failed:', e);
        const msg = e.message || '';
        if (msg.toLowerCase().includes('already ended') || msg.toLowerCase().includes('already completed')) {
            showToast('Session was already saved!', 'success', 3000);
        } else {
            showToast('Could not save: ' + (msg || 'unknown error'), 'error', 5000);
        }
        resetTimerUI();
    }
}

window.popOutTimer = function() {
    const w = 340, h = 300;
    const left = (screen.width/2)-(w/2);
    const top = (screen.height/2)-(h/2);
    window.open('/timer-popout.html', 'FocusAITimer', `width=${w},height=${h},top=${top},left=${left},status=no,menubar=no,toolbar=no,location=no`);
};

window.stopSessionEarly = async function() {
    // Stop button now acts as Pause — stops the timer but allows resuming.
    // The session is NOT permanently ended. Use "End Session" to complete & save.
    if (!currentSessionId) return;

    if (!isTimerPaused) {
        // Pause the session
        try {
            await Api.pauseSession(currentSessionId);
            
            clearInterval(timerInterval);
            elapsedBeforePause += Math.floor((Date.now() - timerStart) / 1000);
            isTimerPaused = true;
            focusTimerState = 'PAUSED';
            pauseCount++;

            localStorage.setItem('timer_elapsed_before_pause', elapsedBeforePause);
            localStorage.setItem('timer_is_paused', 'true');
            localStorage.setItem('timer_pause_count', pauseCount);

            // UI: show Resume, hide Pause
            document.getElementById('pauseBtn').classList.add('hidden');
            document.getElementById('resumeBtn').classList.remove('hidden');
            document.getElementById('timerStatus').innerHTML = '<span class="status-dot-sm" style="background:var(--warning); box-shadow:0 0 6px var(--warning);"></span> Paused';

            showToast('Session paused. Click Resume to continue.', 'info');
            renderWorkspaceActivities();
        } catch(e) {
            console.error('Stop/pause failed:', e);
            showToast('Could not pause session.', 'error');
        }
    } else {
        // Already paused — resume
        try {
            await Api.resumeSession(currentSessionId);
            timerStart = Date.now();
            isTimerPaused = false;
            focusTimerState = 'ACTIVE';

            localStorage.setItem('timer_start', timerStart);
            localStorage.setItem('timer_is_paused', 'false');

            document.getElementById('resumeBtn').classList.add('hidden');
            document.getElementById('pauseBtn').classList.remove('hidden');
            document.getElementById('timerStatus').innerHTML = '<span class="status-dot-sm" style="background:var(--success); box-shadow:0 0 6px var(--success);"></span> Focusing';

            startInterval();
            showToast('Session resumed!', 'success');
            renderWorkspaceActivities();
        } catch(e) {
            console.error('Resume failed:', e);
            showToast('Could not resume session.', 'error');
        }
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

    // Guard against stale/corrupt sessions left in localStorage from a previous
    // browser session. Without this, an active session whose timer_start is hours
    // or days old computes a nonsensical elapsed time (e.g. 1245:50:44).
    if (savedId && savedStart && savedIsPaused !== 'true') {
        const startMs = parseInt(savedStart);
        const elapsedBefore = parseInt(savedElapsed) || 0;
        const computedElapsed = elapsedBefore + Math.floor((Date.now() - startMs) / 1000);
        // If the session has been "running" for more than 12 hours it is stale — discard it.
        const MAX_SESSION_SECONDS = 12 * 3600;
        if (!startMs || isNaN(startMs) || computedElapsed > MAX_SESSION_SECONDS || computedElapsed < 0) {
            ['timer_session_id','timer_start','timer_elapsed_before_pause','timer_activity_id',
             'timer_target_seconds','timer_deep_work_mode','timer_is_paused','timer_pause_count']
                .forEach(k => localStorage.removeItem(k));
            focusTimerState = 'IDLE';
            return;
        }
    }

    if (savedId && savedActId) {
        currentSessionId = savedId;

        // Validate that this session still exists on the backend.
        // After a server restart, H2 DB is fresh and old sessions are gone.
        try {
            const check = await apiFetch(`${API_BASE}/sessions/${savedId}/status`);
            if (!check || check.status === 'COMPLETED' || check.status === 'STOPPED') {
                throw new Error('Session ended or not found');
            }
        } catch(e) {
            // Session doesn't exist on backend anymore — clear stale localStorage
            console.warn('Stored session no longer valid on backend, clearing:', e.message);
            ['timer_session_id','timer_start','timer_elapsed_before_pause','timer_activity_id',
             'timer_target_seconds','timer_deep_work_mode','timer_is_paused','timer_pause_count']
                .forEach(k => localStorage.removeItem(k));
            currentSessionId = null;
            focusTimerState = 'IDLE';
            return;
        }

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
        document.getElementById('stopBtn').classList.remove('hidden');

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
