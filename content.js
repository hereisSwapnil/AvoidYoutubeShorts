// Avoid YouTube Shorts - Content Script (MV3 & 2024-2026 YouTube Architecture)

if (window.shortsBlockerInitialized) {
    console.log('🚫 Avoid YT Shorts - Content script already initialized');
} else {
    window.shortsBlockerInitialized = true;

    class ShortsBlocker {
        constructor() {
            this.stats = {
                shortsBlocked: 0,
                shortsRedirected: 0,
                startTime: Date.now(),
                lastBlockTime: null
            };
            this.settings = {
                enabled: true,
                redirectShorts: true,
                hideShelves: true,
                hideNav: true,
                showUI: true,
                notifications: true
            };
            this.isInitialized = false;
            this.storageKey = 'shortsBlockerState';
            this.statsKey = 'shortsBlockerStats';
            this.settingsKey = 'settings';
            this.positionKey = 'shortsBlockerPosition';
            this.isRedirecting = false;
        }

        async init() {
            console.log('🚫 Avoid YT Shorts - Initializing...');

            await this.loadStateAndSettings();

            // First check if current page is a Shorts URL and needs redirection
            if (this.checkAndExecuteRedirection()) {
                return; // Redirecting away from /shorts/
            }

            this.createUI();
            this.updateCSSState();
            this.setupObserver();
            this.setupNavigationHandling();
            this.setupFullscreenDetection();

            if (this.settings.enabled) {
                this.blockExistingShorts();
            }

            this.isInitialized = true;
            console.log('✅ Avoid YT Shorts initialized. Enabled:', this.settings.enabled, 'Redirect:', this.settings.redirectShorts);
        }

        checkAndExecuteRedirection() {
            if (!this.settings.enabled || !this.settings.redirectShorts || this.isRedirecting) {
                return false;
            }

            const path = window.location.pathname;
            const shortsMatch = path.match(/\/shorts\/([a-zA-Z0-9_-]+)/);

            if (shortsMatch && shortsMatch[1]) {
                const videoId = shortsMatch[1];
                const watchUrl = `${window.location.origin}/watch?v=${videoId}${window.location.search ? '&' + window.location.search.substring(1) : ''}`;
                
                console.log(`🔀 Redirecting Shorts (${videoId}) to standard Watch player...`);
                this.isRedirecting = true;
                
                // Track redirection stats
                this.stats.shortsRedirected = (this.stats.shortsRedirected || 0) + 1;
                this.saveStats();

                // Perform seamless redirect
                window.location.replace(watchUrl);
                return true;
            }
            return false;
        }

        async loadStateAndSettings() {
            try {
                const result = await chrome.storage.local.get([this.settingsKey, this.storageKey, this.statsKey]);

                if (result[this.settingsKey]) {
                    this.settings = { ...this.settings, ...result[this.settingsKey] };
                }

                if (result[this.storageKey]) {
                    const state = result[this.storageKey];
                    if (typeof state.isEnabled === 'boolean') {
                        this.settings.enabled = state.isEnabled;
                    }
                    if (typeof state.redirectShorts === 'boolean') {
                        this.settings.redirectShorts = state.redirectShorts;
                    }
                }

                if (result[this.statsKey]) {
                    this.stats = { ...this.stats, ...result[this.statsKey] };
                }
            } catch (err) {
                console.error('Error loading state from storage:', err);
            }
        }

        async saveState() {
            try {
                await chrome.storage.local.set({
                    [this.storageKey]: {
                        isEnabled: this.settings.enabled,
                        redirectShorts: this.settings.redirectShorts,
                        lastSaved: Date.now()
                    },
                    [this.settingsKey]: this.settings
                });
            } catch (err) {
                console.error('Error saving state:', err);
            }
        }

        async saveStats() {
            try {
                await chrome.storage.local.set({
                    [this.statsKey]: this.stats,
                    stats: this.stats
                });
            } catch (err) {
                console.error('Error saving stats:', err);
            }
        }

        updateCSSState() {
            if (!document.body) {
                setTimeout(() => this.updateCSSState(), 50);
                return;
            }

            if (this.settings.enabled) {
                document.body.classList.add('shorts-blocker-enabled');
            } else {
                document.body.classList.remove('shorts-blocker-enabled');
            }

            const ui = document.getElementById('shorts-blocker-ui');
            if (ui) {
                ui.style.display = (this.settings.showUI !== false) ? 'block' : 'none';
            }
        }

        setupNavigationHandling() {
            // Handle YouTube's SPA navigation events
            const handleNav = () => {
                if (this.checkAndExecuteRedirection()) return;
                
                if (!document.getElementById('shorts-blocker-ui')) {
                    this.createUI();
                }
                this.updateUI();
                this.updateCSSState();
                
                if (this.settings.enabled) {
                    this.blockExistingShorts();
                }
            };

            document.addEventListener('yt-navigate-finish', handleNav);
            document.addEventListener('yt-page-data-updated', handleNav);
            window.addEventListener('popstate', handleNav);

            chrome.runtime.onMessage.addListener((message) => {
                if (message.action === 'urlChanged') {
                    handleNav();
                }
            });
        }

        setupObserver() {
            if (!document.body) {
                setTimeout(() => this.setupObserver(), 50);
                return;
            }

            let rafId = null;
            const pendingNodes = new Set();

            const processPendingNodes = () => {
                if (!this.settings.enabled) {
                    pendingNodes.clear();
                    rafId = null;
                    return;
                }

                pendingNodes.forEach(node => {
                    if (document.contains(node)) {
                        this.scanAndBlockElement(node);
                    }
                });

                pendingNodes.clear();
                rafId = null;
            };

            const observer = new MutationObserver((mutations) => {
                if (!this.settings.enabled) return;

                let addedAny = false;
                for (const mutation of mutations) {
                    if (mutation.type === 'childList') {
                        for (const node of mutation.addedNodes) {
                            if (node.nodeType === Node.ELEMENT_NODE) {
                                pendingNodes.add(node);
                                addedAny = true;
                            }
                        }
                    }
                }

                if (addedAny && !rafId) {
                    rafId = requestAnimationFrame(processPendingNodes);
                }
            });

            observer.observe(document.body, { childList: true, subtree: true });
        }

        scanAndBlockElement(root) {
            const selectors = [
                'ytd-rich-shelf-renderer[is-shorts]',
                'ytd-rich-shelf-renderer:has(a[href*="/shorts/"])',
                'ytd-rich-section-renderer:has(a[href*="/shorts/"])',
                'ytd-reel-shelf-renderer',
                'ytd-shorts',
                'grid-shelf-view-model:has(ytm-shorts-lockup-view-model)',
                'grid-shelf-view-model:has(ytm-shorts-lockup-view-model-v2)',
                'grid-shelf-view-model:has(a[href*="/shorts/"])',
                'ytm-shorts-lockup-view-model',
                'ytm-shorts-lockup-view-model-v2',
                'yt-lockup-view-model:has(a[href*="/shorts/"])',
                'ytd-rich-item-renderer:has(a[href*="/shorts/"])',
                'ytd-video-renderer:has(a[href*="/shorts/"])',
                'ytd-compact-video-renderer:has(a[href*="/shorts/"])',
                'ytd-grid-video-renderer:has(a[href*="/shorts/"])',
                'ytd-guide-entry-renderer:has(a[href*="/shorts"])',
                'ytd-mini-guide-entry-renderer:has(a[href*="/shorts"])',
                'yt-tab-shape[tab-title="Shorts"]',
                'yt-tab-shape:has(a[href*="/shorts"])',
                'tp-yt-paper-tab:has(a[href*="/shorts"])',
                'yt-chip-cloud-chip-renderer:has(button[title="Shorts"])'
            ];

            let newlyBlocked = 0;

            selectors.forEach(selector => {
                const elements = root.querySelectorAll ? root.querySelectorAll(selector) : [];
                elements.forEach(el => {
                    if (!el.hasAttribute('data-shorts-blocked')) {
                        el.setAttribute('data-shorts-blocked', 'true');
                        el.style.display = 'none';
                        el.style.visibility = 'hidden';
                        newlyBlocked++;
                    }
                });

                if (root.matches && root.matches(selector) && !root.hasAttribute('data-shorts-blocked')) {
                    root.setAttribute('data-shorts-blocked', 'true');
                    root.style.display = 'none';
                    root.style.visibility = 'hidden';
                    newlyBlocked++;
                }
            });

            if (newlyBlocked > 0) {
                this.stats.shortsBlocked += newlyBlocked;
                this.stats.lastBlockTime = Date.now();
                this.updateUI();
                this.saveStats();
            }
        }

        blockExistingShorts() {
            if (document.body) {
                this.scanAndBlockElement(document.body);
            }
        }

        unblockAllShorts() {
            const blocked = document.querySelectorAll('[data-shorts-blocked="true"]');
            blocked.forEach(el => {
                el.style.display = '';
                el.style.visibility = '';
                el.removeAttribute('data-shorts-blocked');
            });
        }

        createUI() {
            if (!document.body) {
                setTimeout(() => this.createUI(), 50);
                return;
            }

            const existing = document.getElementById('shorts-blocker-ui');
            if (existing) existing.remove();

            const ui = document.createElement('div');
            ui.id = 'shorts-blocker-ui';
            ui.style.display = (this.settings.showUI !== false) ? 'block' : 'none';

            ui.innerHTML = `
                <div class="shorts-blocker-container" id="shorts-blocker-container">
                    <div class="shorts-blocker-logo">
                        <span class="logo-icon">🚫</span>
                    </div>
                    <div class="shorts-blocker-expanded">
                        <div class="shorts-blocker-header">
                            <div class="header-left">
                                <h2>🚫 Avoid YT Shorts</h2>
                            </div>
                            <button id="shorts-blocker-toggle" class="shorts-blocker-btn ${!this.settings.enabled ? 'paused' : ''}">
                                ${this.settings.enabled ? 'Pause' : 'Resume'}
                            </button>
                        </div>
                        <div class="shorts-blocker-stats">
                            <div class="stat-item">
                                <span class="stat-label">Shorts Blocked:</span>
                                <span id="shorts-blocked-count" class="stat-value">0</span>
                            </div>
                            <div class="stat-item">
                                <span class="stat-label">Shorts Redirected:</span>
                                <span id="shorts-redirected-count" class="stat-value">0</span>
                            </div>
                        </div>
                        <div class="shorts-blocker-message">
                            <p>${this.settings.enabled ? 'Focus mode active 🎯' : 'Blocker paused 🟡'}</p>
                        </div>
                    </div>
                </div>
            `;

            document.body.appendChild(ui);

            document.getElementById('shorts-blocker-toggle').addEventListener('click', () => {
                this.toggleBlocker();
            });

            this.makeDraggable();
            this.loadPosition();
            this.updateUI();
        }

        toggleBlocker() {
            this.settings.enabled = !this.settings.enabled;
            this.saveState();
            this.updateCSSState();
            this.updateUI();

            if (this.settings.enabled) {
                this.blockExistingShorts();
            } else {
                this.unblockAllShorts();
            }
        }

        updateUI() {
            const blockedEl = document.getElementById('shorts-blocked-count');
            const redirectedEl = document.getElementById('shorts-redirected-count');
            const toggleBtn = document.getElementById('shorts-blocker-toggle');

            if (blockedEl) blockedEl.textContent = (this.stats.shortsBlocked || 0).toLocaleString();
            if (redirectedEl) redirectedEl.textContent = (this.stats.shortsRedirected || 0).toLocaleString();

            if (toggleBtn) {
                toggleBtn.textContent = this.settings.enabled ? 'Pause' : 'Resume';
                if (this.settings.enabled) {
                    toggleBtn.classList.remove('paused');
                } else {
                    toggleBtn.classList.add('paused');
                }
            }
        }

        makeDraggable() {
            const container = document.getElementById('shorts-blocker-container');
            if (!container) return;

            let isDragging = false;
            let startX, startY, currentX = 20, currentY = 20;

            const onStart = (e) => {
                isDragging = true;
                const clientX = e.touches ? e.touches[0].clientX : e.clientX;
                const clientY = e.touches ? e.touches[0].clientY : e.clientY;
                startX = clientX - currentX;
                startY = clientY - currentY;
                container.classList.add('dragging');
            };

            const onMove = (e) => {
                if (!isDragging) return;
                const clientX = e.touches ? e.touches[0].clientX : e.clientX;
                const clientY = e.touches ? e.touches[0].clientY : e.clientY;
                currentX = clientX - startX;
                currentY = clientY - startY;

                container.style.transform = `translate3d(${currentX}px, ${currentY}px, 0)`;
            };

            const onEnd = () => {
                if (!isDragging) return;
                isDragging = false;
                container.classList.remove('dragging');
                chrome.storage.local.set({ [this.positionKey]: { x: currentX, y: currentY } });
            };

            container.addEventListener('mousedown', onStart);
            document.addEventListener('mousemove', onMove);
            document.addEventListener('mouseup', onEnd);

            container.addEventListener('touchstart', onStart, { passive: true });
            document.addEventListener('touchmove', onMove, { passive: true });
            document.addEventListener('touchend', onEnd);
        }

        async loadPosition() {
            try {
                const res = await chrome.storage.local.get(this.positionKey);
                if (res[this.positionKey]) {
                    const { x, y } = res[this.positionKey];
                    const container = document.getElementById('shorts-blocker-container');
                    if (container) {
                        container.style.transform = `translate3d(${x}px, ${y}px, 0)`;
                    }
                }
            } catch (err) {
                // Ignore position load error
            }
        }

        setupFullscreenDetection() {
            const handleFullscreen = () => {
                const isFs = !!(document.fullscreenElement || document.webkitFullscreenElement);
                const ui = document.getElementById('shorts-blocker-ui');
                if (ui) {
                    ui.style.display = (isFs || !this.settings.showUI) ? 'none' : 'block';
                }
            };
            document.addEventListener('fullscreenchange', handleFullscreen);
            document.addEventListener('webkitfullscreenchange', handleFullscreen);
        }

        handleMessage(message, sendResponse) {
            switch (message.action) {
                case 'getStats':
                    sendResponse({ stats: this.stats });
                    break;
                case 'toggleBlocker':
                    this.toggleBlocker();
                    sendResponse({ success: true, isEnabled: this.settings.enabled });
                    break;
                case 'resetStats':
                    this.stats.shortsBlocked = 0;
                    this.stats.shortsRedirected = 0;
                    this.updateUI();
                    this.saveStats().then(() => sendResponse({ success: true }));
                    break;
                case 'settingsUpdated':
                    if (message.settings) {
                        this.settings = { ...this.settings, ...message.settings };
                        this.updateCSSState();
                        this.updateUI();
                        if (this.checkAndExecuteRedirection()) return;
                    }
                    sendResponse({ success: true });
                    break;
                default:
                    sendResponse({ error: 'Unknown action' });
            }
        }
    }

    let instance = null;
    const initBlocker = async () => {
        if (!instance) {
            instance = new ShortsBlocker();
            await instance.init();
        }
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initBlocker);
    } else {
        initBlocker();
    }

    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        if (instance && instance.isInitialized) {
            instance.handleMessage(message, sendResponse);
        } else {
            initBlocker().then(() => {
                if (instance) instance.handleMessage(message, sendResponse);
            });
        }
        return true;
    });
}