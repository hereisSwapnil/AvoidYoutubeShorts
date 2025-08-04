// Options page script for Avoid YT Shorts - Enhanced
class OptionsManager {
    constructor() {
        this.settings = {
            enabled: true,
            showUI: true,
            notifications: true,
            autoPause: false
        };
        this.init();
    }

    async init() {
        await this.loadSettings();
        await this.loadStats();
        this.setupEventListeners();
        this.updateUI();
    }

    async loadSettings() {
        try {
            const result = await chrome.storage.local.get('settings');
            this.settings = { ...this.settings, ...result.settings };
        } catch (error) {
            console.error('Error loading settings:', error);
        }
    }

    async loadStats() {
        try {
            const result = await chrome.storage.local.get('stats');
            this.stats = result.stats || {
                totalShortsBlocked: 0,
                totalTimeSaved: 0,
                installDate: Date.now()
            };
        } catch (error) {
            console.error('Error loading stats:', error);
        }
    }

    setupEventListeners() {
        // Toggle switches
        document.getElementById('enabled-toggle').addEventListener('click', () => {
            this.settings.enabled = !this.settings.enabled;
            this.updateToggleUI('enabled-toggle', this.settings.enabled);
            this.saveSettings();
        });

        document.getElementById('show-ui-toggle').addEventListener('click', () => {
            this.settings.showUI = !this.settings.showUI;
            this.updateToggleUI('show-ui-toggle', this.settings.showUI);
            this.saveSettings();
        });

        document.getElementById('notifications-toggle').addEventListener('click', () => {
            this.settings.notifications = !this.settings.notifications;
            this.updateToggleUI('notifications-toggle', this.settings.notifications);
            this.saveSettings();
        });

        document.getElementById('auto-pause-toggle').addEventListener('click', () => {
            this.settings.autoPause = !this.settings.autoPause;
            this.updateToggleUI('auto-pause-toggle', this.settings.autoPause);
            this.saveSettings();
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

    // Format large numbers with K, M, B suffixes
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

    // Format time duration in a readable way
    formatTime(seconds) {
        if (seconds < 60) {
            return `${seconds}s`;
        } else if (seconds < 3600) {
            const minutes = Math.floor(seconds / 60);
            const remainingSeconds = seconds % 60;
            return `${minutes}m ${remainingSeconds}s`;
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

    updateUI() {
        // Update toggle states
        this.updateToggleUI('enabled-toggle', this.settings.enabled);
        this.updateToggleUI('show-ui-toggle', this.settings.showUI);
        this.updateToggleUI('notifications-toggle', this.settings.notifications);
        this.updateToggleUI('auto-pause-toggle', this.settings.autoPause);

        // Update stats with improved formatting
        document.getElementById('total-blocked').textContent = this.formatNumber(this.stats.totalShortsBlocked || 0);
        
        const totalTimeSavedSeconds = this.stats.totalTimeSaved || 0;
        document.getElementById('time-saved').textContent = this.formatTime(totalTimeSavedSeconds);
        
        const installDate = new Date(this.stats.installDate || Date.now());
        document.getElementById('install-date').textContent = installDate.toLocaleDateString();
    }

    async saveSettings() {
        try {
            await chrome.storage.local.set({ settings: this.settings });
            this.showSaveIndicator();
            
            // Notify all YouTube tabs about settings change
            const tabs = await chrome.tabs.query({ url: 'https://www.youtube.com/*' });
            tabs.forEach(tab => {
                chrome.tabs.sendMessage(tab.id, { 
                    action: 'settingsUpdated', 
                    settings: this.settings 
                }).catch(() => {
                    // Tab might not be ready, ignore errors
                });
            });
        } catch (error) {
            console.error('Error saving settings:', error);
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
        if (confirm('Are you sure you want to reset all statistics? This action cannot be undone.')) {
            try {
                const newStats = {
                    totalShortsBlocked: 0,
                    totalTimeSaved: 0,
                    installDate: Date.now()
                };
                
                await chrome.storage.local.set({ stats: newStats });
                this.stats = newStats;
                this.updateUI();
                
                // Reset stats in all YouTube tabs
                const tabs = await chrome.tabs.query({ url: 'https://www.youtube.com/*' });
                tabs.forEach(tab => {
                    chrome.tabs.sendMessage(tab.id, { action: 'resetStats' }).catch(() => {
                        // Tab might not be ready, ignore errors
                    });
                });
                
                alert('Statistics have been reset successfully!');
            } catch (error) {
                console.error('Error resetting stats:', error);
                alert('Error resetting statistics. Please try again.');
            }
        }
    }

    async exportStats() {
        try {
            const exportData = {
                stats: this.stats,
                settings: this.settings,
                exportDate: new Date().toISOString()
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
            console.error('Error exporting stats:', error);
            alert('Error exporting statistics. Please try again.');
        }
    }

    async refreshAllYouTubeTabs() {
        try {
            const tabs = await chrome.tabs.query({ url: 'https://www.youtube.com/*' });
            tabs.forEach(tab => {
                chrome.tabs.reload(tab.id);
            });
            
            alert(`Refreshed ${tabs.length} YouTube tab(s)!`);
        } catch (error) {
            console.error('Error refreshing tabs:', error);
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
            console.error('Error showing test notification:', error);
            alert('Error showing test notification. Please check notification permissions.');
        }
    }
}

// Initialize options when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new OptionsManager();
}); 