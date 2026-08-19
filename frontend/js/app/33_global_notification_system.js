/* ────────────────────────────────────────────
   GLOBAL NOTIFICATION SYSTEM
   ──────────────────────────────────────────── */
window.notifications = [];

// Helper to format notification created_at time
function formatNotifTime(dateStr) {
    if (!dateStr) return 'Just now';
    const date = new Date(dateStr);
    const diffMs = Date.now() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

window.loadNotifications = async function() {
    try {
        const notifs = await Api.getNotifications();
        window.notifications = (notifs || []).map(n => ({
            id: n.id,
            title: n.title,
            desc: n.description,
            type: n.type,
            isRead: n.isRead,
            time: formatNotifTime(n.createdAt)
        }));
        
        const hasUnread = (notifs || []).some(n => !n.isRead);
        const notifDot = document.getElementById('notifDot');
        if (notifDot) {
            notifDot.style.display = hasUnread ? 'block' : 'none';
        }
    } catch (e) {
        console.warn('Failed to load notifications from database:', e);
    }
};

window.addNotification = async function(title, desc, type = "info") {
    try {
        await Api.saveNotification(title, desc, type);
        await loadNotifications();
        
        const dropdown = document.getElementById('notificationsDropdown');
        if (dropdown && dropdown.classList.contains('active')) {
            renderNotifications();
        }
    } catch (e) {
        console.warn('Failed to save notification to database:', e);
        const newNotif = {
            id: Date.now(),
            title: title,
            desc: desc,
            type: type,
            isRead: false,
            time: "Just now"
        };
        window.notifications.unshift(newNotif);
        if (window.notifications.length > 15) {
            window.notifications.pop();
        }
        const notifDot = document.getElementById('notifDot');
        if (notifDot) {
            notifDot.style.display = 'block';
        }
        const dropdown = document.getElementById('notificationsDropdown');
        if (dropdown && dropdown.classList.contains('active')) {
            renderNotifications();
        }
    }
};

window.renderNotifications = function() {
    const list = document.getElementById('notificationsList');
    if (!list) return;
    
    if (window.notifications.length === 0) {
        list.innerHTML = `
            <div style="text-align: center; padding: 24px 12px; color: var(--text-600); font-size: 11px; font-family: var(--font-mono);">
                <i class="fa-regular fa-bell-slash" style="font-size: 20px; margin-bottom: 8px; opacity: 0.5; display: block; color: var(--text-400);"></i>
                No notifications active
            </div>
        `;
        return;
    }
    
    list.innerHTML = window.notifications.map(n => {
        let iconHtml = '<i class="fa-solid fa-info"></i>';
        if (n.type === 'success') iconHtml = '<i class="fa-solid fa-check"></i>';
        if (n.type === 'warning') iconHtml = '<i class="fa-solid fa-triangle-exclamation"></i>';
        if (n.type === 'danger')  iconHtml = '<i class="fa-solid fa-circle-exclamation"></i>';
        
        const opacityStyle = n.isRead ? 'opacity: 0.6;' : '';
        return `
            <div class="notif-item" style="${opacityStyle}">
                <div class="notif-item-icon ${n.type}">
                    ${iconHtml}
                </div>
                <div class="notif-item-content">
                    <span class="notif-item-title">${n.title}</span>
                    <span class="notif-item-desc">${n.desc}</span>
                    <span class="notif-item-time">${n.time}</span>
                </div>
            </div>
        `;
    }).join('');
};

window.toggleNotificationsDropdown = async function(e) {
    if (e) {
        e.preventDefault();
        e.stopPropagation();
    }
    const dropdown = document.getElementById('notificationsDropdown');
    if (!dropdown) return;
    
    if (dropdown.classList.contains('active')) {
        dropdown.classList.remove('active');
        return;
    }
    
    const notifDot = document.getElementById('notifDot');
    if (notifDot) {
        notifDot.style.display = 'none';
    }

    try {
        const unreadNotifs = window.notifications.filter(n => !n.isRead);
        for (const n of unreadNotifs) {
            await Api.markNotificationAsRead(n.id);
        }
        await loadNotifications();
    } catch (err) {
        console.warn('Failed to mark notifications as read:', err);
    }
    
    renderNotifications();
    
    const profile = document.getElementById('profileDropdown');
    if (profile) profile.classList.remove('active');
    
    dropdown.classList.add('active');
};

window.clearAllNotifications = async function() {
    try {
        await Api.clearNotifications();
        window.notifications = [];
        renderNotifications();
        const notifDot = document.getElementById('notifDot');
        if (notifDot) {
            notifDot.style.display = 'none';
        }
        showToast('All notifications cleared.', 'success');
    } catch (e) {
        console.warn('Failed to clear notifications in database:', e);
        showToast('Could not clear notifications.', 'error');
    }
};

// Listen to browser connectivity changes to post system notifications
window.addEventListener('online', () => {
    window.addNotification("Network Connected", "Internet connection restored. Hybrid RAG mode enabled.", "success");
});
window.addEventListener('offline', () => {
    window.addNotification("Network Offline", "Switched automatically to offline RAG mode.", "warning");
});
