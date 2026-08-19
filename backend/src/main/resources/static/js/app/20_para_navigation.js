/* ────────────────────────────────────────────
   PARA NAVIGATION
──────────────────────────────────────────── */
document.querySelectorAll('.para-item').forEach(item => {
    item.addEventListener('click', () => {
        document.querySelectorAll('.para-item').forEach(i => i.classList.remove('active'));
        item.classList.add('active');
        showToast(`${item.getAttribute('title')} context activated.`, 'info', 2000);
    });
});
