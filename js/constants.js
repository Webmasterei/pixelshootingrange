/**
 * Constants for Pixel Shooting Range
 * Sample items and configuration for GA4 E-Commerce events
 */

const CURRENCY = 'EUR';

const PAGE_RELOAD_EVENTS = [
    'page_view',
    'view_item_list',
    'view_item',
    'begin_checkout',
    'purchase'
];

const STORAGE_KEYS = {
    PENDING_EVENT: 'psr_pending_event',
    FAKE_REFERRER: 'psr_fake_referrer',
    SPA_MODE: 'psr_spa_mode',
    SOUND_MUTED: 'psr_sound_muted',
    GTM_SNIPPET: 'psr_gtm_snippet',
    CMP_SNIPPET: 'psr_cmp_snippet'
};

const FAKE_PAYMENT_PROVIDER_URL = 'https://checkout.stripe.com/pay/cs_test_' + 
    Math.random().toString(36).substring(2, 10);

const SAMPLE_ITEMS = [
    {
        item_id: 'COWBOY_HAT_001',
        item_name: 'Cowboy Hat',
        affiliation: 'Pixel Shooting Range Store',
        coupon: 'WESTERN10',
        discount: 5.00,
        index: 0,
        item_brand: 'Wild West',
        item_category: 'Accessories',
        item_category2: 'Headwear',
        item_category3: 'Hats',
        item_list_id: 'western_collection',
        item_list_name: 'Western Collection',
        item_variant: 'Brown',
        price: 49.99,
        quantity: 1
    },
    {
        item_id: 'SHERIFF_BADGE_002',
        item_name: 'Sheriff Badge',
        affiliation: 'Pixel Shooting Range Store',
        coupon: 'WESTERN10',
        discount: 2.00,
        index: 1,
        item_brand: 'Wild West',
        item_category: 'Accessories',
        item_category2: 'Badges',
        item_category3: 'Collectibles',
        item_list_id: 'western_collection',
        item_list_name: 'Western Collection',
        item_variant: 'Gold',
        price: 19.99,
        quantity: 2
    }
];

const SIGN_CONFIG = [
    {
        id: 'sign-page-view',
        eventName: 'page_view',
        label: 'page_view'
    },
    {
        id: 'sign-view-item-list',
        eventName: 'view_item_list',
        label: 'view_item_list'
    },
    {
        id: 'sign-view-item',
        eventName: 'view_item',
        label: 'view_item'
    },
    {
        id: 'sign-select-item',
        eventName: 'select_item',
        label: 'select_item'
    },
    {
        id: 'sign-add-to-cart',
        eventName: 'add_to_cart',
        label: 'add_to_cart'
    },
    {
        id: 'sign-remove-from-cart',
        eventName: 'remove_from_cart',
        label: 'remove_from_cart'
    },
    {
        id: 'sign-begin-checkout',
        eventName: 'begin_checkout',
        label: 'begin_checkout'
    },
    {
        id: 'sign-add-shipping-info',
        eventName: 'add_shipping_info',
        label: 'add_shipping_info'
    },
    {
        id: 'sign-add-payment-info',
        eventName: 'add_payment_info',
        label: 'add_payment_info'
    },
    {
        id: 'sign-purchase',
        eventName: 'purchase',
        label: 'purchase'
    }
];

function calculateTotalValue(items) {
    return items.reduce((total, item) => {
        const itemTotal = (item.price - (item.discount || 0)) * (item.quantity || 1);
        return total + itemTotal;
    }, 0);
}

function generateTransactionId() {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8).toUpperCase();
    return `TXN_${timestamp}_${random}`;
}
