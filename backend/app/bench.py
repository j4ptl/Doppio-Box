import json
import socket
import subprocess
from pathlib import Path

from .schemas import (
  BenchAccessOut,
  BenchAppOut,
  BenchCommandOut,
  BenchSiteOut,
  BenchSummaryOut,
)


BENCH_PATH_STATE = Path.cwd() / ".doppio" / "bench_path.txt"


APP_CATALOG = [
  {
    "key": "erpnext",
    "name": "ERPNext",
    "category": "Core ERP",
    "repo_url": "https://github.com/frappe/erpnext",
    "branch": "version-16",
    "description": "Accounting, selling, buying, stock, manufacturing, projects, and support.",
    "desk_route": "app/home",
  },
  {
    "key": "hrms",
    "name": "HRMS",
    "category": "People",
    "repo_url": "https://github.com/frappe/hrms",
    "branch": "version-16",
    "description": "Employee records, attendance, payroll, leaves, expense claims, and HR workflows.",
    "desk_route": "app/hr",
  },
  {
    "key": "crm",
    "name": "Frappe CRM",
    "category": "Sales",
    "repo_url": "https://github.com/frappe/crm",
    "branch": "main",
    "description": "Leads, deals, contacts, organizations, sales pipeline, and customer follow-up.",
    "desk_route": "crm",
  },
  {
    "key": "helpdesk",
    "name": "Helpdesk",
    "category": "Support",
    "repo_url": "https://github.com/frappe/helpdesk",
    "branch": "develop",
    "description": "Tickets, support agents, service conversations, and knowledge operations.",
    "desk_route": "helpdesk",
  },
  {
    "key": "payments",
    "name": "Payments",
    "category": "Finance",
    "repo_url": "https://github.com/frappe/payments",
    "branch": "develop",
    "description": "Payment gateway connectors for ERPNext invoices and checkout flows.",
    "desk_route": "app/payments",
  },
  {
    "key": "insights",
    "name": "Insights",
    "category": "Analytics",
    "repo_url": "https://github.com/frappe/insights",
    "branch": "version-3",
    "description": "Business dashboards, reports, and query workspaces for Frappe data.",
    "desk_route": "insights",
  },
]


