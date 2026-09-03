"""Supabase JWT verification and the Owner allowlist (docs/10 §3)."""

from dataclasses import dataclass
from typing import Annotated, Any

import jwt
from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from brain.settings import Settings

_bearer = HTTPBearer(auto_error=False)
_REQUIRED_CLAIMS = ["sub", "exp", "aud"]


@dataclass(frozen=True)
class Claims:
    sub: str
    role: str
    email: str | None


class JwtVerifier:
    """HS256 with the project JWT secret (local CLI, legacy projects) or ES256/RS256 via JWKS."""

    def __init__(self, *, secret: str | None, jwks_url: str | None, audience: str) -> None:
        if not secret and not jwks_url:
            raise RuntimeError("Set SUPABASE_JWT_SECRET or SUPABASE_JWKS_URL")
        self._secret = secret
        self._audience = audience
        self._jwks = jwt.PyJWKClient(jwks_url, cache_keys=True) if jwks_url else None

    def _signing_key_for(self, token: str) -> Any:  # noqa: ANN401 - PyJWK has no stable public type
        assert self._jwks is not None
        return self._jwks.get_signing_key_from_jwt(token)

    def verify(self, token: str) -> Claims:
        if self._jwks is not None:
            key = self._signing_key_for(token).key
            payload = jwt.decode(
                token,
                key,
                algorithms=["ES256", "RS256"],
                audience=self._audience,
                options={"require": _REQUIRED_CLAIMS},
            )
        else:
            assert self._secret is not None
            payload = jwt.decode(
                token,
                self._secret,
                algorithms=["HS256"],
                audience=self._audience,
                options={"require": _REQUIRED_CLAIMS},
            )
        return Claims(
            sub=str(payload["sub"]),
            role=str(payload.get("role", "")),
            email=payload.get("email"),
        )


def get_settings(request: Request) -> Settings:
    settings: Settings = request.app.state.settings
    return settings


def get_verifier(request: Request) -> JwtVerifier:
    verifier: JwtVerifier = request.app.state.verifier
    return verifier


def current_claims(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(_bearer)],
    verifier: Annotated[JwtVerifier, Depends(get_verifier)],
) -> Claims:
    if credentials is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Missing bearer token")
    try:
        return verifier.verify(credentials.credentials)
    except jwt.PyJWTError as exc:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid token") from exc


def require_owner(
    claims: Annotated[Claims, Depends(current_claims)],
    settings: Annotated[Settings, Depends(get_settings)],
) -> Claims:
    if claims.sub not in settings.owner_user_ids:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Owner only")
    return claims
