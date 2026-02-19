"""
Security configuration for Pixel Shooting Range.
Replaces the old Apache .htaccess with Flask-native security headers,
CSP via Talisman, caching, and robots directives.
"""

from flask_talisman import Talisman

CSP = {
    'default-src': "'self'",
    'script-src': [
        "'self'",
        "'unsafe-inline'",
        "https://www.googletagmanager.com",
        "https://www.google-analytics.com",
        "https://tagassistant.google.com",
    ],
    'style-src': ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
    'font-src': ["'self'", "https://fonts.gstatic.com"],
    'img-src': [
        "'self'", "data:",
        "https://www.googletagmanager.com",
        "https://www.google-analytics.com",
    ],
    'connect-src': [
        "'self'",
        "https://www.google-analytics.com",
        "https://www.googletagmanager.com",
        "https://tagassistant.google.com",
        "https://region1.google-analytics.com",
    ],
    'frame-src': ["https://www.googletagmanager.com"],
}

CACHE_SECONDS = {
    'text/css': 604800,
    'application/javascript': 604800,
    'image/png': 2592000,
    'image/jpeg': 2592000,
    'image/gif': 2592000,
    'image/svg+xml': 2592000,
    'image/webp': 2592000,
}

ROBOTS_TXT = "User-agent: *\nDisallow: /\n"


def init_security(app):
    """Attach Talisman, robots tag, and caching headers to the app."""
    Talisman(
        app,
        content_security_policy=CSP,
        force_https=False,
        strict_transport_security=False,
        session_cookie_secure=True,
    )

    @app.after_request
    def security_headers(response):
        response.headers['X-Robots-Tag'] = 'noindex, nofollow, noarchive, nosnippet'

        mime = (response.content_type or '').split(';')[0].strip()
        max_age = CACHE_SECONDS.get(mime)
        if max_age:
            response.headers['Cache-Control'] = f'public, max-age={max_age}'

        return response
