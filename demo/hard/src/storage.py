class WindowStore:
    def __init__(self):
        self._counts: dict[tuple[str, int], int] = {}

    def incr(self, key: str, window_id: int) -> int:
        k = (key, window_id)
        self._counts[k] = self._counts.get(k, 0) + 1
        return self._counts[k]