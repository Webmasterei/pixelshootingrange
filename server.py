"""
Pixel Shooting Range - Flask Server
Stateless server that injects GTM/CMP snippets into HTML based on session cookie.
"""

import os
import re
import logging
from flask import Flask, request, session, jsonify, send_from_directory
from security import init_security, ROBOTS_TXT
from simulator_api import simulator_bp

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)

app = Flask(__name__, static_folder=None)

app.config.update(
    SECRET_KEY=os.environ.get('SESSION_SECRET', 'dev-secret-change-in-production'),
    SESSION_COOKIE_HTTPONLY=True,
    SESSION_COOKIE_SAMESITE='Strict',
    SESSION_COOKIE_SECURE=os.environ.get('FLASK_ENV') == 'production',
)

if os.environ.get('FLASK_ENV') == 'production':
    from werkzeug.middleware.proxy_fix import ProxyFix
    app.wsgi_app = ProxyFix(app.wsgi_app, x_for=1, x_proto=1, x_host=1)

init_security(app)

app.register_blueprint(simulator_bp)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

HEAD_MARKER = '<!-- SNIPPET:HEAD -->'
BODY_MARKER = '<!-- SNIPPET:BODY -->'


def parse_gtm_snippet(snippet):
    """Extract script and noscript parts from GTM snippet."""
    if not snippet:
        return '', ''
    
    script_match = re.search(r'<script[^>]*>([\s\S]*?)</script>', snippet, re.IGNORECASE)
    noscript_match = re.search(r'<noscript[^>]*>([\s\S]*?)</noscript>', snippet, re.IGNORECASE)
    
    script_part = ''
    if script_match:
        script_content = script_match.group(1).strip()
        if script_content:
            script_part = f'<script>{script_content}</script>'
    
    noscript_part = ''
    if noscript_match:
        noscript_content = noscript_match.group(1).strip()
        if noscript_content:
            noscript_part = f'<noscript>{noscript_content}</noscript>'
    
    return script_part, noscript_part


def parse_cmp_snippet(snippet):
    """Extract script from CMP snippet (external src or inline)."""
    if not snippet:
        return ''
    
    src_match = re.search(r'<script[^>]*src=["\']([^"\']+)["\'][^>]*>', snippet, re.IGNORECASE)
    if src_match:
        src = src_match.group(1)
        is_async = 'async' in snippet.lower()
        async_attr = ' async' if is_async else ''
        return f'<script{async_attr} src="{src}"></script>'
    
    script_match = re.search(r'<script[^>]*>([\s\S]*?)</script>', snippet, re.IGNORECASE)
    if script_match:
        script_content = script_match.group(1).strip()
        if script_content:
            return f'<script>{script_content}</script>'
    
    return ''


def inject_snippets(html_content):
    """Inject session snippets into HTML at marker positions.
    
    Snippets come from session OR from query params (for simulator).
    Query params take precedence if present.
    """
    gtm_snippet = request.args.get('_gtm') or session.get('gtm_snippet', '')
    cmp_snippet = request.args.get('_cmp') or session.get('cmp_snippet', '')
    
    gtm_script, gtm_noscript = parse_gtm_snippet(gtm_snippet)
    cmp_script = parse_cmp_snippet(cmp_snippet)
    
    head_injection = ''
    if cmp_script:
        head_injection += cmp_script + '\n    '
    if gtm_script:
        head_injection += gtm_script
    
    body_injection = gtm_noscript
    
    html_content = html_content.replace(HEAD_MARKER, head_injection)
    html_content = html_content.replace(BODY_MARKER, body_injection)
    
    return html_content


@app.route('/')
def index():
    """Serve index.html with injected snippets."""
    html_path = os.path.join(BASE_DIR, 'index.html')
    with open(html_path, 'r', encoding='utf-8') as f:
        html_content = f.read()
    
    html_content = inject_snippets(html_content)
    return html_content, 200, {'Content-Type': 'text/html; charset=utf-8'}


@app.route('/index.html')
def index_html():
    """Alias for index route."""
    return index()


@app.route('/payment-provider.html')
def payment_provider():
    """Serve payment provider page without snippet injection."""
    return send_from_directory(BASE_DIR, 'payment-provider.html')


@app.route('/api/snippets', methods=['GET'])
def get_snippets():
    """Return current session snippets."""
    return jsonify({
        'gtm_snippet': session.get('gtm_snippet', ''),
        'cmp_snippet': session.get('cmp_snippet', '')
    })


@app.route('/api/snippets', methods=['POST'])
def save_snippets():
    """Save snippets to session."""
    data = request.get_json() or {}
    
    gtm = data.get('gtm_snippet', '').strip()
    cmp = data.get('cmp_snippet', '').strip()
    
    if gtm:
        session['gtm_snippet'] = gtm
    else:
        session.pop('gtm_snippet', None)
    
    if cmp:
        session['cmp_snippet'] = cmp
    else:
        session.pop('cmp_snippet', None)
    
    session.modified = True
    
    return jsonify({'status': 'ok'})


@app.route('/css/<path:filename>')
def serve_css(filename):
    """Serve CSS files."""
    return send_from_directory(os.path.join(BASE_DIR, 'css'), filename)


@app.route('/js/<path:filename>')
def serve_js(filename):
    """Serve JS files."""
    return send_from_directory(os.path.join(BASE_DIR, 'js'), filename)


@app.route('/images/<path:filename>')
def serve_images(filename):
    """Serve image files."""
    return send_from_directory(os.path.join(BASE_DIR, 'images'), filename)


@app.route('/robots.txt')
def robots():
    """Block all search engine crawlers."""
    return ROBOTS_TXT, 200, {'Content-Type': 'text/plain; charset=utf-8'}


@app.route('/health')
def health():
    """Health check endpoint for container orchestration."""
    return jsonify({'status': 'healthy'}), 200


@app.errorhandler(404)
def not_found(_error):
    return jsonify({'error': 'not found'}), 404


if __name__ == '__main__':
    port = int(os.environ.get('PORT', 3000))
    debug = os.environ.get('FLASK_ENV') != 'production'
    app.run(host='0.0.0.0', port=port, debug=debug)
