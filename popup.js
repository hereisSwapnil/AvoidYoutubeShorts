// Avoid YouTube Shorts - Popup Script
class PopupManager {
    constructor() {
        this.settings = {
            enabled: true,
            redirectShorts: true
        };
        this.stats = {
            shortsBlocked: 0,
            shortsRedirected: 0
        };
    }

    async init() {
        this.setupEventListeners();
        await this.loadFromStorage();
        this.updateUI();
    }

    async loadFromStorage() {
        try {
            const result = await chrome.storage.local.get(['settings', 'shortsBlockerState', 'shortsBlockerStats']);

            if (result.settings) {
                this.settings = { ...this.settings, ...result.settings };
            }

            if (result.shortsBlockerState) {
                if (typeof result.shortsBlockerState.isEnabled === 'boolean') {
                    this.settings.enabled = result.shortsBlockerState.isEnabled;
                }
                if (typeof result.shortsBlockerState.redirectShorts === 'boolean') {
                    this.settings.redirectShorts = result.shortsBlockerState.redirectShorts;
                }
            }

            if (result.shortsBlockerStats) {
                this.stats = { ...this.stats, ...result.shortsBlockerStats };
            }
        } catch (err) {
            console.error('Error loading popup data from storage:', err);
        }
    }

    setupEventListeners() {
        document.getElementById('toggle-btn').addEventListener('click', () => {
            this.toggleBlocker();
        });

        document.getElementById('redirect-toggle').addEventListener('change', (e) => {
            this.toggleRedirect(e.target.checked);
        });

        document.getElementById('reset-btn').addEventListener('click', () => {
            this.resetStats();
        });

        document.getElementById('options-btn').addEventListener('click', () => {
            chrome.runtime.openOptionsPage();
        });

        document.getElementById('open-options-link').addEventListener('click', (e) => {
            e.preventDefault();
            chrome.runtime.openOptionsPage();
        });
    }

    async toggleBlocker() {
        this.settings.enabled = !this.settings.enabled;
        await this.saveSettings();
        this.updateUI();
        this.notifyYouTubeTabs();
    }

    async toggleRedirect(value) {
        this.settings.redirectShorts = value;
        await this.saveSettings();
        this.notifyYouTubeTabs();
    }

    async saveSettings() {
        try {
            await chrome.storage.local.set({
                settings: this.settings,
                shortsBlockerState: {
                    isEnabled: this.settings.enabled,
                    redirectShorts: this.settings.redirectShorts,
                    lastSaved: Date.now()
                }
            });
        } catch (err) {
            console.error('Error saving popup settings:', err);
        }
    }

    async resetStats() {
        if (!confirm('Are you sure you want to reset all statistics?')) return;

        this.stats.shortsBlocked = 0;
        this.stats.shortsRedirected = 0;

        await chrome.storage.local.set({
            shortsBlockerStats: this.stats,
            stats: this.stats
        });

        this.updateUI();
        this.notifyYouTubeTabs({ action: 'resetStats' });
    }

    async notifyYouTubeTabs(customMessage = null) {
        try {
            const tabs = await chrome.tabs.query({ url: 'https://www.youtube.com/*' });
            for (const tab of tabs) {
                chrome.tabs.sendMessage(tab.id, customMessage || {
                    action: 'settingsUpdated',
                    settings: this.settings
                }).catch(() => {});
            }
        } catch (err) {
            console.error('Error notifying YouTube tabs:', err);
        }
    }

    updateUI() {
        const statusEl = document.getElementById('status');
        const toggleBtn = document.getElementById('toggle-btn');
        const redirectToggle = document.getElementById('redirect-toggle');
        const blockedEl = document.getElementById('shorts-blocked');
        const redirectedEl = document.getElementById('shorts-redirected');

        if (this.settings.enabled) {
            statusEl.className = 'status-badge active';
            statusEl.innerHTML = '🟢 Active &bull; Blocking Shorts';
            toggleBtn.textContent = 'Pause Blocker';
            toggleBtn.className = 'btn primary';
        } else {
            statusEl.className = 'status-badge paused';
            statusEl.innerHTML = '🟡 Paused &bull; Blocker Inactive';
            toggleBtn.textContent = 'Resume Blocker';
            toggleBtn.className = 'btn';
        }

        if (redirectToggle) {
            redirectToggle.checked = this.settings.redirectShorts !== false;
        }

        if (blockedEl) blockedEl.textContent = (this.stats.shortsBlocked || 0).toLocaleString();
        if (redirectedEl) redirectedEl.textContent = (this.stats.shortsRedirected || 0).toLocaleString();
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const popup = new PopupManager();
    popup.init();
});