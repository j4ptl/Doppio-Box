from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import desc, select
from sqlalchemy.orm import Session

from .bench import BenchManager
from .config import get_settings
from .database import SessionLocal, get_session, init_db
from .frappe import FrappeClient, site_has_credentials
from .models import AppModule, AutomationRun, ManagedSite
from .network_access import build_network_access
from .schemas import (
  AppModuleOut,
  AutomationRunCreate,
  AutomationRunOut,
  BenchAppInstallCreate,
  BenchCommandOut,
  BenchSiteCreate,
  BenchSummaryOut,
  FrappeModuleOut,
  ManagedSiteCreate,
  ManagedSiteOut,
  MetricOut,
  ModuleAutomationCreate,
  ModuleAutomationOut,
  NetworkAccessOut,
  WorkspaceOut,
)
from .seed import seed_defaults


@asynccontextmanager
async def lifespan(_: FastAPI):
  init_db()
  with SessionLocal() as session:
    seed_defaults(session)
  yield


settings = get_settings()
app = FastAPI(title="Doppio Box Backend", version="0.1.0", lifespan=lifespan)
frappe_client = FrappeClient(settings.frappe_timeout_seconds)
bench_manager = BenchManager(
  settings.bench_path,
  settings.bench_command_timeout_seconds,
)

app.add_middleware(
  CORSMiddleware,
  allow_origins=settings.cors_origins,
  allow_credentials=True,
  allow_methods=["*"],
  allow_headers=["*"],
)


@app.get("/")
def root() -> dict[str, str]:
  return {
    "app": "Doppio Box Backend",
    "status": "ok",
    "ui": "http://localhost:5173",
    "frappe_bench": "http://localhost:8000",
    "backend_health": "/health",
    "backend_docs": "/docs",
  }


@app.get("/health")
def health() -> dict[str, str]:
  return {"status": "ok"}


@app.get("/api/apps", response_model=list[AppModuleOut])
def list_apps(session: Session = Depends(get_session)) -> list[AppModule]:
  return list(session.scalars(select(AppModule).order_by(AppModule.name)))


@app.get("/api/sites", response_model=list[ManagedSiteOut])
def list_sites(session: Session = Depends(get_session)) -> list[ManagedSite]:
  return list(session.scalars(select(ManagedSite).order_by(ManagedSite.name)))


@app.get("/api/bench/summary", response_model=BenchSummaryOut)
def bench_summary() -> BenchSummaryOut:
  return bench_manager.summary()


@app.get("/api/network/access", response_model=NetworkAccessOut)
def network_access() -> NetworkAccessOut:
  return build_network_access()


@app.post("/api/bench/apps/install", response_model=BenchCommandOut)
def install_bench_app(payload: BenchAppInstallCreate) -> BenchCommandOut:
  try:
    return bench_manager.install_app(
      payload.app_key,
      payload.site_name,
      payload.install_to_site,
    )
  except ValueError as exc:
    raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.post("/api/bench/sites/create", response_model=BenchCommandOut)
def create_bench_site(payload: BenchSiteCreate) -> BenchCommandOut:
  try:
    return bench_manager.create_site(
      payload.site_name,
      payload.admin_password,
      payload.db_root_username,
      payload.db_root_password,
      payload.install_apps,
    )
  except ValueError as exc:
    raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.get("/api/frappe/modules", response_model=list[FrappeModuleOut])
async def list_frappe_modules(
  site_id: int = 1,
  session: Session = Depends(get_session),
) -> list[FrappeModuleOut]:
  site = session.get(ManagedSite, site_id)

  if not site:
    raise HTTPException(status_code=404, detail="Managed site not found")
  if not site_has_credentials(site):
    return []

  workspaces = await frappe_client.list_resources(
    site,
    "Workspace",
    fields=["name", "title", "module"],
    limit=100,
  )

  return [
    _module_out(site, workspace)
    for workspace in workspaces
    if workspace.get("name")
  ]


@app.post("/api/frappe/modules/automate", response_model=ModuleAutomationOut)
async def automate_frappe_module(
  payload: ModuleAutomationCreate,
  session: Session = Depends(get_session),
) -> ModuleAutomationOut:
  site = session.get(ManagedSite, payload.site_id)

  if not site:
    raise HTTPException(status_code=404, detail="Managed site not found")
  if not site_has_credentials(site):
    return ModuleAutomationOut(
      status="needs_setup",
      module=payload.module,
      message="Frappe credentials are not configured.",
    )

  try:
    doctypes = await frappe_client.list_resources(
      site,
      "DocType",
      fields=["name", "module"],
      filters=[["module", "=", payload.module]],
      limit=500,
    )
    return ModuleAutomationOut(
      status="completed",
      module=payload.module,
      doctype_count=len(doctypes),
      message=f"{payload.module} automation check completed with {len(doctypes)} doctypes available.",
    )
  except Exception as exc:
    return ModuleAutomationOut(
      status="failed",
      module=payload.module,
      message=f"Frappe module automation failed: {exc.__class__.__name__}",
    )


