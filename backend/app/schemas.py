from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field, HttpUrl


class MetricOut(BaseModel):
  label: str
  value: str
  detail: str


class ManagedSiteCreate(BaseModel):
  name: str = Field(min_length=2, max_length=120)
  url: HttpUrl
  environment: str = "cloud"
  api_key: str = ""
  api_secret: str = ""


class ManagedSiteOut(BaseModel):
  id: int
  name: str
  url: str
  environment: str
  status: str

  class Config:
    from_attributes = True


class AppModuleOut(BaseModel):
  id: int
  key: str
  name: str
  description: str
  doctype: str
  status: str
  enabled: bool

  class Config:
    from_attributes = True


class AutomationRunCreate(BaseModel):
  site_id: int
  app_key: str


class AutomationRunOut(BaseModel):
  id: int
  app: str
  site: str
  status: str
  message: str
  created_at: datetime


class FrappeModuleOut(BaseModel):
  key: str
  title: str
  module: str
  link_url: str
  preview: str
  status: str


class ModuleAutomationCreate(BaseModel):
  site_id: int
  module: str


class ModuleAutomationOut(BaseModel):
  status: str
  message: str
  module: str
  doctype_count: int = 0


class BenchAccessOut(BaseModel):
  label: str
  url: str
  detail: str


class BenchAppOut(BaseModel):
  key: str
  name: str
  category: str
  description: str
  repo_url: str
  branch: str
  installed: bool
  install_command: str
  desk_url: str


class BenchSiteOut(BaseModel):
  name: str
  path: str
  desk_url: str
  config_found: bool


class BenchSummaryOut(BaseModel):
  bench_path: str
  exists: bool
  default_site: str
  apps_installed: int
  sites_count: int
  webserver_port: str
  access_urls: list[BenchAccessOut]
  apps: list[BenchAppOut]
  sites: list[BenchSiteOut]


class BenchAppInstallCreate(BaseModel):
  app_key: str
  site_name: str = ""
  install_to_site: bool = True


class BenchSiteCreate(BaseModel):
  site_name: str = Field(min_length=2, max_length=120)
  admin_password: str = Field(min_length=4, max_length=255)
  db_root_username: str = "root"
  db_root_password: str = ""
  install_apps: list[str] = Field(default_factory=list)


class BenchPathCreate(BaseModel):
  path: str = Field(min_length=2, max_length=500)


class BenchCommandOut(BaseModel):
  status: str
  message: str
  command: list[str]
  output: str = ""


class TerminalCommandCreate(BaseModel):
  action: Literal[
    "bench-version",
    "bench-list-sites",
    "bench-list-apps",
    "bench-migrate",
    "bench-clear-cache",
  ]
  site_name: str = ""


class TerminalManualCommandCreate(BaseModel):
  command: str = Field(min_length=1, max_length=500)


class TerminalOsCommandCreate(BaseModel):
  command: str = Field(min_length=1, max_length=500)
  token: str = Field(default="", max_length=255)


class NetworkInterfaceOut(BaseModel):
  name: str
  address: str
  family: str
  internal: bool


class NetworkServiceOut(BaseModel):
  name: str
  port: int
  protocol: str = "tcp"
  bind_address: str
  local_url: str
  network_url: str
  status: str
  warning: str = ""
  command_suggestion: str = ""


class SSHAccessOut(BaseModel):
  username: str
  host: str
  port: int = 22
  project_path: str
  status: str
  ssh_command: str
  sftp_command: str
  scp_download_command: str
  rsync_download_command: str
  vscode_remote_command: str
  suggestion: str


class NetworkAccessOut(BaseModel):
  hostname: str
  ip: str
  localhost: str = "127.0.0.1"
  interfaces: list[NetworkInterfaceOut]
  services: list[NetworkServiceOut]
  ssh: SSHAccessOut


class WorkspaceOut(BaseModel):
  site: str
  user: str
  mode: str
  metrics: list[MetricOut]
  apps: list[AppModuleOut]
  sites: list[ManagedSiteOut]
  runs: list[AutomationRunOut]
