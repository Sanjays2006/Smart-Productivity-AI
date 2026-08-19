/* ────────────────────────────────────────────
   QUESTS & REWARDS SHOP
──────────────────────────────────────────── */
async function loadChallenges() {
    const container = document.getElementById('dailyChallengesList');
    if (!container) return;

    try {
        const challenges = await Api.getChallenges();
        container.innerHTML = challenges.map(c => {
            const check = c.completed ? '<i class="fa-solid fa-circle-check text-success fs-6"></i>' : '<i class="fa-regular fa-circle text-muted fs-6"></i>';
            const progressPct = Math.min((c.progress / c.target) * 100, 100);
            const progressText = `${c.progress}/${c.target}`;
            return `
                <div class="quest-card glass-inner p-2 d-flex align-items-center gap-2" style="border-radius: 8px; border: 1px solid rgba(255,255,255,0.03); background: rgba(0,0,0,0.12);">
                    <div class="quest-status d-flex align-items-center justify-content-center">${check}</div>
                    <div class="quest-body flex-grow-1" style="min-width:0;">
                        <div class="d-flex justify-content-between align-items-center mb-1">
                            <span class="quest-title text-light fw-bold" style="font-size: 10.5px; white-space: normal; word-break: break-word;" title="${escHtml(c.name)}">${escHtml(c.name)}</span>
                            <span class="quest-progress text-muted" style="font-size: 9px; font-family: var(--font-mono);">${progressText}</span>
                        </div>
                        <div class="progress" style="height: 4px; background: rgba(255,255,255,0.05); border-radius: 2px;">
                            <div class="progress-bar ${c.completed ? 'bg-success' : 'bg-primary'}" style="width: ${progressPct}%; height: 100%; transition: width 0.4s;"></div>
                        </div>
                    </div>
                    <div class="quest-reward" style="font-size: 8.5px; font-family: var(--font-mono); text-align: right; line-height: 1.2; flex-shrink:0;">
                        <div class="text-success">+${c.xpReward}xp</div>
                        <div class="text-warning">+${c.coinReward}c</div>
                    </div>
                </div>
            `;
        }).join('');
    } catch (e) {
        console.warn('Could not load challenges:', e);
        container.innerHTML = '<div class="text-center p-3 text-muted small">Quests temporarily unavailable.</div>';
    }
}

async function loadShop() {
    const container = document.getElementById('sidebarShopList');
    if (!container) return;

    try {
        const rewards = await Api.getRewards();
        container.innerHTML = rewards.map(r => {
            const owned = r.unlocked;
            const costText = owned ? 'OWNED' : `<i class="fa-solid fa-coins"></i> ${r.coinCost}`;
            const btnClass = owned ? 'btn-ghost' : 'btn-primary btn-glow';
            const disabled = owned ? 'disabled' : '';
            return `
                <div class="shop-card glass-inner p-2 d-flex align-items-center justify-content-between" style="border-radius: 8px; border: 1px solid rgba(255,255,255,0.03); background: rgba(0,0,0,0.12); gap: 8px;">
                    <div class="shop-body" style="flex: 1; min-width: 0;">
                        <div class="shop-title text-light fw-bold" style="font-size: 10.5px; width: 100%; white-space: normal; word-break: break-word;" title="${escHtml(r.title)}">${escHtml(r.title)}</div>
                        <div class="shop-desc text-muted" style="font-size: 9px; margin-top: 1px; width: 100%; white-space: normal; word-break: break-word;" title="${escHtml(r.description)}">${escHtml(r.description)}</div>
                    </div>
                    <button class="${btnClass} shop-buy-btn" style="padding: 2px 6px; font-size: 9.5px; font-family: var(--font-mono); min-width: 60px; height: 24px; border-radius: 6px; flex-shrink: 0;" 
                            ${disabled} onclick="purchaseShopItem(event, '${r.code}', ${r.coinCost})">
                        ${costText}
                    </button>
                </div>
            `;
        }).join('');
    } catch (e) {
        console.warn('Could not load shop:', e);
        container.innerHTML = '<div class="text-center p-3 text-muted small">Shop temporarily unavailable.</div>';
    }
}

window.purchaseShopItem = async function(event, rewardCode, coinCost) {
    try {
        const res = await Api.purchaseReward(rewardCode);
        if (res.success) {
            showToast(`🎉 Purchased: ${rewardCode}!`, 'success');
            
            // Floating coin deduction indicator
            if (event && event.target) {
                const rect = event.target.getBoundingClientRect();
                triggerXpPop(`-${coinCost} Coins`, rect.left + rect.width / 2, rect.top);
            }
            
            await loadDashboard();
        } else {
            showToast(res.error || 'Failed to purchase item.', 'error');
        }
    } catch (e) {
        console.error(e);
        showToast('Purchase failed.', 'error');
    }
};

function triggerXpPop(text, x, y) {
    const pop = document.createElement('div');
    pop.className = 'xp-float-indicator';
    pop.textContent = text;
    pop.style.position = 'fixed';
    pop.style.left = `${x}px`;
    pop.style.top = `${y}px`;
    pop.style.color = text.startsWith('-') ? '#ff5555' : '#00ff9d';
    pop.style.textShadow = '0 0 10px rgba(0,0,0,0.8)';
    pop.style.fontFamily = 'var(--font-mono)';
    pop.style.fontSize = '14px';
    pop.style.fontWeight = 'bold';
    pop.style.pointerEvents = 'none';
    pop.style.zIndex = '99999';
    document.body.appendChild(pop);

    if (typeof gsap !== 'undefined') {
        gsap.to(pop, {
            y: -50,
            opacity: 0,
            duration: 1.2,
            ease: 'power2.out',
            onComplete: () => pop.remove()
        });
    } else {
        setTimeout(() => pop.remove(), 1200);
    }
}