@app.post("/api/sites", response_model=ManagedSiteOut)
def create_site(
  payload: ManagedSiteCreate,
  session: Session = Depends(get_session),
) -> ManagedSite:
  site = ManagedSite(
    name=payload.name,
    url=str(payload.url).rstrip("/"),
    environment=payload.environment,
    status="ready" if payload.api_key and payload.api_secret else "needs_setup",
    api_key=payload.api_key,
    api_secret=payload.api_secret,
  )
  session.add(site)
  session.commit()
  session.refresh(site)
  return site


@app.get("/api/workspace", response_model=WorkspaceOut)
async def get_workspace(session: Session = Depends(get_session)) -> WorkspaceOut:
  sites = list(session.scalars(select(ManagedSite).order_by(ManagedSite.name)))
  primary_site = sites[0] if sites else None
  user = "Frappe API token not configured"
  mode = "Seed data only - Frappe not connected"

  metrics = [
    MetricOut(label="Frappe Modules", value="Not loaded", detail="Connect Frappe to load live workspaces"),
    MetricOut(label="Configured Sites", value=str(len(sites)), detail="Stored connection records in MariaDB"),
    MetricOut(label="Automation", value="Waiting", detail="Module automation starts after live connection"),
    MetricOut(label="Frappe Link", value="Not connected", detail="Add a site URL, API key, and API secret"),
  ]

  if primary_site and site_has_credentials(primary_site):
    try:
      user = await frappe_client.get_logged_user(primary_site)
      mode = "Live Frappe API through backend"
      workspaces = await frappe_client.list_resources(
        primary_site,
        "Workspace",
        fields=["name", "title", "module"],
        limit=100,
      )
      metrics = [
        MetricOut(label="Frappe Modules", value=str(len(workspaces)), detail="Live Workspace records from Frappe"),
        MetricOut(label="Configured Sites", value=str(len(sites)), detail="Stored connection records in MariaDB"),
        MetricOut(label="Live Connection", value="Connected", detail="Frappe REST API is reachable"),
        MetricOut(label="Automation", value="Ready", detail="Module checks run through FastAPI"),
      ]
    except Exception as exc:
      user = "Frappe connection failed"
      mode = f"Backend online, Frappe error: {exc.__class__.__name__}"

  return WorkspaceOut(
    site=primary_site.name if primary_site else "No site configured",
    user=user,
    mode=mode,
    metrics=metrics[:4],
    apps=[],
    sites=sites,
    runs=[],
  )


@app.post("/api/automations/run", response_model=AutomationRunOut)
async def run_automation(
  payload: AutomationRunCreate,
  session: Session = Depends(get_session),
) -> AutomationRunOut:
  site = session.get(ManagedSite, payload.site_id)
  app_module = session.scalar(select(AppModule).where(AppModule.key == payload.app_key))

  if not site:
    raise HTTPException(status_code=404, detail="Managed site not found")
  if not app_module:
    raise HTTPException(status_code=404, detail="App module not found")

  run = AutomationRun(site=site, app=app_module, status="running")
  session.add(run)
  session.commit()
  session.refresh(run)

  try:
    if site_has_credentials(site) and app_module.doctype:
      count = await frappe_client.get_count(site, app_module.doctype)
      run.status = "completed"
      run.message = f"{app_module.doctype} check completed with {count} records."
    else:
      run.status = "needs_setup"
      run.message = "Add live Frappe API credentials to execute this backend process."
  except Exception as exc:
    run.status = "failed"
    run.message = f"Frappe automation failed: {exc.__class__.__name__}"

  session.commit()
  session.refresh(run)
  return _run_out(run)


def _run_out(run: AutomationRun) -> AutomationRunOut:
  return AutomationRunOut(
    id=run.id,
    app=run.app.name,
    site=run.site.name,
    status=run.status,
    message=run.message,
    created_at=run.created_at,
  )


def _module_out(site: ManagedSite, workspace: dict[str, str]) -> FrappeModuleOut:
  title = workspace.get("title") or workspace.get("name", "")
  module = workspace.get("module") or title
  key = _slug(title)

  return FrappeModuleOut(
    key=key,
    title=title,
    module=module,
    link_url=f"{site.url.rstrip('/')}/app/{key}",
    preview=f"Open {title} in Frappe Desk and run backend checks for {module}.",
    status="live",
  )


def _slug(value: str) -> str:
  safe = "".join(character.lower() if character.isalnum() else "-" for character in value)
  return "-".join(part for part in safe.split("-") if part)
