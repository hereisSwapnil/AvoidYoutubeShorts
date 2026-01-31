// Popup script for Avoid YT Shorts - Enhanced
class PopupManager {
    constructor() {
        this.stats = {
            shortsBlocked: 0,
            startTime: Date.now(),
            isEnabled: true
        };
        this.init();
    }

    async init() {
        this.setupEventListeners();
        const isYouTube = await this.checkActiveTab();
        if (isYouTube) {
            await this.loadStats();
            this.showContent();
            this.startUpdateTimer();
        } else {
            this.showNotActiveState();
        }
    }

    async checkActiveTab() {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        return tab.url && tab.url.includes('youtube.com');
    }

    showNotActiveState() {
        document.getElementById('loading').classList.add('hidden');
        document.getElementById('content').classList.remove('hidden');
        
        // Disable controls
        const controls = document.querySelector('.controls');
        controls.style.opacity = '0.5';
        controls.style.pointerEvents = 'none';
        
        // Update status message
        const statusEl = document.getElementById('status');
        statusEl.className = 'status paused';
        statusEl.innerHTML = '<strong>⚠️ Not on YouTube</strong><br>Visit YouTube to use blockers';
    }

    setupEventListeners() {
        document.getElementById('toggle-btn').addEventListener('click', () => {
            this.toggleBlocker();
        });

        document.getElementById('reset-btn').addEventListener('click', () => {
            this.resetStats();
        });

        document.getElementById('refresh-btn').addEventListener('click', () => {
            this.refreshPage();
        });
    }

    async loadStats() {
        try {
            // Get current tab
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            
            if (tab.url && tab.url.includes('youtube.com')) {
                // Try to get stats from content script
                try {
                    const response = await chrome.tabs.sendMessage(tab.id, { action: 'getStats' });
                    if (response && response.stats) {
                        this.stats = { ...this.stats, ...response.stats };
                    }
                } catch (error) {
                    console.log('Content script not ready, using default stats');
                }
            }
        } catch (error) {
            console.error('Error loading stats:', error);
        }
    }

    async toggleBlocker() {
        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            
            if (tab.url && tab.url.includes('youtube.com')) {
                await chrome.tabs.sendMessage(tab.id, { action: 'toggleBlocker' });
                this.stats.isEnabled = !this.stats.isEnabled;
                this.updateUI();
            }
        } catch (error) {
            console.error('Error toggling blocker:', error);
        }
    }

    async resetStats() {
        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            
            if (tab.url && tab.url.includes('youtube.com')) {
                await chrome.tabs.sendMessage(tab.id, { action: 'resetStats' });
                this.stats.shortsBlocked = 0;
                this.stats.startTime = Date.now();
                this.updateUI();
            }
        } catch (error) {
            console.error('Error resetting stats:', error);
        }
    }

    async refreshPage() {
        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            await chrome.tabs.reload(tab.id);
        } catch (error) {
            console.error('Error refreshing page:', error);
        }
    }

    showContent() {
        document.getElementById('loading').classList.add('hidden');
        document.getElementById('content').classList.remove('hidden');
        this.updateUI();
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
        // Update status
        const statusEl = document.getElementById('status');
        const toggleBtn = document.getElementById('toggle-btn');
        
        if (this.stats.isEnabled) {
            statusEl.className = 'status active';
            statusEl.innerHTML = '<strong>🟢 Active</strong> - Shorts are being blocked';
            toggleBtn.textContent = '⏸️ Pause Blocker';
            toggleBtn.className = 'btn primary';
        } else {
            statusEl.className = 'status paused';
            statusEl.innerHTML = '<strong>🟡 Paused</strong> - Shorts are not being blocked';
            toggleBtn.textContent = '▶️ Resume Blocker';
            toggleBtn.className = 'btn danger';
        }

        // Update stats with improved formatting
        document.getElementById('shorts-blocked').textContent = this.formatNumber(this.stats.shortsBlocked);
        
        // Calculate time saved (30 seconds per short)
        const timeSavedSeconds = this.stats.shortsBlocked * 30;
        document.getElementById('time-saved').textContent = this.formatTime(timeSavedSeconds);

        // Calculate session time
        const sessionTimeSeconds = Math.floor((Date.now() - this.stats.startTime) / 1000);
        document.getElementById('session-time').textContent = this.formatTime(sessionTimeSeconds);
    }

    startUpdateTimer() {
        // Update UI every second to keep session time current
        setInterval(() => {
            this.updateUI();
        }, 1000);
    }
}

// Initialize popup when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new PopupManager();
});

// Listen for messages from content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'statsUpdated') {
        // Update stats if content script sends updates
        if (message.stats) {
            // This would be handled by the PopupManager instance
            // For now, we'll just log it
            console.log('Stats updated from content script:', message.stats);
        }
    }
}); 