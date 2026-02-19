"""
Virtual User Pool Management.
Handles new vs returning users with in-memory storage state.
State is ephemeral - only persists during simulator job execution.
"""

import random
import time
from dataclasses import dataclass
from datetime import datetime
from typing import Optional, Dict, Any


@dataclass
class User:
    id: str
    created_at: str
    session_count: int = 0
    last_visit: Optional[str] = None
    is_new: bool = True


class UserPool:
    """
    In-memory User Pool Manager for simulating new and returning users.
    
    State is ephemeral - cleared when job completes.
    No file I/O, no persistence between jobs.
    """

    def __init__(self, config: dict):
        self.returning_user_rate = config.get('returning_user_rate', 0.35)
        self.max_pool_size = config.get('max_pool_size', 50)
        
        self._users: Dict[str, dict] = {}
        self._storage_states: Dict[str, dict] = {}

    def get_user(self) -> User:
        """Get a user for the next session (new or returning)."""
        should_return = random.random() < self.returning_user_rate
        has_existing_users = len(self._users) > 0

        if should_return and has_existing_users:
            return self._get_returning_user()

        return self._create_new_user()

    def _create_new_user(self) -> User:
        user_id = self._generate_user_id()
        return User(
            id=user_id,
            created_at=datetime.utcnow().isoformat(),
            session_count=0,
            last_visit=None,
            is_new=True
        )

    def _get_returning_user(self) -> User:
        """Select a returning user with weighted probability."""
        if not self._users:
            return self._create_new_user()
        
        weighted_users = [
            (user_id, user_data, self._calculate_return_weight(user_data))
            for user_id, user_data in self._users.items()
        ]

        total_weight = sum(weight for _, _, weight in weighted_users)
        rand = random.random() * total_weight

        for user_id, user_data, weight in weighted_users:
            rand -= weight
            if rand <= 0:
                return self._user_from_data(user_id, user_data)

        first_id = next(iter(self._users))
        return self._user_from_data(first_id, self._users[first_id])

    def _user_from_data(self, user_id: str, user_data: dict) -> User:
        return User(
            id=user_id,
            created_at=user_data['created_at'],
            session_count=user_data.get('session_count', 0),
            last_visit=user_data.get('last_visit'),
            is_new=False
        )

    def _calculate_return_weight(self, user_data: dict) -> float:
        """Weight users by recency - recent visitors more likely to return."""
        last_visit = user_data.get('last_visit')
        if not last_visit:
            return 1.0

        try:
            last_visit_dt = datetime.fromisoformat(last_visit)
            seconds_since = (datetime.utcnow() - last_visit_dt).total_seconds()
        except (ValueError, TypeError):
            return 1.0

        if seconds_since < 60:
            return 0.5
        if seconds_since < 300:
            return 2.0
        return 1.5

    def save_user_state(self, user: User, storage_state: dict) -> None:
        """Save user state in memory after session completes."""
        self._users[user.id] = {
            'created_at': user.created_at,
            'session_count': (user.session_count or 0) + 1,
            'last_visit': datetime.utcnow().isoformat()
        }
        
        self._storage_states[user.id] = storage_state
        self._enforce_pool_limit()

    def _enforce_pool_limit(self) -> None:
        """Remove oldest users if pool exceeds limit."""
        if len(self._users) <= self.max_pool_size:
            return

        sorted_users = sorted(
            self._users.items(),
            key=lambda x: x[1].get('last_visit') or '1970-01-01'
        )

        while len(self._users) > self.max_pool_size:
            old_user_id, _ = sorted_users.pop(0)
            del self._users[old_user_id]
            self._storage_states.pop(old_user_id, None)

    def load_storage_state(self, user_id: str) -> Optional[dict]:
        """Load storage state from memory."""
        return self._storage_states.get(user_id)

    def _generate_user_id(self) -> str:
        timestamp = hex(int(time.time()))[2:]
        rand = hex(random.randint(0, 0xFFFFFF))[2:].zfill(6)
        return f"user_{timestamp}_{rand}"

    def clear(self) -> None:
        """Clear all user data - call after job completes."""
        self._users.clear()
        self._storage_states.clear()

    def get_stats(self) -> dict:
        """Get pool statistics."""
        return {
            'total_users': len(self._users),
            'max_pool_size': self.max_pool_size,
            'returning_user_rate': self.returning_user_rate
        }
