/**
 * Config Panel for GTM/CMP Snippet Configuration
 * Snippets are stored server-side in session cookie and injected into HTML by server.
 * SPA mode and other UI states remain in sessionStorage.
 */

const ConfigPanel = {
    elements: {},
    snippetsCache: { gtm_snippet: '', cmp_snippet: '' },

    init() {
        this.cacheElements();
        this.bindEvents();
        this.updateStatusIndicator();
    },

    cacheElements() {
        this.elements = {
            configBtn: document.getElementById('configBtn'),
            configStatus: document.getElementById('configStatus'),
            modalOverlay: document.getElementById('modalOverlay'),
            gtmSnippet: document.getElementById('gtmSnippet'),
            cmpSnippet: document.getElementById('cmpSnippet'),
            spaToggle: document.getElementById('spaToggle'),
            consentTimingToggle: document.getElementById('consentTimingToggle'),
            btnApply: document.getElementById('btnApply'),
            btnClear: document.getElementById('btnClear'),
            btnClose: document.getElementById('btnClose')
        };
    },

    bindEvents() {
        this.elements.configBtn.addEventListener('click', () => this.openModal());
        this.elements.modalOverlay.addEventListener('click', (e) => {
            if (e.target === this.elements.modalOverlay) {
                this.closeModal();
            }
        });
        this.elements.btnApply.addEventListener('click', () => this.applySnippets());
        this.elements.btnClear.addEventListener('click', () => this.clearSnippets());
        this.elements.btnClose.addEventListener('click', () => this.closeModal());

        if (this.elements.spaToggle) {
            this.elements.spaToggle.addEventListener('change', () => this.toggleSPAMode());
        }

        if (this.elements.consentTimingToggle) {
            this.elements.consentTimingToggle.addEventListener('change', () => this.toggleConsentTiming());
        }

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.elements.modalOverlay.classList.contains('visible')) {
                this.closeModal();
            }
        });
    },

    async openModal() {
        try {
            const response = await fetch('/api/snippets');
            if (response.ok) {
                this.snippetsCache = await response.json();
            }
        } catch (err) {
            console.warn('[ConfigPanel] Could not fetch snippets:', err);
        }

        this.elements.gtmSnippet.value = this.snippetsCache.gtm_snippet || '';
        this.elements.cmpSnippet.value = this.snippetsCache.cmp_snippet || '';
        
        if (this.elements.spaToggle) {
            this.elements.spaToggle.checked = this.isSPAMode();
        }

        if (this.elements.consentTimingToggle) {
            this.elements.consentTimingToggle.checked = this.isEcommerceBeforeConsent();
        }
        
        this.elements.modalOverlay.classList.add('visible');
    },

    closeModal() {
        this.elements.modalOverlay.classList.remove('visible');
    },

    async applySnippets() {
        const gtmSnippet = this.elements.gtmSnippet.value.trim();
        const cmpSnippet = this.elements.cmpSnippet.value.trim();

        try {
            const response = await fetch('/api/snippets', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    gtm_snippet: gtmSnippet,
                    cmp_snippet: cmpSnippet
                })
            });

            if (!response.ok) {
                throw new Error('Server error');
            }

            window.location.reload();
        } catch (err) {
            console.error('[ConfigPanel] Failed to save snippets:', err);
            if (typeof App !== 'undefined' && App.showToast) {
                App.showToast('Fehler beim Speichern');
            }
        }
    },

    async clearSnippets() {
        try {
            const response = await fetch('/api/snippets', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    gtm_snippet: '',
                    cmp_snippet: ''
                })
            });

            if (!response.ok) {
                throw new Error('Server error');
            }

            window.location.reload();
        } catch (err) {
            console.error('[ConfigPanel] Failed to clear snippets:', err);
            if (typeof App !== 'undefined' && App.showToast) {
                App.showToast('Fehler beim Loeschen');
            }
        }
    },

    updateStatusIndicator() {
        const gtmScriptInPage = document.querySelector('script[src*="googletagmanager.com/gtm.js"]');
        const gtmInlineScript = document.documentElement.innerHTML.includes('gtm.start');
        const hasGTM = gtmScriptInPage || gtmInlineScript;
        
        if (hasGTM) {
            this.elements.configStatus.classList.add('active');
        } else {
            this.elements.configStatus.classList.remove('active');
        }
    },

    isGTMActive() {
        const gtmInPage = document.documentElement.innerHTML.includes('gtm.start');
        return gtmInPage;
    },

    isSPAMode() {
        return sessionStorage.getItem(STORAGE_KEYS.SPA_MODE) === 'true';
    },

    toggleSPAMode() {
        const isEnabled = this.elements.spaToggle.checked;
        
        if (isEnabled) {
            sessionStorage.setItem(STORAGE_KEYS.SPA_MODE, 'true');
        } else {
            sessionStorage.removeItem(STORAGE_KEYS.SPA_MODE);
        }

        if (typeof App !== 'undefined' && App.showToast) {
            const status = isEnabled ? 'aktiviert' : 'deaktiviert';
            App.showToast(`SPA-Modus ${status}`);
        }
    },

    isEcommerceBeforeConsent() {
        return sessionStorage.getItem(STORAGE_KEYS.ECOMMERCE_BEFORE_CONSENT) !== 'false';
    },

    toggleConsentTiming() {
        const isEnabled = this.elements.consentTimingToggle.checked;
        
        if (isEnabled) {
            sessionStorage.removeItem(STORAGE_KEYS.ECOMMERCE_BEFORE_CONSENT);
        } else {
            sessionStorage.setItem(STORAGE_KEYS.ECOMMERCE_BEFORE_CONSENT, 'false');
        }

        if (typeof App !== 'undefined' && App.showToast) {
            const mode = isEnabled ? 'vor' : 'nach';
            App.showToast(`E-Commerce Events ${mode} Einwilligung`);
        }
    }
};
