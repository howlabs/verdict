from src.retry_client import RetryClient

def test_succeeds_on_second_try():
    n = {'i': 0}
    def flaky():
        n['i'] += 1
        if n['i'] < 2:
            raise ValueError('fail')
        return 'ok'
    c = RetryClient(max_retries=3)
    assert c.execute(flaky) == 'ok'