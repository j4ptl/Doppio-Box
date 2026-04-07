import { useEffect, useMemo, useState } from "react";
import {
  BenchApp,
  BenchCommandResult,
  BenchSummary,
  FrappeModule,
  ManagedSite,
  TerminalCommandAction,
  WorkspaceData,
  automateFrappeModule,
  createBenchSite,
  installBenchApp,
  loadBenchSummary,
  loadFrappeModules,
  loadWorkspaceData,
  runManualTerminalCommand,
  runOwnerOsTerminalCommand,
  runTerminalCommand,
  runTerminalDiagnostics,
  selectBenchFolder,
  setBenchPath,
  startBench,
} from "./lib/doppioApi";

type Page = "overview" | "modules" | "setup" | "access";
type ThemeMode = "light" | "dark";

const themeStorageKey = "doppio.theme";

const pages: Array<{ key: Page; label: string }> = [
  { key: "overview", label: "Overview" },
  { key: "modules", label: "Modules" },
  { key: "setup", label: "Setup" },
  { key: "access", label: "Terminal" },
];

const pageCopy: Record<Page, { eyebrow: string; title: string; copy: string }> = {
  overview: {
    eyebrow: "Frappe ERPNext Control",
    title: "Doppio Box cloud control desk.",
    copy: "Manage live Frappe modules, bench apps, local sites, and local automation from one workspace.",
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
    eyebrow: "Local Automation Terminal",
    title: "Run bench work without manual commands.",
    copy: "Install apps, create sites, and automate Frappe modules from Doppio buttons while the mini terminal shows local backend output.",
  },
};

type PageRendererProps = {
  page: Page;
  workspace: WorkspaceData;
  bench: BenchSummary | null;
  modules: FrappeModule[];
  selectedSite: ManagedSite | null;
  selectedSiteId: number | null;
  selectedModule: FrappeModule | null;
  selectedModuleKey: string;
  running: boolean;
  automationMessage: string;
  galleryModule: FrappeModule | null;
  setupMessage: string;
  installingKey: string;
  creatingSite: boolean;
  siteName: string;
  adminPassword: string;
  dbRootUsername: string;
  dbRootPassword: string;
  siteInstallApps: string[];
  benchPathInput: string;
  benchPathSaving: boolean;
  benchStarting: boolean;
  terminalLog: string[];
  terminalCommandInput: string;
  ownerCommandInput: string;
  ownerTerminalToken: string;
  terminalAction: TerminalCommandAction;
  terminalSiteName: string;
  terminalRunning: boolean;
  onNavigate: (page: Page) => void;
  onSelectSite: (siteId: number | null) => void;
  onSelectModule: (moduleKey: string) => void;
  onGallery: (moduleItem: FrappeModule | null) => void;
  onAutomate: (moduleItem: FrappeModule) => void;
  onRefreshBench: () => void;
  onInstallApp: (app: BenchApp) => void;
  onSiteName: (value: string) => void;
  onAdminPassword: (value: string) => void;
  onDbRootUsername: (value: string) => void;
  onDbRootPassword: (value: string) => void;
  onToggleSiteInstallApp: (appKey: string) => void;
  onCreateSite: () => void;
  onBenchPathInput: (value: string) => void;
  onSelectBenchPath: () => void;
  onSaveBenchPath: () => void;
  onStartBench: () => void;
  onTerminalCommandInput: (value: string) => void;
  onOwnerCommandInput: (value: string) => void;
  onOwnerTerminalToken: (value: string) => void;
  onManualTerminalCommand: () => void;
  onOwnerOsCommand: () => void;
  onDiagnoseIssue: () => void;
  onTerminalAction: (action: TerminalCommandAction) => void;
  onTerminalSiteName: (siteName: string) => void;
  onRunTerminalCommand: () => void;
  onClearTerminal: () => void;
};

