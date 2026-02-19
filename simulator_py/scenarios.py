"""
Realistic E-Commerce Funnel Scenarios for GA4 Session Simulation.
Generates event sequences that mimic real user behavior.
"""

import random
from enum import Enum
from typing import List


class ScenarioType(Enum):
    BOUNCE = 'bounce'
    BROWSE = 'browse'
    CART_ABANDON = 'cart_abandon'
    CHECKOUT_ABANDON = 'checkout_abandon'
    PURCHASE = 'purchase'


AVAILABLE_EVENTS = [
    'page_view',
    'view_item_list',
    'view_item',
    'select_item',
    'add_to_cart',
    'remove_from_cart',
    'begin_checkout',
    'add_payment_info',
    'purchase'
]

EVENT_DELAY_MULTIPLIERS = {
    'page_view': 0.5,
    'view_item_list': 1.2,
    'view_item': 1.5,
    'select_item': 0.8,
    'add_to_cart': 0.6,
    'remove_from_cart': 0.5,
    'begin_checkout': 1.0,
    'add_payment_info': 2.0,
    'purchase': 1.5
}


def select_scenario_type(funnel_config: dict) -> ScenarioType:
    """Select a scenario type based on configured funnel rates."""
    rand = random.random()
    cumulative = 0.0

    rates = [
        (ScenarioType.BOUNCE, funnel_config.get('bounce_rate', 0.30)),
        (ScenarioType.BROWSE, funnel_config.get('browse_rate', 0.30)),
        (ScenarioType.CART_ABANDON, funnel_config.get('cart_abandon_rate', 0.20)),
        (ScenarioType.CHECKOUT_ABANDON, funnel_config.get('checkout_abandon_rate', 0.12)),
        (ScenarioType.PURCHASE, funnel_config.get('purchase_rate', 0.08)),
    ]

    for scenario_type, rate in rates:
        cumulative += rate
        if rand < cumulative:
            return scenario_type

    return ScenarioType.BOUNCE


def generate_event_sequence(scenario_type: ScenarioType) -> List[str]:
    """Generate a realistic event sequence for a given scenario type."""
    generators = {
        ScenarioType.BOUNCE: _generate_bounce_sequence,
        ScenarioType.BROWSE: _generate_browse_sequence,
        ScenarioType.CART_ABANDON: _generate_cart_abandon_sequence,
        ScenarioType.CHECKOUT_ABANDON: _generate_checkout_abandon_sequence,
        ScenarioType.PURCHASE: _generate_purchase_sequence,
    }
    generator = generators.get(scenario_type, _generate_bounce_sequence)
    return generator()


def _generate_bounce_sequence() -> List[str]:
    return ['page_view']


def _generate_browse_sequence() -> List[str]:
    events = ['page_view', 'view_item_list']
    browse_loops = random.randint(1, 5)

    for i in range(browse_loops):
        if random.random() < 0.7:
            events.append('view_item')
        if random.random() < 0.4:
            events.append('select_item')
        if random.random() < 0.3 and i < browse_loops - 1:
            events.append('view_item_list')

    return events


def _generate_cart_abandon_sequence() -> List[str]:
    events = _generate_browse_sequence()
    events.append('add_to_cart')

    if random.random() < 0.4:
        events.append('view_item_list')
        if random.random() < 0.6:
            events.append('view_item')
        if random.random() < 0.5:
            events.append('add_to_cart')

    if random.random() < 0.3:
        events.append('remove_from_cart')
        if random.random() < 0.4:
            events.append('add_to_cart')

    return events


def _generate_checkout_abandon_sequence() -> List[str]:
    events = _generate_cart_abandon_sequence()
    events.append('begin_checkout')

    if random.random() < 0.6:
        events.append('add_payment_info')

    return events


def _generate_purchase_sequence() -> List[str]:
    events = _generate_checkout_abandon_sequence()

    if 'add_payment_info' not in events:
        events.append('add_payment_info')

    events.append('purchase')
    return events


def get_event_delay(event_name: str, timing_config: dict) -> int:
    """Calculate a realistic delay for a specific event type."""
    min_delay = timing_config.get('min_event_delay_ms', 1500)
    max_delay = timing_config.get('max_event_delay_ms', 12000)

    base_delay = random.randint(min_delay, max_delay)
    multiplier = EVENT_DELAY_MULTIPLIERS.get(event_name, 1.0)

    return round(base_delay * multiplier)
