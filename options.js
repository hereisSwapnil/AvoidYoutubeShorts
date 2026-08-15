// Avoid YouTube Shorts - Options Script
class OptionsManager {
    constructor() {
        this.settings = {
            enabled: true,
            redirectShorts: true,
            hideShelves: true,
            hideNav: true,
            showUI: true,
            notifications: true
        };
        this.stats = {
            shortsBlocked: 0,
            shortsRedirected: 0,
            installDate: Date.now()
        };
    }

    async init() {
        await this.loadData();
        this.setupEventListeners();
        this.updateUI();
    }

    async loadData() {
        try {
            const res = await chrome.storage.local.get(['settings', 'shortsBlockerState', 'shortsBlockerStats']);

            if (res.settings) {
                this.settings = { ...this.settings, ...res.settings };
            }

            if (res.shortsBlockerState) {
                if (typeof res.shortsBlockerState.isEnabled === 'boolean') {
                    this.settings.enabled = res.shortsBlockerState.isEnabled;
                }
                if (typeof res.shortsBlockerState.redirectShorts === 'boolean') {
                    this.settings.redirectShorts = res.shortsBlockerState.redirectShorts;
                }
            }

            if (res.shortsBlockerStats) {
                this.stats = { ...this.stats, ...res.shortsBlockerStats };
            }
        } catch (err) {
            console.error('Error loading options data:', err);
        }
    }

    setupEventListeners() {
        const toggleMap = [
            { id: 'enabled-toggle', key: 'enabled' },
            { id: 'redirect-toggle', key: 'redirectShorts' },
            { id: 'shelves-toggle', key: 'hideShelves' },
            { id: 'nav-toggle', key: 'hideNav' },
            { id: 'ui-toggle', key: 'showUI' },
            { id: 'notifications-toggle', key: 'notifications' }
        ];

        toggleMap.forEach(({ id, key }) => {
            const el = document.getElementById(id);
            if (el) {
                el.addEventListener('change', (e) => {
                    this.settings[key] = e.target.checked;
                    this.saveSettings();
                });
            }
        });

        document.getElementById('reset-stats-btn').addEventListener('click', () => {
            this.resetStats();
        });

        document.getElementById('refresh-tabs-btn').addEventListener('click', () => {
            this.refreshYouTubeTabs();
        });
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

            this.showSaveToast();
            this.notifyTabs();
        } catch (err) {
            console.error('Error saving settings:', err);
        }
    }

    async notifyTabs() {
        try {
            const tabs = await chrome.tabs.query({ url: 'https://www.youtube.com/*' });
            for (const tab of tabs) {
                chrome.tabs.sendMessage(tab.id, {
                    action: 'settingsUpdated',
                    settings: this.settings
                }).catch(() => {});
            }
        } catch (err) {
            console.error('Error notifying tabs:', err);
        }
    }

    showSaveToast() {
        const indicator = document.getElementById('save-indicator');
        if (indicator) {
            indicator.classList.add('show');
            setTimeout(() => indicator.classList.remove('show'), 1800);
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
        this.notifyTabs();
    }

    async refreshYouTubeTabs() {
        try {
            const tabs = await chrome.tabs.query({ url: 'https://www.youtube.com/*' });
            for (const tab of tabs) {
                chrome.tabs.reload(tab.id);
            }
            alert(`Refreshed ${tabs.length} YouTube tab(s)!`);
        } catch (err) {
            console.error('Error refreshing YouTube tabs:', err);
        }
    }

    updateUI() {
        const idMap = {
            'enabled-toggle': this.settings.enabled !== false,
            'redirect-toggle': this.settings.redirectShorts !== false,
            'shelves-toggle': this.settings.hideShelves !== false,
            'nav-toggle': this.settings.hideNav !== false,
            'ui-toggle': this.settings.showUI !== false,
            'notifications-toggle': this.settings.notifications !== false
        };

        Object.entries(idMap).forEach(([id, val]) => {
            const el = document.getElementById(id);
            if (el) el.checked = val;
        });

        const blockedEl = document.getElementById('total-blocked');
        const redirectedEl = document.getElementById('total-redirected');
        const installDateEl = document.getElementById('install-date');

        if (blockedEl) blockedEl.textContent = (this.stats.shortsBlocked || 0).toLocaleString();
        if (redirectedEl) redirectedEl.textContent = (this.stats.shortsRedirected || 0).toLocaleString();
        if (installDateEl) {
            const date = new Date(this.stats.installDate || Date.now());
            installDateEl.textContent = date.toLocaleDateString();
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const mgr = new OptionsManager();
    mgr.init();
});