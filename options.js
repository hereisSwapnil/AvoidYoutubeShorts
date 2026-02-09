// Options page script for Avoid YT Shorts - Enhanced
class OptionsManager {
    constructor() {
        this.settings = {
            enabled: true,
            showUI: true,
            notifications: true,
            autoPause: false
        };
        this.stats = {
            totalShortsBlocked: 0,
            totalTimeSaved: 0,
            installDate: Date.now()
        };
        this.storageKey = 'shortsBlockerState';
        this.statsKey = 'shortsBlockerStats';
        this.settingsKey = 'settings';
    }

    async init() {
        await this.loadSettings();
        await this.loadStats();
        this.setupEventListeners();
        this.setupStorageListener();
        this.updateUI();
    }

    async loadSettings() {
        try {
            // Load from chrome.storage
            const result = await chrome.storage.local.get([this.settingsKey, this.storageKey]);
            
            console.log('📦 Loaded settings:', result);
            
            // Load general settings
            if (result[this.settingsKey]) {
                this.settings = { ...this.settings, ...result[this.settingsKey] };
            }
            
            // Load enabled state from blocker state
            if (result[this.storageKey]) {
                this.settings.enabled = result[this.storageKey].isEnabled !== false;
            }
            
            console.log('✅ Settings loaded:', this.settings);
        } catch (error) {
            console.error('❌ Error loading settings:', error);
        }
    }

    async loadStats() {
        try {
            const result = await chrome.storage.local.get(this.statsKey);
            
            if (result[this.statsKey]) {
                this.stats = {
                    totalShortsBlocked: result[this.statsKey].shortsBlocked || 0,
                    totalTimeSaved: (result[this.statsKey].shortsBlocked || 0) * 30,
                    installDate: result[this.statsKey].startTime || Date.now()
                };
            }
            
            console.log('📈 Stats loaded:', this.stats);
        } catch (error) {
            console.error('❌ Error loading stats:', error);
        }
    }

    setupStorageListener() {
        // Listen for storage changes to keep UI in sync
        chrome.storage.onChanged.addListener((changes, area) => {
            if (area === 'local') {
                console.log('📦 Storage changed:', changes);
                
                if (changes[this.storageKey]) {
                    this.settings.enabled = changes[this.storageKey].newValue?.isEnabled !== false;
                    this.updateToggleUI('enabled-toggle', this.settings.enabled);
                }
                
                if (changes[this.statsKey]) {
                    this.stats = {
                        totalShortsBlocked: changes[this.statsKey].newValue?.shortsBlocked || 0,
                        totalTimeSaved: (changes[this.statsKey].newValue?.shortsBlocked || 0) * 30,
                        installDate: changes[this.statsKey].newValue?.startTime || this.stats.installDate
                    };
                    this.updateStatsUI();
                }
            }
        });
    }

    setupEventListeners() {
        // Toggle switches
        document.getElementById('enabled-toggle').addEventListener('click', async () => {
            this.settings.enabled = !this.settings.enabled;
            this.updateToggleUI('enabled-toggle', this.settings.enabled);
            await this.saveSettings();
        });

        document.getElementById('show-ui-toggle').addEventListener('click', async () => {
            this.settings.showUI = !this.settings.showUI;
            this.updateToggleUI('show-ui-toggle', this.settings.showUI);
            await this.saveSettings();
        });

        document.getElementById('notifications-toggle').addEventListener('click', async () => {
            this.settings.notifications = !this.settings.notifications;
            this.updateToggleUI('notifications-toggle', this.settings.notifications);
            await this.saveSettings();
        });

        document.getElementById('auto-pause-toggle').addEventListener('click', async () => {
            this.settings.autoPause = !this.settings.autoPause;
            this.updateToggleUI('auto-pause-toggle', this.settings.autoPause);
            await this.saveSettings();
        });

        // Action buttons
        document.getElementById('reset-stats-btn').addEventListener('click', () => {
            this.resetStats();
        });

        document.getElementById('export-stats-btn').addEventListener('click', () => {
            this.exportStats();
        });

        document.getElementById('refresh-all-btn').addEventListener('click', () => {
            this.refreshAllYouTubeTabs();
        });

        document.getElementById('test-notification-btn').addEventListener('click', () => {
            this.testNotification();
        });
    }

    updateToggleUI(toggleId, isActive) {
        const toggle = document.getElementById(toggleId);
        if (isActive) {
            toggle.classList.add('active');
        } else {
            toggle.classList.remove('active');
        }
    }

    formatNumber(num) {
        if (num >= 1000000000) {
            return (num / 1000000000).toFixed(1) + 'B';
        } else if (num >= 1000000) {
            return (num / 1000000).toFixed(1) + 'M';
        } else if (num >= 1000) {
            return (num / 1000).toFixed(1) + 'K';
        }
        return num.toString();
    }

