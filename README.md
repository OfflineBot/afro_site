# Afro Sites

Score board for subjects rated on a set of tasks (0–100). React + Go Fiber + Postgres, all in Docker.

## Develop

```sh
docker compose up -d
```

Open http://localhost:8764 — the frontend hot-reloads, the backend needs
`docker compose restart backend`. Reset the database with `docker compose down -v`.

## Deploy

```sh
cp .env.example .env     # fill in ADMIN_PASSWORD and TUNNEL_TOKEN
docker compose -f docker-compose.prod.yml up -d --build
```

Builds the frontend into nginx and the backend into a static binary, and brings up a
Cloudflare Tunnel. Reachable locally on `WEB_PORT` (8764 by default) and publicly through
the tunnel.

### Cloudflare Tunnel

1. Zero Trust → Networks → Tunnels → create a tunnel, pick **Docker**, copy the token.
2. Put it in `.env` as `TUNNEL_TOKEN`.
3. In the tunnel's **Public hostname** tab: `afro.offlinebot.xyz` → service URL `http://web:80`. The scheme is required; `web:80` alone is rejected.

`cloudflared` reaches `web` over the compose network, so nothing has to be port-forwarded.

## Use

- **Chart** — pick subjects and tasks with the two filters, group the bars `by task` or
  `by subject`, switch to `table` for the raw numbers. A task that is computed but has no
  number yet shows as a dashed stub on the baseline instead of being silently absent.
- **Scores** — one table per subject, task rows with a Done mark and the score. Tick *Done*
  for a task that is computed while the number is still pending; typing a score ticks it.
  Empty the score field to take the number back out. Tables reorder with ↑ ↓.
- **Tasks** — the shared task list every table uses. Add, rename, reorder, delete.

Editing needs a password (no user name), kept in `localStorage`. It defaults to `admin`
in the dev stack and comes from `ADMIN_PASSWORD` in the production one.

## Layout

```
backend/    Go Fiber API, schema created and migrated on startup
frontend/   React + Vite; dev server in development, nginx build in production
```

## API

| Method | Path | Auth |
|---|---|---|
| POST | `/api/login` | — |
| GET | `/api/session` | — |
| GET | `/api/subjects`, `/api/tasks`, `/api/scores` | — |
| POST/PATCH/DELETE | `/api/subjects/:id`, `/api/tasks/:id` | bearer |
| PUT | `/api/subjects/order`, `/api/tasks/order` | bearer |
| PUT | `/api/scores` | bearer |

`PUT /api/scores` takes `{subject_id, task_id, value, computed}`. A `value` implies
`computed`; sending neither removes the row.
