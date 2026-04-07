const { execFile } = require("node:child_process");
const os = require("node:os");

const serviceNames = {
  8000: "Frappe/ERPNext",
  3000: "React/Vite",
  5173: "Doppio React/Vite",
  5000: "FastAPI/Uvicorn",
  8001: "Doppio FastAPI",
  3306: "MariaDB",
  6379: "Redis",
};

const commandSuggestions = {
  8000: "bench start and ensure external binding when you intentionally need LAN access.",
  3000: "npm run dev -- --host 0.0.0.0 --port 3000",
  5173: "npm run dev -- --host 0.0.0.0",
  5000: "uvicorn main:app --host 0.0.0.0 --port 5000",
  8001: "uvicorn backend.app.main:app --host 0.0.0.0 --port 8001",
};

const databaseWarnings = {
  3306: "Database port. Do not expose MariaDB to the network unless firewall and credentials are hardened.",
  6379: "Database/cache port. Do not expose Redis to the network unless it is secured and firewalled.",
};

async function getNetworkAccess() {
  const interfaces = getInterfaces();
  const ip = getPrimaryIp(interfaces);
  const listeners = await getListeningPorts();
  const services = mergeByPort(listeners).map((listener) =>
    toService(listener, ip)
  );

  return {
    hostname: os.hostname(),
    ip,
    localhost: "127.0.0.1",
    interfaces,
    services,
  };
}

function getInterfaces() {
  const interfaces = [
    {
      name: "localhost",
      address: "127.0.0.1",
      family: "IPv4",
      internal: true,
    },
  ];
  const seen = new Set(["127.0.0.1"]);
  let systemInterfaces = {};

  try {
    systemInterfaces = os.networkInterfaces();
  } catch {
    return interfaces;
  }

  for (const [name, values] of Object.entries(systemInterfaces)) {
    for (const item of values || []) {
      if (item.family !== "IPv4" || seen.has(item.address)) {
        continue;
      }

      seen.add(item.address);
      interfaces.push({
        name,
        address: item.address,
        family: item.family,
        internal: item.internal,
      });
    }
  }

  return interfaces;
}

function getPrimaryIp(interfaces) {
  const primary = interfaces.find(
    (item) => item.family === "IPv4" && !item.internal && item.address !== "127.0.0.1"
  );

  return primary?.address || "127.0.0.1";
}

async function getListeningPorts() {
  try {
    const output = await runCommand("ss", ["-tulpn"]);
    const parsed = parseSs(output);

    if (parsed.length > 0) {
      return parsed;
    }
  } catch {
    // lsof fallback below
  }

  try {
    const output = await runCommand("lsof", ["-i", "-P", "-n"]);
    return parseLsof(output);
  } catch {
    return [];
  }
}

function runCommand(command, args) {
  return new Promise((resolve, reject) => {
    execFile(command, args, { timeout: 5000 }, (error, stdout, stderr) => {
      if (error) {
        reject(error);
        return;
      }

      resolve(`${stdout}${stderr}`);
    });
  });
}

function parseSs(output) {
  const listeners = [];

  for (const line of output.split(/\r?\n/)) {
    if (!line.includes("LISTEN")) {
      continue;
    }

    const parts = line.trim().split(/\s+/);

    if (parts.length < 5) {
      continue;
    }

    const parsed = splitAddressPort(parts[4]);

    if (parsed) {
      listeners.push(parsed);
    }
  }

  return listeners;
}

function parseLsof(output) {
  const listeners = [];

  for (const line of output.split(/\r?\n/)) {
    if (!line.includes("LISTEN") || !line.includes("TCP")) {
      continue;
    }

    const match = line.match(/TCP\s+(.+?)\s+\(LISTEN\)/);

    if (!match) {
      continue;
    }

    const parsed = splitAddressPort(match[1]);

    if (parsed) {
      listeners.push(parsed);
    }
  }

  return listeners;
}

function splitAddressPort(value) {
  let normalized = value.trim().replace("[::]", "::").replace("[::1]", "::1");
  let bindAddress;
  let portText;

  if (normalized.startsWith("*:")) {
    bindAddress = "0.0.0.0";
    portText = normalized.split(":").pop();
  } else {
    const index = normalized.lastIndexOf(":");

    if (index === -1) {
      return null;
    }

    bindAddress = normalized.slice(0, index);
    portText = normalized.slice(index + 1);
  }

  const port = Number(portText);

  if (!Number.isInteger(port)) {
    return null;
  }

  if (["*", "::", "[::]"].includes(bindAddress)) {
    bindAddress = "0.0.0.0";
  } else if (bindAddress === "::1") {
    bindAddress = "127.0.0.1";
  } else if (bindAddress.startsWith("[") && bindAddress.endsWith("]")) {
    bindAddress = bindAddress.slice(1, -1);
  }

  return { bind_address: bindAddress, port };
}

function mergeByPort(listeners) {
  const byPort = new Map();

  for (const listener of listeners) {
    const current = byPort.get(listener.port);

    if (!current || (isNetworkBind(listener.bind_address) && !isNetworkBind(current.bind_address))) {
      byPort.set(listener.port, listener);
    }
  }

  return [...byPort.values()].sort((left, right) => left.port - right.port);
}

function toService(listener, ip) {
  const networkAccessible = isNetworkBind(listener.bind_address);

  return {
    name: serviceNames[listener.port] || `Port ${listener.port}`,
    port: listener.port,
    protocol: "tcp",
    bind_address: listener.bind_address,
    local_url: `http://localhost:${listener.port}`,
    network_url: `http://${ip}:${listener.port}`,
    status: networkAccessible ? "network-accessible" : "local-only",
    warning: databaseWarnings[listener.port] || "",
    command_suggestion: networkAccessible
      ? ""
      : commandSuggestions[listener.port] ||
        `Restart the service on port ${listener.port} with host 0.0.0.0 only if LAN access is required.`,
  };
}

function isNetworkBind(bindAddress) {
  return ["0.0.0.0", "::"].includes(bindAddress) || !bindAddress.startsWith("127.");
}

module.exports = {
  getNetworkAccess,
};
