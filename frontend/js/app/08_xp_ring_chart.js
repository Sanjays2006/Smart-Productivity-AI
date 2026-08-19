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
