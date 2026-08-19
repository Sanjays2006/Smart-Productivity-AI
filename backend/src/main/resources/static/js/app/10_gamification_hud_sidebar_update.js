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
