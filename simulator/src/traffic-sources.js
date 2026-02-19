/**
 * Traffic Source Generator for GA4 Session Simulation
 * Generates UTM parameters and referrer URLs
 */

/**
 * Select a traffic source based on configured weights
 */
export function selectTrafficSource(trafficSources) {
    const random = Math.random();
    let cumulative = 0;

    for (const source of trafficSources) {
        cumulative += source.weight;
        if (random < cumulative) {
            return source;
        }
    }

    return trafficSources[0] || createDirectSource();
}

function createDirectSource() {
    return {
        name: 'direct',
        source: '(direct)',
        medium: '(none)',
        referrer: ''
    };
}

/**
 * Build URL with UTM parameters
 */
export function buildUrlWithUtm(baseUrl, trafficSource) {
    const url = new URL(baseUrl);

    if (trafficSource.source && trafficSource.source !== '(direct)') {
        url.searchParams.set('utm_source', trafficSource.source);
    }

    if (trafficSource.medium && trafficSource.medium !== '(none)') {
        url.searchParams.set('utm_medium', trafficSource.medium);
    }

    if (trafficSource.campaign) {
        url.searchParams.set('utm_campaign', trafficSource.campaign);
    }

    if (trafficSource.term) {
        url.searchParams.set('utm_term', trafficSource.term);
    }

    if (trafficSource.content) {
        url.searchParams.set('utm_content', trafficSource.content);
    }

    return url.toString();
}

/**
 * Get the referrer URL for a traffic source
 */
export function getReferrer(trafficSource) {
    return trafficSource.referrer || '';
}

/**
 * Format traffic source info for logging
 */
export function formatTrafficSourceLog(trafficSource) {
    const parts = [trafficSource.name || 'unknown'];
    
    if (trafficSource.source && trafficSource.source !== '(direct)') {
        parts.push(`${trafficSource.source}/${trafficSource.medium}`);
    }
    
    if (trafficSource.campaign) {
        parts.push(`campaign=${trafficSource.campaign}`);
    }

    return parts.join(' | ');
}
