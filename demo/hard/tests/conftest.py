import pytest

@pytest.fixture
def store():
    from src.storage import WindowStore
    return WindowStore()