    formatTime(seconds) {
        if (seconds < 60) {
            return `${seconds}s`;
        } else if (seconds < 3600) {
            const minutes = Math.floor(seconds / 60);
            return `${minutes}m`;
        } else if (seconds < 86400) {
            const hours = Math.floor(seconds / 3600);
            const minutes = Math.floor((seconds % 3600) / 60);
            return `${hours}h ${minutes}m`;
        } else {
            const days = Math.floor(seconds / 86400);
            const hours = Math.floor((seconds % 86400) / 3600);
            return `${days}d ${hours}h`;
        }
    }

    updateStatsUI() {
        document.getElementById('total-blocked').textContent = this.formatNumber(this.stats.totalShortsBlocked);
        document.getElementById('time-saved').textContent = this.formatTime(this.stats.totalTimeSaved);
        
        const installDate = new Date(this.stats.installDate);
        document.getElementById('install-date').textContent = installDate.toLocaleDateString();
    }

    updateUI() {
        // Update toggle states
        this.updateToggleUI('enabled-toggle', this.settings.enabled);
        this.updateToggleUI('show-ui-toggle', this.settings.showUI);
        this.updateToggleUI('notifications-toggle', this.settings.notifications);
        this.updateToggleUI('auto-pause-toggle', this.settings.autoPause);

        // Update stats
        this.updateStatsUI();
    }

    async saveSettings() {
        try {
            // Save general settings
            await chrome.storage.local.set({ [this.settingsKey]: this.settings });
            
            // Save enabled state to blocker state
            const blockerState = {
                isEnabled: this.settings.enabled,
                lastSaved: Date.now()
            };
            await chrome.storage.local.set({ [this.storageKey]: blockerState });
            
            console.log('💾 Settings saved:', this.settings);
            
            this.showSaveIndicator();
            
            // Notify all YouTube tabs
            const tabs = await chrome.tabs.query({ url: 'https://www.youtube.com/*' });
            for (const tab of tabs) {
                try {
                    await chrome.tabs.sendMessage(tab.id, { 
                        action: 'settingsUpdated', 
                        settings: this.settings 
                    });
                } catch (error) {
                    // Tab might not be ready
                    console.log('Could not notify tab:', tab.id);
                }
            }
            
            return true;
        } catch (error) {
            console.error('❌ Error saving settings:', error);
            return false;
        }
    }

    showSaveIndicator() {
        const indicator = document.getElementById('save-indicator');
        indicator.classList.add('show');
        setTimeout(() => {
            indicator.classList.remove('show');
        }, 2000);
    }

    async resetStats() {
        if (!confirm('Are you sure you want to reset all statistics? This action cannot be undone.')) {
            return;
        }
        
        try {
            const newStats = {
                shortsBlocked: 0,
                startTime: Date.now(),
                lastBlockTime: null,
                lastSaved: Date.now()
            };
            
            await chrome.storage.local.set({ [this.statsKey]: newStats });
            
            this.stats = {
                totalShortsBlocked: 0,
                totalTimeSaved: 0,
                installDate: Date.now()
            };
            
            this.updateStatsUI();
            
            // Reset stats in all YouTube tabs
            const tabs = await chrome.tabs.query({ url: 'https://www.youtube.com/*' });
            for (const tab of tabs) {
                try {
                    await chrome.tabs.sendMessage(tab.id, { action: 'resetStats' });
                } catch (error) {
                    console.log('Could not reset stats in tab:', tab.id);
                }
            }
            
            alert('Statistics have been reset successfully!');
        } catch (error) {
            console.error('❌ Error resetting stats:', error);
            alert('Error resetting statistics. Please try again.');
        }
    }

    async exportStats() {
        try {
            const exportData = {
                stats: this.stats,
                settings: this.settings,
                exportDate: new Date().toISOString(),
                version: '2.0.0'
            };
            
            const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            
            const a = document.createElement('a');
            a.href = url;
            a.download = `avoid-yt-shorts-stats-${new Date().toISOString().split('T')[0]}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            
            alert('Statistics exported successfully!');
        } catch (error) {
            console.error('❌ Error exporting stats:', error);
            alert('Error exporting statistics. Please try again.');
        }
    }

    async refreshAllYouTubeTabs() {
        try {
            const tabs = await chrome.tabs.query({ url: 'https://www.youtube.com/*' });
            
            for (const tab of tabs) {
                await chrome.tabs.reload(tab.id);
            }
            
            alert(`Refreshed ${tabs.length} YouTube tab(s)!`);
        } catch (error) {
            console.error('❌ Error refreshing tabs:', error);
            alert('Error refreshing tabs. Please try again.');
        }
    }

    async testNotification() {
        try {
            await chrome.runtime.sendMessage({
                action: 'showNotification',
                title: 'Avoid YT Shorts - Test',
                message: 'This is a test notification! 🎉'
            });
        } catch (error) {
            console.error('❌ Error showing test notification:', error);
            alert('Error showing test notification. Please check notification permissions.');
        }
    }
}

// Initialize options when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new OptionsManager();
});