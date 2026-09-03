import time
from collections.abc import Callable

import jwt
import pytest
from cryptography.hazmat.primitives.asymmetric import ec
from fastapi.testclient import TestClient

from brain.auth import Claims, JwtVerifier
from tests.conftest import GUEST_ID, OWNER_ID, TEST_SECRET


def test_missing_token_is_401(client: TestClient) -> None:
    assert client.get("/owner/ping").status_code == 401


def test_garbage_token_is_401(client: TestClient) -> None:
    r = client.get("/owner/ping", headers={"Authorization": "Bearer not-a-jwt"})
    assert r.status_code == 401


def test_wrong_secret_is_401(client: TestClient, mint: Callable[..., str]) -> None:
    token = mint(OWNER_ID, secret="another-secret-that-is-also-32-chars-long")
    r = client.get("/owner/ping", headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 401


def test_owner_token_is_200(client: TestClient, mint: Callable[..., str]) -> None:
    r = client.get("/owner/ping", headers={"Authorization": f"Bearer {mint(OWNER_ID)}"})
    assert r.status_code == 200
    assert r.json() == {"ok": True, "sub": OWNER_ID}


def test_guest_token_is_403_on_owner_route(client: TestClient, mint: Callable[..., str]) -> None:
    r = client.get("/owner/ping", headers={"Authorization": f"Bearer {mint(GUEST_ID)}"})
    assert r.status_code == 403


def test_health_stays_public(client: TestClient) -> None:
    assert client.get("/health").status_code == 200


def test_verifier_hs256_returns_claims(mint: Callable[..., str]) -> None:
    verifier = JwtVerifier(secret=TEST_SECRET, jwks_url=None, audience="authenticated")
    assert verifier.verify(mint(OWNER_ID)) == Claims(sub=OWNER_ID, role="authenticated", email=None)


def test_verifier_es256_via_jwks(monkeypatch: pytest.MonkeyPatch) -> None:
    private_key = ec.generate_private_key(ec.SECP256R1())
    token = jwt.encode(
        {"sub": OWNER_ID, "aud": "authenticated", "role": "authenticated", "exp": 4102444800},
        private_key,
        algorithm="ES256",
        headers={"kid": "k1"},
    )

    class FakeSigningKey:
        key = private_key.public_key()

    verifier = JwtVerifier(
        secret=None, jwks_url="https://example.test/jwks.json", audience="authenticated"
    )
    monkeypatch.setattr(verifier, "_signing_key_for", lambda _token: FakeSigningKey())
    assert verifier.verify(token).sub == OWNER_ID


def test_verifier_without_config_raises() -> None:
    with pytest.raises(RuntimeError):
        JwtVerifier(secret=None, jwks_url=None, audience="authenticated")


def test_token_missing_sub_is_401(client: TestClient) -> None:
    now = int(time.time())
    payload = {"aud": "authenticated", "role": "authenticated", "exp": now + 600}
    token = jwt.encode(payload, TEST_SECRET, algorithm="HS256")
    r = client.get("/owner/ping", headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 401


def test_expired_token_is_401(client: TestClient) -> None:
    now = int(time.time())
    payload = {"sub": OWNER_ID, "aud": "authenticated", "role": "authenticated", "exp": now - 10}
    token = jwt.encode(payload, TEST_SECRET, algorithm="HS256")
    r = client.get("/owner/ping", headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 401


def test_token_missing_exp_is_401(client: TestClient) -> None:
    payload = {"sub": OWNER_ID, "aud": "authenticated", "role": "authenticated"}
    token = jwt.encode(payload, TEST_SECRET, algorithm="HS256")
    r = client.get("/owner/ping", headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 401
