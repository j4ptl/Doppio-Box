import re
import socket
import subprocess

from .schemas import NetworkAccessOut, NetworkInterfaceOut, NetworkServiceOut


SERVICE_NAMES = {
  8000: "Frappe/ERPNext",
  3000: "React/Vite",
  5173: "Doppio React/Vite",
  5000: "FastAPI/Uvicorn",
  8001: "Doppio FastAPI",
  3306: "MariaDB",
  6379: "Redis",
}

COMMAND_SUGGESTIONS = {
  8000: "bench start and ensure external binding when you intentionally need LAN access.",
  3000: "npm run dev -- --host 0.0.0.0 --port 3000",
  5173: "npm run dev -- --host 0.0.0.0",
  5000: "uvicorn main:app --host 0.0.0.0 --port 5000",
  8001: "uvicorn backend.app.main:app --host 0.0.0.0 --port 8001",
}

DATABASE_WARNINGS = {
  3306: "Database port. Do not expose MariaDB to the network unless firewall and credentials are hardened.",
  6379: "Database/cache port. Do not expose Redis to the network unless it is secured and firewalled.",
}


def build_network_access() -> NetworkAccessOut:
  hostname = socket.gethostname()
  interfaces = _interfaces()
  ip_address = _primary_ip(interfaces)
  services = _services(ip_address)

  return NetworkAccessOut(
    hostname=hostname,
    ip=ip_address,
    interfaces=interfaces,
    services=services,
  )


def _interfaces() -> list[NetworkInterfaceOut]:
  items: list[NetworkInterfaceOut] = [
    NetworkInterfaceOut(
      name="localhost",
      address="127.0.0.1",
      family="IPv4",
      internal=True,
    )
  ]
  seen = {"127.0.0.1"}

  for info in socket.getaddrinfo(socket.gethostname(), None, socket.AF_INET):
    address = info[4][0]

    if address in seen:
      continue

    seen.add(address)
    items.append(
      NetworkInterfaceOut(
        name="primary",
        address=address,
        family="IPv4",
        internal=address.startswith("127."),
      )
    )

  host_ip = _host_ip()

  if host_ip and host_ip not in seen:
    items.append(
      NetworkInterfaceOut(
        name="primary",
        address=host_ip,
        family="IPv4",
        internal=False,
      )
    )

  return items


def _primary_ip(interfaces: list[NetworkInterfaceOut]) -> str:
  for item in interfaces:
    if item.family == "IPv4" and not item.internal and item.address != "127.0.0.1":
      return item.address

  host_ip = _host_ip()

  if host_ip:
    return host_ip

  return "127.0.0.1"


def _services(ip_address: str) -> list[NetworkServiceOut]:
  listeners = _listening_ports()
  by_port: dict[int, dict[str, str | int]] = {}

  for listener in listeners:
    port = int(listener["port"])
    existing = by_port.get(port)

    if not existing:
      by_port[port] = listener
      continue

    if _is_network_bind(str(listener["bind_address"])) and not _is_network_bind(
      str(existing["bind_address"])
    ):
      by_port[port] = listener

  return [
    _service_out(port, str(listener["bind_address"]), ip_address)
    for port, listener in sorted(by_port.items())
  ]


def _service_out(port: int, bind_address: str, ip_address: str) -> NetworkServiceOut:
  network_accessible = _is_network_bind(bind_address)
  warning = DATABASE_WARNINGS.get(port, "")
  suggestion = ""

  if not network_accessible:
    suggestion = COMMAND_SUGGESTIONS.get(
      port,
      f"Restart the service on port {port} with host 0.0.0.0 only if LAN access is required.",
    )

  return NetworkServiceOut(
    name=SERVICE_NAMES.get(port, f"Port {port}"),
    port=port,
    bind_address=bind_address,
    local_url=f"http://localhost:{port}",
    network_url=f"http://{ip_address}:{port}",
    status="network-accessible" if network_accessible else "local-only",
    warning=warning,
    command_suggestion=suggestion,
  )


def _listening_ports() -> list[dict[str, str | int]]:
  try:
    completed = subprocess.run(
      ["ss", "-tulpn"],
      capture_output=True,
      check=False,
      text=True,
      timeout=5,
    )

    if completed.returncode == 0:
      parsed = _parse_ss(completed.stdout)

      if parsed:
        return parsed
  except (FileNotFoundError, subprocess.TimeoutExpired):
    pass

  try:
    completed = subprocess.run(
      ["lsof", "-i", "-P", "-n"],
      capture_output=True,
      check=False,
      text=True,
      timeout=5,
    )

    if completed.returncode == 0:
      return _parse_lsof(completed.stdout)
  except (FileNotFoundError, subprocess.TimeoutExpired):
    pass

  return []


def _parse_ss(output: str) -> list[dict[str, str | int]]:
  listeners: list[dict[str, str | int]] = []

  for line in output.splitlines():
    if "LISTEN" not in line:
      continue

    parts = line.split()

    if len(parts) < 5:
      continue

    local = parts[4]
    parsed = _split_address_port(local)

    if parsed:
      listeners.append(parsed)

  return listeners


def _parse_lsof(output: str) -> list[dict[str, str | int]]:
  listeners: list[dict[str, str | int]] = []

  for line in output.splitlines():
    if "LISTEN" not in line or "TCP" not in line:
      continue

    match = re.search(r"TCP\s+(.+?)\s+\(LISTEN\)", line)

    if not match:
      continue

    parsed = _split_address_port(match.group(1))

    if parsed:
      listeners.append(parsed)

  return listeners


def _split_address_port(value: str) -> dict[str, str | int] | None:
  normalized = value.strip()
  normalized = normalized.replace("[::]", "::").replace("[::1]", "::1")

  if normalized.startswith("*:"):
    bind_address = "0.0.0.0"
    port_text = normalized.rsplit(":", 1)[1]
  else:
    if ":" not in normalized:
      return None

    bind_address, port_text = normalized.rsplit(":", 1)

  if not port_text.isdigit():
    return None

  if bind_address in {"*", "::", "[::]"}:
    bind_address = "0.0.0.0"
  elif bind_address == "::1":
    bind_address = "127.0.0.1"
  elif bind_address.startswith("[") and bind_address.endswith("]"):
    bind_address = bind_address[1:-1]

  return {"bind_address": bind_address, "port": int(port_text)}


def _is_network_bind(bind_address: str) -> bool:
  return bind_address in {"0.0.0.0", "::"} or not bind_address.startswith("127.")


def _host_ip() -> str:
  try:
    with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as sock:
      sock.connect(("8.8.8.8", 80))
      ip_address = sock.getsockname()[0]

    if ip_address and not ip_address.startswith("127."):
      return ip_address
  except OSError:
    return ""

  return ""
