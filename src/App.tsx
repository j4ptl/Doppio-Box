import { useEffect, useMemo, useState } from "react";
import {
  BenchApp,
  BenchSummary,
  FrappeModule,
  ManagedSite,
  NetworkAccessData,
  NetworkService,
  WorkspaceData,
  automateFrappeModule,
  copyAccessText,
  createBenchSite,
  installBenchApp,
  loadBenchSummary,
  loadFrappeModules,
  loadNetworkAccess,
  loadWorkspaceData,
  openAccessUrl,
} from "./lib/doppioApi";

type Page = "overview" | "modules" | "setup" | "access";

const pages: Array<{ key: Page; label: string }> = [
  { key: "overview", label: "Overview" },
  { key: "modules", label: "Modules" },
  { key: "setup", label: "Setup" },
  { key: "access", label: "Access" },
];

const pageCopy: Record<Page, { eyebrow: string; title: string; copy: string }> = {
  overview: {
    eyebrow: "Frappe ERPNext Control",
    title: "Doppio Box cloud control desk.",
    copy: "Manage live Frappe modules, bench apps, local sites, and direct access links from one workspace.",
  },
  modules: {
    eyebrow: "Frappe Gallery",
    title: "Live module dashboard.",
    copy: "Open ERPNext workspaces in Frappe Desk and run backend automation checks from Doppio Box.",
  },
  setup: {
    eyebrow: "Bench Setup",
    title: "Install apps and create sites.",
    copy: "Prepare ERPNext, HRMS, CRM, Helpdesk, and related Frappe apps from a single setup page.",
  },
  access: {
    eyebrow: "Network Access Center",
    title: "Local and LAN services.",
    copy: "Detect listening ports, show localhost and network URLs, and keep database ports clearly marked.",
  },
};