class BenchManager:
  def __init__(self, bench_path: str, timeout_seconds: int) -> None:
    self.bench_path = self._load_saved_path() or Path(bench_path).expanduser()
    self.timeout_seconds = timeout_seconds
    self.bench_process: subprocess.Popen[bytes] | None = None

  def summary(self) -> BenchSummaryOut:
    installed_apps = self._installed_apps()
    common_config = self._common_site_config()
    webserver_port = str(common_config.get("webserver_port", "8000"))
    default_site = str(common_config.get("default_site", ""))
    sites = self._sites(webserver_port)

    if not default_site and sites:
      default_site = sites[0].name

    return BenchSummaryOut(
      bench_path="Configured" if self.bench_path.exists() else "Not configured",
      exists=self.bench_path.exists(),
      default_site=default_site,
      apps_installed=len(installed_apps),
      sites_count=len(sites),
      webserver_port=webserver_port,
      access_urls=self._access_urls(webserver_port),
      apps=[
        self._catalog_app(item, installed_apps, webserver_port)
        for item in APP_CATALOG
      ],
      sites=sites,
    )

  def install_app(self, app_key: str, site_name: str = "", install_to_site: bool = True) -> BenchCommandOut:
    item = self._catalog_item(app_key)
    installed_apps = self._installed_apps()
    commands: list[list[str]] = []

    if app_key not in installed_apps:
      command = ["bench", "get-app"]
      if item["branch"]:
        command.extend(["--branch", item["branch"]])
      command.append(item["repo_url"])
      commands.append(command)

    if install_to_site and site_name:
      commands.append(["bench", "--site", site_name, "install-app", app_key])
      commands.append(["bench", "--site", site_name, "migrate"])

    if not commands:
      return BenchCommandOut(
        status="completed",
        message=f"{item['name']} is already installed in this bench.",
        command=[],
      )

    return self._run_commands(commands)

  def create_site(
    self,
    site_name: str,
    admin_password: str,
    db_root_username: str,
    db_root_password: str,
    install_apps: list[str],
  ) -> BenchCommandOut:
    command = [
      "bench",
      "new-site",
      site_name,
      "--admin-password",
      admin_password,
      "--mariadb-root-username",
      db_root_username,
    ]

    if db_root_password:
      command.extend(["--mariadb-root-password", db_root_password])

    for app_key in install_apps:
      self._catalog_item(app_key)
      command.extend(["--install-app", app_key])

    return self._run_commands([command])

  def set_bench_path(self, bench_path: str) -> BenchCommandOut:
    path = Path(bench_path).expanduser()

    if not self._is_valid_bench_path(path):
      return BenchCommandOut(
        status="failed",
        message="Selected folder is not a valid Frappe Bench. Choose a folder with apps, sites, and a Procfile.",
        command=[],
      )

    self.bench_path = path
    BENCH_PATH_STATE.parent.mkdir(parents=True, exist_ok=True)
    BENCH_PATH_STATE.write_text(str(path), encoding="utf-8")

    return BenchCommandOut(
      status="completed",
      message="Frappe Bench path configured.",
      command=["doppio", "set-bench-path", "********"],
      output="Bench folder saved for local automation.",
    )

  def start_bench(self) -> BenchCommandOut:
    if not self._is_valid_bench_path(self.bench_path):
      return BenchCommandOut(
        status="failed",
        message="Bench path is not configured. Set a valid Frappe Bench folder first.",
        command=["bench", "start"],
      )

    if self.bench_process and self.bench_process.poll() is None:
      return BenchCommandOut(
        status="completed",
        message="Frappe Bench is already starting or running from Doppio.",
        command=["bench", "start"],
      )

    webserver_port = int(self._common_site_config().get("webserver_port", 8000))

    if _port_is_open("127.0.0.1", webserver_port):
      return BenchCommandOut(
        status="completed",
        message="Frappe Bench is already reachable.",
        command=["bench", "start"],
        output=f"Frappe is already available at http://localhost:{webserver_port}.",
      )

    log_path = Path.cwd() / ".doppio" / "bench-start.log"
    log_path.parent.mkdir(parents=True, exist_ok=True)

    try:
      with log_path.open("ab") as log_file:
        self.bench_process = subprocess.Popen(
          ["bench", "start"],
          cwd=self.bench_path,
          stdout=log_file,
          stderr=subprocess.STDOUT,
          start_new_session=True,
        )
    except FileNotFoundError:
      return BenchCommandOut(
        status="failed",
        message="The bench command was not found in this backend process PATH.",
        command=["bench", "start"],
      )

    return BenchCommandOut(
      status="running",
      message="Frappe Bench start command launched.",
      command=["bench", "start"],
      output="Bench is starting in the background. Open Frappe after a few seconds at http://localhost:8000.",
    )

  def run_terminal_action(self, action: str, site_name: str = "") -> BenchCommandOut:
    site_required_actions = {
      "bench-list-apps",
      "bench-migrate",
      "bench-clear-cache",
    }

    if action in site_required_actions and not site_name:
      return BenchCommandOut(
        status="failed",
        message="Select a site before running this terminal action.",
        command=[],
      )

    commands = {
      "bench-version": ["bench", "--version"],
      "bench-list-sites": ["bench", "list-sites"],
      "bench-list-apps": ["bench", "--site", site_name, "list-apps"],
      "bench-migrate": ["bench", "--site", site_name, "migrate"],
      "bench-clear-cache": ["bench", "--site", site_name, "clear-cache"],
    }
    command = commands.get(action)

    if not command:
      raise ValueError(f"Unsupported terminal action: {action}")

    return self._run_commands([command])

  def _catalog_item(self, app_key: str) -> dict[str, str]:
    for item in APP_CATALOG:
      if item["key"] == app_key:
        return item

    raise ValueError(f"Unsupported app: {app_key}")

  def _catalog_app(
    self,
    item: dict[str, str],
    installed_apps: set[str],
    webserver_port: str,
  ) -> BenchAppOut:
    install_command = f"bench get-app {item['repo_url']}"

    if item["branch"]:
      install_command = f"bench get-app --branch {item['branch']} {item['repo_url']}"

    return BenchAppOut(
      key=item["key"],
      name=item["name"],
      category=item["category"],
      description=item["description"],
      repo_url=item["repo_url"],
      branch=item["branch"],
      installed=item["key"] in installed_apps,
      install_command=install_command,
      desk_url=f"http://localhost:{webserver_port}/{item['desk_route']}",
    )

  def _sites(self, webserver_port: str) -> list[BenchSiteOut]:
    sites_path = self.bench_path / "sites"

    if not sites_path.exists():
      return []

    return [
      BenchSiteOut(
        name=path.name,
        path="Hidden",
        desk_url=f"http://localhost:{webserver_port}/app",
        config_found=(path / "site_config.json").exists(),
      )
      for path in sorted(sites_path.iterdir())
      if path.is_dir() and (path / "site_config.json").exists()
    ]

  def _installed_apps(self) -> set[str]:
    apps_txt = self.bench_path / "sites" / "apps.txt"
    apps_dir = self.bench_path / "apps"
    apps = set()

    if apps_txt.exists():
      apps.update(
        line.strip()
        for line in apps_txt.read_text(encoding="utf-8").splitlines()
        if line.strip()
      )

    if apps_dir.exists():
      apps.update(path.name for path in apps_dir.iterdir() if path.is_dir())

    return apps

  def _common_site_config(self) -> dict[str, object]:
    config_path = self.bench_path / "sites" / "common_site_config.json"

    if not config_path.exists():
      return {}

    try:
      return json.loads(config_path.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
      return {}

  def _load_saved_path(self) -> Path | None:
    if not BENCH_PATH_STATE.exists():
      return None

    saved_path = Path(BENCH_PATH_STATE.read_text(encoding="utf-8").strip()).expanduser()

    if self._is_valid_bench_path(saved_path):
      return saved_path

    return None

  def _is_valid_bench_path(self, path: Path) -> bool:
    return (
      path.exists()
      and path.is_dir()
      and (path / "apps").is_dir()
      and (path / "sites").is_dir()
      and (path / "Procfile").is_file()
    )

  def _access_urls(self, webserver_port: str) -> list[BenchAccessOut]:
    return [
      BenchAccessOut(
        label="Doppio UI",
        url="http://localhost:5173",
        detail="React control panel for modules, setup, and access.",
      ),
      BenchAccessOut(
        label="Doppio Backend",
        url="http://localhost:8001",
        detail="FastAPI service used by the Doppio UI.",
      ),
      BenchAccessOut(
        label="Frappe Bench",
        url=f"http://localhost:{webserver_port}",
        detail="Local ERPNext/Frappe Desk served by bench.",
      ),
    ]

  def _run_commands(self, commands: list[list[str]]) -> BenchCommandOut:
    if not self.bench_path.exists():
      return BenchCommandOut(
        status="failed",
        message="Bench path does not exist.",
        command=_mask_command(commands[0]) if commands else [],
      )

    output_parts = []
    last_command: list[str] = []

    for command in commands:
      last_command = command
      try:
        completed = subprocess.run(
          command,
          cwd=self.bench_path,
          check=False,
          capture_output=True,
          text=True,
          timeout=self.timeout_seconds,
        )
      except FileNotFoundError:
        return BenchCommandOut(
          status="failed",
          message="The bench command was not found in this backend process PATH.",
          command=_mask_command(command),
        )
      except subprocess.TimeoutExpired as exc:
        return BenchCommandOut(
          status="failed",
          message="Bench command timed out.",
          command=_mask_command(command),
          output=(exc.stdout or "") + (exc.stderr or ""),
        )

      output_parts.append(completed.stdout)
      output_parts.append(completed.stderr)

      if completed.returncode != 0:
        return BenchCommandOut(
          status="failed",
          message=f"Bench command failed with exit code {completed.returncode}.",
          command=_mask_command(command),
          output="\n".join(part for part in output_parts if part),
        )

    return BenchCommandOut(
      status="completed",
      message="Bench command completed.",
      command=_mask_command(last_command),
      output="\n".join(part for part in output_parts if part),
    )


def _mask_command(command: list[str]) -> list[str]:
  sensitive_flags = {
    "--admin-password",
    "--mariadb-root-password",
  }
  masked: list[str] = []
  hide_next = False

  for part in command:
    if hide_next:
      masked.append("********")
      hide_next = False
      continue

    masked.append(part)

    if part in sensitive_flags:
      hide_next = True

  return masked


def _port_is_open(host: str, port: int) -> bool:
  try:
    with socket.create_connection((host, port), timeout=0.5):
      return True
  except OSError:
    return False
