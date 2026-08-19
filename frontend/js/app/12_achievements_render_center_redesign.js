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
