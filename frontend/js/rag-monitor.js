/**
 * rag-monitor.js — Hybrid RAG Monitor Dashboard
 * Handles live status polling, test queries, source citations,
 * retrieval history, and knowledge base management.
 */

/* ────────────────────────────────────
   State
──────────────────────────────────── */
let ragTestMode = 'hybrid';
let latencyHistory = [];
let _ragRefreshTimer = null;

/* ────────────────────────────────────
   Entry Point
──────────────────────────────────── */
async function loadRagValidation() {
    await Promise.all([
        refreshRagStatus(),
        refreshRagKnowledgeBase(),
        refreshRecentRetrievals()
    ]);
}

/* ────────────────────────────────────
   Mode Selector
──────────────────────────────────── */
function setRagTestMode(mode) {
    ragTestMode = mode;
    document.querySelectorAll('.rag-mode-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.mode === mode);
    });
    // Update mode badge in header
    const badge = document.getElementById('ragModeBadge');
    if (badge) {
        const icons = { hybrid: 'fa-layer-group', offline: 'fa-database', online: 'fa-globe' };
        const colors = { hybrid: 'rgba(99,102,241,0.18)', offline: 'rgba(16,185,129,0.18)', online: 'rgba(6,182,212,0.18)' };
        badge.innerHTML = `<i class="fa-solid ${icons[mode]}"></i> Mode: ${mode.charAt(0).toUpperCase() + mode.slice(1)}`;
        badge.style.background = colors[mode] || '';
    }
}

/* ────────────────────────────────────
   Status Refresh
──────────────────────────────────── */
async function refreshRagStatus() {
    try {
        const s = await Api.getRagStatus();

        // Header badges
        _setBadge('ragNetBadge', s.internetAvailable,
            '<i class="fa-solid fa-wifi"></i> Online', '<i class="fa-solid fa-wifi-slash"></i> Offline');
        _setBadge('ragOllamaBadge', s.ollamaRunning,
            '<i class="fa-solid fa-robot"></i> Ollama Ready', '<i class="fa-solid fa-robot"></i> Ollama Offline');

        // System status panel
        _setBadge('sysNetStatus', s.internetAvailable, '🟢 Connected', '🔴 Offline');
        _setBadge('sysOllamaStatus', s.ollamaRunning, '🟢 Running', '🔴 Offline');

        const recEl = document.getElementById('sysRecommendedMode');
        if (recEl) {
            const modeLabel = (s.recommendedMode || 'hybrid').toUpperCase();
            recEl.textContent = modeLabel;
        }

        // Stat cards
        _setText('ragStatChunks', s.userChunks ?? '—');
        _setText('ragStatDocs', s.userDocuments ?? '—');
        _setText('ragStatQueries', s.totalQueriesSession ?? 0);

        // Mode distribution
        const metrics = await Api.getRagMonitorMetrics();
        updateModeDistribution(metrics);

    } catch (e) {
        console.warn('RAG status error:', e.message);
    }
}

function _setBadge(id, isGood, goodHtml, badHtml) {
    const el = document.getElementById(id);
    if (!el) return;
    el.innerHTML = isGood ? goodHtml : badHtml;
    el.style.background = isGood ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)';
    el.style.color = isGood ? '#10b981' : '#ef4444';
}

function _setText(id, val) {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
}

function updateModeDistribution(metrics) {
    const hybridPct = metrics.hybridPct || 0;
    const offlinePct = metrics.offlinePct || 0;
    const onlinePct  = metrics.onlinePct  || 0;

    const setDist = (barId, pctId, pct) => {
        const bar = document.getElementById(barId);
        const pctEl = document.getElementById(pctId);
        if (bar) bar.style.width = pct + '%';
        if (pctEl) pctEl.textContent = pct + '%';
    };

    setDist('ragDistHybrid', 'ragDistHybridPct', hybridPct);
    setDist('ragDistOffline', 'ragDistOfflinePct', offlinePct);
    setDist('ragDistOnline', 'ragDistOnlinePct', onlinePct);
}

