import os
from dataclasses import dataclass
from functools import lru_cache

from dotenv import load_dotenv

load_dotenv()


@dataclass(frozen=True)
class Settings:
  database_url: str
  frappe_site_url: str
  frappe_api_key: str
  frappe_api_secret: str
  cors_origins: list[str]
  frappe_timeout_seconds: float
  bench_path: str
  bench_command_timeout_seconds: int
  terminal_token: str


@lru_cache
def get_settings() -> Settings:
  cors_origins = os.getenv("BACKEND_CORS_ORIGINS", "http://localhost:5173")

  return Settings(
    database_url=os.getenv(
      "DATABASE_URL",
      "mysql+pymysql://doppio:doppio@127.0.0.1:3306/doppio_box",
    ),
    frappe_site_url=os.getenv("FRAPPE_SITE_URL", ""),
    frappe_api_key=os.getenv("FRAPPE_API_KEY", ""),
    frappe_api_secret=os.getenv("FRAPPE_API_SECRET", ""),
    cors_origins=[origin.strip() for origin in cors_origins.split(",") if origin.strip()],
    frappe_timeout_seconds=float(os.getenv("FRAPPE_TIMEOUT_SECONDS", "15")),
    bench_path=os.getenv("BENCH_PATH", "/home/jenish/frappe16/frappe-bench16"),
    bench_command_timeout_seconds=int(os.getenv("BENCH_COMMAND_TIMEOUT_SECONDS", "900")),
    terminal_token=os.getenv("DOPPIO_TERMINAL_TOKEN", ""),
  )
