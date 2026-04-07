import json
from typing import Any

import httpx

from .models import ManagedSite


def site_has_credentials(site: ManagedSite) -> bool:
  return bool(site.api_key and site.api_secret and "example.com" not in site.url)


class FrappeClient:
  def __init__(self, timeout_seconds: float) -> None:
    self.timeout_seconds = timeout_seconds

  async def get_logged_user(self, site: ManagedSite) -> str:
    return await self.call_method(site, "frappe.auth.get_logged_user")

  async def get_count(self, site: ManagedSite, doctype: str) -> int:
    value = await self.call_method(
      site,
      "frappe.client.get_count",
      params={"doctype": doctype, "filters": "[]"},
    )
    return int(value)

  async def list_resources(
    self,
    site: ManagedSite,
    doctype: str,
    fields: list[str],
    filters: list[list[str]] | None = None,
    limit: int = 100,
  ) -> list[dict[str, Any]]:
    if not site_has_credentials(site):
      raise ValueError("Frappe site credentials are not configured")

    params = {
      "fields": json.dumps(fields),
      "limit_page_length": str(limit),
    }
    if filters:
      params["filters"] = json.dumps(filters)

    async with httpx.AsyncClient(timeout=self.timeout_seconds) as client:
      response = await client.get(
        f"{site.url.rstrip('/')}/api/resource/{doctype}",
        params=params,
        headers={
          "Authorization": f"token {site.api_key}:{site.api_secret}",
          "Accept": "application/json",
        },
      )
      response.raise_for_status()
      return response.json()["data"]

  async def call_method(
    self,
    site: ManagedSite,
    method: str,
    params: dict[str, str] | None = None,
  ) -> Any:
    if not site_has_credentials(site):
      raise ValueError("Frappe site credentials are not configured")

    async with httpx.AsyncClient(timeout=self.timeout_seconds) as client:
      response = await client.get(
        f"{site.url.rstrip('/')}/api/method/{method}",
        params=params,
        headers={
          "Authorization": f"token {site.api_key}:{site.api_secret}",
          "Accept": "application/json",
        },
      )
      response.raise_for_status()
      return response.json()["message"]
