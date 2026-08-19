/* ────────────────────────────────────────────
   LEVEL-UP CELEBRATION STATE CHECK
──────────────────────────────────────────── */
let _currentLevelState = null;

function checkLevelUp(newLevel) {
    if (_currentLevelState === null) {
        _currentLevelState = newLevel;
        return;
    }

    if (newLevel > _currentLevelState) {
        const oldLevel = _currentLevelState;
        _currentLevelState = newLevel;
        
        const overlay = document.getElementById('levelUpOverlay');
        const oldEl   = document.getElementById('levelUpOld');
        const newEl   = document.getElementById('levelUpNew');
        const rankEl  = document.getElementById('levelUpRankName');

        if (oldEl) oldEl.textContent = oldLevel;
        if (newEl) newEl.textContent = newLevel;
        
        if (rankEl) {
            const titles = {
                1: 'Focus Rookie',
                5: 'Time Trainee',
                10: 'Productivity Pro',
                20: 'Deep Work Master',
                40: 'Flow State Legend',
                70: 'Zen Architect'
            };
            let matched = 'Focus Rookie';
            for (let l of Object.keys(titles).map(Number).sort((a,b)=>a-b)) {
                if (newLevel >= l) matched = titles[l];
            }
            rankEl.textContent = matched;
        }

        if (overlay) {
            overlay.style.display = 'flex';
            if (typeof gsap !== 'undefined') {
                gsap.killTweensOf('#levelUpOverlay .level-up-card');
                gsap.fromTo('#levelUpOverlay .level-up-card',
                    { scale: 0.5, rotation: -10, opacity: 0 },
                    { scale: 1, rotation: 0, opacity: 1, duration: 0.8, ease: 'back.out(1.5)' }
                );
            }
        }

        // Trigger confetti burst
        if (typeof spawnConfetti === 'function') {
            spawnConfetti(50);
        }
        
        // Holographic flip on avatar
        const avatar = document.getElementById('avatarEl');
        if (avatar && typeof gsap !== 'undefined') {
            gsap.fromTo(avatar, 
                { rotationY: 0 },
                { rotationY: 360, duration: 1.2, ease: 'power2.out' }
            );
        }
    }
}

window.closeLevelUpOverlay = function() {
    const overlay = document.getElementById('levelUpOverlay');
    if (overlay) {
        if (typeof gsap !== 'undefined') {
            gsap.to('#levelUpOverlay .level-up-card', {
                scale: 0.7, opacity: 0, duration: 0.4, ease: 'power2.in',
                onComplete: () => { overlay.style.display = 'none'; }
            });
        } else {
            overlay.style.display = 'none';
        }
    }
};
