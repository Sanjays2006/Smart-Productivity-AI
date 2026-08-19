/* ────────────────────────────────────────────
   CHART REGISTRY (prevent double-init)
──────────────────────────────────────────── */
const Charts = {};

function destroyChart(key) {
    if (Charts[key]) { Charts[key].destroy(); delete Charts[key]; }
}