function App() {
  const [workspace, setWorkspace] = useState<WorkspaceData | null>(null);
  const [bench, setBench] = useState<BenchSummary | null>(null);
  const [networkAccess, setNetworkAccess] = useState<NetworkAccessData | null>(null);
  const [modules, setModules] = useState<FrappeModule[]>([]);
  const [page, setPage] = useState<Page>("overview");
  const [loading, setLoading] = useState(true);
  const [selectedSiteId, setSelectedSiteId] = useState<number | null>(null);
  const [selectedModuleKey, setSelectedModuleKey] = useState("");
  const [galleryModule, setGalleryModule] = useState<FrappeModule | null>(null);
  const [running, setRunning] = useState(false);
  const [automationMessage, setAutomationMessage] = useState("");
  const [setupMessage, setSetupMessage] = useState("");
  const [accessMessage, setAccessMessage] = useState("");
  const [suggestion, setSuggestion] = useState("");
  const [installingKey, setInstallingKey] = useState("");
  const [creatingSite, setCreatingSite] = useState(false);
  const [siteName, setSiteName] = useState("new-site.local");
  const [adminPassword, setAdminPassword] = useState("");
  const [dbRootUsername, setDbRootUsername] = useState("root");
  const [dbRootPassword, setDbRootPassword] = useState("");
  const [siteInstallApps, setSiteInstallApps] = useState<string[]>(["erpnext"]);

  useEffect(() => {
    let mounted = true;

    Promise.allSettled([
      loadWorkspaceData(),
      loadBenchSummary(),
      loadNetworkAccess(),
    ]).then((results) => {
      if (!mounted) {
        return;
      }

      const workspaceResult = results[0];
      const benchResult = results[1];
      const networkResult = results[2];

      if (workspaceResult.status === "fulfilled") {
        setWorkspace(workspaceResult.value);
        setSelectedSiteId(workspaceResult.value.sites[0]?.id ?? null);
      }

      if (benchResult.status === "fulfilled") {
        setBench(benchResult.value);
      } else {
        setSetupMessage("Bench summary is not available. Start the backend and check BENCH_PATH.");
      }

      if (networkResult.status === "fulfilled") {
        setNetworkAccess(networkResult.value);
      } else {
        setAccessMessage("Network scan is not available. Start the backend or Electron IPC bridge.");
      }

      setLoading(false);
    });

    return () => {
      mounted = false;
    };
  }, []);

  const selectedSite = useMemo(
    () => workspace?.sites.find((site) => site.id === selectedSiteId) ?? null,
    [workspace?.sites, selectedSiteId]
  );
  const selectedModule = useMemo(
    () => modules.find((moduleItem) => moduleItem.key === selectedModuleKey) ?? null,
    [modules, selectedModuleKey]
  );
  const connected = workspace?.mode.toLowerCase().includes("live frappe") ?? false;
  const hero = pageCopy[page];

  useEffect(() => {
    if (!selectedSiteId) {
      setModules([]);
      return;
    }

    let mounted = true;

    loadFrappeModules(selectedSiteId)
      .then((items) => {
        if (!mounted) {
          return;
        }

        setModules(items);
        setSelectedModuleKey(items[0]?.key ?? "");
      })
      .catch((error) => {
        if (mounted) {
          setModules([]);
          setAutomationMessage(
            error instanceof Error ? error.message : "Could not load Frappe modules"
          );
        }
      });

    return () => {
      mounted = false;
    };
  }, [selectedSiteId]);

  async function refreshBench() {
    try {
      setBench(await loadBenchSummary());
    } catch (error) {
      setSetupMessage(error instanceof Error ? error.message : "Bench refresh failed");
    }
  }

  async function refreshNetworkAccess() {
    try {
      setNetworkAccess(await loadNetworkAccess());
      setAccessMessage("Network access data refreshed.");
    } catch (error) {
      setAccessMessage(error instanceof Error ? error.message : "Network access refresh failed");
    }
  }

  async function handleOpenAccessUrl(url: string) {
    try {
      await openAccessUrl(url);
      setAccessMessage(`Opened ${url}`);
    } catch (error) {
      setAccessMessage(error instanceof Error ? error.message : "Could not open URL");
    }
  }

  async function handleCopyAccessUrl(url: string) {
    try {
      await copyAccessText(url);
      setAccessMessage(`Copied ${url}`);
    } catch (error) {
      setAccessMessage(error instanceof Error ? error.message : "Could not copy URL");
    }
  }

  async function handleModuleAutomation(moduleItem: FrappeModule) {
    if (!selectedSiteId) {
      return;
    }

    setRunning(true);
    setAutomationMessage(`Starting ${moduleItem.title} automation...`);

    try {
      const result = await automateFrappeModule({
        site_id: selectedSiteId,
        module: moduleItem.module,
      });
      setAutomationMessage(result.message);
    } catch (error) {
      setAutomationMessage(
        error instanceof Error ? error.message : "Module automation failed"
      );
    } finally {
      setRunning(false);
    }
  }

  async function handleInstallApp(app: BenchApp) {
    const site = bench?.default_site ?? "";

    setInstallingKey(app.key);
    setSetupMessage(`Running bench setup for ${app.name}...`);

    try {
      const result = await installBenchApp({
        app_key: app.key,
        site_name: site,
        install_to_site: Boolean(site),
      });
      setSetupMessage(result.message);
      await refreshBench();
    } catch (error) {
      setSetupMessage(error instanceof Error ? error.message : "Bench app install failed");
    } finally {
      setInstallingKey("");
    }
  }

  async function handleCreateSite() {
    setCreatingSite(true);
    setSetupMessage(`Creating ${siteName} in Frappe Bench...`);

    try {
      const result = await createBenchSite({
        site_name: siteName,
        admin_password: adminPassword,
        db_root_username: dbRootUsername,
        db_root_password: dbRootPassword,
        install_apps: siteInstallApps,
      });
      setSetupMessage(result.message);
      await refreshBench();
    } catch (error) {
      setSetupMessage(error instanceof Error ? error.message : "Bench site create failed");
    } finally {
      setCreatingSite(false);
    }
  }

  function toggleSiteInstallApp(appKey: string) {
    setSiteInstallApps((current) =>
      current.includes(appKey)
        ? current.filter((key) => key !== appKey)
        : [...current, appKey]
    );
  }

  if (loading || !workspace) {
    return (
      <main className="loading-shell">
        <span className="loader" />
        <p>Preparing Doppio Box</p>
      </main>
    );
  }

  return (
    <main className="app-shell">
      <nav className="top-nav" aria-label="Doppio pages">
        <strong>Doppio Box</strong>
        <div>
          {pages.map((item) => (
            <button
              type="button"
              className={page === item.key ? "active" : ""}
              onClick={() => setPage(item.key)}
              key={item.key}
            >
              {item.label}
            </button>
          ))}
        </div>
      </nav>

      <section className="hero">
        <div className="hero-content">
          <p className="eyebrow">{hero.eyebrow}</p>
          <h1>{hero.title}</h1>
          <p className="hero-copy">{hero.copy}</p>
          <div className="hero-actions">
            <button type="button" className="primary-button" onClick={() => setPage("modules")}>
              Browse modules
            </button>
            <button type="button" className="secondary-button" onClick={() => setPage("setup")}>
              Configure bench
            </button>
          </div>
        </div>
      </section>

      <section className="status-strip" aria-label="Connection">
        <div>
          <span>Workspace</span>
          <strong>{workspace.site}</strong>
        </div>
        <div>
          <span>Frappe User</span>
          <strong>{workspace.user}</strong>
        </div>
        <div>
          <span>Mode</span>
          <strong>{workspace.mode}</strong>
        </div>
      </section>

      {!connected ? (
        <section className="notice-panel" aria-label="Frappe connection status">
          <strong>Frappe is not connected yet.</strong>
          <p>
            Add a real Frappe URL, API key, and API secret before treating
            module counts as live ERPNext data.
          </p>
        </section>
      ) : null}

      {page === "overview" ? (
        <OverviewPage
          workspace={workspace}
          bench={bench}
          selectedSiteId={selectedSiteId}
          onSelectSite={setSelectedSiteId}
          onOpenModules={() => setPage("modules")}
          onOpenSetup={() => setPage("setup")}
        />
      ) : null}

      {page === "modules" ? (
        <ModulesPage
          modules={modules}
          selectedModuleKey={selectedModuleKey}
          running={running}
          selectedSite={selectedSite}
          selectedSiteId={selectedSiteId}
          selectedModule={selectedModule}
          sites={workspace.sites}
          automationMessage={automationMessage}
          galleryModule={galleryModule}
          onSelectSite={setSelectedSiteId}
          onSelectModule={setSelectedModuleKey}
          onGallery={setGalleryModule}
          onAutomate={handleModuleAutomation}
        />
      ) : null}

      {page === "setup" ? (
        <SetupPage
          bench={bench}
          setupMessage={setupMessage}
          installingKey={installingKey}
          creatingSite={creatingSite}
          siteName={siteName}
          adminPassword={adminPassword}
          dbRootUsername={dbRootUsername}
          dbRootPassword={dbRootPassword}
          siteInstallApps={siteInstallApps}
          onRefreshBench={refreshBench}
          onInstallApp={handleInstallApp}
          onSiteName={setSiteName}
          onAdminPassword={setAdminPassword}
          onDbRootUsername={setDbRootUsername}
          onDbRootPassword={setDbRootPassword}
          onToggleSiteInstallApp={toggleSiteInstallApp}
          onCreateSite={handleCreateSite}
        />
      ) : null}

      {page === "access" ? (
        <AccessPage
          bench={bench}
          workspace={workspace}
          networkAccess={networkAccess}
          accessMessage={accessMessage}
          suggestion={suggestion}
          onRefresh={refreshNetworkAccess}
          onOpenUrl={handleOpenAccessUrl}
          onCopyUrl={handleCopyAccessUrl}
          onSuggestion={setSuggestion}
        />
      ) : null}
    </main>
  );
}

