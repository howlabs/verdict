from src.rate_limiter import RateLimiter
from src.storage import WindowStore

def test_two_keys_independent():
    rl = RateLimiter(max_requests=1, window_sec=60, store=WindowStore())
    assert rl.allow("a") is True
    assert rl.allow("b") is True
    assert rl.allow("a") is False