/* ────────────────────────────────────
   Live RAG Query Test
──────────────────────────────────── */
async function runRagTest() {
    const queryInput = document.getElementById('ragTestQuery');
    const query = queryInput ? queryInput.value.trim() : '';
    if (!query) {
        if (typeof showToast === 'function') showToast('Please enter a query', 'warning');
        return;
    }

    const btn = document.getElementById('ragRunBtn');
    const resultsEl = document.getElementById('ragTestResults');
    const metaEl = document.getElementById('ragResultMeta');

    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Retrieving...'; }
    if (resultsEl) resultsEl.innerHTML = '<div style="text-align:center;padding:30px;color:var(--text-400);font-size:12px;"><i class="fa-solid fa-spinner fa-spin" style="font-size:20px;margin-bottom:8px;"></i><br>Searching knowledge base and online sources...</div>';

    try {
        const result = await Api.testRagQuery(query, ragTestMode);

        // Update meta bar
        if (metaEl) {
            metaEl.style.display = 'flex';
            _setText('ragMetaTime', result.retrievalTimeMs);
            _setText('ragMetaMode', (result.activeMode || 'hybrid').toUpperCase());
            _setText('ragMetaLocal', result.localSourceCount + ' source' + (result.localSourceCount !== 1 ? 's' : ''));
            _setText('ragMetaOnline', result.onlineSourceCount + ' source' + (result.onlineSourceCount !== 1 ? 's' : ''));
            _setText('ragMetaNet', result.internetAvailable ? '🟢 Online' : '🔴 Offline');
        }

        // Track latency
        latencyHistory.push(result.retrievalTimeMs);
        if (latencyHistory.length > 20) latencyHistory.shift();
        const avgLatency = Math.round(latencyHistory.reduce((a, b) => a + b, 0) / latencyHistory.length);
        _setText('ragStatLatency', avgLatency);

        // Render sources
        renderSourceCitations(result.allSources || [], resultsEl);

        // Refresh session stats & recent list
        refreshRagStatus();
        refreshRecentRetrievals();

    } catch (e) {
        if (resultsEl) resultsEl.innerHTML = `<div style="text-align:center;padding:30px;color:#ef4444;font-size:12px;">
            <i class="fa-solid fa-circle-exclamation" style="font-size:20px;margin-bottom:8px;"></i><br>
            ${e.message || 'Retrieval failed. Check server logs.'}</div>`;
    } finally {
        if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-bolt"></i> Run Test'; }
    }
}

