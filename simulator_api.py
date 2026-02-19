"""
Simulator API - Flask Blueprint for controlling the traffic simulator.
Provides endpoints for challenge, start, status, and stop operations.
"""

import asyncio
import logging
import threading
import time
import uuid
from dataclasses import dataclass, field, asdict
from typing import Dict, Optional

from flask import Blueprint, request, session, jsonify

from bot_protection import (
    proof_of_work, csrf_protection, require_bot_protection, get_client_ip
)
from simulator_py.config import DEFAULT_CONFIG, MAX_SESSIONS_PER_JOB, DEFAULT_SESSIONS
from simulator_py.runner import run_batch, JobProgress

logger = logging.getLogger(__name__)

simulator_bp = Blueprint('simulator', __name__, url_prefix='/api/simulator')

JOB_EXPIRY_SECONDS = 3600


@dataclass
class SimulatorJob:
    """Represents a running or completed simulator job."""
    job_id: str
    status: str  # 'pending', 'running', 'completed', 'failed', 'stopped'
    total: int
    completed: int = 0
    successful: int = 0
    failed: int = 0
    started_at: float = field(default_factory=time.time)
    finished_at: Optional[float] = None
    error: Optional[str] = None
    stop_requested: bool = False


job_store: Dict[str, SimulatorJob] = {}
job_stop_events: Dict[str, asyncio.Event] = {}
_cleanup_lock = threading.Lock()


def _cleanup_old_jobs() -> None:
    """Remove jobs older than JOB_EXPIRY_SECONDS."""
    with _cleanup_lock:
        now = time.time()
        expired = [
            job_id for job_id, job in job_store.items()
            if now - job.started_at > JOB_EXPIRY_SECONDS
        ]
        for job_id in expired:
            del job_store[job_id]
            job_stop_events.pop(job_id, None)


def _job_to_dict(job: SimulatorJob) -> dict:
    """Convert job to API response dict."""
    return {
        'job_id': job.job_id,
        'status': job.status,
        'total': job.total,
        'completed': job.completed,
        'successful': job.successful,
        'failed': job.failed,
        'started_at': job.started_at,
        'finished_at': job.finished_at,
        'error': job.error,
    }


@simulator_bp.route('/challenge', methods=['GET'])
def get_challenge():
    """
    Get a Proof of Work challenge.
    Client must solve this before starting the simulator.
    """
    challenge = proof_of_work.generate_challenge()
    session['_pow_challenge'] = challenge

    csrf_token = csrf_protection.generate_token()

    return jsonify({
        'nonce': challenge['nonce'],
        'difficulty': challenge['difficulty'],
        'expires_in': int(challenge['expires_at'] - time.time()),
        'csrf_token': csrf_token
    })


@simulator_bp.route('/start', methods=['POST'])
@require_bot_protection(job_store)
def start_simulator():
    """
    Start a new simulator batch job.
    Requires valid PoW solution and CSRF token.
    Config is passed from client sessionStorage.
    """
    _cleanup_old_jobs()

    json_data = request.get_json(silent=True) or {}
    num_sessions = json_data.get('sessions', DEFAULT_SESSIONS)

    if not isinstance(num_sessions, int) or num_sessions < 1:
        num_sessions = DEFAULT_SESSIONS
    if num_sessions > MAX_SESSIONS_PER_JOB:
        num_sessions = MAX_SESSIONS_PER_JOB

    job_id = str(uuid.uuid4())

    job = SimulatorJob(
        job_id=job_id,
        status='pending',
        total=num_sessions
    )
    job_store[job_id] = job

    session['_simulator_job_id'] = job_id

    config = _build_config_from_request(json_data)

    stop_event = asyncio.Event()
    job_stop_events[job_id] = stop_event

    thread = threading.Thread(
        target=_run_simulator_thread,
        args=(job_id, config, num_sessions, stop_event),
        daemon=True
    )
    thread.start()

    logger.info(f"Simulator job {job_id} started: {num_sessions} sessions")

    return jsonify({
        'job_id': job_id,
        'status': 'pending',
        'total': num_sessions
    }), 202


@simulator_bp.route('/status/<job_id>', methods=['GET'])
def get_status(job_id: str):
    """Get the status of a simulator job."""
    _cleanup_old_jobs()

    job = job_store.get(job_id)
    if not job:
        return jsonify({'error': 'Job not found'}), 404

    return jsonify(_job_to_dict(job))


@simulator_bp.route('/stop/<job_id>', methods=['POST'])
def stop_simulator(job_id: str):
    """Request to stop a running simulator job."""
    job = job_store.get(job_id)
    if not job:
        return jsonify({'error': 'Job not found'}), 404

    if job.status not in ('pending', 'running'):
        return jsonify({'error': 'Job is not running'}), 400

    stored_job_id = session.get('_simulator_job_id')
    if stored_job_id != job_id:
        return jsonify({'error': 'Not authorized to stop this job'}), 403

    job.stop_requested = True

    stop_event = job_stop_events.get(job_id)
    if stop_event:
        stop_event.set()

    logger.info(f"Stop requested for job {job_id}")

    return jsonify({
        'job_id': job_id,
        'status': 'stopping',
        'message': 'Stop signal sent'
    })


def _build_config_from_request(json_data: dict) -> dict:
    """Build simulator config from client request data."""
    config = dict(DEFAULT_CONFIG)

    client_config = json_data.get('config', {})
    
    config['gtm_snippet'] = client_config.get('gtm_snippet', '')
    config['cmp_snippet'] = client_config.get('cmp_snippet', '')
    config['ecommerce_before_consent'] = client_config.get('ecommerce_before_consent', True)
    config['spa_mode'] = client_config.get('spa_mode', False)
    
    config['target_url'] = _get_target_url()

    return config


def _get_target_url() -> str:
    """Get target URL for simulator to use.
    
    In Docker, the simulator runs inside the container and must use
    the internal container address, not the external mapped port.
    """
    import os
    
    if os.environ.get('FLASK_ENV') == 'development':
        return 'http://127.0.0.1:3000'
    
    host = request.host
    scheme = 'https' if request.is_secure else 'http'
    
    if request.headers.get('X-Forwarded-Proto'):
        scheme = request.headers.get('X-Forwarded-Proto')
    
    return f"{scheme}://{host}"


def _run_simulator_thread(
    job_id: str,
    config: dict,
    num_sessions: int,
    stop_event: asyncio.Event
) -> None:
    """
    Run the simulator in a background thread.
    Updates job_store with progress.
    """
    job = job_store.get(job_id)
    if not job:
        return

    job.status = 'running'

    def on_progress(progress: JobProgress):
        job.completed = progress.completed
        job.successful = progress.successful
        job.failed = progress.failed

    try:
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)

        try:
            result = loop.run_until_complete(
                run_batch(config, num_sessions, on_progress, stop_event)
            )

            job.completed = result.total_sessions
            job.successful = result.successful
            job.failed = result.failed

            if job.stop_requested:
                job.status = 'stopped'
            else:
                job.status = 'completed'

        finally:
            loop.close()

    except Exception as e:
        logger.exception(f"Simulator job {job_id} failed: {e}")
        job.status = 'failed'
        job.error = str(e)

    finally:
        job.finished_at = time.time()
        job_stop_events.pop(job_id, None)

        logger.info(
            f"Job {job_id} finished: status={job.status}, "
            f"completed={job.completed}/{job.total}"
        )