function OverviewPage({
  workspace,
  bench,
  selectedSiteId,
  onSelectSite,
  onOpenModules,
  onOpenSetup,
}: {
  workspace: WorkspaceData;
  bench: BenchSummary | null;
  selectedSiteId: number | null;
  onSelectSite: (siteId: number) => void;
  onOpenModules: () => void;
  onOpenSetup: () => void;
}) {
  return (
    <>
      <section className="metrics-grid" aria-label="Dashboard metrics">
        {workspace.metrics.map((metric) => (
          <article className="metric-card" key={metric.label}>
            <span>{metric.label}</span>
            <strong>{metric.value}</strong>
            <p>{metric.detail}</p>
          </article>
        ))}
      </section>

      <section className="workspace-grid">
        <article className="panel">
          <div className="section-heading">
            <p className="eyebrow">Managed Sites</p>
            <h2>Frappe and ERPNext cloud</h2>
          </div>
          <div className="site-list">
            {workspace.sites.map((site) => (
              <SiteRow
                selected={site.id === selectedSiteId}
                site={site}
                onSelect={() => onSelectSite(site.id)}
                key={site.id}
              />
            ))}
          </div>
        </article>

        <aside className="panel command-panel">
          <div className="section-heading">
            <p className="eyebrow">Bench Summary</p>
            <h2>{bench?.exists ? "Local bench ready" : "Bench not found"}</h2>
          </div>
          <div className="summary-list">
            <SummaryItem label="Bench path" value={bench?.bench_path ?? "Not loaded"} />
            <SummaryItem label="Installed apps" value={String(bench?.apps_installed ?? 0)} />
            <SummaryItem label="Sites" value={String(bench?.sites_count ?? 0)} />
            <SummaryItem label="Default site" value={bench?.default_site || "Not set"} />
          </div>
          <button type="button" className="run-button" onClick={onOpenModules}>
            Open module gallery
          </button>
          <button type="button" className="ghost-button" onClick={onOpenSetup}>
            Configure apps and sites
          </button>
        </aside>
      </section>
    </>
  );
}

