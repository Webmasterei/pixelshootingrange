/**
 * DataLayer Event Functions for GA4 E-Commerce Events
 * Based on: https://developers.google.com/analytics/devguides/collection/ga4/reference/events
 */

window.dataLayer = window.dataLayer || [];

const DataLayerEvents = {
    
    pushPageView() {
        const eventData = {
            event: 'page_view',
            page_title: document.title,
            page_location: window.location.href
        };
        
        window.dataLayer.push(eventData);
        this._logEvent('page_view', eventData);
        return 'page_view';
    },

    pushViewItemList() {
        const eventData = {
            event: 'view_item_list',
            item_list_id: 'western_collection',
            item_list_name: 'Western Collection',
            items: SAMPLE_ITEMS
        };
        
        window.dataLayer.push(eventData);
        this._logEvent('view_item_list', eventData);
        return 'view_item_list';
    },

    pushViewItem() {
        const item = SAMPLE_ITEMS[0];
        const value = (item.price - (item.discount || 0)) * (item.quantity || 1);
        
        const eventData = {
            event: 'view_item',
            currency: CURRENCY,
            value: parseFloat(value.toFixed(2)),
            items: [item]
        };
        
        window.dataLayer.push(eventData);
        this._logEvent('view_item', eventData);
        return 'view_item';
    },

    pushSelectItem() {
        const item = { ...SAMPLE_ITEMS[0], index: 0 };
        
        const eventData = {
            event: 'select_item',
            item_list_id: 'western_collection',
            item_list_name: 'Western Collection',
            items: [item]
        };
        
        window.dataLayer.push(eventData);
        this._logEvent('select_item', eventData);
        return 'select_item';
    },

    pushAddToCart() {
        const value = calculateTotalValue(SAMPLE_ITEMS);
        
        const eventData = {
            event: 'add_to_cart',
            currency: CURRENCY,
            value: parseFloat(value.toFixed(2)),
            items: SAMPLE_ITEMS
        };
        
        window.dataLayer.push(eventData);
        this._logEvent('add_to_cart', eventData);
        return 'add_to_cart';
    },

    pushRemoveFromCart() {
        const item = SAMPLE_ITEMS[0];
        const value = (item.price - (item.discount || 0)) * (item.quantity || 1);
        
        const eventData = {
            event: 'remove_from_cart',
            currency: CURRENCY,
            value: parseFloat(value.toFixed(2)),
            items: [item]
        };
        
        window.dataLayer.push(eventData);
        this._logEvent('remove_from_cart', eventData);
        return 'remove_from_cart';
    },

    pushBeginCheckout() {
        const value = calculateTotalValue(SAMPLE_ITEMS);
        
        const eventData = {
            event: 'begin_checkout',
            currency: CURRENCY,
            value: parseFloat(value.toFixed(2)),
            coupon: 'WESTERN10',
            items: SAMPLE_ITEMS
        };
        
        window.dataLayer.push(eventData);
        this._logEvent('begin_checkout', eventData);
        return 'begin_checkout';
    },

    pushAddShippingInfo() {
        const value = calculateTotalValue(SAMPLE_ITEMS);
        
        const eventData = {
            event: 'add_shipping_info',
            currency: CURRENCY,
            value: parseFloat(value.toFixed(2)),
            coupon: 'WESTERN10',
            shipping_tier: 'Ground',
            items: SAMPLE_ITEMS
        };
        
        window.dataLayer.push(eventData);
        this._logEvent('add_shipping_info', eventData);
        return 'add_shipping_info';
    },

    pushAddPaymentInfo() {
        const value = calculateTotalValue(SAMPLE_ITEMS);
        
        const eventData = {
            event: 'add_payment_info',
            currency: CURRENCY,
            value: parseFloat(value.toFixed(2)),
            coupon: 'WESTERN10',
            payment_type: 'Credit Card',
            items: SAMPLE_ITEMS
        };
        
        window.dataLayer.push(eventData);
        this._logEvent('add_payment_info', eventData);
        return 'add_payment_info';
    },

    pushPurchase() {
        const value = calculateTotalValue(SAMPLE_ITEMS);
        const tax = parseFloat((value * 0.19).toFixed(2));
        const shipping = 5.99;
        
        const eventData = {
            event: 'purchase',
            transaction_id: generateTransactionId(),
            currency: CURRENCY,
            value: parseFloat((value + tax + shipping).toFixed(2)),
            tax: tax,
            shipping: shipping,
            coupon: 'WESTERN10',
            items: SAMPLE_ITEMS
        };
        
        window.dataLayer.push(eventData);
        this._logEvent('purchase', eventData);
        return 'purchase';
    },

    _logEvent(eventName, data) {
        console.log(`%c[dataLayer Push] ${eventName}`, 'color: #4caf50; font-weight: bold;');
        console.log(data);
    },

    triggerEvent(eventName) {
        const eventMap = {
            'page_view': () => this.pushPageView(),
            'view_item_list': () => this.pushViewItemList(),
            'view_item': () => this.pushViewItem(),
            'select_item': () => this.pushSelectItem(),
            'add_to_cart': () => this.pushAddToCart(),
            'remove_from_cart': () => this.pushRemoveFromCart(),
            'begin_checkout': () => this.pushBeginCheckout(),
            'add_shipping_info': () => this.pushAddShippingInfo(),
            'add_payment_info': () => this.pushAddPaymentInfo(),
            'purchase': () => this.pushPurchase()
        };

        const trigger = eventMap[eventName];
        if (trigger) {
            return trigger();
        }
        
        console.warn(`Unknown event: ${eventName}`);
        return null;
    }
};