function renderSourceCitations(sources, container) {
    if (!container) return;
    if (!sources || sources.length === 0) {
        container.innerHTML = `<div style="text-align:center;padding:40px;color:var(--text-400);font-size:12px;border:1px dashed var(--border-glass);border-radius:12px;">
            <i class="fa-solid fa-folder-open" style="font-size:24px;margin-bottom:12px;opacity:0.3;"></i><br>
            No sources retrieved. Try a different query or index more documents.
        </div>`;
        return;
    }

    container.innerHTML = sources.map((src, i) => {
        const isOnline = src.type === 'online';
        const sourceIcon = isOnline ? 'fa-globe' : 'fa-database';
        const sourceBadgeColor = isOnline ? '#06b6d4' : '#10b981';
        const sourceLabel = isOnline ? 'ONLINE' : 'LOCAL';
        const sourceProvider = src.source || (isOnline ? 'web' : 'local');
        const providerIcon = sourceProvider === 'wikipedia' ? 'fa-w' :
                             sourceProvider === 'duckduckgo' ? 'fa-d' : 'fa-bookmark';
        const simScore = src.similarity ? parseFloat(src.similarity) : null;
        const simPct = simScore ? Math.round(simScore * 100) : null;

        const snippet = (src.snippet || src.chunkText || '').substring(0, 320);
        const url = src.url || src.sourceUrl || '#';
        const title = src.title || src.sourceTitle || 'Unknown Source';

        return `
        <div style="padding:14px 16px; background:rgba(255,255,255,0.03); border:1px solid var(--border-glass); border-radius:12px; border-left:3px solid ${sourceBadgeColor}; transition: all 0.2s;" 
             onmouseenter="this.style.background='rgba(255,255,255,0.06)'" 
             onmouseleave="this.style.background='rgba(255,255,255,0.03)'">
            <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:8px; gap:10px;">
                <div style="display:flex; align-items:center; gap:8px; flex:1; min-width:0;">
                    <span style="font-size:10px; font-family:var(--font-mono); font-weight:700; color:white; background:${sourceBadgeColor}; padding:2px 7px; border-radius:6px; flex-shrink:0;">${i + 1}</span>
                    <span style="font-size:10px; font-family:var(--font-mono); font-weight:600; color:${sourceBadgeColor}; background:${isOnline ? 'rgba(6,182,212,0.1)' : 'rgba(16,185,129,0.1)'}; padding:2px 7px; border-radius:6px; flex-shrink:0;">
                        <i class="fa-solid ${sourceIcon}"></i> ${sourceLabel}
                    </span>
                    <a href="${url}" target="_blank" rel="noopener" style="font-size:12px; font-weight:600; color:var(--text-100); text-decoration:none; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; flex:1;" title="${title}">
                        ${title}
                    </a>
                </div>
                <div style="display:flex; align-items:center; gap:6px; flex-shrink:0;">
                    ${simPct !== null ? `<span style="font-size:10px; font-family:var(--font-mono); color:var(--text-300); background:rgba(255,255,255,0.05); padding:2px 8px; border-radius:6px;">${simPct}% match</span>` : ''}
                    ${url !== '#' ? `<a href="${url}" target="_blank" rel="noopener" style="font-size:11px; color:var(--text-400); text-decoration:none; padding:2px 6px;"><i class="fa-solid fa-external-link"></i></a>` : ''}
                </div>
            </div>
            <p style="font-size:11.5px; color:var(--text-300); margin:0; line-height:1.6; font-family:var(--font-mono);">${snippet}${snippet.length >= 320 ? '...' : ''}</p>
            ${url !== '#' && url !== '' ? `<div style="margin-top:8px;"><a href="${url}" target="_blank" rel="noopener" style="font-size:10px; color:var(--text-400); text-decoration:none; font-family:var(--font-mono); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; display:block;">${url.length > 80 ? url.substring(0, 80) + '...' : url}</a></div>` : ''}
        </div>`;
    }).join('');
}

/* ────────────────────────────────────
   Recent Retrievals
──────────────────────────────────── */
async function refreshRecentRetrievals() {
    try {
        const recent = await Api.getRagRecentRetrievals();
        const el = document.getElementById('ragRecentList');
        if (!el) return;

        if (!recent || recent.length === 0) {
            el.innerHTML = '<div style="text-align:center;padding:20px;color:var(--text-400);font-size:12px;">No queries this session yet.</div>';
            return;
        }

        const modeColors = { hybrid: '#6366f1', offline: '#10b981', online: '#06b6d4', offline_fallback: '#f59e0b' };
        el.innerHTML = recent.map(r => {
            const modeColor = modeColors[r.mode] || '#6366f1';
            const ts = r.timestamp ? new Date(r.timestamp).toLocaleTimeString() : '';
            return `
            <div style="display:flex; align-items:center; gap:10px; padding:8px 12px; background:rgba(255,255,255,0.03); border-radius:8px; border:1px solid var(--border-glass);">
                <span style="font-size:10px; font-family:var(--font-mono); color:${modeColor}; background:${modeColor}18; padding:2px 6px; border-radius:4px; flex-shrink:0;">${(r.mode || '').toUpperCase()}</span>
                <span style="font-size:12px; color:var(--text-200); flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${r.query || ''}</span>
                <span style="font-size:10px; color:var(--text-400); font-family:var(--font-mono); flex-shrink:0;">${r.sourceCount} src · ${r.retrievalTimeMs}ms</span>
                <span style="font-size:10px; color:var(--text-400); font-family:var(--font-mono); flex-shrink:0;">${ts}</span>
            </div>`;
        }).join('');
    } catch (e) {
        console.warn('Recent retrievals error:', e.message);
    }
}