function ModulesPage({
  modules,
  selectedModuleKey,
  running,
  selectedSite,
  selectedSiteId,
  selectedModule,
  sites,
  automationMessage,
  galleryModule,
  onSelectSite,
  onSelectModule,
  onGallery,
  onAutomate,
}: {
  modules: FrappeModule[];
  selectedModuleKey: string;
  running: boolean;
  selectedSite: ManagedSite | null;
  selectedSiteId: number | null;
  selectedModule: FrappeModule | null;
  sites: ManagedSite[];
  automationMessage: string;
  galleryModule: FrappeModule | null;
  onSelectSite: (siteId: number | null) => void;
  onSelectModule: (moduleKey: string) => void;
  onGallery: (moduleItem: FrappeModule | null) => void;
  onAutomate: (moduleItem: FrappeModule) => void;
}) {
  return (
    <>
      <section className="panel">
        <div className="section-heading">
          <p className="eyebrow">Frappe Gallery</p>
          <h2>Live module dashboard</h2>
        </div>
        {modules.length ? (
          <div className="module-grid">
            {modules.map((moduleItem) => (
              <article
                className={
                  moduleItem.key === selectedModuleKey
                    ? "module-card active"
                    : "module-card"
                }
                onMouseEnter={() => onGallery(moduleItem)}
                onFocus={() => onGallery(moduleItem)}
                key={moduleItem.key}
              >
                <button
                  type="button"
                  className="module-main"
                  onClick={() => {
                    onSelectModule(moduleItem.key);
                    onGallery(moduleItem);
                  }}
                >
                  <span>{moduleItem.module}</span>
                  <strong>{moduleItem.title}</strong>
                  <p>{moduleItem.preview}</p>
                  <small>{moduleItem.status}</small>
                </button>
                <div className="module-actions">
                  <a href={moduleItem.link_url} target="_blank" rel="noreferrer">
                    Open in Frappe
                  </a>
                  <button
                    type="button"
                    disabled={running}
                    onClick={() => onAutomate(moduleItem)}
                  >
                    Automate
                  </button>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <p className="empty-state">
            No live Frappe modules loaded. Confirm the API token and Frappe
            Bench server are running.
          </p>
        )}
      </section>

      {galleryModule ? (
        <section className="gallery-popup" aria-label="Module gallery preview">
          <button type="button" className="gallery-close" onClick={() => onGallery(null)}>
            Close
          </button>
          <span>{galleryModule.module}</span>
          <strong>{galleryModule.title}</strong>
          <p>{galleryModule.preview}</p>
          <a href={galleryModule.link_url} target="_blank" rel="noreferrer">
            Open short link
          </a>
        </section>
      ) : null}

      <section className="panel command-panel">
        <div className="section-heading">
          <p className="eyebrow">Backend Process</p>
          <h2>Run module automation</h2>
        </div>

        <label className="control-field">
          <span>ERPNext module</span>
          <select value={selectedModuleKey} onChange={(event) => onSelectModule(event.target.value)}>
            {modules.map((moduleItem) => (
              <option value={moduleItem.key} key={moduleItem.key}>
                {moduleItem.title}
              </option>
            ))}
          </select>
        </label>

        <label className="control-field">
          <span>Frappe site</span>
          <select
            value={selectedSiteId ?? ""}
            onChange={(event) =>
              onSelectSite(event.target.value ? Number(event.target.value) : null)
            }
          >
            {sites.map((site) => (
              <option value={site.id} key={site.id}>
                {site.name}
              </option>
            ))}
          </select>
        </label>

        <div className="selected-action">
          <span>Selected</span>
          <strong>{formatSelection(selectedModule, selectedSite)}</strong>
          <p>
            FastAPI checks the selected Frappe module and links directly to the
            ERPNext workspace.
          </p>
        </div>

        <button
          type="button"
          className="run-button"
          disabled={running || !selectedModule || !selectedSiteId}
          onClick={() => selectedModule && onAutomate(selectedModule)}
        >
          {running ? "Running process" : "Automate selected module"}
        </button>

        {automationMessage ? <p className="process-message">{automationMessage}</p> : null}
      </section>
    </>
  );
}

function SetupPage({
  bench,
  setupMessage,
  installingKey,
  creatingSite,
  siteName,
  adminPassword,
  dbRootUsername,
  dbRootPassword,
  siteInstallApps,
  onRefreshBench,
  onInstallApp,
  onSiteName,
  onAdminPassword,
  onDbRootUsername,
  onDbRootPassword,
  onToggleSiteInstallApp,
  onCreateSite,
}: {
  bench: BenchSummary | null;
  setupMessage: string;
  installingKey: string;
  creatingSite: boolean;
  siteName: string;
  adminPassword: string;
  dbRootUsername: string;
  dbRootPassword: string;
  siteInstallApps: string[];
  onRefreshBench: () => void;
  onInstallApp: (app: BenchApp) => void;
  onSiteName: (value: string) => void;
  onAdminPassword: (value: string) => void;
  onDbRootUsername: (value: string) => void;
  onDbRootPassword: (value: string) => void;
  onToggleSiteInstallApp: (appKey: string) => void;
  onCreateSite: () => void;
}) {
  return (
    <section className="workspace-grid setup-layout">
      <article className="panel">
        <div className="section-heading split-heading">
          <div>
            <p className="eyebrow">App Installer</p>
            <h2>ERPNext app catalog</h2>
          </div>
          <button type="button" className="secondary-button small-button" onClick={onRefreshBench}>
            Refresh
          </button>
        </div>
        <div className="setup-grid">
          {bench?.apps.map((app) => (
            <article className="setup-card" key={app.key}>
              <span>{app.category}</span>
              <strong>{app.name}</strong>
              <p>{app.description}</p>
              <small data-status={app.installed ? "installed" : "missing"}>
                {app.installed ? "installed in bench" : "ready to install"}
              </small>
              <code>{app.install_command}</code>
              <div className="module-actions">
                <a href={app.desk_url} target="_blank" rel="noreferrer">
                  Open
                </a>
                <button
                  type="button"
                  disabled={Boolean(installingKey)}
                  onClick={() => onInstallApp(app)}
                >
                  {installingKey === app.key ? "Running" : app.installed ? "Install on site" : "Install"}
                </button>
              </div>
            </article>
          )) ?? <p className="empty-state">Bench catalog is not loaded.</p>}
        </div>
      </article>

      <aside className="panel command-panel">
        <div className="section-heading">
          <p className="eyebrow">Create Site</p>
          <h2>New Frappe site</h2>
        </div>
        <label className="control-field">
          <span>Site name</span>
          <input value={siteName} onChange={(event) => onSiteName(event.target.value)} />
        </label>
        <label className="control-field">
          <span>Administrator password</span>
          <input
            type="password"
            value={adminPassword}
            onChange={(event) => onAdminPassword(event.target.value)}
          />
        </label>
        <label className="control-field">
          <span>MariaDB root username</span>
          <input
            value={dbRootUsername}
            onChange={(event) => onDbRootUsername(event.target.value)}
          />
        </label>
        <label className="control-field">
          <span>MariaDB root password</span>
          <input
            type="password"
            value={dbRootPassword}
            onChange={(event) => onDbRootPassword(event.target.value)}
          />
        </label>
        <div className="check-list">
          <span>Preinstall apps</span>
          {bench?.apps.slice(0, 4).map((app) => (
            <label key={app.key}>
              <input
                type="checkbox"
                checked={siteInstallApps.includes(app.key)}
                disabled={!app.installed}
                onChange={() => onToggleSiteInstallApp(app.key)}
              />
              {app.installed ? app.name : `${app.name} (install app first)`}
            </label>
          ))}
        </div>
        <button
          type="button"
          className="run-button"
          disabled={creatingSite || !siteName || !adminPassword}
          onClick={onCreateSite}
        >
          {creatingSite ? "Creating site" : "Create site with apps"}
        </button>
        {setupMessage ? <p className="process-message">{setupMessage}</p> : null}
      </aside>
    </section>
  );
}

function AccessPage({
  bench,
  workspace,
  networkAccess,
  accessMessage,
  suggestion,
  onRefresh,
  onOpenUrl,
  onCopyUrl,
  onSuggestion,
}: {
  bench: BenchSummary | null;
  workspace: WorkspaceData;
  networkAccess: NetworkAccessData | null;
  accessMessage: string;
  suggestion: string;
  onRefresh: () => void;
  onOpenUrl: (url: string) => void;
  onCopyUrl: (url: string) => void;
  onSuggestion: (value: string) => void;
}) {
  return (
    <>
      <section className="metrics-grid" aria-label="Network overview">
        <article className="metric-card">
          <span>Device Name</span>
          <strong>{networkAccess?.hostname ?? "Unknown"}</strong>
          <p>Hostname from the system network layer.</p>
        </article>
        <article className="metric-card">
          <span>Local IP</span>
          <strong>{networkAccess?.ip ?? "Not detected"}</strong>
          <p>Primary IPv4 address, excluding 127.0.0.1.</p>
        </article>
        <article className="metric-card">
          <span>Localhost</span>
          <strong>{networkAccess?.localhost ?? "127.0.0.1"}</strong>
          <p>Loopback access for local-only services.</p>
        </article>
        <article className="metric-card">
          <span>Running Services</span>
          <strong>{networkAccess?.services.length ?? 0}</strong>
          <p>Active listening ports detected from the system.</p>
        </article>
      </section>

      <section className="panel">
        <div className="section-heading split-heading">
          <div>
            <p className="eyebrow">Network Access Center</p>
            <h2>Running apps and services</h2>
          </div>
          <button type="button" className="secondary-button small-button" onClick={onRefresh}>
            Rescan
          </button>
        </div>

        {networkAccess?.services.length ? (
          <div className="service-grid">
            {networkAccess.services.map((service) => (
              <ServiceCard
                service={service}
                onOpenUrl={onOpenUrl}
                onCopyUrl={onCopyUrl}
                onSuggestion={onSuggestion}
                key={`${service.port}-${service.bind_address}`}
              />
            ))}
          </div>
        ) : (
          <p className="empty-state">
            No listening ports detected. Start Frappe, Vite, FastAPI, or MariaDB
            and rescan this page.
          </p>
        )}

        {suggestion ? (
          <div className="suggestion-panel">
            <span>Command Suggestion</span>
            <code>{suggestion}</code>
          </div>
        ) : null}

        {accessMessage ? <p className="process-message">{accessMessage}</p> : null}
      </section>

      <section className="workspace-grid">
        <article className="panel">
          <div className="section-heading">
            <p className="eyebrow">Network Interfaces</p>
            <h2>Device addresses</h2>
          </div>
          <div className="access-grid">
            {networkAccess?.interfaces.map((item) => (
              <article className="access-card" key={`${item.name}-${item.address}`}>
                <span>{item.name}</span>
                <strong>{item.address}</strong>
                <p>{item.family} {item.internal ? "internal" : "network"}</p>
              </article>
            )) ?? <p className="empty-state">Network interfaces are not loaded.</p>}
          </div>
        </article>

        <aside className="panel">
          <div className="section-heading">
            <p className="eyebrow">Known Access</p>
            <h2>Doppio and Frappe links</h2>
          </div>
          <div className="access-grid">
            {bench?.access_urls.map((item) => (
              <a href={item.url} target="_blank" rel="noreferrer" className="access-card" key={item.label}>
                <span>{item.label}</span>
                <strong>{item.url}</strong>
                <p>{item.detail}</p>
              </a>
            )) ?? <p className="empty-state">Access links are not loaded.</p>}
          </div>
        </aside>
      </section>

      <section className="workspace-grid">
        <article className="panel">
          <div className="section-heading">
            <p className="eyebrow">Sites</p>
            <h2>Bench and Doppio sites</h2>
          </div>
          <div className="site-list">
            {bench?.sites.map((site) => (
              <a className="site-row" href={site.desk_url} target="_blank" rel="noreferrer" key={site.name}>
                <div>
                  <strong>{site.name}</strong>
                  <p>{site.path}</p>
                </div>
                <span data-status={site.config_found ? "ready" : "needs_setup"}>bench</span>
              </a>
            ))}
            {workspace.sites.map((site) => (
              <a className="site-row" href={site.url} target="_blank" rel="noreferrer" key={site.id}>
                <div>
                  <strong>{site.name}</strong>
                  <p>{site.url}</p>
                </div>
                <span data-status={site.status}>{site.environment}</span>
              </a>
            ))}
          </div>
        </article>

        <aside className="notice-panel warning-panel">
          <strong>Security boundary</strong>
          <p>
            Doppio only displays network information here. It does not expose
            services automatically. Keep database ports such as 3306 and 6379
            local unless you have firewall rules and hardened credentials.
          </p>
        </aside>
      </section>
    </>
  );
}

function ServiceCard({
  service,
  onOpenUrl,
  onCopyUrl,
  onSuggestion,
}: {
  service: NetworkService;
  onOpenUrl: (url: string) => void;
  onCopyUrl: (url: string) => void;
  onSuggestion: (value: string) => void;
}) {
  const statusText =
    service.status === "network-accessible"
      ? "Running / Network Accessible"
      : "Running / Local Only";

  return (
    <article className="service-card">
      <div className="service-card-head">
        <div>
          <span>{service.bind_address}</span>
          <strong>{service.name}</strong>
        </div>
        <small data-status={service.status}>{statusText}</small>
      </div>
      <p>Port {service.port}</p>
      <div className="url-list">
        <label>
          Local URL
          <code>{service.local_url}</code>
        </label>
        <label>
          Network URL
          <code>{service.network_url}</code>
        </label>
      </div>
      {service.warning ? <p className="security-warning">{service.warning}</p> : null}
      <div className="service-actions">
        <button type="button" onClick={() => onOpenUrl(service.local_url)}>
          Open in Browser
        </button>
        <button type="button" onClick={() => onCopyUrl(service.network_url)}>
          Copy URL
        </button>
        <button
          type="button"
          disabled={!service.command_suggestion}
          onClick={() => onSuggestion(service.command_suggestion)}
        >
          Show Command Suggestion
        </button>
      </div>
    </article>
  );
}

function SiteRow({
  site,
  selected,
  onSelect,
}: {
  site: ManagedSite;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      className={selected ? "site-row active" : "site-row"}
      onClick={onSelect}
    >
      <div>
        <strong>{site.name}</strong>
        <p>{site.url}</p>
      </div>
      <span data-status={site.status}>{site.environment}</span>
    </button>
  );
}

function SummaryItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function formatSelection(moduleItem: FrappeModule | null, site: ManagedSite | null) {
  if (!moduleItem || !site) {
    return "Select a module and site";
  }

  return `${moduleItem.title} on ${site.name}`;
}

export default App;
