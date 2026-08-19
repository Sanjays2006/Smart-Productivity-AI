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
