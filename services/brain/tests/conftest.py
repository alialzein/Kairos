import time
from collections.abc import Callable

import jwt
import pytest
from fastapi.testclient import TestClient

from brain.main import create_app
from brain.settings import Settings

TEST_SECRET = "test-secret-with-at-least-32-characters-long"
OWNER_ID = "11111111-1111-1111-1111-111111111111"
GUEST_ID = "22222222-2222-2222-2222-222222222222"


@pytest.fixture
def settings() -> Settings:
    return Settings(_env_file=None, supabase_jwt_secret=TEST_SECRET, owner_user_ids=[OWNER_ID])


@pytest.fixture
def client(settings: Settings) -> TestClient:
    return TestClient(create_app(settings))


@pytest.fixture
def mint() -> Callable[[str], str]:
    def _mint(sub: str, *, secret: str = TEST_SECRET, aud: str = "authenticated") -> str:
        now = int(time.time())
        payload = {"sub": sub, "aud": aud, "role": "authenticated", "iat": now, "exp": now + 600}
        return jwt.encode(payload, secret, algorithm="HS256")

    return _mint
