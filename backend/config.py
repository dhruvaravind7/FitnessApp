"""Application settings loaded from environment variables / backend/.env."""
from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    # Database
    db_host: str
    db_port: int = 5432
    db_name: str
    db_username: str
    db_password: str
    db_sslmode: str = "require"
    db_schema: str = "public"  # tests point this at an isolated schema

    # External services
    edb_key: str = ""
    gemini_api_key: str = ""
    gemini_model: str = "gemini-3.1-flash-lite-preview"

    # Auth
    jwt_secret_key: str
    jwt_expire_days: int = 7

    # Server
    port: int = 8000
    frontend_origin: str = "http://localhost:5173"

    @property
    def conninfo(self) -> str:
        return (
            f"host={self.db_host} port={self.db_port} dbname={self.db_name} "
            f"user={self.db_username} password={self.db_password} sslmode={self.db_sslmode}"
        )

    @property
    def cors_origins(self) -> list[str]:
        return [o.strip() for o in self.frontend_origin.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
