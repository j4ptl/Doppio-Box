# Doppio Box

Doppio Box is a Vite + React workspace with a Python FastAPI backend for managing Frappe and ERPNext cloud sites from one place. The backend stores managed sites, app modules, and automation run history in MariaDB.

## Frontend

```bash
npm install
npm run dev
```

Open the local URL printed by Vite. If the backend is not running, the frontend falls back to demo data.

## Backend And MariaDB

Start MariaDB and the FastAPI backend with Docker Compose:

```bash
cp .env.example .env
docker compose up --build
```

Set these values in `.env` before connecting a live Frappe site:

```bash
FRAPPE_SITE_URL=https://your-frappe-site.example.com
FRAPPE_API_KEY=your-api-key
FRAPPE_API_SECRET=your-api-secret
BACKEND_CORS_ORIGINS=http://localhost:5173,http://127.0.0.1:5173
VITE_BACKEND_URL=
BENCH_PATH=/home/jenish/frappe16/frappe-bench16
BENCH_COMMAND_TIMEOUT_SECONDS=900
```

During Vite development, leave `VITE_BACKEND_URL` empty. Vite proxies `/api` and `/health` to `http://127.0.0.1:8001`, so the UI can reach the backend without browser CORS or `localhost` mismatch problems. Keep `localhost:8000` free for Frappe Bench.

The backend exposes:

- `GET /health`
- `GET /api/workspace`
- `GET /api/frappe/modules`
- `POST /api/frappe/modules/automate`
- `GET /api/bench/summary`
- `POST /api/bench/apps/install`
- `POST /api/bench/sites/create`
- `GET /api/sites`
- `POST /api/sites`
- `POST /api/automations/run`

The backend calls Frappe REST methods with token authentication:

- `/api/method/frappe.auth.get_logged_user`
- `/api/method/frappe.client.get_count`
- `/api/resource/{doctype}`

The Doppio UI is split into Overview, Modules, Setup, and Access pages. The Modules page loads live Frappe Workspace records, shows each module as a gallery card, provides a short link to open the module directly in Frappe Desk, and runs backend automation checks per module.

The Setup page reads the local bench path from `BENCH_PATH`, shows installed apps, and provides bounded bench actions for known Frappe apps such as ERPNext, HRMS, CRM, Helpdesk, Payments, and Insights. The Create Site form runs `bench new-site` and can preinstall selected apps into the new site. Use the local backend process for bench actions because Docker containers need the bench folder mounted and the `bench` executable available.

## Local Backend Without Docker

Create the local MariaDB database and app user first:

```bash
sudo mariadb < backend/sql/init_local_mariadb.sql
```

Then start the backend:

```bash
python3 -m venv env
. env/bin/activate
pip install -r backend/requirements.txt
uvicorn backend.app.main:app --reload --port 8001
```

Then run the frontend in another terminal:

```bash
npm run dev
```

Local ports:

- Frappe Bench: `http://localhost:8000`
- Doppio backend API: `http://localhost:8001`
- Doppio UI: `http://localhost:5173`

The default local database URL is:

```bash
DATABASE_URL=mysql+pymysql://doppio:doppio@127.0.0.1:3306/doppio_box
```

If your MariaDB user or password is different, set `DATABASE_URL` in `.env`.

The default local bench path is:

```bash
BENCH_PATH=/home/jenish/frappe16/frappe-bench16
```

Change it in `.env` if your Frappe bench is in a different folder.

## Production Build

```bash
npm run build
npm run preview
```

For production, do not expose long-lived Frappe API secrets in browser code. Keep credentials in the backend or a cloud secret manager, and serve the frontend against the FastAPI API over HTTPS.
