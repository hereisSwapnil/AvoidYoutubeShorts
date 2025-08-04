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
            this.init();
        }

        async init() {
            console.log("🚫 Avoid YouTube Shorts - Enhanced version loaded");
            await this.loadState();
            this.createUI();
            this.setupObserver();
            this.setupFullscreenDetection();
            this.updateCSSState();
            await this.blockExistingShorts();
            this.updateStats();
        }

        async loadState() {
            try {
                const result = await chrome.storage.local.get(['shortsBlockerState', 'shortsBlockerStats']);
                
                // Load settings state
                if (result.shortsBlockerState) {
                    this.isEnabled = result.shortsBlockerState.isEnabled !== false; // Default to true
                    console.log('📊 Loaded saved state:', result.shortsBlockerState);
                    console.log('🔧 Current state - isEnabled:', this.isEnabled);
                } else {
                    console.log('📊 No saved state found, using defaults - isEnabled:', this.isEnabled);
                }
                
                // Load stats
                if (result.shortsBlockerStats) {
                    this.stats = {
                        ...this.stats, // Keep default values as fallback
                        ...result.shortsBlockerStats // Override with saved values
                    };
                    console.log('📈 Loaded saved stats:', result.shortsBlockerStats);
                } else {
                    console.log('📈 No saved stats found, using defaults');
                }
            } catch (error) {
                console.log('❌ Error loading state:', error);
                console.log('📊 Using defaults - isEnabled:', this.isEnabled);
            }
        }

        async saveState() {
            try {
                const state = {
                    isEnabled: this.isEnabled,
                    lastSaved: Date.now()
                };
                await chrome.storage.local.set({ shortsBlockerState: state });
                console.log('💾 State saved:', state);
            } catch (error) {
                console.error('Error saving state:', error);
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
                await chrome.storage.local.set({ shortsBlockerStats: stats });
                console.log('💾 Stats saved:', stats);
            } catch (error) {
                console.error('Error saving stats:', error);
            }
        }

        updateCSSState() {
            if (this.isEnabled) {
                document.body.classList.add('shorts-blocker-enabled');
                console.log('🎯 CSS blocker enabled');
            } else {
                document.body.classList.remove('shorts-blocker-enabled');
                console.log('⏸️ CSS blocker disabled');
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
                // Blocker is active - mute all audio/video to prevent distraction
                videos.forEach(video => {
                    video.muted = true;
                    video.volume = 0;
                    console.log('🔇 Muted video (blocker active):', video.src || 'unknown source');
                });
                
                audios.forEach(audio => {
                    audio.muted = true;
                    audio.volume = 0;
                    console.log('🔇 Muted audio (blocker active):', audio.src || 'unknown source');
                });
                
                console.log(`🔇 Muted ${videos.length} videos and ${audios.length} audio elements (blocker active)`);
            } else {
                // Blocker is paused - unmute all audio/video for normal viewing
                videos.forEach(video => {
                    video.muted = false;
                    video.volume = 1;
                    console.log('🔊 Unmuted video (blocker paused):', video.src || 'unknown source');
                });
                
                audios.forEach(audio => {
                    audio.muted = false;
                    audio.volume = 1;
                    console.log('🔊 Unmuted audio (blocker paused):', audio.src || 'unknown source');
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
                    '<p>🎯 You\'re on a Shorts page!</p><p>💡 Consider navigating to regular videos</p><p>🔇 Audio is muted to prevent distraction</p>' :
                    '<p>🎯 You\'re on a Shorts page!</p><p>✅ Shorts blocker is paused</p><p>🔊 Audio is enabled for normal viewing</p>';
            }
            
            // Update container state
            if (container) {
                if (!this.isEnabled) {
                    container.classList.add('disabled');
                } else {
                    container.classList.remove('disabled');
                }
            }
        }

        createUI() {
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
                                        '<p>🎯 You\'re on a Shorts page!</p><p>💡 Consider navigating to regular videos</p><p>🔇 Audio is muted to prevent distraction</p>' :
                                        '<p>🎯 You\'re on a Shorts page!</p><p>✅ Shorts blocker is paused</p><p>🔊 Audio is enabled for normal viewing</p>'
                                    ) : 
                                    '<p>Stay focused on meaningful content! 📚</p>'
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
            let isOnRightSide = true; // Track which side the logo is on

            // Load saved position
            this.loadPosition();

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
                    // Prevent text selection during drag
                    document.body.style.userSelect = 'none';
                    document.body.style.webkitUserSelect = 'none';
                    document.body.style.mozUserSelect = 'none';
                    document.body.style.msUserSelect = 'none';
                }
            };

            const dragEnd = (e) => {
                initialX = currentX;
                initialY = currentY;
                isDragging = false;
                container.classList.remove('dragging');
                
                // Restore text selection
                document.body.style.userSelect = '';
                document.body.style.webkitUserSelect = '';
                document.body.style.mozUserSelect = '';
                document.body.style.msUserSelect = '';
                
                // Save position
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

                    // Constrain to screen bounds
                    const containerRect = container.getBoundingClientRect();
                    const containerWidth = containerRect.width;
                    const containerHeight = containerRect.height;
                    const screenWidth = window.innerWidth;
                    const screenHeight = window.innerHeight;

                    // Determine which side to snap to based on X position
                    const centerX = newX + containerWidth / 2;
                    const isRightSide = centerX > screenWidth / 2;
                    
                    // Snap to left or right side
                    const wasOnRightSide = isOnRightSide;
                    if (isRightSide) {
                        newX = screenWidth - containerWidth - 20; // 20px margin from right edge
                        isOnRightSide = true;
                    } else {
                        newX = 20; // 20px margin from left edge
                        isOnRightSide = false;
                    }

                    // Add snapping animation if side changed
                    if (wasOnRightSide !== isOnRightSide) {
                        container.classList.add('snapping');
                        setTimeout(() => {
                            container.classList.remove('snapping');
                        }, 300);
                    }

                    // Update side indicator classes
                    container.classList.remove('on-left-side', 'on-right-side');
                    if (isOnRightSide) {
                        container.classList.add('on-right-side');
                    } else {
                        container.classList.add('on-left-side');
                    }

                    // Constrain Y position to stay within screen bounds
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

            // Mouse events
            container.addEventListener("mousedown", dragStart);
            document.addEventListener("mousemove", drag);
            document.addEventListener("mouseup", dragEnd);

            // Touch events
            container.addEventListener("touchstart", dragStart);
            document.addEventListener("touchmove", drag);
            document.addEventListener("touchend", dragEnd);
        }

        setTranslate(xPos, yPos, el) {
            el.style.transform = `translate3d(${xPos}px, ${yPos}px, 0)`;
        }

        async loadPosition() {
            try {
                const result = await chrome.storage.local.get(['shortsBlockerPosition']);
                if (result.shortsBlockerPosition) {
                    const container = document.getElementById('shorts-blocker-container');
                    if (container) {
                        // Validate and constrain the saved position
                        const constrainedPosition = this.constrainPosition(
                            result.shortsBlockerPosition.x, 
                            result.shortsBlockerPosition.y
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
            const containerWidth = containerRect.width || 60; // fallback width
            const containerHeight = containerRect.height || 60; // fallback height
            const screenWidth = window.innerWidth;
            const screenHeight = window.innerHeight;

            // Determine which side to snap to based on X position
            const centerX = x + containerWidth / 2;
            const isRightSide = centerX > screenWidth / 2;
            
            // Snap to left or right side
            if (isRightSide) {
                x = screenWidth - containerWidth - 20; // 20px margin from right edge
            } else {
                x = 20; // 20px margin from left edge
            }

            // Constrain Y position to stay within screen bounds
            if (y < 0) {
                y = 0;
            } else if (y + containerHeight > screenHeight) {
                y = screenHeight - containerHeight;
            }

            // Update side indicator classes
            container.classList.remove('on-left-side', 'on-right-side');
            if (isRightSide) {
                container.classList.add('on-right-side');
            } else {
                container.classList.add('on-left-side');
            }

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
                        
                        // Save the constrained position
                        const constrainedPosition = this.constrainPosition(x, y);
                        await chrome.storage.local.set({ 
                            shortsBlockerPosition: constrainedPosition
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
            // Listen for fullscreen changes
            document.addEventListener('fullscreenchange', this.handleFullscreenChange.bind(this));
            document.addEventListener('webkitfullscreenchange', this.handleFullscreenChange.bind(this));
            document.addEventListener('mozfullscreenchange', this.handleFullscreenChange.bind(this));
            document.addEventListener('MSFullscreenChange', this.handleFullscreenChange.bind(this));

            // Listen for YouTube player fullscreen changes
            this.observeYouTubeFullscreen();
        }

        handleFullscreenChange() {
            const isFullscreen = !!(document.fullscreenElement || 
                                  document.webkitFullscreenElement || 
                                  document.mozFullScreenElement || 
                                  document.msFullscreenElement);
            
            const ui = document.getElementById('shorts-blocker-ui');
            if (ui) {
                if (isFullscreen) {
                    ui.style.display = 'none';
                    console.log('🎬 Fullscreen mode detected - hiding UI');
                } else {
                    ui.style.display = 'block';
                    console.log('📺 Exited fullscreen mode - showing UI');
                }
            }
        }

        observeYouTubeFullscreen() {
            // Watch for YouTube player fullscreen button changes
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

            // Observe YouTube player elements
            const playerElements = document.querySelectorAll('.ytp-fullscreen-button, .ytp-player-content');
            playerElements.forEach(element => {
                observer.observe(element, { attributes: true, attributeFilter: ['class'] });
            });

            // Also observe the body for YouTube-specific fullscreen classes
            observer.observe(document.body, { attributes: true, attributeFilter: ['class'] });
        }

        handleYouTubeFullscreen() {
            const isYouTubeFullscreen = document.querySelector('.ytp-fullscreen') !== null ||
                                      document.body.classList.contains('ytp-fullscreen');
            
            const ui = document.getElementById('shorts-blocker-ui');
            if (ui) {
                if (isYouTubeFullscreen) {
                    ui.style.display = 'none';
                    console.log('🎬 YouTube fullscreen mode detected - hiding UI');
                } else {
                    ui.style.display = 'block';
                    console.log('📺 YouTube exited fullscreen mode - showing UI');
                }
            }
        }



        setupObserver() {
            // Create a more efficient observer for dynamic content
            const observer = new MutationObserver((mutations) => {
                mutations.forEach((mutation) => {
                    if (mutation.type === 'childList') {
                        mutation.addedNodes.forEach((node) => {
                            if (node.nodeType === Node.ELEMENT_NODE) {
                                // Check and block shorts if enabled
                                if (this.isEnabled) {
                                    this.checkAndBlockShorts(node).catch(error => {
                                        console.error('Error checking and blocking shorts:', error);
                                    });
                                }
                                
                                // Handle new videos/audio on Shorts pages based on blocker state
                                if (window.location.pathname.includes('/shorts/')) {
                                    this.handleNewMediaElements(node);
                                }
                            }
                        });
                    }
                });
            });

            observer.observe(document.body, {
                childList: true,
                subtree: true
            });

            // Periodically check for CSS-hidden shorts (every 2 seconds)
            setInterval(() => {
                if (this.isEnabled) {
                    this.countCSSHiddenShorts().catch(error => {
                        console.error('Error counting CSS-hidden shorts:', error);
                    });
                }
            }, 2000);
        }

        handleNewMediaElements(element) {
            // Handle videos and audio elements within the added element based on blocker state
            const videos = element.querySelectorAll ? element.querySelectorAll('video') : [];
            const audios = element.querySelectorAll ? element.querySelectorAll('audio') : [];
            
            // Also check if the element itself is a video or audio
            if (element.tagName === 'VIDEO') {
                videos.push(element);
            } else if (element.tagName === 'AUDIO') {
                audios.push(element);
            }
            
            if (this.isEnabled) {
                // Blocker is active - mute new media elements
                videos.forEach(video => {
                    video.muted = true;
                    video.volume = 0;
                    console.log('🔇 Muted new video (blocker active):', video.src || 'unknown source');
                });
                
                audios.forEach(audio => {
                    audio.muted = true;
                    audio.volume = 0;
                    console.log('🔇 Muted new audio (blocker active):', audio.src || 'unknown source');
                });
            } else {
                // Blocker is paused - unmute new media elements
                videos.forEach(video => {
                    video.muted = false;
                    video.volume = 1;
                    console.log('🔊 Unmuted new video (blocker paused):', video.src || 'unknown source');
                });
                
                audios.forEach(audio => {
                    audio.muted = false;
                    audio.volume = 1;
                    console.log('🔊 Unmuted new audio (blocker paused):', audio.src || 'unknown source');
                });
            }
        }

        async checkAndBlockShorts(element) {
            // Use improved selectors that target individual shorts without hiding entire sections
            const shortsSelectors = [
                'ytd-video-renderer:has(a[href*="/shorts/"])',
                'ytd-reel-shelf-renderer:has(a[href*="/shorts/"])',
                'ytd-shorts:has(div[id="shorts-container"])',
                'ytd-guide-entry-renderer:has(a[title="Shorts"])',
                'ytd-rich-section-renderer ytd-rich-item-renderer:has(a[href*="/shorts/"])',
                'ytd-rich-section-renderer ytd-compact-video-renderer:has(a[href*="/shorts/"])',
                'ytd-rich-section-renderer ytd-grid-video-renderer:has(a[href*="/shorts/"])',
                'ytd-search ytd-video-renderer:has(a[href*="/shorts/"])',
                'ytd-trending ytd-video-renderer:has(a[href*="/shorts/"])',
                'ytd-browse ytd-video-renderer:has(a[href*="/shorts/"])'
            ];

            // Check for shorts section headers
            await this.checkAndBlockShortsHeaders(element);

            for (const selector of shortsSelectors) {
                const elements = element.querySelectorAll ? element.querySelectorAll(selector) : [];
                for (const el of elements) {
                    if (!el.hasAttribute('data-shorts-blocked')) {
                        await this.blockElement(el);
                    }
                }
            }

            // Also check if the element itself matches
            if (element.matches && shortsSelectors.some(selector => element.matches(selector))) {
                if (!element.hasAttribute('data-shorts-blocked')) {
                    await this.blockElement(element);
                }
            }
        }

        async checkAndBlockShortsHeaders(element) {
            // Check for shorts section headers by looking for elements with "Shorts" text
            const shortsHeaderSelectors = [
                'ytd-rich-shelf-renderer',
                '#rich-shelf-header',
                'ytd-rich-section-renderer'
            ];

            for (const selector of shortsHeaderSelectors) {
                const elements = element.querySelectorAll ? element.querySelectorAll(selector) : [];
                for (const el of elements) {
                    // Check if this element contains "Shorts" text
                    const titleElement = el.querySelector('#title, #title-text, [id="title"], [id="title-text"]');
                    if (titleElement && titleElement.textContent && titleElement.textContent.trim().toLowerCase() === 'shorts') {
                        if (!el.hasAttribute('data-shorts-blocked')) {
                            await this.blockElement(el);
                            console.log('🚫 Blocked shorts section header:', titleElement.textContent);
                        }
                    }
                }
            }

            // Also check if the element itself is a shorts header
            if (element.matches && shortsHeaderSelectors.some(selector => element.matches(selector))) {
                const titleElement = element.querySelector('#title, #title-text, [id="title"], [id="title-text"]');
                if (titleElement && titleElement.textContent && titleElement.textContent.trim().toLowerCase() === 'shorts') {
                    if (!element.hasAttribute('data-shorts-blocked')) {
                        await this.blockElement(element);
                        console.log('🚫 Blocked shorts section header:', titleElement.textContent);
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
            
            // Add a subtle animation effect
            element.style.transition = 'opacity 0.3s ease-out';
            element.style.opacity = '0';
            
            // Trigger success animation on the logo
            this.triggerBlockSuccessAnimation();
        }

        async blockExistingShorts() {
            // Block shorts that are already on the page
            const allElements = document.querySelectorAll('*');
            for (const element of allElements) {
                await this.checkAndBlockShorts(element);
            }
            
            // Also count shorts that are already hidden by CSS
            await this.countCSSHiddenShorts();
        }

        async countCSSHiddenShorts() {
            if (!this.isEnabled) return;
            
            // Selectors for shorts that might be hidden by CSS
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
                        // Check if element is hidden by CSS but not marked as blocked
                        const computedStyle = window.getComputedStyle(element);
                        const isHiddenByCSS = computedStyle.visibility === 'hidden' || computedStyle.display === 'none';
                        
                        if (isHiddenByCSS && !element.hasAttribute('data-shorts-blocked')) {
                            // Mark as blocked and count it
                            element.setAttribute('data-shorts-blocked', 'true');
                            cssHiddenCount++;
                        }
                    }
                } catch (error) {
                    // Some selectors might not be supported in all browsers
                    console.log('Selector not supported:', selector);
                }
            }

            // Count shorts section headers hidden by CSS
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
                    console.log('Header selector not supported:', selector);
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
            const toggleBtn = document.getElementById('shorts-blocker-toggle');
            
            if (this.isEnabled) {
                toggleBtn.textContent = 'Pause';
                toggleBtn.classList.remove('paused');
                console.log('🚫 Shorts blocker enabled');
                this.updateCSSState();
                this.updateUI();
                // Re-block any shorts that might have been unblocked
                await this.blockExistingShorts();
            } else {
                toggleBtn.textContent = 'Resume';
                toggleBtn.classList.add('paused');
                console.log('⏸️ Shorts blocker paused');
                this.updateCSSState();
                this.updateUI();
                // Unblock all previously blocked shorts
                this.unblockAllShorts();
            }
            
            await this.saveState();
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

        updateStats() {
            const blockedCount = document.getElementById('shorts-blocked-count');
            const timeSaved = document.getElementById('time-saved');
            
            if (blockedCount) {
                blockedCount.textContent = this.formatNumber(this.stats.shortsBlocked);
            }
            
            if (timeSaved) {
                // Estimate time saved (assuming 30 seconds per short)
                const estimatedSecondsSaved = this.stats.shortsBlocked * 30;
                timeSaved.textContent = this.formatTime(estimatedSecondsSaved);
            }
        }

        getStats() {
            return this.stats;
        }

        async resetStats() {
            this.stats.shortsBlocked = 0;
            this.stats.startTime = Date.now();
            this.stats.lastBlockTime = null;
            this.updateStats();
            await this.saveStats();
            console.log('📊 Stats reset');
        }

        // Handle messages from popup and background
        handleMessage(message, sendResponse) {
            switch (message.action) {
                case 'getStats':
                    sendResponse({ stats: this.getStats() });
                    break;
                
                case 'toggleBlocker':
                    this.toggleBlocker();
                    sendResponse({ success: true, isEnabled: this.isEnabled });
                    break;
                
                case 'resetStats':
                    this.resetStats();
                    sendResponse({ success: true });
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

    // Initialize the blocker when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', async () => {
            shortsBlockerInstance = new ShortsBlocker();
        });
    } else {
        shortsBlockerInstance = new ShortsBlocker();
    }

    // Handle navigation in YouTube (SPA)
    let currentUrl = location.href;
    new MutationObserver(() => {
        const url = location.href;
        if (url !== currentUrl) {
            currentUrl = url;
            // Re-initialize blocker for new page
            setTimeout(async () => {
                if (!document.getElementById('shorts-blocker-ui')) {
                    shortsBlockerInstance = new ShortsBlocker();
                }
            }, 1000);
        }
    }).observe(document, { subtree: true, childList: true });

    // Listen for messages from popup and background
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        if (shortsBlockerInstance) {
            shortsBlockerInstance.handleMessage(message, sendResponse);
        } else {
            sendResponse({ error: 'Blocker not initialized' });
        }
        return true; // Keep message channel open for async responses
    });
}