"""
Traffic Source Generator for GA4 Session Simulation.
Generates UTM parameters and referrer URLs.
"""

import random
from typing import List, Optional
from urllib.parse import urlencode, urlparse, urlunparse, parse_qs


def select_traffic_source(traffic_sources: List[dict]) -> dict:
    """Select a traffic source based on configured weights."""
    if not traffic_sources:
        return _create_direct_source()

    rand = random.random()
    cumulative = 0.0

    for source in traffic_sources:
        cumulative += source.get('weight', 0)
        if rand < cumulative:
            return source

    return traffic_sources[0] if traffic_sources else _create_direct_source()


def _create_direct_source() -> dict:
    return {
        'name': 'direct',
        'source': '(direct)',
        'medium': '(none)',
        'referrer': ''
    }


def build_url_with_utm(base_url: str, traffic_source: dict) -> str:
    """Build URL with UTM parameters."""
    parsed = urlparse(base_url)
    existing_params = parse_qs(parsed.query)

    utm_params = {}

    source = traffic_source.get('source', '')
    if source and source != '(direct)':
        utm_params['utm_source'] = source

    medium = traffic_source.get('medium', '')
    if medium and medium != '(none)':
        utm_params['utm_medium'] = medium

    campaign = traffic_source.get('campaign')
    if campaign:
        utm_params['utm_campaign'] = campaign

    term = traffic_source.get('term')
    if term:
        utm_params['utm_term'] = term

    content = traffic_source.get('content')
    if content:
        utm_params['utm_content'] = content

    all_params = {**existing_params, **utm_params}
    query_string = urlencode(all_params, doseq=True)

    return urlunparse((
        parsed.scheme,
        parsed.netloc,
        parsed.path,
        parsed.params,
        query_string,
        parsed.fragment
    ))


def get_referrer(traffic_source: dict) -> str:
    """Get the referrer URL for a traffic source."""
    return traffic_source.get('referrer', '')


def format_traffic_source_log(traffic_source: dict) -> str:
    """Format traffic source info for logging."""
    parts = [traffic_source.get('name', 'unknown')]

    source = traffic_source.get('source', '')
    if source and source != '(direct)':
        medium = traffic_source.get('medium', '')
        parts.append(f"{source}/{medium}")

    campaign = traffic_source.get('campaign')
    if campaign:
        parts.append(f"campaign={campaign}")

    return ' | '.join(parts)
