import time
from .storage import WindowStore

class RateLimiter:
    def __init__(self, max_requests: int, window_sec: int, store: WindowStore):
        self.max_requests = max_requests
        self.window_sec = window_sec
        self.store = store

    def allow(self, key: str) -> bool:
        now = time.time()
        window_id = int(now)  # ponytail: bug — should be int(now // window_sec)
        count = self.store.incr(key, window_id)
        return count <= self.max_requests