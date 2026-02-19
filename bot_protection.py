"""
Bot Protection Layer for Simulator API.
Implements Rate Limiting, Proof of Work, CSRF tokens, and session validation.
"""

import hashlib
import secrets
import time
from functools import wraps
from typing import Optional, Tuple

from flask import request, session, jsonify, g
import logging

logger = logging.getLogger(__name__)


POW_DIFFICULTY = 4
POW_CHALLENGE_EXPIRY_SECONDS = 300
SESSION_MIN_AGE_SECONDS = 10

RATE_LIMIT_HOURLY = 3
RATE_LIMIT_DAILY = 10


class RateLimiter:
    """Simple in-memory rate limiter per IP address."""

    def __init__(self):
        self._hourly: dict = {}
        self._daily: dict = {}
        self._last_cleanup = time.time()

    def _cleanup(self) -> None:
        """Remove expired entries periodically."""
        now = time.time()
        if now - self._last_cleanup < 60:
            return

        hour_ago = now - 3600
        day_ago = now - 86400

        self._hourly = {
            ip: [t for t in times if t > hour_ago]
            for ip, times in self._hourly.items()
            if any(t > hour_ago for t in times)
        }

        self._daily = {
            ip: [t for t in times if t > day_ago]
            for ip, times in self._daily.items()
            if any(t > day_ago for t in times)
        }

        self._last_cleanup = now

    def check_and_record(self, ip: str) -> Tuple[bool, Optional[str]]:
        """
        Check if request is allowed and record it.

        Returns:
            (allowed, error_message) - allowed is True if within limits
        """
        self._cleanup()
        now = time.time()
        hour_ago = now - 3600
        day_ago = now - 86400

        hourly_requests = [
            t for t in self._hourly.get(ip, []) if t > hour_ago
        ]
        if len(hourly_requests) >= RATE_LIMIT_HOURLY:
            return False, f'Rate limit exceeded: max {RATE_LIMIT_HOURLY} per hour'

        daily_requests = [
            t for t in self._daily.get(ip, []) if t > day_ago
        ]
        if len(daily_requests) >= RATE_LIMIT_DAILY:
            return False, f'Rate limit exceeded: max {RATE_LIMIT_DAILY} per day'

        if ip not in self._hourly:
            self._hourly[ip] = []
        self._hourly[ip].append(now)

        if ip not in self._daily:
            self._daily[ip] = []
        self._daily[ip].append(now)

        return True, None


rate_limiter = RateLimiter()


class ProofOfWork:
    """Proof of Work challenge generator and verifier."""

    @staticmethod
    def generate_challenge() -> dict:
        """Generate a new PoW challenge."""
        nonce = secrets.token_hex(16)
        created_at = time.time()

        return {
            'nonce': nonce,
            'difficulty': POW_DIFFICULTY,
            'created_at': created_at,
            'expires_at': created_at + POW_CHALLENGE_EXPIRY_SECONDS
        }

    @staticmethod
    def verify_solution(nonce: str, solution: str, difficulty: int) -> bool:
        """
        Verify a PoW solution.

        The solution is valid if SHA-256(nonce + solution) starts with
        `difficulty` zero characters (in hex).
        """
        if not nonce or not solution:
            return False

        hash_input = (nonce + solution).encode('utf-8')
        hash_result = hashlib.sha256(hash_input).hexdigest()

        required_prefix = '0' * difficulty
        return hash_result.startswith(required_prefix)

    @staticmethod
    def is_challenge_valid(challenge: dict) -> bool:
        """Check if challenge is still valid (not expired)."""
        if not challenge:
            return False
        expires_at = challenge.get('expires_at', 0)
        return time.time() < expires_at


proof_of_work = ProofOfWork()


