from pathlib import Path
from typing import Literal

from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import Field


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_prefix="IMMO_", extra="ignore")
    mode: Literal["demo", "real"] = "demo"
    database_url: str = "sqlite:///./.local/demo.db"
    storage_dir: Path = Path(".local/demo-documents")
    cors_origins: list[str] = ["http://127.0.0.1:1420", "http://localhost:1420", "http://tauri.localhost", "tauri://localhost"]
    session_hours: int = Field(default=8, ge=1, le=24)
    desktop_key: str = ""

    def validate_runtime(self):
        if self.mode == "real" and not self.database_url.startswith("postgresql"):
            raise ValueError("Le mode réel exige PostgreSQL et une base dédiée.")
        self.storage_dir.mkdir(parents=True, exist_ok=True)
        marker = self.storage_dir / ".installation-mode"
        if marker.exists() and marker.read_text(encoding="utf-8") != self.mode:
            raise ValueError("Le stockage documentaire appartient à un autre mode. Choisissez un dossier séparé.")
        if not marker.exists():
            marker.write_text(self.mode, encoding="utf-8")
        Path(".local").mkdir(exist_ok=True)
