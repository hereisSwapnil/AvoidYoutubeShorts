// Background service worker for Avoid YT Shorts - Enhanced
class BackgroundManager {
    constructor() {
        this.init();
    }

    init() {
        this.setupEventListeners();
        console.log('🚫 Avoid YT Shorts - Background service worker initialized');
    }

    setupEventListeners() {
        // Handle extension installation
        chrome.runtime.onInstalled.addListener((details) => {
            if (details.reason === 'install') {
                this.onInstall();
            } else if (details.reason === 'update') {
                this.onUpdate(details.previousVersion);
            }
        });

        // Handle extension startup
        chrome.runtime.onStartup.addListener(() => {
            this.onStartup();
        });

        // Handle messages from content scripts and popup
        chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
            this.handleMessage(message, sender, sendResponse);
            return true; // Keep message channel open for async responses
        });

        // Handle tab updates
        chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
            if (changeInfo.status === 'complete' && tab.url && tab.url.includes('youtube.com')) {
                this.onYouTubeTabLoaded(tabId, tab);
            }
        });
    }

    onInstall() {
        console.log('🚫 Avoid YT Shorts - Extension installed');
        
        // Set default settings
        chrome.storage.local.set({
            settings: {
                enabled: true,
                showUI: true,
                autoPause: false,
                notifications: true
            },
            stats: {
                totalShortsBlocked: 0,
                totalTimeSaved: 0,
                installDate: Date.now()
            }
        });

        // Show welcome notification
        this.showNotification(
            'Avoid YT Shorts - Enhanced',
            'Extension installed successfully! Visit YouTube to start blocking shorts.'
        );
    }

    onUpdate(previousVersion) {
        console.log(`🚫 Avoid YT Shorts - Updated from ${previousVersion} to 2.0.0`);
        
        // Show update notification
        this.showNotification(
            'Avoid YT Shorts - Enhanced',
            'Extension updated to version 2.0.0! New features include statistics, pause/resume, and beautiful UI.'
        );
    }

    onStartup() {
        console.log('🚫 Avoid YT Shorts - Extension started');
    }

    onYouTubeTabLoaded(tabId, tab) {
        // Inject content script if not already injected
        chrome.scripting.executeScript({
            target: { tabId: tabId },
            files: ['content.js']
        }).catch(error => {
            console.log('Content script already injected or error:', error);
        });
    }

    async handleMessage(message, sender, sendResponse) {
        try {
            switch (message.action) {
                case 'getStats':
                    const stats = await this.getStats();
                    sendResponse({ stats });
                    break;

                case 'updateStats':
                    await this.updateStats(message.stats);
                    sendResponse({ success: true });
                    break;

                case 'getSettings':
                    const settings = await this.getSettings();
                    sendResponse({ settings });
                    break;

                case 'updateSettings':
                    await this.updateSettings(message.settings);
                    sendResponse({ success: true });
                    break;

                case 'showNotification':
                    this.showNotification(message.title, message.message);
                    sendResponse({ success: true });
                    break;

                default:
                    sendResponse({ error: 'Unknown action' });
            }
        } catch (error) {
            console.error('Error handling message:', error);
            sendResponse({ error: error.message });
        }
    }

    async getStats() {
        const result = await chrome.storage.local.get('stats');
        return result.stats || {
            totalShortsBlocked: 0,
            totalTimeSaved: 0,
            installDate: Date.now()
        };
    }

    async updateStats(newStats) {
        const currentStats = await this.getStats();
        const updatedStats = {
            ...currentStats,
            totalShortsBlocked: (currentStats.totalShortsBlocked || 0) + (newStats.shortsBlocked || 0),
            totalTimeSaved: (currentStats.totalTimeSaved || 0) + (newStats.timeSaved || 0),
            lastUpdated: Date.now()
        };
        
        await chrome.storage.local.set({ stats: updatedStats });
    }

    async getSettings() {
        const result = await chrome.storage.local.get('settings');
        return result.settings || {
            enabled: true,
            showUI: true,
            autoPause: false,
            notifications: true
        };
    }

    async updateSettings(newSettings) {
        const currentSettings = await this.getSettings();
        const updatedSettings = { ...currentSettings, ...newSettings };
        await chrome.storage.local.set({ settings: updatedSettings });
    }

    showNotification(title, message) {
        // Check if notifications are enabled
        this.getSettings().then(settings => {
            if (settings.notifications) {
                chrome.notifications.create({
                    type: 'basic',
                    iconUrl: 'icons/icon.png',
                    title: title,
                    message: message
                });
            }
        });
    }
}

// Initialize background manager
new BackgroundManager(); 