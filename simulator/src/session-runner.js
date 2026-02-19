/**
 * Session Runner - Executes a single simulated user session via Playwright
 */

import { selectScenarioType, generateEventSequence, getEventDelay } from './scenarios.js';
import { selectTrafficSource, buildUrlWithUtm, getReferrer, formatTrafficSourceLog } from './traffic-sources.js';

const STORAGE_KEYS = {
    GTM: 'psr_gtm_snippet',
    CMP: 'psr_cmp_snippet'
};

/**
 * Run a single simulated session
 */
export async function runSession(browser, config, user, userPool, logger) {
    const sessionId = generateSessionId();
    const startTime = Date.now();

    const trafficSource = selectTrafficSource(config.trafficSources);
    const scenarioType = selectScenarioType(config.funnel);
    const events = generateEventSequence(scenarioType);

    logger.sessionStart(sessionId, user, scenarioType, trafficSource, events.length);

    let context = null;
    let page = null;

    try {
        context = await createBrowserContext(browser, user, userPool);
        page = await context.newPage();

        await injectGtmSnippet(page, config);

        const targetUrl = buildUrlWithUtm(config.targetUrl, trafficSource);
        const referrer = getReferrer(trafficSource);

        await navigateToPage(page, targetUrl, referrer, config.timing.pageLoadWaitMs);

        await executeEventSequence(page, events, config.timing, logger, sessionId);

        const storageState = await context.storageState();
        userPool.saveUserState(user, storageState);

        const duration = Date.now() - startTime;
        logger.sessionComplete(sessionId, events.length, duration);

        return { success: true, sessionId, events: events.length, duration };

    } catch (error) {
        const duration = Date.now() - startTime;
        logger.sessionError(sessionId, error, duration);
        return { success: false, sessionId, error: error.message, duration };

    } finally {
        if (page) await page.close().catch(() => {});
        if (context) await context.close().catch(() => {});
    }
}

async function createBrowserContext(browser, user, userPool) {
    const contextOptions = {
        viewport: getRandomViewport(),
        userAgent: getRandomUserAgent(),
        locale: 'de-DE',
        timezoneId: 'Europe/Berlin'
    };

    if (!user.isNew && user.storageStatePath) {
        const storageState = userPool.loadStorageState(user.storageStatePath);
        if (storageState) {
            contextOptions.storageState = storageState;
        }
    }

    return browser.newContext(contextOptions);
}

async function injectGtmSnippet(page, config) {
    if (!config.gtmSnippet) return;

    await page.addInitScript(({ gtmSnippet, cmpSnippet, keys }) => {
        if (gtmSnippet) {
            sessionStorage.setItem(keys.GTM, gtmSnippet);
        }
        if (cmpSnippet) {
            sessionStorage.setItem(keys.CMP, cmpSnippet);
        }
    }, {
        gtmSnippet: config.gtmSnippet,
        cmpSnippet: config.cmpSnippet || '',
        keys: STORAGE_KEYS
    });
}

async function navigateToPage(page, url, referrer, waitMs) {
    const gotoOptions = { waitUntil: 'networkidle' };
    
    if (referrer) {
        gotoOptions.referer = referrer;
    }

    await page.goto(url, gotoOptions);
    await page.waitForTimeout(waitMs);
}

async function executeEventSequence(page, events, timingConfig, logger, sessionId) {
    for (let i = 0; i < events.length; i++) {
        const eventName = events[i];
        
        if (i > 0) {
            const delay = getEventDelay(eventName, timingConfig);
            await page.waitForTimeout(delay);
        }

        await triggerEvent(page, eventName);
        logger.eventTriggered(sessionId, eventName, i + 1, events.length);
    }
}

async function triggerEvent(page, eventName) {
    const selector = `.sign-btn[data-event="${eventName}"]`;
    
    await page.waitForSelector(selector, { state: 'visible', timeout: 5000 });
    await page.click(selector);
    await page.waitForTimeout(300);
}

function getRandomViewport() {
    const viewports = [
        { width: 1920, height: 1080 },
        { width: 1366, height: 768 },
        { width: 1536, height: 864 },
        { width: 1440, height: 900 },
        { width: 1280, height: 720 },
        { width: 375, height: 667 },
        { width: 414, height: 896 },
        { width: 390, height: 844 }
    ];
    return viewports[Math.floor(Math.random() * viewports.length)];
}

function getRandomUserAgent() {
    const userAgents = [
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:122.0) Gecko/20100101 Firefox/122.0',
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2.1 Safari/605.1.15',
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_2_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Mobile/15E148 Safari/604.1',
        'Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Mobile Safari/537.36'
    ];
    return userAgents[Math.floor(Math.random() * userAgents.length)];
}

function generateSessionId() {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 6);
    return `sess_${timestamp}_${random}`;
}
