// Popup script for Avoid YT Shorts - Enhanced
class PopupManager {
    constructor() {
        this.stats = {
            shortsBlocked: 0,
            startTime: Date.now(),
            isEnabled: true
        };
        this.storageKey = 'shortsBlockerState';
        this.statsKey = 'shortsBlockerStats';
        this.updateInterval = null;
    }

    async init() {
        this.setupEventListeners();
        const isYouTube = await this.checkActiveTab();
        
        if (isYouTube) {
            await this.loadStatsFromStorage();
            this.showContent();
            this.startUpdateTimer();
        } else {
            this.showNotActiveState();
        }
    }

    async checkActiveTab() {
        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            return tab && tab.url && tab.url.includes('youtube.com');
        } catch (error) {
            console.error('Error checking active tab:', error);
            return false;
        }
    }

    showNotActiveState() {
        document.getElementById('loading').classList.add('hidden');
        document.getElementById('content').classList.remove('hidden');
        
        const controls = document.querySelector('.controls');
        controls.style.opacity = '0.5';
        controls.style.pointerEvents = 'none';
        
        const statusEl = document.getElementById('status');
        statusEl.className = 'status paused';
        statusEl.innerHTML = '<strong>⚠️ Not on YouTube</strong><br>Visit YouTube to use blocker';
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

    async loadStatsFromStorage() {
        try {
            // Load directly from storage for accuracy
            const [stateResult, statsResult] = await Promise.all([
                chrome.storage.local.get(this.storageKey),
                chrome.storage.local.get(this.statsKey)
            ]);
            
            console.log('📦 Popup loaded from storage:', { stateResult, statsResult });
            
            // Load state
            if (stateResult[this.storageKey]) {
                const savedState = stateResult[this.storageKey];
                this.stats.isEnabled = savedState.isEnabled !== false;
            } else {
                this.stats.isEnabled = true;
            }
            
            // Load stats
            if (statsResult[this.statsKey]) {
                this.stats = {
                    ...this.stats,
                    ...statsResult[this.statsKey]
                };
            }
            
            // Try to get live stats from content script if available
            try {
                const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
                if (tab && tab.url && tab.url.includes('youtube.com')) {
                    const response = await chrome.tabs.sendMessage(tab.id, { action: 'getStats' });
                    if (response && response.stats) {
                        // Merge with storage stats, preferring content script for freshness
                        this.stats = {
                            ...this.stats,
                            ...response.stats
                        };
                        console.log('✅ Got live stats from content script:', response.stats);
                    }
                }
            } catch (error) {
                console.log('ℹ️ Content script not available, using storage stats');
            }
            
        } catch (error) {
            console.error('Error loading stats:', error);
        }
    }

    async toggleBlocker() {
        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            
            if (tab && tab.url && tab.url.includes('youtube.com')) {
                // Send toggle message to content script
                const response = await chrome.tabs.sendMessage(tab.id, { action: 'toggleBlocker' });
                
                if (response && response.success !== undefined) {
                    this.stats.isEnabled = response.isEnabled;
                    console.log('✅ Toggled blocker to:', this.stats.isEnabled);
                    
                    // Update UI immediately
                    this.updateUI();
                    
                    // Reload stats from storage to stay in sync
                    setTimeout(() => {
                        this.loadStatsFromStorage().then(() => {
                            this.updateUI();
                        });
                    }, 100);
                }
            }
        } catch (error) {
            console.error('Error toggling blocker:', error);
            
            // Fallback: try to update storage directly
            try {
                const result = await chrome.storage.local.get(this.storageKey);
                const currentState = result[this.storageKey] || { isEnabled: true };
                const newState = {
                    isEnabled: !currentState.isEnabled,
                    lastSaved: Date.now()
                };
                
                await chrome.storage.local.set({ [this.storageKey]: newState });
                this.stats.isEnabled = newState.isEnabled;
                this.updateUI();
                
                // Reload the page to apply changes
                const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
                if (tab) {
                    await chrome.tabs.reload(tab.id);
                }
            } catch (fallbackError) {
                console.error('Fallback toggle failed:', fallbackError);
            }
        }
    }

    async resetStats() {
        if (!confirm('Are you sure you want to reset all statistics?')) {
            return;
        }
        
        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            
            if (tab && tab.url && tab.url.includes('youtube.com')) {
                await chrome.tabs.sendMessage(tab.id, { action: 'resetStats' });
                
                // Reset local stats
                this.stats.shortsBlocked = 0;
                this.stats.startTime = Date.now();
                this.stats.lastBlockTime = null;
                
                this.updateUI();
                
                // Reload from storage to confirm
                setTimeout(() => {
                    this.loadStatsFromStorage().then(() => {
                        this.updateUI();
                    });
                }, 100);
            }
        } catch (error) {
            console.error('Error resetting stats:', error);
        }
    }

    async refreshPage() {
        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            if (tab) {
                await chrome.tabs.reload(tab.id);
                window.close(); // Close popup after refresh
            }
        } catch (error) {
            console.error('Error refreshing page:', error);
        }
    }

    showContent() {
        document.getElementById('loading').classList.add('hidden');
        document.getElementById('content').classList.remove('hidden');
        this.updateUI();
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

        const blockedCount = document.getElementById('shorts-blocked');
        const timeSaved = document.getElementById('time-saved');
        const sessionTime = document.getElementById('session-time');
        
        if (blockedCount) {
            blockedCount.textContent = this.formatNumber(this.stats.shortsBlocked || 0);
        }
        
        if (timeSaved) {
            const timeSavedSeconds = (this.stats.shortsBlocked || 0) * 30;
            timeSaved.textContent = this.formatTime(timeSavedSeconds);
        }

        if (sessionTime) {
            const sessionTimeSeconds = Math.floor((Date.now() - (this.stats.startTime || Date.now())) / 1000);
            sessionTime.textContent = this.formatTime(sessionTimeSeconds);
        }
    }

    startUpdateTimer() {
        // Update UI every second
        this.updateInterval = setInterval(() => {
            this.updateUI();
            
            // Reload stats from storage every 5 seconds to stay in sync
            if (Math.floor(Date.now() / 1000) % 5 === 0) {
                this.loadStatsFromStorage().then(() => {
                    this.updateUI();
                });
            }
        }, 1000);
    }

    cleanup() {
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
        }
    }
}

// Initialize popup
let popupManager = null;

document.addEventListener('DOMContentLoaded', () => {
    popupManager = new PopupManager();
    popupManager.init();
});

// Cleanup on unload
window.addEventListener('unload', () => {
    if (popupManager) {
        popupManager.cleanup();
    }
});

// Listen for storage changes
chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && popupManager) {
        console.log('📦 Storage changed:', changes);
        
        // Reload stats if they changed
        if (changes.shortsBlockerState || changes.shortsBlockerStats) {
            popupManager.loadStatsFromStorage().then(() => {
                popupManager.updateUI();
            });
        }
    }
});