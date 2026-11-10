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

Tasks live in **task sets**. The picker in the header chooses the active one and every tab
follows it: the chart, its task filter and the score tables all show that set only. Sets
have their own tasks, in their own number and with their own names — the same name may
appear in two sets. Rename a set by typing over its title under *Tasks*.

- **Chart** — pick subjects and tasks in the single *Filters* card, group the bars `by task` or
  `by subject`, switch to `table` for the raw numbers. A task that is computed but has no
  number yet shows as a dashed stub on the baseline instead of being silently absent.
  Reference subjects keep their own colour and are drawn with a hatched fill, so they read
  apart from your own benchmarks in both the filter chips and the bars. `subject order`
  switches between the hand-made order and the subject size, smallest or largest first.
- **Scores** — one table per subject, task rows with a Done mark and the score. Tick *Done*
  for a task that is computed while the number is still pending; typing a score ticks it.
  Empty the score field to take the number back out. Tables reorder with ↑ ↓ while
  `subject order` is `manual`. Mark a subject *reference* when it is not one of your own
  benchmarks, and give it a size such as `0,8B`, `4B` or `700M` to sort by it; subjects
  without a size are listed last.
- **Tasks** — the task list of the active set. Add, rename, reorder, archive. The second
  card creates further sets and switches between them.

Nothing is ever deleted. *archive* takes a subject or a task out of the board while its
scores stay in the database; an **Archive** list underneath brings it back with *restore*.
A restored entry lands at the end of the order, since its old place was taken meanwhile.
The archive is visible only once logged in — the API leaves archived rows out for everyone
else.

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
| GET | `/api/subjects`, `/api/tasks`, `/api/scores`, `/api/tasksets` | — |
| POST/PATCH | `/api/subjects/:id`, `/api/tasks/:id`, `/api/tasksets/:id` | bearer |
| PUT | `/api/subjects/order`, `/api/tasks/order` | bearer |
| PUT | `/api/subjects/:id/archived`, `/api/tasks/:id/archived` | bearer |
| PUT | `/api/scores` | bearer |

`PUT /api/scores` takes `{subject_id, task_id, value, computed}`. A `value` implies
`computed`; sending neither removes the row.

`PATCH /api/subjects/:id` replaces the whole subject, so send `reference` and `size` along
with `name` and `note` — a missing `reference` reads as `false`, a missing `size` as none.
`size` is a parameter count in billions, so `0.8` is 0,8B.

`PUT .../archived` takes `{archived}`. There is no delete route for subjects or tasks.

`POST /api/tasks` needs `{name, set_id}`. Task names are unique per set, not globally.

A database from before task sets migrates on startup: a set named `Set 1` is created and
every existing task joins it. Task ids do not change, so every score stays attached to its
task. Rename that set afterwards to whatever it should be called.
