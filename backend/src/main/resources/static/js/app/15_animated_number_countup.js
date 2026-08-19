/* ────────────────────────────────────────────
   ANIMATED NUMBER COUNTUP
──────────────────────────────────────────── */
function animateNumber(id, target) {
    const el = document.getElementById(id);
    if (!el) return;
    const start = parseInt(el.textContent) || 0;
    if (start === target) return;
    const obj = { val: start };
    gsap.to(obj, { val: target, duration: 0.8, ease: 'power2.out',
        onUpdate: function() { el.textContent = Math.round(obj.val); }
    });
}