class CSRFProtection:
    """CSRF token generation and validation."""

    @staticmethod
    def generate_token() -> str:
        """Generate a new CSRF token and store in session."""
        token = secrets.token_hex(32)
        session['_csrf_token'] = token
        session['_csrf_created'] = time.time()
        return token

    @staticmethod
    def validate_token(token: str) -> bool:
        """Validate CSRF token from request."""
        if not token:
            return False

        stored_token = session.get('_csrf_token')
        if not stored_token:
            return False

        if not secrets.compare_digest(token, stored_token):
            return False

        session.pop('_csrf_token', None)
        session.pop('_csrf_created', None)

        return True

    @staticmethod
    def get_token_from_request() -> Optional[str]:
        """Extract CSRF token from request headers or body."""
        token = request.headers.get('X-CSRF-Token')
        if token:
            return token

        json_data = request.get_json(silent=True)
        if json_data:
            return json_data.get('csrf_token')

        return None


csrf_protection = CSRFProtection()


def check_session_age() -> Tuple[bool, Optional[str]]:
    """Check if session is old enough (anti-burst protection)."""
    session_created = session.get('_session_created')

    if not session_created:
        session['_session_created'] = time.time()
        return False, 'Session too new, please wait a moment'

    age = time.time() - session_created
    if age < SESSION_MIN_AGE_SECONDS:
        remaining = int(SESSION_MIN_AGE_SECONDS - age)
        return False, f'Please wait {remaining} seconds before starting simulator'

    return True, None


def check_snippets_configured(json_data: dict = None) -> Tuple[bool, Optional[str]]:
    """Check if GTM snippet is configured in the request config."""
    if json_data is None:
        json_data = request.get_json(silent=True) or {}
    
    config = json_data.get('config', {})
    gtm_snippet = config.get('gtm_snippet', '')
    
    if not gtm_snippet:
        return False, 'GTM snippet must be configured before running simulator'
    return True, None


def check_no_running_job(job_store: dict) -> Tuple[bool, Optional[str]]:
    """Check if user already has a running job."""
    session_id = session.get('_simulator_job_id')
    if session_id and session_id in job_store:
        job = job_store[session_id]
        if job.get('status') == 'running':
            return False, 'A simulator job is already running'
    return True, None


def get_client_ip() -> str:
    """Get client IP address, handling proxies."""
    forwarded = request.headers.get('X-Forwarded-For')
    if forwarded:
        return forwarded.split(',')[0].strip()
    return request.remote_addr or '127.0.0.1'


def require_bot_protection(job_store: dict):
    """
    Decorator that enforces all bot protection checks.

    Usage:
        @require_bot_protection(job_store)
        def start_simulator():
            ...
    """
    def decorator(f):
        @wraps(f)
        def wrapped(*args, **kwargs):
            ip = get_client_ip()
            allowed, error = rate_limiter.check_and_record(ip)
            if not allowed:
                return jsonify({'error': error}), 429

            csrf_token = csrf_protection.get_token_from_request()
            if not csrf_protection.validate_token(csrf_token):
                return jsonify({'error': 'Invalid or missing CSRF token'}), 403

            json_data = request.get_json(silent=True) or {}
            challenge = session.get('_pow_challenge')

            if not proof_of_work.is_challenge_valid(challenge):
                return jsonify({'error': 'PoW challenge expired or missing'}), 400

            solution = json_data.get('pow_solution', '')
            if not proof_of_work.verify_solution(
                challenge.get('nonce', ''),
                solution,
                challenge.get('difficulty', POW_DIFFICULTY)
            ):
                return jsonify({'error': 'Invalid PoW solution'}), 400

            session.pop('_pow_challenge', None)

            valid, error = check_session_age()
            if not valid:
                return jsonify({'error': error}), 400

            valid, error = check_snippets_configured(json_data)
            if not valid:
                logger.warning(f"Snippets check failed: {error}, json_data keys: {list(json_data.keys())}, config: {json_data.get('config', 'MISSING')}")
                return jsonify({'error': error}), 400

            valid, error = check_no_running_job(job_store)
            if not valid:
                return jsonify({'error': error}), 409

            return f(*args, **kwargs)
        return wrapped
    return decorator
