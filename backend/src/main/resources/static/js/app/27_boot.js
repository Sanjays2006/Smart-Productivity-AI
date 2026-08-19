/* ────────────────────────────────────────────
   BOOT
──────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', async () => {
    // Attach brand logo guide pulse
    const brandLogo = document.querySelector('.brand-logo');
    let logoClick = () => {};
    
    if (brandLogo) {
        brandLogo.classList.add('brand-logo-pulsing');
        
        logoClick = () => {
            const prompt = document.getElementById('lockPromptCard');
            const auth = document.getElementById('authCard');
            if (prompt && auth && prompt.style.display !== 'none') {
                gsap.to(prompt, { opacity: 0, y: 15, duration: 0.4, onComplete: () => {
                    prompt.style.display = 'none';
                    auth.style.display = 'block';
                    gsap.fromTo(auth, { opacity: 0, y: -15, scale: 0.98 }, { opacity: 1, y: 0, scale: 1, duration: 0.5, ease: 'power3.out' });
                }});
                brandLogo.classList.remove('brand-logo-pulsing');
            }
        };

        brandLogo.addEventListener('click', logoClick);
        document.querySelector('.sidebar-brand')?.addEventListener('click', logoClick);
        document.getElementById('lockPromptCard')?.addEventListener('click', logoClick);
    }

    // Initialize forms (guarded — a missing dependency must not abort boot)
    try {
        if (typeof initAuthForms === 'function') initAuthForms();
    } catch (e) {
        console.warn('initAuthForms failed:', e);
    }

    // Silent background authentication check on start
    const lockOverlay = document.getElementById('appLockOverlay');
    try {
        const user = await Api.getMe();
        if (user && user.authenticated) {
            // Session exists! Silently bypass lock screen
            if (lockOverlay) {
                lockOverlay.style.display = 'none';
            }
            if (brandLogo) {
                brandLogo.classList.remove('brand-logo-pulsing');
            }
            
            // Check PG state
            const status = await Api.getDatabaseStatus();
            if (status.configured) {
                bootstrapApp();
            } else {
                initDbSetup(); // Shows the PostgreSQL Setup card and binds form handlers!
            }
        } else {
            // Not logged in: enforce lock overlay
            if (lockOverlay) {
                lockOverlay.style.display = 'flex';
            }
        }
    } catch (e) {
        // Enforce lock overlay on errors
        if (lockOverlay) {
            lockOverlay.style.display = 'flex';
        }
    }
});

/* Inject SVG gradient for timer ring */
function injectTimerGradient() {
    const svg = document.querySelector('.timer-ring-svg');
    if (!svg || svg.querySelector('defs')) return;
    const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
    defs.innerHTML = `
        <linearGradient id="timerGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%"   stop-color="#6366f1"/>
            <stop offset="100%" stop-color="#06b6d4"/>
        </linearGradient>`;
    svg.insertBefore(defs, svg.firstChild);
}
