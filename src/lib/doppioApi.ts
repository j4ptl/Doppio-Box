export type DashboardMetric = {
  label: string;
  value: string;
  detail: string;
};

export type AppModule = {
  id: number;
  key: string;
  name: string;
  description: string;
  doctype: string;
  status: string;
  enabled: boolean;
};

export type ManagedSite = {
  id: number;
  name: string;
  url: string;
  environment: string;
  status: string;
};

export type AutomationRun = {
  id: number;
  app: string;
  site: string;
  status: string;
  message: string;
  created_at: string;
};

export type WorkspaceData = {
  site: string;
  user: string;
  mode: string;
  metrics: DashboardMetric[];
  apps: AppModule[];
  sites: ManagedSite[];
  runs: AutomationRun[];
};

export type AutomationRunRequest = {
  site_id: number;
  app_key: string;
};

export type FrappeModule = {
  key: string;
  title: string;
  module: string;
  link_url: string;
  preview: string;
  status: string;
};

export type ModuleAutomationRequest = {
  site_id: number;
  module: string;
};

export type ModuleAutomationResult = {
  status: string;
  message: string;
  module: string;
  doctype_count: number;
};

export type BenchAccess = {
  label: string;
  url: string;
  detail: string;
};

export type BenchApp = {
  key: string;
  name: string;
  category: string;
  description: string;
  repo_url: string;
  branch: string;
  installed: boolean;
  install_command: string;
  desk_url: string;
};

export type BenchSite = {
  name: string;
  path: string;
  desk_url: string;
  config_found: boolean;
};

export type BenchSummary = {
  bench_path: string;
  exists: boolean;
  default_site: string;
  apps_installed: number;
  sites_count: number;
  webserver_port: string;
  access_urls: BenchAccess[];
  apps: BenchApp[];
  sites: BenchSite[];
};

export type BenchAppInstallRequest = {
  app_key: string;
  site_name: string;
  install_to_site: boolean;
};

export type BenchSiteCreateRequest = {
  site_name: string;
  admin_password: string;
  db_root_username: string;
  db_root_password: string;
  install_apps: string[];
};

export type BenchCommandResult = {
  status: string;
  message: string;
  command: string[];
  output: string;
};

export type NetworkInterface = {
  name: string;
  address: string;
  family: string;
  internal: boolean;
};

export type NetworkService = {
  name: string;
  port: number;
  protocol: string;
  bind_address: string;
  local_url: string;
  network_url: string;
  status: "local-only" | "network-accessible";
  warning: string;
  command_suggestion: string;
};

export type NetworkAccessData = {
  hostname: string;
  ip: string;
  localhost: string;
  interfaces: NetworkInterface[];
  services: NetworkService[];
};

type ElectronNetworkAccess = {
  getNetworkDetails: () => Promise<NetworkAccessData>;
  openExternal: (url: string) => Promise<{ status: string }>;
  copyText: (text: string) => Promise<{ status: string }>;
};

declare global {
  interface Window {
    networkAccess?: ElectronNetworkAccess;
  }
}

const backendUrl = (import.meta.env.VITE_BACKEND_URL || "").replace(/\/$/, "");

function apiUrl(path: string) {
  return `${backendUrl}${path}`;
}

export async function loadWorkspaceData(): Promise<WorkspaceData> {
  try {
    const response = await fetch(apiUrl("/api/workspace"));

    if (!response.ok) {
      throw new Error(`Backend request failed with status ${response.status}`);
    }

    return (await response.json()) as WorkspaceData;
  } catch (error) {
    console.warn("Backend workspace unavailable, using frontend demo data", error);

    return {
      site: "Doppio backend unavailable",
      user: "Backend API not reachable",
      mode: "Frontend demo fallback",
      metrics: [
        {
          label: "Frappe Modules",
          value: "Offline",
          detail: "Start FastAPI to load live Frappe workspaces",
        },
        {
          label: "Backend",
          value: "Down",
          detail: "Expected at /api through Vite proxy",
        },
        {
          label: "Automation",
          value: "Paused",
          detail: "Module automation needs the backend",
        },
        {
          label: "Frappe Link",
          value: "Waiting",
          detail: "Start Frappe Bench and Doppio backend",
        },
      ],
      apps: [],
      sites: [
        {
          id: 1,
          name: "Local Frappe Bench",
          url: "http://127.0.0.1:8000",
          environment: "local",
          status: "offline",
        },
      ],
      runs: [],
    };
  }
}

export async function runAutomation(
  payload: AutomationRunRequest
): Promise<AutomationRun> {
  const response = await fetch(apiUrl("/api/automations/run"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`Automation request failed with status ${response.status}`);
  }

  return (await response.json()) as AutomationRun;
}

export async function loadFrappeModules(siteId = 1): Promise<FrappeModule[]> {
  const response = await fetch(apiUrl(`/api/frappe/modules?site_id=${siteId}`));

  if (!response.ok) {
    throw new Error(`Frappe module request failed with status ${response.status}`);
  }

  return (await response.json()) as FrappeModule[];
}

export async function automateFrappeModule(
  payload: ModuleAutomationRequest
): Promise<ModuleAutomationResult> {
  const response = await fetch(apiUrl("/api/frappe/modules/automate"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`Frappe module automation failed with status ${response.status}`);
  }

  return (await response.json()) as ModuleAutomationResult;
}

export async function loadBenchSummary(): Promise<BenchSummary> {
  const response = await fetch(apiUrl("/api/bench/summary"));

  if (!response.ok) {
    throw new Error(`Bench summary request failed with status ${response.status}`);
  }

  return (await response.json()) as BenchSummary;
}

export async function installBenchApp(
  payload: BenchAppInstallRequest
): Promise<BenchCommandResult> {
  const response = await fetch(apiUrl("/api/bench/apps/install"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`Bench app install failed with status ${response.status}`);
  }

  return (await response.json()) as BenchCommandResult;
}

export async function createBenchSite(
  payload: BenchSiteCreateRequest
): Promise<BenchCommandResult> {
  const response = await fetch(apiUrl("/api/bench/sites/create"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`Bench site create failed with status ${response.status}`);
  }

  return (await response.json()) as BenchCommandResult;
}

export async function loadNetworkAccess(): Promise<NetworkAccessData> {
  if (window.networkAccess) {
    return window.networkAccess.getNetworkDetails();
  }

  const response = await fetch(apiUrl("/api/network/access"));

  if (!response.ok) {
    throw new Error(`Network access request failed with status ${response.status}`);
  }

  return (await response.json()) as NetworkAccessData;
}

export async function openAccessUrl(url: string) {
  if (window.networkAccess) {
    await window.networkAccess.openExternal(url);
    return;
  }

  window.open(url, "_blank", "noopener,noreferrer");
}

export async function copyAccessText(text: string) {
  if (window.networkAccess) {
    await window.networkAccess.copyText(text);
    return;
  }

  await navigator.clipboard.writeText(text);
}
