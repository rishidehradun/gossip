/**
 * GossipYah Behavior Tracker
 * Tracks user behavior and habits for analytics and optimization
 * Privacy-focused: All data is anonymized and aggregated
 */

(function() {
    'use strict';

    const CONFIG = {
        trackingEnabled: true,
        sessionTimeout: 30 * 60 * 1000,
        sendInterval: 10000,
        endpoint: 'https://script.google.com/macros/s/AKfycbz8ccvgSSDIl_Kf_qiNHjViEI9eoyte4qIE9eht5IW047KKKCbWO1yhnsPbEFlG8CL5/exec',
        debug: false
    };

    const STORAGE_KEYS = {
        sessionId: 'gy_session_id',
        visitCount: 'gy_visit_count',
        firstVisit: 'gy_first_visit',
        lastVisit: 'gy_last_visit',
        returnVisitor: 'gy_return_visitor'
    };

    const tracker = {
        sessionId: null,
        startTime: Date.now(),
        events: [],
        interactions: {
            scrollDepth: 0,
            clicks: 0,
            formFocused: false,
            formStarted: false,
            formCompleted: false,
            fieldsInteracted: new Set(),
            errorsSeen: [],
            timeOnPage: 0,
            mouseMoves: 0,
            idleTime: 0
        },
        lastActivity: Date.now(),
        idleThreshold: 60000,
        deviceInfo: {},
        referrer: document.referrer || 'direct',
        queryParams: {}
    };

    function init() {
        if (!CONFIG.trackingEnabled) return;

        try {
            tracker.sessionId = getOrCreateSession();
            captureDeviceInfo();
            parseQueryParams();
            trackVisit();
            setupEventListeners();
            startPeriodicSender();
            trackPageVisibility();
            window.addEventListener('beforeunload', handlePageUnload);
            log('Behavior tracker initialized', tracker.sessionId);
        } catch (error) {
            log('Error initializing tracker:', error);
        }
    }

    function getOrCreateSession() {
        try {
            let sessionId = sessionStorage.getItem(STORAGE_KEYS.sessionId);
            if (!sessionId) {
                sessionId = generateId();
                sessionStorage.setItem(STORAGE_KEYS.sessionId, sessionId);
            }
            return sessionId;
        } catch (error) {
            log('Error with sessionStorage:', error);
            return generateId();
        }
    }

    function generateId() {
        return 'gy_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    function captureDeviceInfo() {
        tracker.deviceInfo = {
            userAgent: navigator.userAgent,
            platform: navigator.platform,
            language: navigator.language,
            screenWidth: window.screen.width,
            screenHeight: window.screen.height,
            viewportWidth: window.innerWidth,
            viewportHeight: window.innerHeight,
            colorDepth: window.screen.colorDepth,
            pixelRatio: window.devicePixelRatio,
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            cookiesEnabled: navigator.cookieEnabled,
            doNotTrack: navigator.doNotTrack,
            touchSupport: 'ontouchstart' in window,
            deviceType: getDeviceType(),
            browser: getBrowser(),
            os: getOS()
        };
    }

    function getDeviceType() {
        const ua = navigator.userAgent;
        if (/(tablet|ipad|playbook|silk)|(android(?!.*mobi))/i.test(ua)) {
            return 'tablet';
        }
        if (/Mobile|Android|iP(hone|od)|IEMobile|BlackBerry|Kindle|Silk-Accelerated|(hpw|web)OS|Opera M(obi|ini)/.test(ua)) {
            return 'mobile';
        }
        return 'desktop';
    }

    function getBrowser() {
        const ua = navigator.userAgent;
        if (ua.indexOf('Chrome') > -1 && ua.indexOf('Edg') === -1) return 'Chrome';
        if (ua.indexOf('Safari') > -1 && ua.indexOf('Chrome') === -1) return 'Safari';
        if (ua.indexOf('Firefox') > -1) return 'Firefox';
        if (ua.indexOf('Edg') > -1) return 'Edge';
        if (ua.indexOf('Opera') > -1 || ua.indexOf('OPR') > -1) return 'Opera';
        if (ua.indexOf('Trident') > -1) return 'IE';
        return 'Unknown';
    }

    function getOS() {
        const ua = navigator.userAgent;
        if (ua.indexOf('Win') > -1) return 'Windows';
        if (ua.indexOf('Mac') > -1) return 'MacOS';
        if (ua.indexOf('Linux') > -1) return 'Linux';
        if (ua.indexOf('Android') > -1) return 'Android';
        if (ua.indexOf('like Mac') > -1) return 'iOS';
        return 'Unknown';
    }

    function parseQueryParams() {
        try {
            const params = new URLSearchParams(window.location.search);
            params.forEach(function(value, key) {
                tracker.queryParams[key] = value;
            });
        } catch (error) {
            log('Error parsing query params:', error);
        }
    }

    function trackVisit() {
        try {
            const now = Date.now();
            const visitCount = parseInt(localStorage.getItem(STORAGE_KEYS.visitCount) || '0', 10);
            const firstVisit = localStorage.getItem(STORAGE_KEYS.firstVisit);
            const lastVisit = localStorage.getItem(STORAGE_KEYS.lastVisit);
            
            const newVisitCount = visitCount + 1;
            localStorage.setItem(STORAGE_KEYS.visitCount, newVisitCount.toString());
            
            if (!firstVisit) {
                localStorage.setItem(STORAGE_KEYS.firstVisit, now.toString());
            }
            
            const isReturning = lastVisit && (now - parseInt(lastVisit, 10)) > CONFIG.sessionTimeout;
            localStorage.setItem(STORAGE_KEYS.returnVisitor, isReturning.toString());
            localStorage.setItem(STORAGE_KEYS.lastVisit, now.toString());
            
            trackEvent('page_view', {
                visitCount: newVisitCount,
                isReturning: isReturning,
                timeSinceLastVisit: lastVisit ? now - parseInt(lastVisit, 10) : null,
                referrer: tracker.referrer,
                utmParams: {
                    source: tracker.queryParams.utm_source,
                    medium: tracker.queryParams.utm_medium,
                    campaign: tracker.queryParams.utm_campaign,
                    term: tracker.queryParams.utm_term,
                    content: tracker.queryParams.utm_content
                }
            });
        } catch (error) {
            log('Error tracking visit:', error);
        }
    }

    function setupEventListeners() {
        let scrollTimeout;
        window.addEventListener('scroll', function() {
            updateActivity();
            clearTimeout(scrollTimeout);
            scrollTimeout = setTimeout(function() {
                trackScroll();
            }, 100);
        }, { passive: true });

        document.addEventListener('click', function(e) {
            updateActivity();
            tracker.interactions.clicks++;
            
            const target = e.target;
            const tagName = target.tagName.toLowerCase();
            const clickData = {
                element: tagName,
                text: target.textContent ? target.textContent.substring(0, 50) : null,
                id: target.id || null,
                classes: target.className || null,
                x: e.clientX,
                y: e.clientY
            };
            
            if (tagName === 'a') {
                trackEvent('link_click', {
                    href: target.href,
                    text: clickData.text,
                    isExternal: target.hostname !== window.location.hostname
                });
            } else if (tagName === 'button') {
                trackEvent('button_click', clickData);
            } else if (target.closest('.whatsapp-float')) {
                trackEvent('whatsapp_click', clickData);
            }
        }, { passive: true });

        const form = document.getElementById('newsletterForm');
        if (form) {
            form.addEventListener('focusin', function() {
                updateActivity();
                if (!tracker.interactions.formFocused) {
                    tracker.interactions.formFocused = true;
                    trackEvent('form_focused');
                }
            }, { passive: true });

            const nameInput = document.getElementById('name');
            const phoneInput = document.getElementById('phone');
            const checkboxes = form.querySelectorAll('input[type="checkbox"]');

            if (nameInput) {
                nameInput.addEventListener('input', function() {
                    updateActivity();
                    if (!tracker.interactions.formStarted) {
                        tracker.interactions.formStarted = true;
                        trackEvent('form_started');
                    }
                    tracker.interactions.fieldsInteracted.add('name');
                }, { passive: true });

                nameInput.addEventListener('blur', function() {
                    if (this.value.length > 0) {
                        trackEvent('field_completed', { field: 'name', length: this.value.length });
                    }
                }, { passive: true });
            }

            if (phoneInput) {
                phoneInput.addEventListener('input', function() {
                    updateActivity();
                    tracker.interactions.fieldsInteracted.add('phone');
                }, { passive: true });

                phoneInput.addEventListener('blur', function() {
                    if (this.value.length > 0) {
                        trackEvent('field_completed', { field: 'phone', length: this.value.length });
                    }
                }, { passive: true });
            }

            checkboxes.forEach(function(checkbox) {
                checkbox.addEventListener('change', function() {
                    updateActivity();
                    tracker.interactions.fieldsInteracted.add(this.name);
                    trackEvent('checkbox_toggled', {
                        name: this.name,
                        checked: this.checked
                    });
                }, { passive: true });
            });

            form.addEventListener('submit', function() {
                updateActivity();
                tracker.interactions.formCompleted = true;
                trackEvent('form_submitted', {
                    fieldsInteracted: Array.from(tracker.interactions.fieldsInteracted),
                    timeToSubmit: Date.now() - tracker.startTime
                });
            });

            try {
                const observer = new MutationObserver(function(mutations) {
                    mutations.forEach(function(mutation) {
                        mutation.addedNodes.forEach(function(node) {
                            if (node.nodeType === 1) {
                                const errorElements = node.querySelectorAll ? node.querySelectorAll('.error-message, .status-error') : [];
                                errorElements.forEach(function(el) {
                                    if (el.textContent && el.textContent.trim()) {
                                        const errorText = el.textContent.trim();
                                        if (!tracker.interactions.errorsSeen.includes(errorText)) {
                                            tracker.interactions.errorsSeen.push(errorText);
                                            trackEvent('form_error', { error: errorText });
                                        }
                                    }
                                });
                            }
                        });
                    });
                });

                observer.observe(form, { childList: true, subtree: true, characterData: true });
            } catch (error) {
                log('Error setting up MutationObserver:', error);
            }
        }

        let mouseMoveTimeout;
        document.addEventListener('mousemove', function() {
            updateActivity();
            clearTimeout(mouseMoveTimeout);
            mouseMoveTimeout = setTimeout(function() {
                tracker.interactions.mouseMoves++;
            }, 500);
        }, { passive: true });

        document.addEventListener('keydown', function() {
            updateActivity();
        }, { passive: true });

        document.addEventListener('touchstart', function() {
            updateActivity();
        }, { passive: true });
    }

    function trackScroll() {
        const windowHeight = window.innerHeight;
        const documentHeight = document.documentElement.scrollHeight;
        const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
        const scrollPercent = Math.round((scrollTop + windowHeight) / documentHeight * 100);
        
        if (scrollPercent > tracker.interactions.scrollDepth) {
            const oldDepth = tracker.interactions.scrollDepth;
            tracker.interactions.scrollDepth = scrollPercent;
            
            if (scrollPercent >= 25 && oldDepth < 25) {
                trackEvent('scroll_depth', { depth: 25 });
            } else if (scrollPercent >= 50 && oldDepth < 50) {
                trackEvent('scroll_depth', { depth: 50 });
            } else if (scrollPercent >= 75 && oldDepth < 75) {
                trackEvent('scroll_depth', { depth: 75 });
            } else if (scrollPercent >= 90 && oldDepth < 90) {
                trackEvent('scroll_depth', { depth: 90 });
            }
        }
    }

    function updateActivity() {
        const now = Date.now();
        const wasIdle = (now - tracker.lastActivity) > tracker.idleThreshold;
        
        if (wasIdle) {
            tracker.interactions.idleTime += (now - tracker.lastActivity);
            trackEvent('returned_from_idle', {
                idleDuration: now - tracker.lastActivity
            });
        }
        
        tracker.lastActivity = now;
    }

    function trackPageVisibility() {
        document.addEventListener('visibilitychange', function() {
            if (document.hidden) {
                trackEvent('page_hidden');
            } else {
                updateActivity();
                trackEvent('page_visible');
            }
        });
    }

    function handlePageUnload() {
        tracker.interactions.timeOnPage = Date.now() - tracker.startTime;
        
        const exitData = {
            timeOnPage: tracker.interactions.timeOnPage,
            scrollDepth: tracker.interactions.scrollDepth,
            clicks: tracker.interactions.clicks,
            formStarted: tracker.interactions.formStarted,
            formCompleted: tracker.interactions.formCompleted,
            fieldsInteracted: Array.from(tracker.interactions.fieldsInteracted),
            errorsSeen: tracker.interactions.errorsSeen,
            idleTime: tracker.interactions.idleTime,
            engagementScore: calculateEngagementScore()
        };
        
        trackEvent('page_exit', exitData);
        sendDataSync();
    }

    function calculateEngagementScore() {
        let score = 0;
        const timeOnPage = Date.now() - tracker.startTime;
        
        score += Math.min(30, (timeOnPage / 1000 / 60) * 10);
        score += (tracker.interactions.scrollDepth / 100) * 20;
        score += Math.min(15, tracker.interactions.clicks * 3);
        
        if (tracker.interactions.formFocused) score += 5;
        if (tracker.interactions.formStarted) score += 10;
        if (tracker.interactions.formCompleted) score += 20;
        
        return Math.round(Math.min(100, score));
    }

    function trackEvent(eventName, data) {
        const event = {
            type: eventName,
            timestamp: Date.now(),
            data: data || {}
        };
        
        tracker.events.push(event);
        log('Event tracked:', eventName, data);
    }

    function startPeriodicSender() {
        setInterval(sendData, CONFIG.sendInterval);
    }

    function sendData() {
        if (tracker.events.length === 0) return;
        
        const payload = {
            sessionId: tracker.sessionId,
            timestamp: Date.now(),
            url: window.location.href,
            deviceInfo: tracker.deviceInfo,
            interactions: {
                scrollDepth: tracker.interactions.scrollDepth,
                clicks: tracker.interactions.clicks,
                formFocused: tracker.interactions.formFocused,
                formStarted: tracker.interactions.formStarted,
                formCompleted: tracker.interactions.formCompleted,
                fieldsInteracted: Array.from(tracker.interactions.fieldsInteracted),
                errorsSeen: tracker.interactions.errorsSeen,
                timeOnPage: Date.now() - tracker.startTime,
                mouseMoves: tracker.interactions.mouseMoves,
                idleTime: tracker.interactions.idleTime
            },
            events: tracker.events.splice(0)
        };
        
        if (CONFIG.endpoint && CONFIG.endpoint !== 'https://script.google.com/macros/s/YOUR_TRACKING_ENDPOINT/exec') {
            fetch(CONFIG.endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(payload),
                keepalive: true
            }).catch(function(err) {
                log('Error sending data:', err);
            });
        }
        
        log('Data sent:', payload);
    }

    function sendDataSync() {
        if (tracker.events.length === 0) return;
        
        const payload = {
            sessionId: tracker.sessionId,
            timestamp: Date.now(),
            url: window.location.href,
            deviceInfo: tracker.deviceInfo,
            interactions: {
                scrollDepth: tracker.interactions.scrollDepth,
                clicks: tracker.interactions.clicks,
                formFocused: tracker.interactions.formFocused,
                formStarted: tracker.interactions.formStarted,
                formCompleted: tracker.interactions.formCompleted,
                fieldsInteracted: Array.from(tracker.interactions.fieldsInteracted),
                errorsSeen: tracker.interactions.errorsSeen,
                timeOnPage: Date.now() - tracker.startTime,
                mouseMoves: tracker.interactions.mouseMoves,
                idleTime: tracker.interactions.idleTime
            },
            events: tracker.events
        };
        
        if (CONFIG.endpoint && CONFIG.endpoint !== 'https://script.google.com/macros/s/YOUR_TRACKING_ENDPOINT/exec') {
            try {
                const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' });
                navigator.sendBeacon(CONFIG.endpoint, blob);
            } catch (error) {
                log('Error with sendBeacon:', error);
            }
        }
        
        log('Data sent (sync):', payload);
    }

    function log() {
        if (CONFIG.debug) {
            console.log('[GossipYah Tracker]', ...arguments);
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    window.GossipYahTracker = {
        trackEvent: trackEvent,
        getSessionId: function() { return tracker.sessionId; },
        getEngagementScore: calculateEngagementScore,
        getData: function() { 
            return {
                sessionId: tracker.sessionId,
                interactions: tracker.interactions,
                deviceInfo: tracker.deviceInfo,
                events: tracker.events
            };
        }
    };

})();
