/* ────────────────────────────────────────────
   NOTES
──────────────────────────────────────────── */
function safeFmtDate(dateVal) {
    if (!dateVal) return 'Just now';
    if (Array.isArray(dateVal)) {
        const [yr, mo, dy, hr, mn, sc] = dateVal;
        return new Date(yr, (mo || 1) - 1, dy || 1, hr || 0, mn || 0, sc || 0).toLocaleString();
    }
    const d = new Date(dateVal);
    return isNaN(d.getTime()) ? 'Just now' : d.toLocaleString();
}

async function loadNotes() {
    try {
        const notes = await Api.getNotes();
        const feed  = document.getElementById('notesList');
        if (!feed) return;

        if (!notes || notes.length === 0) {
            feed.innerHTML = '<div class="glass-card" style="padding:24px;text-align:center;color:var(--text-400)">No notes yet. Write your first one! 📝</div>';
            return;
        }

        feed.innerHTML = notes.map(n => `
            <div class="glass-card note-card">
                <p class="note-card-title">${escHtml(n.title || 'Untitled')}</p>
                <p class="note-card-body">${escHtml(n.content || '')}</p>
                <p class="note-card-date">${safeFmtDate(n.createdAt)}</p>
            </div>
        `).join('');

        gsap.fromTo('.note-card', { opacity:0, y:15 }, { opacity:1, y:0, duration:0.4, stagger:0.08, ease:'power2.out' });
    } catch(e) {
        console.error(e);
    }
}

document.getElementById('saveNoteBtn')?.addEventListener('click', async () => {
    const btn = document.getElementById('saveNoteBtn');
    const origText = btn.innerHTML;
    
    try {
        const title   = document.getElementById('noteTitle').value.trim();
        const content = document.getElementById('noteContent').value.trim();
        if (!title || !content) return showToast('Fill in both title and content.', 'error');

        // Show premium loading state
        btn.disabled = true;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Saving...';

        await Api.createNote(title, content);

        document.getElementById('noteTitle').value   = '';
        document.getElementById('noteContent').value = '';
        showToast('Note saved! 📝', 'success');

        await loadNotes();
    } catch (e) {
        console.error('Failed to save note:', e);
        showToast('Failed to save note: ' + (e.message || 'Server error'), 'error');
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = origText;
        }
    }
});
