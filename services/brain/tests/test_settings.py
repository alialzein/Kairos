import pytest

from brain.settings import Settings


def test_owner_user_ids_parses_csv_env(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("OWNER_USER_IDS", " a , b,,c ")
    monkeypatch.setenv("SUPABASE_JWT_SECRET", "x" * 32)
    assert Settings(_env_file=None).owner_user_ids == ["a", "b", "c"]


def test_owner_user_ids_accepts_list() -> None:
    settings = Settings(_env_file=None, supabase_jwt_secret="x" * 32, owner_user_ids=["x", "y"])
    assert settings.owner_user_ids == ["x", "y"]
