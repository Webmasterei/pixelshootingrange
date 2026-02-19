/**
 * Main Application for Pixel Shooting Range
 * Handles sign click events and toast notifications
 */

const App = {
    elements: {},

    init() {
        this.cacheElements();
        this.bindSignEvents();
        ConfigPanel.init();
        GunController.init();
        this.restoreSoundState();
        
        this.processPendingEvent();
        
        console.log('%c[Pixel Shooting Range] Ready!', 'color: #ff9800; font-weight: bold; font-size: 14px;');
        console.log('Click on signs to trigger GA4 E-Commerce events.');
        console.log('Open DevTools > Console to see dataLayer pushes.');
    },

    processPendingEvent() {
        if (sessionStorage.getItem(STORAGE_KEYS.ECOMMERCE_EARLY_FIRED)) {
            sessionStorage.removeItem(STORAGE_KEYS.ECOMMERCE_EARLY_FIRED);
            const pendingEvent = PageReloadHandler.checkPendingEvent();
            if (pendingEvent) {
                this.showToast(`dataLayer push: ${pendingEvent} (vor Einwilligung)`);
                console.log('%c[Page Reload] Event fired early (before consent)', 'color: #ff9800;');
            }
            return;
        }

        const pendingEvent = PageReloadHandler.checkPendingEvent();
        
        if (pendingEvent) {
            setTimeout(() => {
                const triggeredEvent = DataLayerEvents.triggerEvent(pendingEvent);
                if (triggeredEvent) {
                    this.showToast(`dataLayer push: ${triggeredEvent}`);
                    console.log('%c[Page Reload] Event fired after reload', 'color: #2196f3;');
                }
            }, 100);
        }
    },

    cacheElements() {
        this.elements = {
            signs: document.querySelectorAll('.sign-btn'),
            toastContainer: document.getElementById('toastContainer'),
            soundBtn: document.getElementById('soundBtn'),
            sessionBtn: document.getElementById('sessionBtn')
        };
    },

    bindSignEvents() {
        this.elements.signs.forEach(sign => {
            sign.addEventListener('click', (e) => this.handleSignClick(e));
        });
        
        this.elements.soundBtn.addEventListener('click', () => this.toggleSound());
        
        if (this.elements.sessionBtn) {
            this.elements.sessionBtn.addEventListener('click', () => this.resetSession());
        }
    },

    resetSession() {
        this.showToast('GA4 Session wird zurückgesetzt...');
        setTimeout(() => {
            SessionManager.resetGA4Session();
        }, 300);
    },

    restoreSoundState() {
        const isMuted = SoundManager._loadMutedState();
        this.elements.soundBtn.textContent = isMuted ? '🔇' : '🔊';
        this.elements.soundBtn.classList.toggle('muted', isMuted);
    },

    toggleSound() {
        const isMuted = SoundManager.toggle();
        this.elements.soundBtn.textContent = isMuted ? '🔇' : '🔊';
        this.elements.soundBtn.classList.toggle('muted', isMuted);
    },

    handleSignClick(e) {
        const sign = e.currentTarget;
        const eventName = sign.dataset.event;

        if (!eventName) {
            console.warn('No event name found on sign');
            return;
        }

        this.animateSign(sign);
        SoundManager.playGunshot();

        if (eventName === 'purchase_payment_provider') {
            this.showToast('Redirect zu Payment Provider...');
            setTimeout(() => {
                PageReloadHandler.schedulePaymentProviderRedirect();
            }, 300);
            return;
        }

        if (PageReloadHandler.shouldReload(eventName)) {
            this.showToast(`Page Reload: ${eventName}`);
            setTimeout(() => {
                this._storeEcommercePayloadIfNeeded(eventName);
                PageReloadHandler.scheduleEventAfterReload(eventName);
            }, 300);
            return;
        }
        
        const triggeredEvent = DataLayerEvents.triggerEvent(eventName);
        
        if (triggeredEvent) {
            this.showToast(`dataLayer push: ${triggeredEvent}`);
        }
    },

    animateSign(sign) {
        sign.classList.remove('clicked');
        void sign.offsetWidth;
        sign.classList.add('clicked');

        setTimeout(() => {
            sign.classList.remove('clicked');
        }, 300);
    },

    showToast(message) {
        const toast = document.createElement('div');
        toast.className = 'toast';
        toast.textContent = message;
        
        this.elements.toastContainer.appendChild(toast);

        setTimeout(() => {
            toast.remove();
        }, 2000);
    },

    _storeEcommercePayloadIfNeeded(eventName) {
        const isBeforeConsent = sessionStorage.getItem(STORAGE_KEYS.ECOMMERCE_BEFORE_CONSENT) !== 'false';
        if (!isBeforeConsent) return;

        const payload = DataLayerEvents.buildEventData(eventName);
        if (payload) {
            sessionStorage.setItem(STORAGE_KEYS.ECOMMERCE_PAYLOAD, JSON.stringify(payload));
        }
    }
};

document.addEventListener('DOMContentLoaded', () => {
    App.init();
});
