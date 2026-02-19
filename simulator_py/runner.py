"""
Batch Runner - Orchestrates multiple simulator sessions with concurrency control.
"""

import asyncio
import logging
import time
from dataclasses import dataclass, field
from typing import Optional, Callable, Dict, Any
from playwright.async_api import async_playwright, Browser

from .session_runner import run_session
from .user_pool import UserPool
from .config import DEFAULT_CONFIG

logger = logging.getLogger(__name__)


@dataclass
class JobProgress:
    """Tracks progress of a simulation job."""
    total: int
    completed: int = 0
    successful: int = 0
    failed: int = 0
    current_events: Dict[str, int] = field(default_factory=dict)


@dataclass
class JobResult:
    """Final result of a simulation job."""
    total_sessions: int
    successful: int
    failed: int
    duration_ms: int
    sessions: list


async def run_batch(
    config: dict,
    num_sessions: int,
    on_progress: Optional[Callable[[JobProgress], None]] = None,
    stop_event: Optional[asyncio.Event] = None
) -> JobResult:
    """
    Run a batch of simulator sessions.

    Args:
        config: Configuration dict with target_url, snippets, funnel, timing, etc.
        num_sessions: Number of sessions to run
        on_progress: Optional callback for progress updates
        stop_event: Optional event to signal stop

    Returns:
        JobResult with statistics
    """
    merged_config = {**DEFAULT_CONFIG, **config}
    max_concurrent = merged_config.get('max_concurrent', 3)

    progress = JobProgress(total=num_sessions)
    sessions_results = []
    start_time = time.time()

    user_pool = UserPool(merged_config.get('users', {}))

    logger.info(
        f"Starting batch: {num_sessions} sessions, "
        f"concurrency={max_concurrent}, target={merged_config.get('target_url')}"
    )

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)

        try:
            semaphore = asyncio.Semaphore(max_concurrent)
            tasks = []

            for i in range(num_sessions):
                if stop_event and stop_event.is_set():
                    logger.info("Stop signal received, aborting remaining sessions")
                    break

                task = asyncio.create_task(
                    _run_session_with_semaphore(
                        semaphore, browser, merged_config, user_pool,
                        progress, on_progress, stop_event
                    )
                )
                tasks.append(task)

            results = await asyncio.gather(*tasks, return_exceptions=True)

            for result in results:
                if isinstance(result, Exception):
                    sessions_results.append({
                        'success': False,
                        'error': str(result)
                    })
                elif result:
                    sessions_results.append(result)

        finally:
            await browser.close()

    duration_ms = int((time.time() - start_time) * 1000)

    logger.info(
        f"Batch complete: {progress.successful}/{progress.total} successful "
        f"in {duration_ms}ms"
    )

    return JobResult(
        total_sessions=progress.total,
        successful=progress.successful,
        failed=progress.failed,
        duration_ms=duration_ms,
        sessions=sessions_results
    )


async def _run_session_with_semaphore(
    semaphore: asyncio.Semaphore,
    browser: Browser,
    config: dict,
    user_pool: UserPool,
    progress: JobProgress,
    on_progress: Optional[Callable],
    stop_event: Optional[asyncio.Event]
) -> Optional[dict]:
    """Run a single session within semaphore limits."""
    if stop_event and stop_event.is_set():
        return None

    async with semaphore:
        if stop_event and stop_event.is_set():
            return None

        user = user_pool.get_user()

        def event_callback(event_name: str, current: int, total: int):
            progress.current_events[event_name] = (
                progress.current_events.get(event_name, 0) + 1
            )

        result = await run_session(
            browser, config, user, user_pool, on_event=event_callback
        )

        progress.completed += 1
        if result.get('success'):
            progress.successful += 1
        else:
            progress.failed += 1

        if on_progress:
            on_progress(progress)

        return result


def run_batch_sync(
    config: dict,
    num_sessions: int,
    on_progress: Optional[Callable[[JobProgress], None]] = None
) -> JobResult:
    """
    Synchronous wrapper for run_batch.
    Useful for running from non-async contexts like threading.Thread.
    """
    return asyncio.run(run_batch(config, num_sessions, on_progress))
