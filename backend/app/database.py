from collections.abc import Generator

from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from .config import get_settings
from .models import Base

settings = get_settings()

engine = create_engine(settings.database_url, pool_pre_ping=True)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def init_db() -> None:
  Base.metadata.create_all(bind=engine)


def get_session() -> Generator[Session, None, None]:
  session = SessionLocal()
  try:
    yield session
  finally:
    session.close()
