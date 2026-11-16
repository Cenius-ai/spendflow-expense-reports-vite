"""A tiny in-process rate limiter for the login endpoint.

Single-instance deployments only (Spendflow ships as one process). Counters are
server-side and windowed, so a burst of credential attempts is throttled without
ever storing per-user state in the client.
"""

from __future__ import annotations

import time
from collections import deque


class SlidingWindowLimiter:
    def __init__(self, limit: int, window_seconds: int) -> None:
        self.limit = limit
        self.window_seconds = window_seconds
        self._hits: dict[str, deque[float]] = {}

    def allow(self, key: str) -> bool:
        now = time.monotonic()
        cutoff = now - self.window_seconds
        bucket = self._hits.setdefault(key, deque())
        while bucket and bucket[0] < cutoff:
            bucket.popleft()
        if len(bucket) >= self.limit:
            return False
        bucket.append(now)
        if len(self._hits) > 4096:  # bound memory on a long-running process
            self._prune(cutoff)
        return True

    def retry_after(self, key: str) -> int:
        bucket = self._hits.get(key)
        if not bucket:
            return 1
        return max(1, int(self.window_seconds - (time.monotonic() - bucket[0])))

    def _prune(self, cutoff: float) -> None:
        for key in [k for k, v in self._hits.items() if not v or v[-1] < cutoff]:
            self._hits.pop(key, None)


login_limiter = SlidingWindowLimiter(limit=60, window_seconds=60)
