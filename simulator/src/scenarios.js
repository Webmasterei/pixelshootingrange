/**
 * Realistic E-Commerce Funnel Scenarios for GA4 Session Simulation
 * Generates event sequences that mimic real user behavior
 */

const SCENARIO_TYPES = {
    BOUNCE: 'bounce',
    BROWSE: 'browse',
    CART_ABANDON: 'cart_abandon',
    CHECKOUT_ABANDON: 'checkout_abandon',
    PURCHASE: 'purchase'
};

const AVAILABLE_EVENTS = [
    'page_view',
    'view_item_list',
    'view_item',
    'select_item',
    'add_to_cart',
    'remove_from_cart',
    'begin_checkout',
    'add_payment_info',
    'purchase'
];

/**
 * Select a scenario type based on configured funnel rates
 */
export function selectScenarioType(funnelConfig) {
    const random = Math.random();
    let cumulative = 0;

    const rates = [
        { type: SCENARIO_TYPES.BOUNCE, rate: funnelConfig.bounceRate },
        { type: SCENARIO_TYPES.BROWSE, rate: funnelConfig.browseRate },
        { type: SCENARIO_TYPES.CART_ABANDON, rate: funnelConfig.cartAbandonRate },
        { type: SCENARIO_TYPES.CHECKOUT_ABANDON, rate: funnelConfig.checkoutAbandonRate },
        { type: SCENARIO_TYPES.PURCHASE, rate: funnelConfig.purchaseRate }
    ];

    for (const { type, rate } of rates) {
        cumulative += rate;
        if (random < cumulative) {
            return type;
        }
    }

    return SCENARIO_TYPES.BOUNCE;
}

/**
 * Generate a realistic event sequence for a given scenario type
 */
export function generateEventSequence(scenarioType) {
    switch (scenarioType) {
        case SCENARIO_TYPES.BOUNCE:
            return generateBounceSequence();
        case SCENARIO_TYPES.BROWSE:
            return generateBrowseSequence();
        case SCENARIO_TYPES.CART_ABANDON:
            return generateCartAbandonSequence();
        case SCENARIO_TYPES.CHECKOUT_ABANDON:
            return generateCheckoutAbandonSequence();
        case SCENARIO_TYPES.PURCHASE:
            return generatePurchaseSequence();
        default:
            return generateBounceSequence();
    }
}

function generateBounceSequence() {
    return ['page_view'];
}

function generateBrowseSequence() {
    const events = ['page_view', 'view_item_list'];
    const browseLoops = randomInt(1, 5);

    for (let i = 0; i < browseLoops; i++) {
        if (Math.random() < 0.7) {
            events.push('view_item');
        }
        if (Math.random() < 0.4) {
            events.push('select_item');
        }
        if (Math.random() < 0.3 && i < browseLoops - 1) {
            events.push('view_item_list');
        }
    }

    return events;
}

function generateCartAbandonSequence() {
    const events = generateBrowseSequence();
    
    events.push('add_to_cart');
    
    if (Math.random() < 0.4) {
        events.push('view_item_list');
        if (Math.random() < 0.6) {
            events.push('view_item');
        }
        if (Math.random() < 0.5) {
            events.push('add_to_cart');
        }
    }

    if (Math.random() < 0.3) {
        events.push('remove_from_cart');
        if (Math.random() < 0.4) {
            events.push('add_to_cart');
        }
    }

    return events;
}

function generateCheckoutAbandonSequence() {
    const events = generateCartAbandonSequence();
    
    events.push('begin_checkout');

    if (Math.random() < 0.6) {
        events.push('add_payment_info');
    }

    return events;
}

function generatePurchaseSequence() {
    const events = generateCheckoutAbandonSequence();

    if (!events.includes('add_payment_info')) {
        events.push('add_payment_info');
    }

    events.push('purchase');

    return events;
}

function randomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Calculate a realistic delay for a specific event type
 */
export function getEventDelay(eventName, timingConfig) {
    const { minEventDelayMs, maxEventDelayMs } = timingConfig;
    const baseDelay = randomInt(minEventDelayMs, maxEventDelayMs);

    const multipliers = {
        'page_view': 0.5,
        'view_item_list': 1.2,
        'view_item': 1.5,
        'select_item': 0.8,
        'add_to_cart': 0.6,
        'remove_from_cart': 0.5,
        'begin_checkout': 1.0,
        'add_payment_info': 2.0,
        'purchase': 1.5
    };

    const multiplier = multipliers[eventName] || 1.0;
    return Math.round(baseDelay * multiplier);
}

export { SCENARIO_TYPES, AVAILABLE_EVENTS };
