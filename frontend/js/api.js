/**
 * api.js — Centralized API Service with JWT Support
 */
const API_BASE = '/api';

const Token = {
    get: () => localStorage.getItem('focus_ai_token'),
    set: (t) => localStorage.setItem('focus_ai_token', t),
    clear: () => localStorage.removeItem('focus_ai_token')
};

async function apiFetch(url, options = {}) {
    const token = Token.get();
    const headers = {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        ...(options.headers || {})
    };

    const controller = new AbortController();
    const timeoutId  = setTimeout(() => controller.abort(), 180000); // 180s for CPU-based local AI

    try {
        const r = await fetch(url, { ...options, headers, signal: controller.signal });
        clearTimeout(timeoutId);

        if (r.status === 401 && !url.includes('/auth/login')) {
            // Token expired or invalid
            Token.clear();
            const lockOverlay = document.getElementById('appLockOverlay');
            if (lockOverlay) {
                lockOverlay.style.display = 'flex';
                lockOverlay.style.opacity = '1';
            }
        }

        if (!r.ok) {
            const err = await r.json().catch(() => ({ error: r.statusText }));
            throw new Error(err.error || `HTTP ${r.status}`);
        }

        const contentType = r.headers.get('content-type') || '';
        if (contentType.includes('application/json')) return r.json();
        return r.text();
    } catch (e) {
        clearTimeout(timeoutId);
        if (e.name === 'AbortError') throw new Error('Request timed out');
        throw e;
    }
}

