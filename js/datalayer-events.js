/**
 * DataLayer Event Functions for GA4 E-Commerce Events
 * Based on: https://developers.google.com/analytics/devguides/collection/ga4/reference/events
 */

window.dataLayer = window.dataLayer || [];

const DataLayerEvents = {

    buildEventData(eventName) {
        const builders = {
            'page_view': () => this._buildPageView(),
            'view_item_list': () => this._buildViewItemList(),
            'view_item': () => this._buildViewItem(),
            'select_item': () => this._buildSelectItem(),
            'add_to_cart': () => this._buildAddToCart(),
            'remove_from_cart': () => this._buildRemoveFromCart(),
            'begin_checkout': () => this._buildBeginCheckout(),
            'add_shipping_info': () => this._buildAddShippingInfo(),
            'add_payment_info': () => this._buildAddPaymentInfo(),
            'purchase': () => this._buildPurchase()
        };

        const builder = builders[eventName];
        if (builder) {
            return builder();
        }
        return null;
    },

    _buildPageView() {
        return {
            event: 'page_view',
            page_title: document.title,
            page_location: window.location.href
        };
    },

    _buildViewItemList() {
        return {
            event: 'view_item_list',
            item_list_id: 'western_collection',
            item_list_name: 'Western Collection',
            items: SAMPLE_ITEMS
        };
    },

    _buildViewItem() {
        const item = SAMPLE_ITEMS[0];
        const value = (item.price - (item.discount || 0)) * (item.quantity || 1);
        return {
            event: 'view_item',
            currency: CURRENCY,
            value: parseFloat(value.toFixed(2)),
            items: [item]
        };
    },

    _buildSelectItem() {
        const item = { ...SAMPLE_ITEMS[0], index: 0 };
        return {
            event: 'select_item',
            item_list_id: 'western_collection',
            item_list_name: 'Western Collection',
            items: [item]
        };
    },

    _buildAddToCart() {
        const value = calculateTotalValue(SAMPLE_ITEMS);
        return {
            event: 'add_to_cart',
            currency: CURRENCY,
            value: parseFloat(value.toFixed(2)),
            items: SAMPLE_ITEMS
        };
    },

    _buildRemoveFromCart() {
        const item = SAMPLE_ITEMS[0];
        const value = (item.price - (item.discount || 0)) * (item.quantity || 1);
        return {
            event: 'remove_from_cart',
            currency: CURRENCY,
            value: parseFloat(value.toFixed(2)),
            items: [item]
        };
    },

    _buildBeginCheckout() {
        const value = calculateTotalValue(SAMPLE_ITEMS);
        return {
            event: 'begin_checkout',
            currency: CURRENCY,
            value: parseFloat(value.toFixed(2)),
            coupon: 'WESTERN10',
            items: SAMPLE_ITEMS
        };
    },

    _buildAddShippingInfo() {
        const value = calculateTotalValue(SAMPLE_ITEMS);
        return {
            event: 'add_shipping_info',
            currency: CURRENCY,
            value: parseFloat(value.toFixed(2)),
            coupon: 'WESTERN10',
            shipping_tier: 'Ground',
            items: SAMPLE_ITEMS
        };
    },

    _buildAddPaymentInfo() {
        const value = calculateTotalValue(SAMPLE_ITEMS);
        return {
            event: 'add_payment_info',
            currency: CURRENCY,
            value: parseFloat(value.toFixed(2)),
            coupon: 'WESTERN10',
            payment_type: 'Credit Card',
            items: SAMPLE_ITEMS
        };
    },

    _buildPurchase() {
        const value = calculateTotalValue(SAMPLE_ITEMS);
        const tax = parseFloat((value * 0.19).toFixed(2));
        const shipping = 5.99;
        return {
            event: 'purchase',
            transaction_id: generateTransactionId(),
            currency: CURRENCY,
            value: parseFloat((value + tax + shipping).toFixed(2)),
            tax: tax,
            shipping: shipping,
            coupon: 'WESTERN10',
            items: SAMPLE_ITEMS
        };
    },

    pushPageView() {
        const eventData = this._buildPageView();
        window.dataLayer.push(eventData);
        this._logEvent('page_view', eventData);
        return 'page_view';
    },

    pushViewItemList() {
        const eventData = this._buildViewItemList();
        window.dataLayer.push(eventData);
        this._logEvent('view_item_list', eventData);
        return 'view_item_list';
    },

    pushViewItem() {
        const eventData = this._buildViewItem();
        window.dataLayer.push(eventData);
        this._logEvent('view_item', eventData);
        return 'view_item';
    },

    pushSelectItem() {
        const eventData = this._buildSelectItem();
        window.dataLayer.push(eventData);
        this._logEvent('select_item', eventData);
        return 'select_item';
    },

    pushAddToCart() {
        const eventData = this._buildAddToCart();
        window.dataLayer.push(eventData);
        this._logEvent('add_to_cart', eventData);
        return 'add_to_cart';
    },

    pushRemoveFromCart() {
        const eventData = this._buildRemoveFromCart();
        window.dataLayer.push(eventData);
        this._logEvent('remove_from_cart', eventData);
        return 'remove_from_cart';
    },

    pushBeginCheckout() {
        const eventData = this._buildBeginCheckout();
        window.dataLayer.push(eventData);
        this._logEvent('begin_checkout', eventData);
        return 'begin_checkout';
    },

    pushAddShippingInfo() {
        const eventData = this._buildAddShippingInfo();
        window.dataLayer.push(eventData);
        this._logEvent('add_shipping_info', eventData);
        return 'add_shipping_info';
    },

    pushAddPaymentInfo() {
        const eventData = this._buildAddPaymentInfo();
        window.dataLayer.push(eventData);
        this._logEvent('add_payment_info', eventData);
        return 'add_payment_info';
    },

    pushPurchase() {
        const eventData = this._buildPurchase();
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
