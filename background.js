// Background service worker for Avoid YT Shorts - Manifest V3
class BackgroundManager {
    constructor() {
        this.init();
    }

    init() {
        this.setupEventListeners();
        console.log('🚫 Avoid YT Shorts - Background service worker initialized');
    }

    setupEventListeners() {
        // Handle extension installation and updates
        chrome.runtime.onInstalled.addListener((details) => {
            if (details.reason === 'install') {
                this.onInstall();
            } else if (details.reason === 'update') {
                this.onUpdate(details.previousVersion);
            }
        });

        // Handle extension startup
        chrome.runtime.onStartup.addListener(() => {
            console.log('🚫 Avoid YT Shorts - Extension started');
        });

        // Handle messages from content scripts, popup, and options
        chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
            this.handleMessage(message, sender, sendResponse);
            return true; // Keep message channel open for async responses
        });

        // Handle tab URL updates (for YouTube SPA navigation events)
        chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
            if (changeInfo.url && tab.url && tab.url.includes('youtube.com')) {
                chrome.tabs.sendMessage(tabId, { 
                    action: 'urlChanged', 
                    url: changeInfo.url 
                }).catch(() => {
                    // Content script might not be initialized on tab yet, which is expected
                });
            }
        });
    }

    async onInstall() {
        console.log('🚫 Avoid YT Shorts - Extension installed');
        
        // Initialize default settings & stats
        const defaultSettings = {
            enabled: true,
            redirectShorts: true,
            hideShelves: true,
            hideNav: true,
            showUI: true,
            notifications: true
        };

        const defaultStats = {
            shortsBlocked: 0,
            shortsRedirected: 0,
            startTime: Date.now(),
            installDate: Date.now()
        };

        await chrome.storage.local.set({
            settings: defaultSettings,
            shortsBlockerState: { isEnabled: true, redirectShorts: true, lastSaved: Date.now() },
            shortsBlockerStats: defaultStats,
            stats: defaultStats
        });

        // Welcome notification
        this.showNotification(
            'Avoid YT Shorts Active',
            'Shorts blocking and video redirection enabled! Enjoy distraction-free YouTube.'
        );
    }

    onUpdate(previousVersion) {
        console.log(`🚫 Avoid YT Shorts - Updated from ${previousVersion} to 2.1.0`);
    }

    async handleMessage(message, sender, sendResponse) {
        try {
            switch (message.action) {
                case 'getStats': {
                    const stats = await this.getStats();
                    sendResponse({ stats });
                    break;
                }
                case 'updateStats': {
                    await this.updateStats(message.stats);
                    sendResponse({ success: true });
                    break;
                }
                case 'getSettings': {
                    const settings = await this.getSettings();
                    sendResponse({ settings });
                    break;
                }
                case 'updateSettings': {
                    await this.updateSettings(message.settings);
                    sendResponse({ success: true });
                    break;
                }
                case 'showNotification': {
                    this.showNotification(message.title, message.message);
                    sendResponse({ success: true });
                    break;
                }
                default:
                    sendResponse({ error: 'Unknown action' });
            }
        } catch (error) {
            console.error('Error handling background message:', error);
            sendResponse({ error: error.message });
        }
    }

    async getStats() {
        const result = await chrome.storage.local.get('shortsBlockerStats');
        return result.shortsBlockerStats || {
            shortsBlocked: 0,
            shortsRedirected: 0,
            startTime: Date.now()
        };
    }

    async updateStats(newStats) {
        const currentStats = await this.getStats();
        const updatedStats = {
            ...currentStats,
            ...newStats,
            lastSaved: Date.now()
        };
        
        await chrome.storage.local.set({ shortsBlockerStats: updatedStats, stats: updatedStats });
    }

    async getSettings() {
        const result = await chrome.storage.local.get('settings');
        return result.settings || {
            enabled: true,
            redirectShorts: true,
            hideShelves: true,
            hideNav: true,
            showUI: true,
            notifications: true
        };
    }

    async updateSettings(newSettings) {
        const currentSettings = await this.getSettings();
        const updatedSettings = { ...currentSettings, ...newSettings };
        await chrome.storage.local.set({ settings: updatedSettings });
    }

    showNotification(title, message) {
        this.getSettings().then(settings => {
            if (settings.notifications !== false) {
                chrome.notifications.create({
                    type: 'basic',
                    iconUrl: 'icons/icon-128.png',
                    title: title,
                    message: message
                });
            }
        });
    }
}

// Initialize background service worker instance
new BackgroundManager();