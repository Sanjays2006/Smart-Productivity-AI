 /* ────────────────────────────────────────────
    PARTICLES BACKGROUND
 ──────────────────────────────────────────── */
 function initParticles() {
    if (typeof particlesJS === 'undefined') return;
    particlesJS('particles-js', {
        particles: {
            number: { value: 60, density: { enable: true, value_area: 900 } },
            color: { value: ['#6366f1', '#06b6d4', '#818cf8'] },
            shape: { type: 'circle' },
            opacity: { value: 0.25, random: true, anim: { enable: true, speed: 0.8, opacity_min: 0.05 } },
            size: { value: 2.5, random: true },
            line_linked: { enable: true, distance: 140, color: '#6366f1', opacity: 0.08, width: 1 },
            move: { enable: true, speed: 0.6, direction: 'none', random: true, out_mode: 'out' }
        },
        interactivity: {
            detect_on: 'window',
            events: { onhover: { enable: true, mode: 'grab' }, onclick: { enable: true, mode: 'push' }, resize: true },
            modes: { grab: { distance: 160, line_linked: { opacity: 0.3 } }, push: { particles_nb: 2 } }
        },
        retina_detect: true
    });
}
