from src.rate_limiter import RateLimiter
from src.storage import WindowStore

def test_blocks_after_limit():
    rl = RateLimiter(max_requests=2, window_sec=60, store=WindowStore())
    assert rl.allow("u1") is True
    assert rl.allow("u1") is True
    assert rl.allow("u1") is False

def test_window_resets():
    rl = RateLimiter(max_requests=1, window_sec=1, store=WindowStore())
    assert rl.allow("u2") is True
    assert rl.allow("u2") is False