const Api = {
    // ── Auth ──────────────────────────────────────────────────
    async login(username, password) {
        const res = await apiFetch(`${API_BASE}/auth/login`, {
            method: 'POST',
            body: JSON.stringify({ username, password })
        });
        if (res.token) Token.set(res.token);
        return res;
    },

    async register(username, email, password) {
        const res = await apiFetch(`${API_BASE}/auth/register`, {
            method: 'POST',
            body: JSON.stringify({ username, email, password })
        });
        if (res.token) Token.set(res.token);
        return res;
    },

    async getMe() {
        return apiFetch(`${API_BASE}/auth/me`);
    },

    logout() {
        Token.clear();
        window.location.href = '/';
    },

    // ── Dashboard & Gamification ──────────────────────────────
    async getDashboard() {
        return apiFetch(`${API_BASE}/dashboard`);
    },

    async getAiInsights() {
        return apiFetch(`${API_BASE}/ai/insights`);
    },

    async getRecentSessions() {
        return apiFetch(`${API_BASE}/dashboard/recent-sessions`);
    },

    async getGamificationProfile() {
        return apiFetch(`${API_BASE}/gamification/profile`);
    },

    async getAchievements() {
        return apiFetch(`${API_BASE}/gamification/achievements`);
    },

    async getRewards() {
        return apiFetch(`${API_BASE}/gamification/rewards`);
    },

    async purchaseReward(rewardCode) {
        return apiFetch(`${API_BASE}/gamification/rewards/purchase`, {
            method: 'POST',
            body: JSON.stringify({ rewardCode })
        });
    },

    async getChallenges() {
        return apiFetch(`${API_BASE}/gamification/challenges`);
    },

    async getXpHistory() {
        return apiFetch(`${API_BASE}/gamification/xp-history`);
    },

    // ── Activities ────────────────────────────────────────────
    async getActivities() {
        return apiFetch(`${API_BASE}/activities`);
    },

    async createActivity(name, colorCode, icon, category, difficulty, estimatedDuration, priority) {
        return apiFetch(`${API_BASE}/activities`, {
            method: 'POST',
            body: JSON.stringify({
                name,
                colorCode: colorCode || '#6366F1',
                icon: icon || 'fa-briefcase',
                category: category || 'CUSTOM',
                difficulty: difficulty || 'MEDIUM',
                estimatedDuration: estimatedDuration ? parseInt(estimatedDuration) : 25,
                priority: priority || 'MEDIUM'
            })
        });
    },

    async updateActivity(activityId, details) {
        return apiFetch(`${API_BASE}/activities/${activityId}`, {
            method: 'PUT',
            body: JSON.stringify(details)
        });
    },

    async deleteActivity(activityId) {
        return apiFetch(`${API_BASE}/activities/${activityId}`, {
            method: 'DELETE'
        });
    },

    async toggleFavoriteActivity(activityId) {
        return apiFetch(`${API_BASE}/activities/${activityId}/favorite`, {
            method: 'POST'
        });
    },

    async updateActivityTags(activityId, tags) {
        return apiFetch(`${API_BASE}/activities/${activityId}/tags`, {
            method: 'PUT',
            body: JSON.stringify({ tags: tags || '' })
        });
    },


    async startSession(activityId, targetSeconds, deepWorkMode) {
        const params = new URLSearchParams({
            activityId: activityId,
            targetSeconds: targetSeconds || 1500,
            deepWorkMode: !!deepWorkMode
        });
        return apiFetch(`${API_BASE}/sessions/start?${params}`, { method: 'POST' });
    },

    async pauseSession(sessionId) {
        return apiFetch(`${API_BASE}/sessions/${sessionId}/pause`, { method: 'POST' });
    },

    async resumeSession(sessionId) {
        return apiFetch(`${API_BASE}/sessions/${sessionId}/resume`, { method: 'POST' });
    },

    async endSession(sessionId, isPomodoro, notes) {
        const params = new URLSearchParams({ isPomodoro: !!isPomodoro, notes: notes || '' });
        return apiFetch(`${API_BASE}/sessions/${sessionId}/end?${params}`, { method: 'POST' });
    },

    async stopSession(sessionId) {
        return apiFetch(`${API_BASE}/sessions/${sessionId}/stop`, { method: 'POST' });
    },

    async completeSession(sessionId, isPomodoro, notes) {
        const params = new URLSearchParams({ isPomodoro: !!isPomodoro, notes: notes || '' });
        return apiFetch(`${API_BASE}/sessions/${sessionId}/complete?${params}`, { method: 'POST' });
    },

    async getTimerAnalytics() {
        return apiFetch(`${API_BASE}/sessions/analytics`);
    },

    // ── History ───────────────────────────────────────────────
    async getHistory() {
        return apiFetch(`${API_BASE}/history`);
    },

    async getAllSessions() {
        return apiFetch(`${API_BASE}/history/sessions`);
    },

    // ── Notes ─────────────────────────────────────────────────
    async getNotes() {
        return apiFetch(`${API_BASE}/notes`);
    },

    async createNote(title, content) {
        return apiFetch(`${API_BASE}/notes`, {
            method: 'POST',
            body: JSON.stringify({ title, content })
        });
    },

    // ── Web Tracking (Study Monitor) ──────────────────────────
    async getTodaySites() {
        return apiFetch(`${API_BASE}/tracking/today`);
    },

    // ── AI Assistant ──────────────────────────────────────────
    async askAi(question, mode) {
        return apiFetch(`${API_BASE}/ai/ask`, {
            method: 'POST',
            body: JSON.stringify({ question, mode })
        });
    },

    async getConversations() {
        return apiFetch(`${API_BASE}/ai/conversations`);
    },

    async getAiStatus() {
        return apiFetch(`${API_BASE}/ai/status`);
    },

    // ── Database Configuration ────────────────────────────────
    async getDatabaseStatus() {
        return apiFetch(`${API_BASE}/config/status`);
    },

    async setupDatabase(host, port, dbName, username, password) {
        return apiFetch(`${API_BASE}/config/setup`, {
            method: 'POST',
            body: JSON.stringify({ host, port, dbName, username, password })
        });
    },

    // ── Diagnostic APIs ───────────────────────────────────────
    async getHealth() {
        return apiFetch(`${API_BASE}/diagnostic/health`);
    },

    async getDbMetrics() {
        return apiFetch(`${API_BASE}/diagnostic/db-metrics`);
    },

    async getTableData(tableName) {
        return apiFetch(`${API_BASE}/diagnostic/db-table/${tableName}`);
    },

    async getRagMetrics() {
        return apiFetch(`${API_BASE}/diagnostic/rag-metrics`);
    },

    async testRagSimilarity(query, mode) {
        return apiFetch(`${API_BASE}/diagnostic/rag-test?query=${encodeURIComponent(query)}&mode=${encodeURIComponent(mode || 'hybrid')}`);
    },

    // ── Learning Assistant ────────────────────────────────────
    async saveOnboarding(useCase, selectedTopics, customInterests, resourceCollectionAllowed) {
        return apiFetch(`${API_BASE}/learning/onboard`, {
            method: 'POST',
            body: JSON.stringify({ useCase, selectedTopics, customInterests, resourceCollectionAllowed })
        });
    },

    async getLearningProfile() {
        return apiFetch(`${API_BASE}/learning/profile`);
    },

    async getLearningStats() {
        return apiFetch(`${API_BASE}/learning/stats`);
    },

    async triggerManualCrawl() {
        return apiFetch(`${API_BASE}/learning/trigger-crawl`, { method: 'POST' });
    },

    async indexCustomDocument(urlOrTopic) {
        return apiFetch(`${API_BASE}/learning/add-document`, {
            method: 'POST',
            body: JSON.stringify({ urlOrTopic })
        });
    },

    // ── RAG Monitor ───────────────────────────────────────────
    async getRagStatus() {
        return apiFetch(`${API_BASE}/rag/status`);
    },

    async getRagNetwork() {
        return apiFetch(`${API_BASE}/rag/network`);
    },

    async testRagQuery(query, mode) {
        return apiFetch(`${API_BASE}/rag/test`, {
            method: 'POST',
            body: JSON.stringify({ query, mode: mode || 'hybrid' })
        });
    },

    async getRagRecentRetrievals() {
        return apiFetch(`${API_BASE}/rag/recent`);
    },

    async getRagChunks() {
        return apiFetch(`${API_BASE}/rag/chunks`);
    },

    async deleteRagChunk(sourceUrl) {
        return apiFetch(`${API_BASE}/rag/chunks?sourceUrl=${encodeURIComponent(sourceUrl)}`, { method: 'DELETE' });
    },

    async getRagMonitorMetrics() {
        return apiFetch(`${API_BASE}/rag/metrics`);
    },

    // ── Activity Intelligence ────────────────────────────────
    async trackActivity(category, action, description, metadata, relatedRecordId) {
        return apiFetch(`${API_BASE}/activity/track`, {
            method: 'POST',
            body: JSON.stringify({ category, action, description, metadata, relatedRecordId })
        });
    },

    async searchActivities(query, category, startDate, endDate) {
        const params = new URLSearchParams();
        if (query) params.append('query', query);
        if (category) params.append('category', category);
        if (startDate) params.append('startDate', startDate);
        if (endDate) params.append('endDate', endDate);
        return apiFetch(`${API_BASE}/activity/search?${params}`);
    },

    async getActivityAnalytics() {
        return apiFetch(`${API_BASE}/activity/analytics`);
    },

    async getPreferences() {
        return apiFetch(`${API_BASE}/user/preferences`);
    },

    async updatePreferences(prefs) {
        return apiFetch(`${API_BASE}/user/preferences`, {
            method: 'POST',
            body: JSON.stringify(prefs)
        });
    },

    // ── Notifications ─────────────────────────────────────────
    async getNotifications() {
        return apiFetch(`${API_BASE}/notifications`);
    },

    async saveNotification(title, description, type) {
        return apiFetch(`${API_BASE}/notifications`, {
            method: 'POST',
            body: JSON.stringify({ title, description, type: type || 'info' })
        });
    },

    async markNotificationAsRead(id) {
        return apiFetch(`${API_BASE}/notifications/${id}/read`, {
            method: 'PUT'
        });
    },

    async clearNotifications() {
        return apiFetch(`${API_BASE}/notifications`, {
            method: 'DELETE'
        });
    }
};

