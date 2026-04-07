from sqlalchemy import select
from sqlalchemy.orm import Session

from .config import get_settings
from .models import AppModule, ManagedSite


DEFAULT_APPS = [
  {
    "key": "website_leads",
    "name": "Website Leads",
    "description": "Capture website enquiries and prepare Lead records in ERPNext.",
    "doctype": "Lead",
  },
  {
    "key": "sales_invoices",
    "name": "Sales Invoices",
    "description": "Review unpaid invoices and prepare follow-up runs.",
    "doctype": "Sales Invoice",
  },
  {
    "key": "tasks_projects",
    "name": "Tasks and Projects",
    "description": "Track open project tasks and operational work queues.",
    "doctype": "Task",
  },
  {
    "key": "stock_items",
    "name": "Stock Items",
    "description": "Read item counts and keep site catalogue checks together.",
    "doctype": "Item",
  },
  {
    "key": "support_tickets",
    "name": "Support Tickets",
    "description": "Monitor Issue records for customer support automation.",
    "doctype": "Issue",
  },
  {
    "key": "website_pages",
    "name": "Website Pages",
    "description": "Track published website pages from the connected Frappe site.",
    "doctype": "Web Page",
  },
]


def seed_defaults(session: Session) -> None:
  settings = get_settings()

  for app_data in DEFAULT_APPS:
    existing_app = session.scalar(
      select(AppModule).where(AppModule.key == app_data["key"])
    )
    if not existing_app:
      session.add(AppModule(**app_data))

  has_site = session.scalar(select(ManagedSite))
  if not has_site:
    session.add(
      ManagedSite(
        name="Primary ERPNext Site",
        url=settings.frappe_site_url or "https://your-frappe-site.example.com",
        environment="cloud",
        status="ready" if settings.frappe_api_key else "needs_setup",
        api_key=settings.frappe_api_key,
        api_secret=settings.frappe_api_secret,
      )
    )

  session.commit()
