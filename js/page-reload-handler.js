/**
 * Page Reload Handler for Pixel Shooting Range
 * Handles page reload behavior for realistic event simulation
 */

const PageReloadHandler = {
    
    shouldReload(eventName) {
        if (this.isSPAMode()) {
            return false;
        }
        return PAGE_RELOAD_EVENTS.includes(eventName);
    },

    isSPAMode() {
        return sessionStorage.getItem(STORAGE_KEYS.SPA_MODE) === 'true';
    },

    scheduleEventAfterReload(eventName) {
        sessionStorage.setItem(STORAGE_KEYS.PENDING_EVENT, eventName);
        location.reload();
    },

    schedulePaymentProviderRedirect() {
        sessionStorage.setItem(STORAGE_KEYS.PENDING_EVENT, 'purchase');
        sessionStorage.setItem(STORAGE_KEYS.FAKE_REFERRER, FAKE_PAYMENT_PROVIDER_URL);
        window.location.href = 'payment-provider.html';
    },

    checkPendingEvent() {
        const pendingEvent = sessionStorage.getItem(STORAGE_KEYS.PENDING_EVENT);
        
        if (!pendingEvent) {
            return null;
        }

        sessionStorage.removeItem(STORAGE_KEYS.PENDING_EVENT);
        return pendingEvent;
    },

    hasPendingEvent() {
        return sessionStorage.getItem(STORAGE_KEYS.PENDING_EVENT) !== null;
    }
};
