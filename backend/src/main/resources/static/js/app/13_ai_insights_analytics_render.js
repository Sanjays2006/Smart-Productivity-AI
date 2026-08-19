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
