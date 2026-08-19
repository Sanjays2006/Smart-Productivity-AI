/**
 * theme.js — Unified premium Dark/Light theme manager, cursor glow, scroll reveal, level-up animations
 */

/* ── Theme Toggle (Unified Single Source of Truth) ─────────────────── */
function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    const btn = document.getElementById('themeToggle');
    if (btn) {
        const icon = btn.querySelector('i') || document.getElementById('themeIcon');
        const text = btn.querySelector('span');
        
        if (icon) {
            icon.className = theme === 'dark' ? 'fa-solid fa-moon' : 'fa-solid fa-sun';
            icon.style.color = theme === 'dark' ? '#818cf8' : '#f59e0b';
        }
        if (text) {
            text.textContent = theme === 'dark' ? 'Dark' : 'Light';
        }
    }
}

(function initTheme() {
    const saved = localStorage.getItem('ft-theme') || 'dark';
    applyTheme(saved);

    const setupListener = () => {
        const toggleBtn = document.getElementById('themeToggle');
        if (toggleBtn) {
            // Clone toggleBtn to strip any duplicate/stale event listeners
            const newToggle = toggleBtn.cloneNode(true);
            toggleBtn.parentNode.replaceChild(newToggle, toggleBtn);
            
            // Re-apply theme styling to the new node
            applyTheme(localStorage.getItem('ft-theme') || 'dark');
            
            newToggle.addEventListener('click', () => {
                const current = document.documentElement.getAttribute('data-theme') || 'dark';
                const next = current === 'dark' ? 'light' : 'dark';
                applyTheme(next);
                localStorage.setItem('ft-theme', next);
            });
        }
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', setupListener);
    } else {
        setupListener();
    }
})();

/* ── Cursor Glow ────────────────────────────────────── */
(function initCursorGlow() {
    const glow = document.getElementById('cursor-glow');
    if (!glow) return;
    document.addEventListener('mousemove', e => {
        glow.style.left = e.clientX + 'px';
        glow.style.top  = e.clientY + 'px';
    });
    document.addEventListener('mouseleave', () => { glow.style.opacity = '0'; });
    document.addEventListener('mouseenter', () => { glow.style.opacity = '1'; });
})();

/* ── Scroll Reveal ──────────────────────────────────── */
function initScrollReveal() {
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(e => {
            if (e.isIntersecting) {
                e.target.classList.add('visible');
                observer.unobserve(e.target);
            }
        });
    }, { threshold: 0.08 });

    // Only animate cards NOT in the currently active view
    document.querySelectorAll('.kpi-card, .chart-card, .glass-card, .note-card').forEach(el => {
        const inActiveView = el.closest('.view.active');
        if (inActiveView) {
            el.style.opacity = '1';
            el.style.transform = 'none';
        } else {
            el.classList.add('reveal');
            observer.observe(el);
        }
    });
}

// Call after each view switch
window.applyScrollReveal = initScrollReveal;

/* ── Level-Up Celebration ───────────────────────────── */
let _lastLevel = 1;

window.checkLevelUp = function(newLevel) {
    if (newLevel > _lastLevel) {
        _lastLevel = newLevel;
        triggerLevelUpCelebration(newLevel);
    }
};

function triggerLevelUpCelebration(level) {
    const avatar = document.getElementById('avatarEl');
    if (avatar) {
        avatar.classList.remove('level-up-animate');
        void avatar.offsetWidth; // reflow
        avatar.classList.add('level-up-animate');
        setTimeout(() => avatar.classList.remove('level-up-animate'), 800);
    }

    spawnConfetti(40);

    if (typeof showToast === 'function') {
        showToast(`🎊 LEVEL UP! You reached Level ${level}!`, 'success', 5000);
    }

    if (typeof gsap !== 'undefined') {
        gsap.fromTo('#sidebarLevel',
            { scale: 1.5, color: '#f59e0b' },
            { scale: 1, color: '', duration: 0.8, ease: 'elastic.out(1.2, 0.5)' }
        );
    }
}

function spawnConfetti(count) {
    const colors = ['#6366f1','#06b6d4','#10b981','#f59e0b','#ec4899','#818cf8'];
    for (let i = 0; i < count; i++) {
        const el = document.createElement('div');
        el.className = 'confetti-piece';
        el.style.cssText = `
            left:${20 + Math.random() * 60}vw;
            top:${Math.random() * 30}vh;
            background:${colors[Math.floor(Math.random() * colors.length)]};
            animation-delay:${Math.random() * 0.6}s;
            animation-duration:${0.8 + Math.random() * 0.8}s;
            transform:rotate(${Math.random()*360}deg);
        `;
        document.body.appendChild(el);
        setTimeout(() => el.remove(), 2000);
    }
}

/* ── Extension Redirect Button ──────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
    const btn = document.getElementById('addExtensionBtn');
    if (!btn) return;

    btn.addEventListener('click', () => {
        try {
            const newTab = window.open('chrome://extensions', '_blank');
            if (!newTab || newTab.closed || typeof newTab.closed === 'undefined') {
                throw new Error('blocked');
            }
        } catch (e) {
            navigator.clipboard.writeText('chrome://extensions').then(() => {
                btn.textContent = '✅ URL Copied! Paste it in Chrome address bar';
                btn.style.background = 'linear-gradient(135deg,#10b981,#059669)';
                if (typeof showToast === 'function') {
                    showToast('📋 Copied! Paste chrome://extensions in your Chrome address bar, then load the extension/ folder.', 'info', 7000);
                }
                setTimeout(() => {
                    btn.innerHTML = '<span>🧩</span> Add to Chrome — Open Extensions Page';
                    btn.style.background = '';
                }, 5000);
            }).catch(() => {
                if (typeof showToast === 'function') {
                    showToast('Open Chrome and go to: chrome://extensions', 'info', 6000);
                }
            });
        }
    });
});

/* ── GSAP Scroll-triggered card reveals on view switch ── */
document.addEventListener('DOMContentLoaded', () => {
    if (typeof gsap === 'undefined') return;

    const main = document.getElementById('mainContent');
    if (main) {
        main.addEventListener('scroll', () => {
            const scrollY = main.scrollTop;
            const particles = document.getElementById('particles-js');
            if (particles) {
                particles.style.transform = `translateY(${scrollY * 0.15}px)`;
            }
        });
    }
});
