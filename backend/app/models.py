from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, String, Text, func
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


class Base(DeclarativeBase):
  pass


class ManagedSite(Base):
  __tablename__ = "managed_sites"

  id: Mapped[int] = mapped_column(primary_key=True, index=True)
  name: Mapped[str] = mapped_column(String(120), nullable=False)
  url: Mapped[str] = mapped_column(String(255), nullable=False)
  environment: Mapped[str] = mapped_column(String(40), default="cloud", nullable=False)
  status: Mapped[str] = mapped_column(String(40), default="needs_setup", nullable=False)
  api_key: Mapped[str] = mapped_column(String(255), default="", nullable=False)
  api_secret: Mapped[str] = mapped_column(String(255), default="", nullable=False)
  created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

  runs: Mapped[list["AutomationRun"]] = relationship(back_populates="site")


class AppModule(Base):
  __tablename__ = "app_modules"

  id: Mapped[int] = mapped_column(primary_key=True, index=True)
  key: Mapped[str] = mapped_column(String(80), unique=True, index=True, nullable=False)
  name: Mapped[str] = mapped_column(String(120), nullable=False)
  description: Mapped[str] = mapped_column(Text, nullable=False)
  doctype: Mapped[str] = mapped_column(String(120), default="", nullable=False)
  status: Mapped[str] = mapped_column(String(40), default="ready", nullable=False)
  enabled: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
  created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

  runs: Mapped[list["AutomationRun"]] = relationship(back_populates="app")


class AutomationRun(Base):
  __tablename__ = "automation_runs"

  id: Mapped[int] = mapped_column(primary_key=True, index=True)
  site_id: Mapped[int] = mapped_column(ForeignKey("managed_sites.id"), nullable=False)
  app_id: Mapped[int] = mapped_column(ForeignKey("app_modules.id"), nullable=False)
  status: Mapped[str] = mapped_column(String(40), default="queued", nullable=False)
  message: Mapped[str] = mapped_column(Text, default="", nullable=False)
  created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

  site: Mapped[ManagedSite] = relationship(back_populates="runs")
  app: Mapped[AppModule] = relationship(back_populates="runs")