/* ────────────────────────────────────
   Knowledge Base Manager
──────────────────────────────────── */
async function refreshRagKnowledgeBase() {
    const kbList = document.getElementById('ragKbList');
    const chunkBadge = document.getElementById('ragChunkBadge');
    if (!kbList) return;

    try {
        const data = await Api.getRagChunks();

        if (chunkBadge) chunkBadge.textContent = `${data.totalChunks} chunks · ${data.embeddingCoverage}% embedded`;

        if (!data.documents || data.documents.length === 0) {
            kbList.innerHTML = '<div style="text-align:center;padding:20px;color:var(--text-400);font-size:12px;">No documents indexed yet.</div>';
            return;
        }

        const typeColors = { 'AI Guide': '#a855f7', 'Note': '#f59e0b', 'Session': '#6366f1', 'Web Document': '#06b6d4' };
        kbList.innerHTML = data.documents.map(doc => {
            const typeColor = typeColors[doc.type] || '#6366f1';
            const embIcon = doc.hasEmbeddings
                ? '<i class="fa-solid fa-circle-check" style="color:#10b981;" title="Vector embeddings available"></i>'
                : '<i class="fa-solid fa-circle-xmark" style="color:#ef4444;" title="No embeddings (offline mode)"></i>';
            return `
            <div style="display:flex; align-items:center; gap:10px; padding:10px 12px; background:rgba(255,255,255,0.03); border-radius:10px; border:1px solid var(--border-glass);">
                <div style="flex:1; min-width:0;">
                    <div style="display:flex; align-items:center; gap:6px; margin-bottom:4px;">
                        <span style="font-size:9px; font-family:var(--font-mono); color:${typeColor}; background:${typeColor}18; padding:1px 6px; border-radius:4px;">${doc.type}</span>
                        ${embIcon}
                        <span style="font-size:10px; color:var(--text-400); font-family:var(--font-mono);">${doc.chunksCount} chunks</span>
                    </div>
                    <div style="font-size:12px; color:var(--text-200); overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="${doc.title}">${doc.title}</div>
                    <div style="font-size:10px; color:var(--text-400); margin-top:2px;">${doc.addedDate}</div>
                </div>
                <button onclick="deleteRagDoc('${encodeURIComponent(doc.url)}')" 
                        style="background:rgba(239,68,68,0.1); border:1px solid rgba(239,68,68,0.2); color:#ef4444; padding:4px 8px; border-radius:6px; cursor:pointer; font-size:11px; flex-shrink:0; transition:all 0.2s;"
                        onmouseenter="this.style.background='rgba(239,68,68,0.25)'" 
                        onmouseleave="this.style.background='rgba(239,68,68,0.1)'"
                        title="Remove from knowledge base">
                    <i class="fa-solid fa-trash"></i>
                </button>
            </div>`;
        }).join('');

    } catch (e) {
        kbList.innerHTML = `<div style="text-align:center;padding:20px;color:#ef4444;font-size:12px;">Failed to load knowledge base: ${e.message}</div>`;
    }
}

async function deleteRagDoc(encodedUrl) {
    const url = decodeURIComponent(encodedUrl);
    try {
        await Api.deleteRagChunk(url);
        if (typeof showToast === 'function') showToast('Document removed from knowledge base.', 'success');
        await refreshRagKnowledgeBase();
        await refreshRagStatus();
    } catch (e) {
        if (typeof showToast === 'function') showToast('Failed to delete: ' + e.message, 'error');
    }
}

/* ────────────────────────────────────
   Auto-refresh while view is active
──────────────────────────────────── */
function startRagAutoRefresh() {
    stopRagAutoRefresh();
    _ragRefreshTimer = setInterval(() => {
        const view = document.getElementById('view-rag-validation');
        if (view && view.classList.contains('active')) {
            refreshRagStatus();
        } else {
            stopRagAutoRefresh();
        }
    }, 15000); // Refresh every 15s
}

function stopRagAutoRefresh() {
    if (_ragRefreshTimer) { clearInterval(_ragRefreshTimer); _ragRefreshTimer = null; }
}

/* ────────────────────────────────────
   Hook into existing app.js switchView
──────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
    // Patch loadRagValidation to also start auto-refresh
    const origLoad = window.loadRagValidation;
    window.loadRagValidation = async function() {
        startRagAutoRefresh();
        if (origLoad) await origLoad();
        else await loadRagValidation();
    };
});
