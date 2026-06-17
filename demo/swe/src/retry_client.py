import time

class RetryClient:
    def __init__(self, max_retries: int = 3, base_delay: float = 0.01):
        self.max_retries = max_retries
        self.base_delay = base_delay
        self.calls = 0

    def execute(self, fn):
        """Call fn until success. Must stop after max_retries failures."""
        # ponytail: bug — range(max_retries) gives 3 tries not 4 when max_retries=3
        for attempt in range(self.max_retries):
            self.calls += 1
            try:
                return fn()
            except Exception:
                if attempt == self.max_retries - 1:
                    raise
                time.sleep(self.base_delay * (attempt + 1))