from typing import Annotated

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    service_name: str = "brain"
    supabase_jwt_secret: str | None = None
    supabase_jwks_url: str | None = None
    jwt_audience: str = "authenticated"
    # NoDecode: pydantic-settings otherwise JSON-decodes complex-typed env values
    # before validators run, so a plain comma-separated OWNER_USER_IDS blows up
    # with a JSONDecodeError instead of reaching `_split_csv` below.
    owner_user_ids: Annotated[list[str], NoDecode] = Field(default_factory=list)
    langfuse_host: str | None = None
    langfuse_public_key: str | None = None
    langfuse_secret_key: str | None = None

    @field_validator("owner_user_ids", mode="before")
    @classmethod
    def _split_csv(cls, value: object) -> object:
        if isinstance(value, str):
            return [part.strip() for part in value.split(",") if part.strip()]
        return value
