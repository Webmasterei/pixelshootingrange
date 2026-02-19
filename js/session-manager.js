/**
 * Session Manager for Pixel Shooting Range
 * Handles GA4 session reset by deleting tracking cookies and storage
 */

const SessionManager = {

    resetGA4Session() {
        this._deleteGACookies();
        this._clearGASessionStorage();
        this._clearGALocalStorage();
        console.log('%c[Session Manager] GA4 Session reset', 'color: #ff5722; font-weight: bold;');
        location.reload();
    },

    _deleteGACookies() {
        const cookies = document.cookie.split(';');
        const gaCookiePatterns = ['_ga', '_gid', '_gat', '_gac_', 'AMP_TOKEN'];
        const hostname = window.location.hostname;
        const domains = this._getDomainVariants(hostname);
        const paths = ['/', ''];

        cookies.forEach(cookie => {
            const cookieName = cookie.split('=')[0].trim();
            const isGACookie = gaCookiePatterns.some(pattern => 
                cookieName.startsWith(pattern)
            );

            if (isGACookie) {
                this._deleteCookieAllVariants(cookieName, domains, paths);
            }
        });
    },

    _getDomainVariants(hostname) {
        const variants = ['', hostname];
        const parts = hostname.split('.');
        
        if (parts.length >= 2) {
            variants.push('.' + hostname);
            variants.push('.' + parts.slice(-2).join('.'));
        }
        if (parts.length >= 3) {
            variants.push('.' + parts.slice(-3).join('.'));
        }
        
        return variants;
    },

    _deleteCookieAllVariants(name, domains, paths) {
        const expires = 'expires=Thu, 01 Jan 1970 00:00:00 GMT';
        
        domains.forEach(domain => {
            paths.forEach(path => {
                const domainPart = domain ? `; domain=${domain}` : '';
                const pathPart = path ? `; path=${path}` : '; path=/';
                document.cookie = `${name}=${domainPart}${pathPart}; ${expires}`;
            });
        });
    },

    _clearGASessionStorage() {
        const keysToRemove = [];
        
        for (let i = 0; i < sessionStorage.length; i++) {
            const key = sessionStorage.key(i);
            if (this._isGARelatedKey(key)) {
                keysToRemove.push(key);
            }
        }
        
        keysToRemove.forEach(key => sessionStorage.removeItem(key));
    },

    _clearGALocalStorage() {
        const keysToRemove = [];
        
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (this._isGARelatedKey(key)) {
                keysToRemove.push(key);
            }
        }
        
        keysToRemove.forEach(key => localStorage.removeItem(key));
    },

    _isGARelatedKey(key) {
        if (!key) return false;
        const gaPatterns = ['_ga', 'google', 'gtm', 'ga4'];
        return gaPatterns.some(pattern => 
            key.toLowerCase().includes(pattern.toLowerCase())
        );
    }
};
