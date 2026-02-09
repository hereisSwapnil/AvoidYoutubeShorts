// Avoid YouTube Shorts - Enhanced Content Script

// Prevent duplicate initialization
if (window.shortsBlockerInitialized) {
    console.log('🚫 Avoid YT Shorts - Already initialized, skipping...');
} else {
    window.shortsBlockerInitialized = true;

    class ShortsBlocker {
        constructor() {
            this.stats = {
                shortsBlocked: 0,
                startTime: Date.now(),
                lastBlockTime: null
            };
            this.isEnabled = true;
            this.isInitialized = false;
            this.storageKey = 'shortsBlockerState';
            this.statsKey = 'shortsBlockerStats';
            this.positionKey = 'shortsBlockerPosition';
        }

        async init() {
            console.log("🚫 Avoid YouTube Shorts - Enhanced version loading...");
            
            // Load state first, before doing anything else
            await this.loadState();
            
            console.log("✅ State loaded. isEnabled:", this.isEnabled);
            
            // Now proceed with UI and blocking
            this.createUI();
            this.setupObserver();
            this.setupNavigationHandling();
            this.setupFullscreenDetection();
            this.updateCSSState();
            
            // Block existing shorts if enabled
            if (this.isEnabled) {
                await this.blockExistingShorts();
            }
            
            this.updateStats();
            this.isInitialized = true;
            
            console.log("✅ Initialization complete. isEnabled:", this.isEnabled);
        }

        setupNavigationHandling() {
            // Handle YouTube's SPA navigation events
            document.addEventListener('yt-navigate-finish', () => {
                this.handleNavigation();
            });

            // Handle background script messages for URL changes
            chrome.runtime.onMessage.addListener((message) => {
                if (message.action === 'urlChanged') {
                    this.handleNavigation();
                }
            });
        }

        handleNavigation() {
            console.log('🔄 Navigation detected');
            
            // Re-create UI if it was removed by YouTube
            if (!document.getElementById('shorts-blocker-ui')) {
                this.createUI();
            }
            
            this.updateUI();
            this.updateAudioState();
            
            // Force re-check of blocking if enabled
            if (this.isEnabled) {
                this.blockExistingShorts();
            }
        }

        async loadState() {
            try {
                console.log('📂 Loading state from storage...');
                
                // Use Promise.all to load both state and stats simultaneously
                const [stateResult, statsResult] = await Promise.all([
                    chrome.storage.local.get(this.storageKey),
                    chrome.storage.local.get(this.statsKey)
                ]);
                
                console.log('📦 Storage results:', { stateResult, statsResult });
                
                // Load enabled state with explicit handling
                if (stateResult[this.storageKey] !== undefined) {
                    const savedState = stateResult[this.storageKey];
                    
                    // Explicitly check for boolean value
                    if (typeof savedState === 'object' && savedState !== null) {
                        this.isEnabled = savedState.isEnabled !== false; // Default to true if undefined
                    } else if (typeof savedState === 'boolean') {
                        this.isEnabled = savedState;
                    }
                    
                    console.log('✅ Loaded state:', { isEnabled: this.isEnabled, savedState });
                } else {
                    // No saved state - use default (enabled)
                    this.isEnabled = true;
                    console.log('ℹ️ No saved state found, using default (enabled)');
                    
                    // Save the default state
                    await this.saveState();
                }
                
                // Load stats
                if (statsResult[this.statsKey]) {
                    this.stats = {
                        ...this.stats,
                        ...statsResult[this.statsKey]
                    };
                    console.log('📈 Loaded stats:', this.stats);
                } else {
                    console.log('ℹ️ No saved stats found, using defaults');
                    // Save default stats
                    await this.saveStats();
                }
                
            } catch (error) {
                console.error('❌ Error loading state:', error);
                // On error, default to enabled
                this.isEnabled = true;
                console.log('⚠️ Using fallback state (enabled) due to error');
            }
        }

        async saveState() {
            try {
                const state = {
                    isEnabled: this.isEnabled,
                    lastSaved: Date.now()
                };
                
                await chrome.storage.local.set({ [this.storageKey]: state });
                console.log('💾 State saved:', state);
                
                return true;
            } catch (error) {
                console.error('❌ Error saving state:', error);
                return false;
            }
        }

        async saveStats() {
            try {
                const stats = {
                    shortsBlocked: this.stats.shortsBlocked,
                    startTime: this.stats.startTime,
                    lastBlockTime: this.stats.lastBlockTime,
                    lastSaved: Date.now()
                };
                
                await chrome.storage.local.set({ [this.statsKey]: stats });
                console.log('💾 Stats saved:', stats);
                
                return true;
            } catch (error) {
                console.error('❌ Error saving stats:', error);
                return false;
            }
        }

        updateCSSState() {
            if (!document.body) {
                console.log('⏳ document.body not ready for CSS update, waiting...');
                setTimeout(() => this.updateCSSState(), 100);
                return;
            }

            if (this.isEnabled) {
                document.body.classList.add('shorts-blocker-enabled');
                console.log('🎨 Applied CSS class: shorts-blocker-enabled');
            } else {
                document.body.classList.remove('shorts-blocker-enabled');
                console.log('🎨 Removed CSS class: shorts-blocker-enabled');
            }
            
            // Update audio state on Shorts pages
            this.updateAudioState();
        }

        updateAudioState() {
            const isShortsPage = window.location.pathname.includes('/shorts/');
            if (!isShortsPage) return;

            const videos = document.querySelectorAll('video');
            const audios = document.querySelectorAll('audio');
            
            if (this.isEnabled) {
                // Blocker is active - mute all audio/video
                videos.forEach(video => {
                    video.muted = true;
                    video.volume = 0;
                });
                
                audios.forEach(audio => {
                    audio.muted = true;
                    audio.volume = 0;
                });
                
                console.log(`🔇 Muted ${videos.length} videos and ${audios.length} audio elements (blocker active)`);
            } else {
                // Blocker is paused - unmute all audio/video
                videos.forEach(video => {
                    video.muted = false;
                    video.volume = 1;
                });
                
                audios.forEach(audio => {
                    audio.muted = false;
                    audio.volume = 1;
                });
                
                console.log(`🔊 Unmuted ${videos.length} videos and ${audios.length} audio elements (blocker paused)`);
            }
        }

        updateUI() {
            const isShortsPage = window.location.pathname.includes('/shorts/');
            const messageEl = document.querySelector('.shorts-blocker-message');
            const container = document.querySelector('.shorts-blocker-container');
            
            if (messageEl && isShortsPage) {
                messageEl.innerHTML = this.isEnabled ? 
                    '<p>⚠️ Shorts Page Detected</p><p>Audio muted</p>' :
                    '<p>✅ Blocker Paused</p>';
            }
            
            // Update container state
            if (container) {
                if (!this.isEnabled) {
                    container.classList.add('disabled');
                } else {
                    container.classList.remove('disabled');
                }
            }
            
            // Update toggle button
            const toggleBtn = document.getElementById('shorts-blocker-toggle');
            if (toggleBtn) {
                toggleBtn.textContent = this.isEnabled ? 'Pause' : 'Resume';
                if (this.isEnabled) {
                    toggleBtn.classList.remove('paused');
                } else {
                    toggleBtn.classList.add('paused');
                }
            }
        }

        createUI() {
            // Ensure document.body exists before proceeding
            if (!document.body) {
                console.log('⏳ document.body not ready, waiting...');
                // Retry after a short delay
                setTimeout(() => this.createUI(), 100);
                return;
            }

            // Remove existing UI if present
            const existingUI = document.getElementById('shorts-blocker-ui');
            if (existingUI) existingUI.remove();

            // Check if we're on a Shorts page
            const isShortsPage = window.location.pathname.includes('/shorts/');

            const ui = document.createElement('div');
            ui.id = 'shorts-blocker-ui';
            ui.innerHTML = `
                <div class="shorts-blocker-container" id="shorts-blocker-container">
                    <div class="shorts-blocker-logo" id="shorts-blocker-logo">
                        <span class="logo-icon">🚫</span>
                    </div>
                    <div class="shorts-blocker-expanded" id="shorts-blocker-expanded">
                        <div class="shorts-blocker-header">
                            <div class="header-left">
                                <h2>${isShortsPage ? '⚠️ Shorts Page' : '🚫 Shorts Blocked'}</h2>
                            </div>
                            <button id="shorts-blocker-toggle" class="shorts-blocker-btn ${!this.isEnabled ? 'paused' : ''}">${this.isEnabled ? 'Pause' : 'Resume'}</button>
                        </div>
                        <div class="shorts-blocker-content">
                            <div class="shorts-blocker-stats">
                                <div class="stat-item">
                                    <span class="stat-label">Blocked:</span>
                                    <span id="shorts-blocked-count" class="stat-value">0</span>
                                </div>
                                <div class="stat-item">
                                    <span class="stat-label">Time saved:</span>
                                    <span id="time-saved" class="stat-value">0m</span>
                                </div>
                            </div>
                            <div class="shorts-blocker-message">
                                ${isShortsPage ? 
                                    (this.isEnabled ? 
                                        '<p>⚠️ Shorts Page Detected</p><p>Audio muted</p>' :
                                        '<p>✅ Blocker Paused</p>'
                                    ) : 
                                    '<p>Stay focused! 📚</p>'
                                }
                            </div>
                        </div>
                    </div>
                </div>
            `;

            document.body.appendChild(ui);

            // Add event listeners
            document.getElementById('shorts-blocker-toggle').addEventListener('click', () => {
                this.toggleBlocker();
            });

            // Make the container draggable
            this.makeDraggable();
            
            // Load saved position
            this.loadPosition();
        }

        makeDraggable() {
            const container = document.getElementById('shorts-blocker-container');
            let isDragging = false;
            let currentX;
            let currentY;
            let initialX;
            let initialY;
            let xOffset = 0;
            let yOffset = 0;

            const dragStart = (e) => {
                if (e.type === "touchstart") {
                    initialX = e.touches[0].clientX - xOffset;
                    initialY = e.touches[0].clientY - yOffset;
                } else {
                    initialX = e.clientX - xOffset;
                    initialY = e.clientY - yOffset;
                }

                if (e.target === container || container.contains(e.target)) {
                    isDragging = true;
                    container.classList.add('dragging');
                    document.body.style.userSelect = 'none';
                }
            };

            const dragEnd = (e) => {
                initialX = currentX;
                initialY = currentY;
                isDragging = false;
                container.classList.remove('dragging');
                document.body.style.userSelect = '';
                this.savePosition();
            };

            const drag = (e) => {
                if (isDragging) {
                    e.preventDefault();

                    let newX, newY;

                    if (e.type === "touchmove") {
                        newX = e.touches[0].clientX - initialX;
                        newY = e.touches[0].clientY - initialY;
                    } else {
                        newX = e.clientX - initialX;
                        newY = e.clientY - initialY;
                    }

                    const containerRect = container.getBoundingClientRect();
                    const containerWidth = containerRect.width;
                    const containerHeight = containerRect.height;
                    const screenWidth = window.innerWidth;
                    const screenHeight = window.innerHeight;

                    // Determine which side to snap to
                    const centerX = newX + containerWidth / 2;
                    const isRightSide = centerX > screenWidth / 2;
                    
                    // Snap to left or right side
                    if (isRightSide) {
                        newX = screenWidth - containerWidth - 20;
                    } else {
                        newX = 20;
                    }

                    // Update side indicator classes
                    container.classList.remove('on-left-side', 'on-right-side');
                    container.classList.add(isRightSide ? 'on-right-side' : 'on-left-side');

                    // Constrain Y position
                    if (newY < 0) {
                        newY = 0;
                    } else if (newY + containerHeight > screenHeight) {
                        newY = screenHeight - containerHeight;
                    }

                    currentX = newX;
                    currentY = newY;
                    xOffset = currentX;
                    yOffset = currentY;

                    this.setTranslate(currentX, currentY, container);
                }
            };

            container.addEventListener("mousedown", dragStart);
            document.addEventListener("mousemove", drag);
            document.addEventListener("mouseup", dragEnd);
            container.addEventListener("touchstart", dragStart);
            document.addEventListener("touchmove", drag);
            document.addEventListener("touchend", dragEnd);
        }

        setTranslate(xPos, yPos, el) {
            el.style.transform = `translate3d(${xPos}px, ${yPos}px, 0)`;
        }

        async loadPosition() {
            try {
                const result = await chrome.storage.local.get(this.positionKey);
                if (result[this.positionKey]) {
                    const container = document.getElementById('shorts-blocker-container');
                    if (container) {
                        const constrainedPosition = this.constrainPosition(
                            result[this.positionKey].x, 
                            result[this.positionKey].y
                        );
                        this.setTranslate(constrainedPosition.x, constrainedPosition.y, container);
                    }
                }
            } catch (error) {
                console.log('Error loading position:', error);
            }
        }

        constrainPosition(x, y) {
            const container = document.getElementById('shorts-blocker-container');
            if (!container) return { x: 20, y: 20 };

            const containerRect = container.getBoundingClientRect();
            const containerWidth = containerRect.width || 60;
            const containerHeight = containerRect.height || 60;
            const screenWidth = window.innerWidth;
            const screenHeight = window.innerHeight;

            const centerX = x + containerWidth / 2;
            const isRightSide = centerX > screenWidth / 2;
            
            if (isRightSide) {
                x = screenWidth - containerWidth - 20;
            } else {
                x = 20;
            }

            if (y < 0) {
                y = 0;
            } else if (y + containerHeight > screenHeight) {
                y = screenHeight - containerHeight;
            }

            container.classList.remove('on-left-side', 'on-right-side');
            container.classList.add(isRightSide ? 'on-right-side' : 'on-left-side');

            return { x, y };
        }

        async savePosition() {
            try {
                const container = document.getElementById('shorts-blocker-container');
                if (container) {
                    const transform = container.style.transform;
                    const match = transform.match(/translate3d\(([^,]+),\s*([^,]+)/);
                    if (match) {
                        const x = parseInt(match[1]);
                        const y = parseInt(match[2]);
                        const constrainedPosition = this.constrainPosition(x, y);
                        await chrome.storage.local.set({ 
                            [this.positionKey]: constrainedPosition
                        });
                    }
                }
            } catch (error) {
                console.log('Error saving position:', error);
            }
        }

        triggerBlockSuccessAnimation() {
            const container = document.getElementById('shorts-blocker-container');
            if (container) {
                container.classList.add('block-success');
                setTimeout(() => {
                    container.classList.remove('block-success');
                }, 600);
            }
        }

        setupFullscreenDetection() {
            document.addEventListener('fullscreenchange', this.handleFullscreenChange.bind(this));
            document.addEventListener('webkitfullscreenchange', this.handleFullscreenChange.bind(this));
            document.addEventListener('mozfullscreenchange', this.handleFullscreenChange.bind(this));
            document.addEventListener('MSFullscreenChange', this.handleFullscreenChange.bind(this));
            this.observeYouTubeFullscreen();
        }

        handleFullscreenChange() {
            const isFullscreen = !!(document.fullscreenElement || 
                                  document.webkitFullscreenElement || 
                                  document.mozFullScreenElement || 
                                  document.msFullscreenElement);
            
            const ui = document.getElementById('shorts-blocker-ui');
            if (ui) {
                ui.style.display = isFullscreen ? 'none' : 'block';
                console.log(isFullscreen ? '🎬 Fullscreen - hiding UI' : '📺 Exited fullscreen - showing UI');
            }
        }

        observeYouTubeFullscreen() {
            const observer = new MutationObserver((mutations) => {
                mutations.forEach((mutation) => {
                    if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
                        const target = mutation.target;
                        if (target.classList.contains('ytp-fullscreen') || 
                            target.classList.contains('ytp-fullscreen-button')) {
                            this.handleYouTubeFullscreen();
                        }
                    }
                });
            });

            const playerElements = document.querySelectorAll('.ytp-fullscreen-button, .ytp-player-content');
            playerElements.forEach(element => {
                observer.observe(element, { attributes: true, attributeFilter: ['class'] });
            });

            observer.observe(document.body, { attributes: true, attributeFilter: ['class'] });
        }

        handleYouTubeFullscreen() {
            const isYouTubeFullscreen = document.querySelector('.ytp-fullscreen') !== null ||
                                      document.body.classList.contains('ytp-fullscreen');
            
            const ui = document.getElementById('shorts-blocker-ui');
            if (ui) {
                ui.style.display = isYouTubeFullscreen ? 'none' : 'block';
                console.log(isYouTubeFullscreen ? '🎬 YouTube fullscreen - hiding UI' : '📺 YouTube exited fullscreen - showing UI');
            }
        }

        setupObserver() {
            // Ensure document.body exists before setting up observer
            if (!document.body) {
                console.log('⏳ document.body not ready for observer, waiting...');
                setTimeout(() => this.setupObserver(), 100);
                return;
            }

            let timeoutId = null;
            const nodesToProcess = new Set();
            
            const processNodes = () => {
                const nodes = Array.from(nodesToProcess);
                nodesToProcess.clear();
                
                nodes.forEach(node => {
                    if (document.contains(node)) {
                        if (this.isEnabled) {
                            this.checkAndBlockShorts(node).catch(() => {});
                        }
                        
                        if (window.location.pathname.includes('/shorts/')) {
                            this.handleNewMediaElements(node);
                        }
                    }
                });
                timeoutId = null;
            };

            const observer = new MutationObserver((mutations) => {
                let shouldProcess = false;
                mutations.forEach((mutation) => {
                    if (mutation.type === 'childList') {
                        mutation.addedNodes.forEach((node) => {
                            if (node.nodeType === Node.ELEMENT_NODE) {
                                nodesToProcess.add(node);
                                shouldProcess = true;
                            }
                        });
                    }
                });
                
                if (shouldProcess && !timeoutId) {
                    timeoutId = requestAnimationFrame(processNodes);
                }
            });

            observer.observe(document.body, {
                childList: true,
                subtree: true
            });

            console.log('👁️ MutationObserver setup complete');

            // Periodically check for CSS-hidden shorts
            setInterval(() => {
                if (this.isEnabled) {
                    this.countCSSHiddenShorts().catch(error => {
                        console.error('Error counting CSS-hidden shorts:', error);
                    });
                }
            }, 2000);
        }

        handleNewMediaElements(element) {
            const videos = element.querySelectorAll ? element.querySelectorAll('video') : [];
            const audios = element.querySelectorAll ? element.querySelectorAll('audio') : [];
            
            if (element.tagName === 'VIDEO') {
                videos.push(element);
            } else if (element.tagName === 'AUDIO') {
                audios.push(element);
            }
            
            if (this.isEnabled) {
                videos.forEach(video => {
                    video.muted = true;
                    video.volume = 0;
                });
                
                audios.forEach(audio => {
                    audio.muted = true;
                    audio.volume = 0;
                });
            } else {
                videos.forEach(video => {
                    video.muted = false;
                    video.volume = 1;
                });
                
                audios.forEach(audio => {
                    audio.muted = false;
                    audio.volume = 1;
                });
            }
        }

        async checkAndBlockShorts(element) {
            const shortsSelectors = [
                'ytd-video-renderer:has(a[href*="/shorts/"])',
                'ytd-reel-shelf-renderer',
                'ytd-shorts',
                'ytd-guide-entry-renderer:has(a[title="Shorts"])',
                'ytd-mini-guide-entry-renderer:has(a[title="Shorts"])',
                'ytd-rich-section-renderer:has(ytd-rich-shelf-renderer[is-shorts])',
                'ytd-search ytd-video-renderer:has(a[href*="/shorts/"])',
                'ytd-search ytd-reel-shelf-renderer',
                'grid-shelf-view-model:has(ytm-shorts-lockup-view-model-v2)',
                'grid-shelf-view-model:has(ytm-shorts-lockup-view-model)',
                'ytm-shorts-lockup-view-model-v2',
                'ytm-shorts-lockup-view-model',
                'ytd-channel-video-player-renderer[is-shorts]',
                'ytd-rich-item-renderer:has(a[href*="/shorts/"])',
                'ytd-grid-video-renderer:has(a[href*="/shorts/"])',
                'ytd-compact-video-renderer:has(a[href*="/shorts/"])',
                'yt-tab-shape[tab-title="Shorts"]'
            ];

            // Block Shorts chip-shape containers (filter chips)
            const chipContainers = document.querySelectorAll('#chip-shape-container');
            chipContainers.forEach(container => {
                if (container.textContent && container.textContent.includes('Shorts')) {
                    if (!container.hasAttribute('data-shorts-blocked')) {
                        container.style.display = 'none';
                        container.setAttribute('data-shorts-blocked', 'true');
                    }
                }
            });

            // Block Shorts tab shapes
            const tabShapes = document.querySelectorAll('yt-tab-shape');
            tabShapes.forEach(tab => {
                if ((tab.getAttribute('tab-title') === 'Shorts') || 
                    (tab.textContent && tab.textContent.trim() === 'Shorts')) {
                    if (!tab.hasAttribute('data-shorts-blocked')) {
                        tab.style.display = 'none';
                        tab.setAttribute('data-shorts-blocked', 'true');
                    }
                }
            });

            const tabContents = document.querySelectorAll('tp-yt-paper-tab div.tab-content');
            tabContents.forEach(tab => {
                if (tab.textContent && tab.textContent.includes('Shorts')) {
                    const paperTab = tab.closest('tp-yt-paper-tab');
                    if (paperTab) {
                        paperTab.style.display = 'none';
                        paperTab.setAttribute('data-shorts-blocked', 'true');
                    }
                }
            });

            await this.checkAndBlockShortsHeaders(element);

            for (const selector of shortsSelectors) {
                const elements = element.querySelectorAll ? element.querySelectorAll(selector) : [];
                for (const el of elements) {
                    if (!el.hasAttribute('data-shorts-blocked')) {
                        await this.blockElement(el);
                    }
                }
            }

            if (element.matches) {
                for (const selector of shortsSelectors) {
                    if (element.matches(selector)) {
                        if (!element.hasAttribute('data-shorts-blocked')) {
                            await this.blockElement(element);
                        }
                        break;
                    }
                }
            }
        }

        async checkAndBlockShortsHeaders(element) {
            const shortsHeaderSelectors = [
                'ytd-rich-shelf-renderer',
                'ytd-rich-section-renderer',
                'ytd-reel-shelf-renderer',
                'grid-shelf-view-model'
            ];

            const checkForShortsTitle = (el) => {
                const titleElement = el.querySelector('#title, #title-text, .ytd-reel-shelf-renderer-title');
                if (titleElement && titleElement.textContent && titleElement.textContent.trim().toLowerCase() === 'shorts') {
                    return true;
                }
                if (el.hasAttribute('is-shorts')) return true;
                return false;
            };

            for (const selector of shortsHeaderSelectors) {
                const elements = element.querySelectorAll ? element.querySelectorAll(selector) : [];
                for (const el of elements) {
                    if (checkForShortsTitle(el)) {
                        if (!el.hasAttribute('data-shorts-blocked')) {
                            await this.blockElement(el);
                        }
                    }
                }
            }

            if (element.matches && shortsHeaderSelectors.some(selector => element.matches(selector))) {
                if (checkForShortsTitle(element)) {
                    if (!element.hasAttribute('data-shorts-blocked')) {
                        await this.blockElement(element);
                    }
                }
            }
        }

        async blockElement(element) {
            element.style.visibility = 'hidden';
            element.style.display = 'none';
            element.setAttribute('data-shorts-blocked', 'true');
            
            this.stats.shortsBlocked++;
            this.stats.lastBlockTime = Date.now();
            this.updateStats();
            await this.saveStats();
            
            element.style.transition = 'opacity 0.3s ease-out';
            element.style.opacity = '0';
            
            this.triggerBlockSuccessAnimation();
        }

        async blockExistingShorts() {
            const allElements = document.querySelectorAll('*');
            for (const element of allElements) {
                await this.checkAndBlockShorts(element);
            }
            
            await this.countCSSHiddenShorts();
        }

        async countCSSHiddenShorts() {
            if (!this.isEnabled) return;
            
            const shortsSelectors = [
                'ytd-video-renderer:has(a[href*="/shorts/"])',
                'ytd-reel-shelf-renderer:has(a[href*="/shorts/"])',
                'ytd-shorts:has(div[id="shorts-container"])',
                'ytd-guide-entry-renderer:has(a[title="Shorts"])',
                'ytd-mini-guide-entry-renderer:has(a[title="Shorts"])',
                'ytd-rich-section-renderer ytd-rich-item-renderer:has(a[href*="/shorts/"])',
                'ytd-rich-section-renderer ytd-compact-video-renderer:has(a[href*="/shorts/"])',
                'ytd-rich-section-renderer ytd-grid-video-renderer:has(a[href*="/shorts/"])',
                'ytd-search ytd-video-renderer:has(a[href*="/shorts/"])',
                'ytd-trending ytd-video-renderer:has(a[href*="/shorts/"])',
                'ytd-browse ytd-video-renderer:has(a[href*="/shorts/"])'
            ];

            let cssHiddenCount = 0;
            
            for (const selector of shortsSelectors) {
                try {
                    const elements = document.querySelectorAll(selector);
                    for (const element of elements) {
                        const computedStyle = window.getComputedStyle(element);
                        const isHiddenByCSS = computedStyle.visibility === 'hidden' || computedStyle.display === 'none';
                        
                        if (isHiddenByCSS && !element.hasAttribute('data-shorts-blocked')) {
                            element.setAttribute('data-shorts-blocked', 'true');
                            cssHiddenCount++;
                        }
                    }
                } catch (error) {
                    // Selector not supported
                }
            }

            const headerSelectors = [
                'ytd-rich-shelf-renderer',
                '#rich-shelf-header',
                'ytd-rich-section-renderer'
            ];

            for (const selector of headerSelectors) {
                try {
                    const elements = document.querySelectorAll(selector);
                    for (const element of elements) {
                        const titleElement = element.querySelector('#title, #title-text, [id="title"], [id="title-text"]');
                        if (titleElement && titleElement.textContent && titleElement.textContent.trim().toLowerCase() === 'shorts') {
                            const computedStyle = window.getComputedStyle(element);
                            const isHiddenByCSS = computedStyle.visibility === 'hidden' || computedStyle.display === 'none';
                            
                            if (isHiddenByCSS && !element.hasAttribute('data-shorts-blocked')) {
                                element.setAttribute('data-shorts-blocked', 'true');
                                cssHiddenCount++;
                            }
                        }
                    }
                } catch (error) {
                    // Selector not supported
                }
            }

            if (cssHiddenCount > 0) {
                this.stats.shortsBlocked += cssHiddenCount;
                this.stats.lastBlockTime = Date.now();
                this.updateStats();
                await this.saveStats();
                console.log(`📊 Counted ${cssHiddenCount} CSS-hidden shorts`);
            }
        }

        async toggleBlocker() {
            this.isEnabled = !this.isEnabled;
            
            console.log(`🔄 Toggling blocker to: ${this.isEnabled ? 'ENABLED' : 'DISABLED'}`);
            
            // Save state immediately
            await this.saveState();
            
            // Update UI and CSS
            this.updateUI();
            this.updateCSSState();
            
            if (this.isEnabled) {
                console.log('✅ Shorts blocker enabled');
                await this.blockExistingShorts();
            } else {
                console.log('⏸️ Shorts blocker paused');
                this.unblockAllShorts();
            }
        }

        unblockAllShorts() {
            const blockedElements = document.querySelectorAll('[data-shorts-blocked="true"]');
            blockedElements.forEach(el => {
                el.style.visibility = '';
                el.style.display = '';
                el.style.opacity = '';
                el.removeAttribute('data-shorts-blocked');
            });
            console.log(`🔄 Unblocked ${blockedElements.length} shorts`);
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

        updateStats() {
            const blockedCount = document.getElementById('shorts-blocked-count');
            const timeSaved = document.getElementById('time-saved');
            
            if (blockedCount) {
                blockedCount.textContent = this.formatNumber(this.stats.shortsBlocked);
            }
            
            if (timeSaved) {
                const estimatedSecondsSaved = this.stats.shortsBlocked * 30;
                timeSaved.textContent = this.formatTime(estimatedSecondsSaved);
            }
        }

        getStats() {
            return {
                ...this.stats,
                isEnabled: this.isEnabled
            };
        }

        async resetStats() {
            this.stats.shortsBlocked = 0;
            this.stats.startTime = Date.now();
            this.stats.lastBlockTime = null;
            this.updateStats();
            await this.saveStats();
            console.log('📊 Stats reset');
        }

        handleMessage(message, sendResponse) {
            switch (message.action) {
                case 'getStats':
                    sendResponse({ stats: this.getStats() });
                    break;
                
                case 'toggleBlocker':
                    this.toggleBlocker().then(() => {
                        sendResponse({ success: true, isEnabled: this.isEnabled });
                    });
                    break;
                
                case 'resetStats':
                    this.resetStats().then(() => {
                        sendResponse({ success: true });
                    });
                    break;
                
                case 'settingsUpdated':
                    this.handleSettingsUpdate(message.settings);
                    sendResponse({ success: true });
                    break;
                
                default:
                    sendResponse({ error: 'Unknown action' });
            }
        }

        handleSettingsUpdate(settings) {
            if (settings.hasOwnProperty('enabled')) {
                this.isEnabled = settings.enabled;
                this.updateCSSState();
                this.updateUI();
                this.saveState();
            }
            
            if (settings.hasOwnProperty('showUI')) {
                const ui = document.getElementById('shorts-blocker-ui');
                if (ui) {
                    ui.style.display = settings.showUI ? 'block' : 'none';
                }
            }
            
            console.log('Settings updated:', settings);
        }
    }

    // Global instance
    let shortsBlockerInstance = null;

    if (!window.hasAvoidShortsBlocker) {
        window.hasAvoidShortsBlocker = true;

        const initBlocker = async () => {
            if (!shortsBlockerInstance) {
                shortsBlockerInstance = new ShortsBlocker();
                await shortsBlockerInstance.init();
            }
        };

        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', initBlocker);
        } else {
            initBlocker();
        }

        // Handle navigation in YouTube (SPA)
        let currentUrl = location.href;
        new MutationObserver(() => {
            const url = location.href;
            if (url !== currentUrl) {
                currentUrl = url;
                if (shortsBlockerInstance) {
                    setTimeout(() => {
                        shortsBlockerInstance.handleNavigation();
                    }, 500);
                }
            }
        }).observe(document, { subtree: true, childList: true });

        // Listen for messages from popup and background
        chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
            if (shortsBlockerInstance && shortsBlockerInstance.isInitialized) {
                shortsBlockerInstance.handleMessage(message, sendResponse);
            } else {
                initBlocker().then(() => {
                    if (shortsBlockerInstance) {
                        shortsBlockerInstance.handleMessage(message, sendResponse);
                    } else {
                        sendResponse({ error: 'Blocker not initialized' });
                    }
                });
            }
            return true;
        });
    }
}