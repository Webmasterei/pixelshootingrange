"""
Session Runner - Executes a single simulated user session via Playwright.
"""

import asyncio
import random
import time
import logging
from typing import Optional, Callable, Any

from playwright.async_api import Browser, BrowserContext, Page

from .scenarios import select_scenario_type, generate_event_sequence, get_event_delay
from .traffic_sources import select_traffic_source, build_url_with_utm, get_referrer
from .user_pool import UserPool, User

logger = logging.getLogger(__name__)

VIEWPORTS = [
    {'width': 1920, 'height': 1080},
    {'width': 1366, 'height': 768},
    {'width': 1536, 'height': 864},
    {'width': 1440, 'height': 900},
    {'width': 1280, 'height': 720},
    {'width': 375, 'height': 667},
    {'width': 414, 'height': 896},
    {'width': 390, 'height': 844},
]

USER_AGENTS = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:122.0) Gecko/20100101 Firefox/122.0',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2.1 Safari/605.1.15',
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_2_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Mobile/15E148 Safari/604.1',
    'Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Mobile Safari/537.36',
]


def _generate_session_id() -> str:
    timestamp = hex(int(time.time()))[2:]
    rand = hex(random.randint(0, 0xFFFF))[2:].zfill(4)
    return f"sess_{timestamp}_{rand}"


async def run_session(
    browser: Browser,
    config: dict,
    user: User,
    user_pool: UserPool,
    on_event: Optional[Callable[[str, int, int], None]] = None
) -> dict:
    """
    Run a single simulated session.

    Args:
        browser: Playwright browser instance
        config: Session configuration dict
        user: User object for this session
        user_pool: UserPool for state persistence
        on_event: Optional callback(event_name, current, total)

    Returns:
        dict with success status, session_id, events count, duration
    """
    session_id = _generate_session_id()
    start_time = time.time()

    traffic_source = select_traffic_source(config.get('traffic_sources', []))
    scenario_type = select_scenario_type(config.get('funnel', {}))
    events = generate_event_sequence(scenario_type)

    logger.info(
        f"Session {session_id}: user={user.id}, scenario={scenario_type.value}, "
        f"events={len(events)}, traffic={traffic_source.get('name', 'unknown')}"
    )

    context: Optional[BrowserContext] = None
    page: Optional[Page] = None

    try:
        context = await _create_browser_context(browser, user, user_pool)
        page = await context.new_page()

        base_url = build_url_with_utm(config['target_url'], traffic_source)
        target_url = _build_url_with_snippets(base_url, config)
        referrer = get_referrer(traffic_source)

        await _navigate_to_page(
            page, target_url, referrer,
            config.get('timing', {}).get('page_load_wait_ms', 3000)
        )

        await _execute_event_sequence(
            page, events, config.get('timing', {}), on_event, session_id
        )

        storage_state = await context.storage_state()
        user_pool.save_user_state(user, storage_state)

        duration = int((time.time() - start_time) * 1000)
        logger.info(f"Session {session_id} complete: {len(events)} events in {duration}ms")

        return {
            'success': True,
            'session_id': session_id,
            'events': len(events),
            'duration': duration,
            'scenario': scenario_type.value
        }

    except Exception as e:
        duration = int((time.time() - start_time) * 1000)
        logger.error(f"Session {session_id} failed after {duration}ms: {e}")
        return {
            'success': False,
            'session_id': session_id,
            'error': str(e),
            'duration': duration
        }

    finally:
        if page:
            try:
                await page.close()
            except Exception:
                pass
        if context:
            try:
                await context.close()
            except Exception:
                pass


async def _create_browser_context(
    browser: Browser,
    user: User,
    user_pool: UserPool
) -> BrowserContext:
    """Create a browser context with random viewport and user agent."""
    viewport = random.choice(VIEWPORTS)
    user_agent = random.choice(USER_AGENTS)

    context_options = {
        'viewport': viewport,
        'user_agent': user_agent,
        'locale': 'de-DE',
        'timezone_id': 'Europe/Berlin'
    }

    if not user.is_new:
        storage_state = user_pool.load_storage_state(user.id)
        if storage_state:
            context_options['storage_state'] = storage_state

    return await browser.new_context(**context_options)


def _build_url_with_snippets(base_url: str, config: dict) -> str:
    """Add GTM/CMP snippets and debug flag as URL parameters."""
    from urllib.parse import urlencode, urlparse, urlunparse, parse_qs
    
    gtm_snippet = config.get('gtm_snippet', '')
    cmp_snippet = config.get('cmp_snippet', '')
    
    parsed = urlparse(base_url)
    params = parse_qs(parsed.query)
    
    if gtm_snippet:
        params['_gtm'] = [gtm_snippet]
    if cmp_snippet:
        params['_cmp'] = [cmp_snippet]
    
    params['gtm_debug'] = [str(int(time.time() * 1000))]
    
    flat_params = {k: v[0] if len(v) == 1 else v for k, v in params.items()}
    new_query = urlencode(flat_params, doseq=True)
    
    return urlunparse((
        parsed.scheme, parsed.netloc, parsed.path,
        parsed.params, new_query, parsed.fragment
    ))


async def _navigate_to_page(
    page: Page,
    url: str,
    referrer: str,
    wait_ms: int
) -> None:
    """Navigate to target URL with optional referrer."""
    goto_options = {'wait_until': 'networkidle'}

    if referrer:
        goto_options['referer'] = referrer

    await page.goto(url, **goto_options)
    await page.wait_for_timeout(wait_ms)


async def _execute_event_sequence(
    page: Page,
    events: list,
    timing_config: dict,
    on_event: Optional[Callable],
    session_id: str
) -> None:
    """Execute the event sequence by clicking sign buttons."""
    for i, event_name in enumerate(events):
        if i > 0:
            delay = get_event_delay(event_name, timing_config)
            await page.wait_for_timeout(delay)

        await _trigger_event(page, event_name)

        if on_event:
            on_event(event_name, i + 1, len(events))

        logger.debug(f"Session {session_id}: [{i+1}/{len(events)}] {event_name}")


async def _trigger_event(page: Page, event_name: str) -> None:
    """Click a sign button to trigger an event."""
    selector = f'.sign-btn[data-event="{event_name}"]'

    await page.wait_for_selector(selector, state='visible', timeout=5000)
    await page.click(selector)
    await page.wait_for_timeout(300)
