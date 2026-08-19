/**
 * background.js — Chrome Extension Service Worker
 * Tracks active tab time and sends heartbeats + page content to Focus Tracker backend.
 */

const BACKEND_URL = 'http://localhost:8080';
const HEARTBEAT_INTERVAL_SECS = 30;

let activeTab = { url: null, title: null, startTime: null };

// ────────────────────────────────────────────────────────────
// TAB TRACKING
// ────────────────────────────────────────────────────────────

chrome.tabs.onActivated.addListener(async (info) => {
    try {
        const tab = await chrome.tabs.get(info.tabId);
        await flushCurrentTab();
        startTracking(tab.url, tab.title);
    } catch (e) {}
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status === 'complete' && tab.active) {
        flushCurrentTab().then(() => {
            startTracking(tab.url, tab.title);
        });
    }
});

chrome.windows.onFocusChanged.addListener(async (windowId) => {
    if (windowId === chrome.windows.WINDOW_ID_NONE) {
        await flushCurrentTab();
        activeTab = { url: null, title: null, startTime: null };
    } else {
        try {
            const [tab] = await chrome.tabs.query({ active: true, windowId });
            if (tab) startTracking(tab.url, tab.title);
        } catch (e) {}
    }
});

function startTracking(url, title) {
    if (shouldSkip(url)) return;
    activeTab = { url, title, startTime: Date.now() };
}

async function flushCurrentTab() {
    if (!activeTab.url || !activeTab.startTime) return;
    const elapsed = Math.floor((Date.now() - activeTab.startTime) / 1000);
    if (elapsed < 3) return; // ignore accidental flicks
    await sendHeartbeat(activeTab.url, activeTab.title, elapsed);
    activeTab.startTime = Date.now(); // reset timer (don't double count)
}

// ────────────────────────────────────────────────────────────
// ALARM — periodic 30-second heartbeat
// ────────────────────────────────────────────────────────────

chrome.alarms.create('heartbeat', { periodInMinutes: 0.5 }); // every 30 seconds

chrome.alarms.onAlarm.addListener(async (alarm) => {
    if (alarm.name !== 'heartbeat') return;
    if (activeTab.url && activeTab.startTime) {
        const elapsed = Math.floor((Date.now() - activeTab.startTime) / 1000);
        if (elapsed >= HEARTBEAT_INTERVAL_SECS) {
            await sendHeartbeat(activeTab.url, activeTab.title, elapsed);
            activeTab.startTime = Date.now(); // reset
        }
    }
});

// ────────────────────────────────────────────────────────────
// API CALLS
// ────────────────────────────────────────────────────────────

async function sendHeartbeat(url, title, elapsedSeconds) {
    if (shouldSkip(url)) return;
    const data = await chrome.storage.local.get('focus_ai_token');
    const token = data.focus_ai_token;
    if (!token) return;

    try {
        await fetch(`${BACKEND_URL}/api/tracking/heartbeat`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ url, title, elapsedSeconds })
        });
    } catch (e) {
        // Backend not running — silently ignore
    }
}

async function sendPageContent(url, title, bodyText) {
    if (shouldSkip(url) || !bodyText) return;
    const data = await chrome.storage.local.get('focus_ai_token');
    const token = data.focus_ai_token;
    if (!token) return;

    try {
        await fetch(`${BACKEND_URL}/api/tracking/page-content`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ url, title, bodyText: bodyText.substring(0, 8000) })
        });
    } catch (e) {}
}

// ────────────────────────────────────────────────────────────
// MESSAGES from content.js
// ────────────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((message, sender) => {
    if (message.type === 'PAGE_CONTENT') {
        sendPageContent(message.url, message.title, message.bodyText);
    }
});

// ────────────────────────────────────────────────────────────
// HELPERS
// ────────────────────────────────────────────────────────────

function shouldSkip(url) {
    if (!url) return true;
    return url.startsWith('chrome://') ||
           url.startsWith('chrome-extension://') ||
           url.startsWith('about:') ||
           url.startsWith('edge://') ||
           url === 'http://localhost:8080/' ||
           url.startsWith('http://localhost:8080');
}
