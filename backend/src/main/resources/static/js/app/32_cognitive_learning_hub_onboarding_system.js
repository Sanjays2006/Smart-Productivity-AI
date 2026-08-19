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