function App() {
  const [workspace, setWorkspace] = useState<WorkspaceData | null>(null);
  const [bench, setBench] = useState<BenchSummary | null>(null);
  const [modules, setModules] = useState<FrappeModule[]>([]);
  const [page, setPage] = useState<Page>(loadInitialPage);
  const [theme, setTheme] = useState<ThemeMode>(loadTheme);
  const [loading, setLoading] = useState(true);
  const [selectedSiteId, setSelectedSiteId] = useState<number | null>(null);
  const [selectedModuleKey, setSelectedModuleKey] = useState("");
  const [galleryModule, setGalleryModule] = useState<FrappeModule | null>(null);
  const [running, setRunning] = useState(false);
  const [automationMessage, setAutomationMessage] = useState("");
  const [setupMessage, setSetupMessage] = useState("");
  const [terminalLog, setTerminalLog] = useState<string[]>([
    "Doppio local terminal ready.",
    "Use setup and module buttons to run bench automation through the backend.",
  ]);
  const [terminalCommandInput, setTerminalCommandInput] = useState("bench --version");
  const [ownerCommandInput, setOwnerCommandInput] = useState("pwd");
  const [ownerTerminalToken, setOwnerTerminalToken] = useState("");
  const [terminalAction, setTerminalAction] =
    useState<TerminalCommandAction>("bench-version");
  const [terminalSiteName, setTerminalSiteName] = useState("");
  const [terminalRunning, setTerminalRunning] = useState(false);
  const [installingKey, setInstallingKey] = useState("");
  const [creatingSite, setCreatingSite] = useState(false);
  const [benchPathInput, setBenchPathInput] = useState("");
  const [benchPathSaving, setBenchPathSaving] = useState(false);
  const [benchStarting, setBenchStarting] = useState(false);
  const [siteName, setSiteName] = useState("new-site.local");
  const [adminPassword, setAdminPassword] = useState("");
  const [dbRootUsername, setDbRootUsername] = useState("root");
  const [dbRootPassword, setDbRootPassword] = useState("");
  const [siteInstallApps, setSiteInstallApps] = useState<string[]>(["erpnext"]);

  useEffect(() => {
    let mounted = true;

    Promise.allSettled([loadWorkspaceData(), loadBenchSummary()]).then((results) => {
      if (!mounted) {
        return;
      }

      const workspaceResult = results[0];
      const benchResult = results[1];

      if (workspaceResult.status === "fulfilled") {
        setWorkspace(workspaceResult.value);
        setSelectedSiteId(workspaceResult.value.sites[0]?.id ?? null);
      }

      if (benchResult.status === "fulfilled") {
        setBench(benchResult.value);
        setTerminalSiteName(benchResult.value.default_site || benchResult.value.sites[0]?.name || "");
      } else {
        setSetupMessage("Bench summary is not available. Start the backend and check BENCH_PATH.");
      }

      setLoading(false);
    });

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem(themeStorageKey, theme);
  }, [theme]);

  useEffect(() => {
    function onHashChange() {
      setPage(loadInitialPage());
    }

    window.addEventListener("hashchange", onHashChange);

    return () => {
      window.removeEventListener("hashchange", onHashChange);
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

  function appendTerminalLog(lines: string | string[]) {
    const entries = Array.isArray(lines) ? lines : [lines];

    setTerminalLog((current) => [...current, ...entries].slice(-120));
  }

  function appendBenchResult(result: BenchCommandResult) {
    appendTerminalLog([
      `$ ${result.command.join(" ")}`,
      result.message,
      ...(result.output.trim() ? result.output.trim().split("\n").slice(-40) : []),
    ]);
  }

  function clearTerminalLog() {
    setTerminalLog(["Doppio local terminal cleared."]);
  }

  async function handleRunTerminalCommand() {
    setTerminalRunning(true);
    appendTerminalLog(
      `$ doppio-terminal ${terminalAction}${terminalSiteName ? ` --site ${terminalSiteName}` : ""}`
    );

    try {
      const result = await runTerminalCommand({
        action: terminalAction,
        site_name: terminalSiteName,
      });
      appendBenchResult(result);
    } catch (error) {
      appendTerminalLog(
        `ERROR: ${error instanceof Error ? error.message : "Terminal command failed"}`
      );
    } finally {
      setTerminalRunning(false);
    }
  }

  async function handleManualTerminalCommand() {
    const command = terminalCommandInput.trim();

    if (!command) {
      appendTerminalLog("ERROR: Enter a bench command first.");
      return;
    }

    setTerminalRunning(true);
    appendTerminalLog(`$ ${command}`);

    try {
      const result = await runManualTerminalCommand({ command });
      appendBenchResult(result);
    } catch (error) {
      appendTerminalLog(
        `ERROR: ${error instanceof Error ? error.message : "Manual terminal command failed"}`
      );
    } finally {
      setTerminalRunning(false);
    }
  }

  async function handleOwnerOsCommand() {
    const command = ownerCommandInput.trim();

    if (!command) {
      appendTerminalLog("ERROR: Enter an owner OS command first.");
      return;
    }

    setTerminalRunning(true);
    appendTerminalLog(`$ owner-os ${command}`);

    try {
      const result = await runOwnerOsTerminalCommand({
        command,
        token: ownerTerminalToken,
      });
      appendBenchResult(result);
    } catch (error) {
      appendTerminalLog(
        `ERROR: ${error instanceof Error ? error.message : "Owner OS terminal command failed"}`
      );
    } finally {
      setTerminalRunning(false);
    }
  }

  async function handleDiagnoseIssue() {
    setTerminalRunning(true);
    appendTerminalLog("$ doppio diagnose");

    try {
      const result = await runTerminalDiagnostics();
      appendBenchResult(result);
    } catch (error) {
      appendTerminalLog(
        `ERROR: ${error instanceof Error ? error.message : "Terminal diagnostics failed"}`
      );
    } finally {
      setTerminalRunning(false);
    }
  }

  async function handleSaveBenchPath() {
    if (!benchPathInput.trim()) {
      appendTerminalLog("ERROR: Enter a Frappe Bench folder path first.");
      return;
    }

    setBenchPathSaving(true);
    setSetupMessage("Validating Frappe Bench folder...");
    appendTerminalLog("$ doppio set-bench-path ********");

    try {
      const result = await setBenchPath({ path: benchPathInput.trim() });
      setSetupMessage(result.message);
      appendBenchResult(result);
      await refreshBench();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Bench path update failed";
      setSetupMessage(message);
      appendTerminalLog(`ERROR: ${message}`);
    } finally {
      setBenchPathSaving(false);
    }
  }

  async function handleSelectBenchPath() {
    const selectedPath = await selectBenchFolder();

    if (!selectedPath) {
      appendTerminalLog("Folder picker is available in Electron mode. In browser mode, paste the bench path manually.");
      return;
    }

    setBenchPathInput(selectedPath);
    appendTerminalLog("$ doppio selected bench folder");
  }

  async function handleStartBench() {
    setBenchStarting(true);
    setSetupMessage("Starting Frappe Bench from Doppio...");
    appendTerminalLog("$ bench start");

    try {
      const result = await startBench();
      setSetupMessage(result.message);
      appendBenchResult(result);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Bench start failed";
      setSetupMessage(message);
      appendTerminalLog(`ERROR: ${message}`);
    } finally {
      setBenchStarting(false);
    }
  }

  async function handleModuleAutomation(moduleItem: FrappeModule) {
    if (!selectedSiteId) {
      return;
    }

    setRunning(true);
    setAutomationMessage(`Starting ${moduleItem.title} automation...`);
    appendTerminalLog(`$ automate frappe module "${moduleItem.module}" on site ${selectedSiteId}`);

    try {
      const result = await automateFrappeModule({
        site_id: selectedSiteId,
        module: moduleItem.module,
      });
      setAutomationMessage(result.message);
      appendTerminalLog([
        result.message,
        `Module: ${result.module}`,
        `DocTypes available: ${result.doctype_count}`,
        `Status: ${result.status}`,
      ]);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Module automation failed";
      setAutomationMessage(message);
      appendTerminalLog(`ERROR: ${message}`);
    } finally {
      setRunning(false);
    }
  }

  async function handleInstallApp(app: BenchApp) {
    const site = bench?.default_site ?? "";

    setInstallingKey(app.key);
    setSetupMessage(`Running bench setup for ${app.name}...`);
    appendTerminalLog(`$ install app "${app.name}"${site ? ` on ${site}` : ""}`);

    try {
      const result = await installBenchApp({
        app_key: app.key,
        site_name: site,
        install_to_site: Boolean(site),
      });
      setSetupMessage(result.message);
      appendBenchResult(result);
      await refreshBench();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Bench app install failed";
      setSetupMessage(message);
      appendTerminalLog(`ERROR: ${message}`);
    } finally {
      setInstallingKey("");
    }
  }

  async function handleCreateSite() {
    setCreatingSite(true);
    setSetupMessage(`Creating ${siteName} in Frappe Bench...`);
    appendTerminalLog(`$ create site "${siteName}" with apps: ${siteInstallApps.join(", ") || "none"}`);

    try {
      const result = await createBenchSite({
        site_name: siteName,
        admin_password: adminPassword,
        db_root_username: dbRootUsername,
        db_root_password: dbRootPassword,
        install_apps: siteInstallApps,
      });
      setSetupMessage(result.message);
      appendBenchResult(result);
      await refreshBench();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Bench site create failed";
      setSetupMessage(message);
      appendTerminalLog(`ERROR: ${message}`);
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

  function navigatePage(nextPage: Page) {
    setPage(nextPage);
    window.history.replaceState(null, "", `#${nextPage}`);
  }

  function toggleTheme() {
    setTheme((current) => (current === "dark" ? "light" : "dark"));
  }

  if (loading || !workspace) {
    return (
      <main className="loading-shell">
        <span className="loader" />
        <p>Preparing Doppio Box</p>
      </main>
    );
  }

  const renderedPage = renderPage({
    page,
    workspace,
    bench,
    modules,
    selectedSite,
    selectedSiteId,
    selectedModule,
    selectedModuleKey,
    running,
    automationMessage,
    galleryModule,
    setupMessage,
    installingKey,
    creatingSite,
    siteName,
    adminPassword,
    dbRootUsername,
    dbRootPassword,
    siteInstallApps,
    benchPathInput,
    benchPathSaving,
    benchStarting,
    terminalLog,
    terminalCommandInput,
    ownerCommandInput,
    ownerTerminalToken,
    terminalAction,
    terminalSiteName,
    terminalRunning,
    onNavigate: navigatePage,
    onSelectSite: setSelectedSiteId,
    onSelectModule: setSelectedModuleKey,
    onGallery: setGalleryModule,
    onAutomate: handleModuleAutomation,
    onRefreshBench: refreshBench,
    onInstallApp: handleInstallApp,
    onSiteName: setSiteName,
    onAdminPassword: setAdminPassword,
    onDbRootUsername: setDbRootUsername,
    onDbRootPassword: setDbRootPassword,
    onToggleSiteInstallApp: toggleSiteInstallApp,
    onCreateSite: handleCreateSite,
    onBenchPathInput: setBenchPathInput,
    onSelectBenchPath: handleSelectBenchPath,
    onSaveBenchPath: handleSaveBenchPath,
    onStartBench: handleStartBench,
    onTerminalCommandInput: setTerminalCommandInput,
    onOwnerCommandInput: setOwnerCommandInput,
    onOwnerTerminalToken: setOwnerTerminalToken,
    onManualTerminalCommand: handleManualTerminalCommand,
    onOwnerOsCommand: handleOwnerOsCommand,
    onDiagnoseIssue: handleDiagnoseIssue,
    onTerminalAction: setTerminalAction,
    onTerminalSiteName: setTerminalSiteName,
    onRunTerminalCommand: handleRunTerminalCommand,
    onClearTerminal: clearTerminalLog,
  });

  return (
    <main className={`app-shell page-${page}`}>
      <nav className="top-nav" aria-label="Doppio pages">
        <strong>Doppio Box</strong>
        <div className="nav-actions">
          {pages.map((item) => (
            <button
              type="button"
              className={page === item.key ? "active" : ""}
              onClick={() => navigatePage(item.key)}
              key={item.key}
            >
              {item.label}
            </button>
          ))}
        </div>
        <button type="button" className="theme-toggle" onClick={toggleTheme}>
          {theme === "dark" ? "Light mode" : "Dark mode"}
        </button>
      </nav>

      <section className="hero">
        <div className="hero-content">
          <p className="eyebrow">{hero.eyebrow}</p>
          <h1>{hero.title}</h1>
          <p className="hero-copy">{hero.copy}</p>
          <div className="hero-actions">
            <button type="button" className="primary-button" onClick={() => navigatePage("modules")}>
              <span>Browse modules</span>
              <span aria-hidden="true" className="button-arrow" />
            </button>
            <button type="button" className="secondary-button" onClick={() => navigatePage("setup")}>
              <span>Configure bench</span>
              <span aria-hidden="true" className="button-arrow" />
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

      <section className="page-frame" aria-label={`${pages.find((item) => item.key === page)?.label ?? "Doppio"} page`}>
        {renderedPage}
      </section>
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
            <SummaryItem label="Bench connection" value={bench?.exists ? "Configured" : "Not loaded"} />
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

function renderPage(props: PageRendererProps) {
  switch (props.page) {
    case "overview":
      return (
        <OverviewPage
          workspace={props.workspace}
          bench={props.bench}
          selectedSiteId={props.selectedSiteId}
          onSelectSite={(siteId) => props.onSelectSite(siteId)}
          onOpenModules={() => props.onNavigate("modules")}
          onOpenSetup={() => props.onNavigate("setup")}
        />
      );
    case "modules":
      return (
        <ModulesPage
          modules={props.modules}
          selectedModuleKey={props.selectedModuleKey}
          running={props.running}
          selectedSite={props.selectedSite}
          selectedSiteId={props.selectedSiteId}
          selectedModule={props.selectedModule}
          sites={props.workspace.sites}
          automationMessage={props.automationMessage}
          galleryModule={props.galleryModule}
          onSelectSite={props.onSelectSite}
          onSelectModule={props.onSelectModule}
          onGallery={props.onGallery}
          onAutomate={props.onAutomate}
        />
      );
    case "setup":
      return (
        <SetupPage
          bench={props.bench}
          setupMessage={props.setupMessage}
          installingKey={props.installingKey}
          creatingSite={props.creatingSite}
          siteName={props.siteName}
          adminPassword={props.adminPassword}
          dbRootUsername={props.dbRootUsername}
          dbRootPassword={props.dbRootPassword}
          siteInstallApps={props.siteInstallApps}
          benchPathInput={props.benchPathInput}
          benchPathSaving={props.benchPathSaving}
          benchStarting={props.benchStarting}
          onRefreshBench={props.onRefreshBench}
          onInstallApp={props.onInstallApp}
          onSiteName={props.onSiteName}
          onAdminPassword={props.onAdminPassword}
          onDbRootUsername={props.onDbRootUsername}
          onDbRootPassword={props.onDbRootPassword}
          onToggleSiteInstallApp={props.onToggleSiteInstallApp}
          onCreateSite={props.onCreateSite}
          onBenchPathInput={props.onBenchPathInput}
          onSelectBenchPath={props.onSelectBenchPath}
          onSaveBenchPath={props.onSaveBenchPath}
          onStartBench={props.onStartBench}
        />
      );
    case "access":
      return (
        <TerminalPage
          bench={props.bench}
          workspace={props.workspace}
          modules={props.modules}
          selectedModule={props.selectedModule}
          selectedModuleKey={props.selectedModuleKey}
          selectedSiteId={props.selectedSiteId}
          running={props.running}
          terminalLog={props.terminalLog}
          terminalCommandInput={props.terminalCommandInput}
          ownerCommandInput={props.ownerCommandInput}
          ownerTerminalToken={props.ownerTerminalToken}
          terminalAction={props.terminalAction}
          terminalSiteName={props.terminalSiteName}
          terminalRunning={props.terminalRunning}
          onNavigate={props.onNavigate}
          onSelectModule={props.onSelectModule}
          onAutomate={props.onAutomate}
          onStartBench={props.onStartBench}
          onTerminalCommandInput={props.onTerminalCommandInput}
          onOwnerCommandInput={props.onOwnerCommandInput}
          onOwnerTerminalToken={props.onOwnerTerminalToken}
          onManualTerminalCommand={props.onManualTerminalCommand}
          onOwnerOsCommand={props.onOwnerOsCommand}
          onDiagnoseIssue={props.onDiagnoseIssue}
          onTerminalAction={props.onTerminalAction}
          onTerminalSiteName={props.onTerminalSiteName}
          onRunTerminalCommand={props.onRunTerminalCommand}
          onClearTerminal={props.onClearTerminal}
        />
      );
    default:
      return null;
  }
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
                  <a
                    className="circle-action"
                    href={moduleItem.link_url}
                    target="_blank"
                    rel="noreferrer"
                    aria-label={`Open ${moduleItem.title} in Frappe`}
                    title={`Open ${moduleItem.title} in Frappe`}
                  >
                    <span aria-hidden="true" className="arrow-glyph" />
                  </a>
                  <button
                    type="button"
                    className="circle-action"
                    disabled={running}
                    onClick={() => onAutomate(moduleItem)}
                    aria-label={`Automate ${moduleItem.title}`}
                    title={`Automate ${moduleItem.title}`}
                  >
                    <span aria-hidden="true" className={running ? "loading-glyph" : "arrow-glyph"} />
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
  benchPathInput,
  benchPathSaving,
  benchStarting,
  onRefreshBench,
  onInstallApp,
  onSiteName,
  onAdminPassword,
  onDbRootUsername,
  onDbRootPassword,
  onToggleSiteInstallApp,
  onCreateSite,
  onBenchPathInput,
  onSelectBenchPath,
  onSaveBenchPath,
  onStartBench,
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
  benchPathInput: string;
  benchPathSaving: boolean;
  benchStarting: boolean;
  onRefreshBench: () => void;
  onInstallApp: (app: BenchApp) => void;
  onSiteName: (value: string) => void;
  onAdminPassword: (value: string) => void;
  onDbRootUsername: (value: string) => void;
  onDbRootPassword: (value: string) => void;
  onToggleSiteInstallApp: (appKey: string) => void;
  onCreateSite: () => void;
  onBenchPathInput: (value: string) => void;
  onSelectBenchPath: () => void;
  onSaveBenchPath: () => void;
  onStartBench: () => void;
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
        <div className="bench-path-box">
          <div>
            <span>Frappe Bench folder</span>
            <strong>{bench?.exists ? "Bench folder connected" : "Set bench folder"}</strong>
            <p>
              Select the local folder that contains the Frappe Bench `apps`,
              `sites`, and `Procfile`, then Doppio will run app and site
              automation inside that folder.
            </p>
          </div>
          <label className="control-field">
            <span>Bench path</span>
            <input
              value={benchPathInput}
              onChange={(event) => onBenchPathInput(event.target.value)}
              placeholder="/home/jenish/frappe16/frappe-bench16"
            />
          </label>
          <div className="inline-actions">
            <button
              type="button"
              className="secondary-button small-button"
              onClick={onSelectBenchPath}
            >
              Select folder
            </button>
            <button
              type="button"
              className="secondary-button small-button"
              disabled={benchPathSaving || !benchPathInput.trim()}
              onClick={onSaveBenchPath}
            >
              {benchPathSaving ? "Saving path" : "Use this bench folder"}
            </button>
            <button
              type="button"
              className="secondary-button small-button"
              disabled={benchStarting || !bench?.exists}
              onClick={onStartBench}
            >
              {benchStarting ? "Starting bench" : "Start Frappe Bench"}
            </button>
          </div>
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
                <a
                  className="circle-action"
                  href={app.desk_url}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={`Open ${app.name} in Frappe`}
                  title={`Open ${app.name} in Frappe`}
                >
                  <span aria-hidden="true" className="arrow-glyph" />
                </a>
                <button
                  type="button"
                  className="circle-action"
                  disabled={Boolean(installingKey)}
                  onClick={() => onInstallApp(app)}
                  aria-label={app.installed ? `Install ${app.name} on site` : `Install ${app.name}`}
                  title={app.installed ? `Install ${app.name} on site` : `Install ${app.name}`}
                >
                  <span
                    aria-hidden="true"
                    className={installingKey === app.key ? "loading-glyph" : "arrow-glyph"}
                  />
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

function TerminalPage({
  bench,
  workspace,
  modules,
  selectedModule,
  selectedModuleKey,
  selectedSiteId,
  running,
  terminalLog,
  terminalCommandInput,
  ownerCommandInput,
  ownerTerminalToken,
  terminalAction,
  terminalSiteName,
  terminalRunning,
  onNavigate,
  onSelectModule,
  onAutomate,
  onStartBench,
  onTerminalCommandInput,
  onOwnerCommandInput,
  onOwnerTerminalToken,
  onManualTerminalCommand,
  onOwnerOsCommand,
  onDiagnoseIssue,
  onTerminalAction,
  onTerminalSiteName,
  onRunTerminalCommand,
  onClearTerminal,
}: {
  bench: BenchSummary | null;
  workspace: WorkspaceData;
  modules: FrappeModule[];
  selectedModule: FrappeModule | null;
  selectedModuleKey: string;
  selectedSiteId: number | null;
  running: boolean;
  terminalLog: string[];
  terminalCommandInput: string;
  ownerCommandInput: string;
  ownerTerminalToken: string;
  terminalAction: TerminalCommandAction;
  terminalSiteName: string;
  terminalRunning: boolean;
  onNavigate: (page: Page) => void;
  onSelectModule: (moduleKey: string) => void;
  onAutomate: (moduleItem: FrappeModule) => void;
  onStartBench: () => void;
  onTerminalCommandInput: (value: string) => void;
  onOwnerCommandInput: (value: string) => void;
  onOwnerTerminalToken: (value: string) => void;
  onManualTerminalCommand: () => void;
  onOwnerOsCommand: () => void;
  onDiagnoseIssue: () => void;
  onTerminalAction: (action: TerminalCommandAction) => void;
  onTerminalSiteName: (siteName: string) => void;
  onRunTerminalCommand: () => void;
  onClearTerminal: () => void;
}) {
  const siteRequired = terminalActionRequiresSite(terminalAction);

  return (
    <>
      <section className="metrics-grid" aria-label="Local automation overview">
        <article className="metric-card">
          <span>Bench</span>
          <strong>{bench?.exists ? "Ready" : "Missing"}</strong>
          <p>Local Frappe Bench actions run through the Doppio backend.</p>
        </article>
        <article className="metric-card">
          <span>Installed Apps</span>
          <strong>{bench?.apps_installed ?? 0}</strong>
          <p>Apps detected in the local bench catalog.</p>
        </article>
        <article className="metric-card">
          <span>Sites</span>
          <strong>{bench?.sites_count ?? 0}</strong>
          <p>Sites detected from the local Frappe Bench.</p>
        </article>
        <article className="metric-card">
          <span>Live Modules</span>
          <strong>{modules.length}</strong>
          <p>ERPNext workspaces ready for button-based automation.</p>
        </article>
      </section>

      <section className="workspace-grid terminal-layout">
        <article className="panel terminal-panel">
          <div className="section-heading split-heading">
            <div>
              <p className="eyebrow">Doppio Terminal</p>
              <h2>Button-driven local automation</h2>
            </div>
            <button type="button" className="secondary-button small-button" onClick={onClearTerminal}>
              Clear
            </button>
          </div>
          <p className="privacy-note">
            IP, SSH, hostname, and network service sections are removed from this page.
            Doppio connects to the local OS terminal only through allowlisted backend actions.
          </p>
          <pre className="mini-terminal" aria-label="Automation terminal output">
            {terminalLog.map((line, index) => (
              <span className="terminal-line" key={`${line}-${index}`}>
                {line}
              </span>
            ))}
          </pre>
        </article>

        <aside className="panel command-panel">
          <div className="section-heading">
            <p className="eyebrow">Quick Actions</p>
            <h2>No manual terminal typing</h2>
          </div>
          <div className="selected-action">
            <span>Current workspace</span>
            <strong>{workspace.site}</strong>
            <p>{workspace.mode}</p>
          </div>
          <button type="button" className="run-button" onClick={() => onNavigate("setup")}>
            Create site or install apps
          </button>
          <button type="button" className="ghost-button" onClick={() => onNavigate("modules")}>
            Open module gallery
          </button>
          <button type="button" className="ghost-button" disabled={!bench?.exists} onClick={onStartBench}>
            Start Frappe Bench
          </button>
          <label className="control-field">
            <span>Automate module</span>
            <select value={selectedModuleKey} onChange={(event) => onSelectModule(event.target.value)}>
              {modules.map((moduleItem) => (
                <option value={moduleItem.key} key={moduleItem.key}>
                  {moduleItem.title}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            className="run-button"
            disabled={running || !selectedModule || !selectedSiteId}
            onClick={() => selectedModule && onAutomate(selectedModule)}
          >
            {running ? "Running automation" : "Automate selected module"}
          </button>

          <div className="terminal-runner">
            <p className="eyebrow">OS Terminal Bridge</p>
            <label className="control-field">
              <span>Manual bench command</span>
              <input
                list="bench-command-suggestions"
                value={terminalCommandInput}
                onChange={(event) => onTerminalCommandInput(event.target.value)}
                placeholder="bench --version"
              />
              <datalist id="bench-command-suggestions">
                {benchCommandSuggestions(terminalSiteName).map((suggestion) => (
                  <option value={suggestion} key={suggestion} />
                ))}
              </datalist>
            </label>
            <div className="command-suggestion-grid" aria-label="Command suggestions">
              {benchCommandSuggestions(terminalSiteName).map((suggestion) => (
                <button
                  type="button"
                  onClick={() => onTerminalCommandInput(suggestion)}
                  key={suggestion}
                >
                  {suggestion}
                </button>
              ))}
            </div>
            <button
              type="button"
              className="run-button"
              disabled={terminalRunning || !terminalCommandInput.trim()}
              onClick={onManualTerminalCommand}
            >
              {terminalRunning ? "Running command" : "Run typed command"}
            </button>
            <p className="privacy-note">
              Manual input is still protected: only allowlisted `bench`
              commands run, and shell operators are blocked.
            </p>

            <label className="control-field">
              <span>Owner OS command</span>
              <input
                list="owner-command-suggestions"
                value={ownerCommandInput}
                onChange={(event) => onOwnerCommandInput(event.target.value)}
                placeholder="pwd"
              />
              <datalist id="owner-command-suggestions">
                {ownerCommandSuggestions().map((suggestion) => (
                  <option value={suggestion} key={suggestion} />
                ))}
              </datalist>
            </label>
            <label className="control-field">
              <span>Owner token</span>
              <input
                type="password"
                value={ownerTerminalToken}
                onChange={(event) => onOwnerTerminalToken(event.target.value)}
                placeholder="DOPPIO_TERMINAL_TOKEN"
              />
            </label>
            <div className="command-suggestion-grid" aria-label="Owner command suggestions">
              {ownerCommandSuggestions().map((suggestion) => (
                <button
                  type="button"
                  onClick={() => onOwnerCommandInput(suggestion)}
                  key={suggestion}
                >
                  {suggestion}
                </button>
              ))}
            </div>
            <button
              type="button"
              className="run-button"
              disabled={terminalRunning || !ownerCommandInput.trim()}
              onClick={onOwnerOsCommand}
            >
              {terminalRunning ? "Running OS command" : "Run owner OS command"}
            </button>
            <button
              type="button"
              className="ghost-button"
              disabled={terminalRunning}
              onClick={onDiagnoseIssue}
            >
              Diagnose issue
            </button>
            <p className="privacy-note">
              Owner OS command mode requires `DOPPIO_TERMINAL_TOKEN` in the backend `.env`.
              It runs without shell expansion and blocks dangerous executables.
            </p>

            <label className="control-field">
              <span>Terminal action</span>
              <select
                value={terminalAction}
                onChange={(event) =>
                  onTerminalAction(event.target.value as TerminalCommandAction)
                }
              >
                <option value="bench-version">Bench version</option>
                <option value="bench-list-sites">List bench sites</option>
                <option value="bench-list-apps">List site apps</option>
                <option value="bench-migrate">Migrate selected site</option>
                <option value="bench-clear-cache">Clear selected site cache</option>
              </select>
            </label>
            <label className="control-field">
              <span>Bench site</span>
              <select
                value={terminalSiteName}
                onChange={(event) => onTerminalSiteName(event.target.value)}
              >
                <option value="">No site selected</option>
                {bench?.sites.map((site) => (
                  <option value={site.name} key={site.name}>
                    {site.name}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              className="run-button"
              disabled={terminalRunning || (siteRequired && !terminalSiteName)}
              onClick={onRunTerminalCommand}
            >
              {terminalRunning ? "Running terminal action" : "Run in mini terminal"}
            </button>
          </div>
        </aside>
      </section>

      <section className="panel">
        <div className="section-heading">
          <p className="eyebrow">Local Bench Scope</p>
          <h2>Automation boundary</h2>
        </div>
        <div className="terminal-action-grid">
          <article>
            <span>App install</span>
            <strong>Setup page button</strong>
            <p>Runs the backend bench install workflow for ERPNext, HRMS, CRM, Helpdesk, Payments, or Insights.</p>
          </article>
          <article>
            <span>Site create</span>
            <strong>Setup page form</strong>
            <p>Creates a local Frappe site and installs selected apps without making the user type bench commands.</p>
          </article>
          <article>
            <span>OS terminal bridge</span>
            <strong>Allowlisted commands</strong>
            <p>Runs selected local bench commands from the backend and writes stdout/stderr into the mini terminal.</p>
          </article>
        </div>
      </section>
    </>
  );
}

function terminalActionRequiresSite(action: TerminalCommandAction) {
  return action === "bench-list-apps" || action === "bench-migrate" || action === "bench-clear-cache";
}

function benchCommandSuggestions(siteName: string) {
  const site = siteName || "demo";

  return [
    "bench --version",
    "bench list-sites",
    "bench start",
    "bench doctor",
    `bench --site ${site} list-apps`,
    `bench --site ${site} migrate`,
    `bench --site ${site} clear-cache`,
    `bench --site ${site} clear-website-cache`,
    `bench --site ${site} install-app erpnext`,
  ];
}

function ownerCommandSuggestions() {
  return [
    "pwd",
    "ls -la",
    "ps -ef",
    "node --version",
    "npm --version",
    "npm run lint",
    "npm run build",
    "./env/bin/python -m compileall backend/app",
    "bench --version",
    "bench list-sites",
  ];
}

function loadTheme(): ThemeMode {
  const stored = localStorage.getItem(themeStorageKey);

  if (stored === "dark" || stored === "light") {
    return stored;
  }

  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function loadInitialPage(): Page {
  const hashPage = window.location.hash.replace("#", "");
  const found = pages.find((item) => item.key === hashPage);

  return found?.key ?? "overview";
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
