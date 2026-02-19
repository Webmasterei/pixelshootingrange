"""
Default configuration for the GA4 Session Simulator.
Values based on the original config.json from the Node.js simulator.
"""

DEFAULT_FUNNEL = {
    'bounce_rate': 0.30,
    'browse_rate': 0.30,
    'cart_abandon_rate': 0.20,
    'checkout_abandon_rate': 0.12,
    'purchase_rate': 0.08,
}

DEFAULT_TIMING = {
    'min_event_delay_ms': 1500,
    'max_event_delay_ms': 12000,
    'page_load_wait_ms': 3000,
}

DEFAULT_USERS = {
    'returning_user_rate': 0.35,
    'max_pool_size': 200,
}

DEFAULT_TRAFFIC_SOURCES = [
    {
        'name': 'organic_google',
        'weight': 0.40,
        'source': 'google',
        'medium': 'organic',
        'referrer': 'https://www.google.com/'
    },
    {
        'name': 'paid_search',
        'weight': 0.20,
        'source': 'google',
        'medium': 'cpc',
        'campaign': 'brand_2026'
    },
    {
        'name': 'social_instagram',
        'weight': 0.15,
        'source': 'instagram',
        'medium': 'social',
        'referrer': 'https://www.instagram.com/'
    },
    {
        'name': 'direct',
        'weight': 0.10,
        'source': '(direct)',
        'medium': '(none)',
        'referrer': ''
    },
    {
        'name': 'referral',
        'weight': 0.10,
        'source': 'partner-blog.de',
        'medium': 'referral',
        'referrer': 'https://partner-blog.de/artikel'
    },
    {
        'name': 'email',
        'weight': 0.05,
        'source': 'newsletter',
        'medium': 'email',
        'campaign': 'feb_2026'
    }
]

DEFAULT_CONFIG = {
    'target_url': 'https://pixelshootingrange.de',
    'gtm_snippet': '',
    'cmp_snippet': '',
    'max_concurrent': 3,
    'funnel': DEFAULT_FUNNEL,
    'timing': DEFAULT_TIMING,
    'users': DEFAULT_USERS,
    'traffic_sources': DEFAULT_TRAFFIC_SOURCES,
}

MAX_SESSIONS_PER_JOB = 50
DEFAULT_SESSIONS = 10
