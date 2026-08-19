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
