/* ────────────────────────────────────────────
   BOOTSTRAP APPLICATION SERVICES
──────────────────────────────────────────── */
async function bootstrapApp() {
    if (window.appBootstrapped) return;

    // Check onboarding status
    if (window.currentUser && !window.currentUser.onboarded) {
        const onboardOverlay = document.getElementById('onboardingOverlay');
        if (onboardOverlay) {
            onboardOverlay.style.display = 'flex';
            const brandLogo = document.querySelector('.brand-logo');
            if (brandLogo) brandLogo.classList.remove('brand-logo-pulsing');
            return;
        }
    }

    window.appBootstrapped = true;

    // Theme initialized globally by theme.js
    setGreeting();
    initParticles();
    injectTimerGradient();
    initMobileNav();
    loadAiStatus();
    setInterval(loadAiStatus, 30000);
    if (window.initAiChat) window.initAiChat();
    initDiagnostics();

    // Sidebar entrance
    gsap.from('.logo',     { opacity: 0, x: -20, duration: 0.6, ease: 'power2.out' });
    gsap.from('.gam-card', { opacity: 0, x: -20, duration: 0.6, delay: 0.1, ease: 'power2.out' });
    gsap.from('.nav-item', { 
        opacity: 0, 
        x: -20, 
        duration: 0.5, 
        stagger: 0.07, 
        delay: 0.2, 
        ease: 'power2.out',
        clearProps: 'all'
    });

    // Load data
    loadActivities();
    loadNotifications();
    resumeTimerIfAny();

    // Load first view
    await loadDashboard();
    gsap.set('#view-dashboard', { opacity: 1 });
}
