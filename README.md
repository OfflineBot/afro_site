# Afro Sites

Score board for subjects rated on a set of tasks (0–100). React + Go Fiber + Postgres, all in Docker.

## Run

```sh
docker compose up -d
```

Open http://localhost:8764

Stop with `docker compose down`. To reset the database, `docker compose down -v`.

The database ships with demo data (6 subjects, 8 tasks) so the chart is not empty on first open;
`down -v` wipes it.

## Use

- **Chart** — pick subjects and tasks with the two filters, group the bars `by task` or `by subject`,
  switch to `table` for the raw numbers.
- **Data** — the score grid. Editable once logged in; empty a cell to remove a score.
- **Manage** — add, rename, reorder and delete subjects and tasks.

Editing needs the password `admin` (no user name). The login is kept in `localStorage`.
Set a different one with `ADMIN_PASSWORD` in `docker-compose.yml`.

## Layout

```
backend/    Go Fiber API, schema created on startup
frontend/   React + Vite, dev server on 8764, proxies /api to the backend
```

Both containers mount their source, so edits are picked up live — the frontend hot-reloads,
the backend needs `docker compose restart backend`.

## API

| Method | Path | Auth |
|---|---|---|
| POST | `/api/login` | — |
| GET | `/api/session` | — |
| GET | `/api/subjects`, `/api/tasks`, `/api/scores` | — |
| POST/PATCH/DELETE | `/api/subjects/:id`, `/api/tasks/:id` | bearer |
| PUT | `/api/scores` | bearer |
| DELETE | `/api/scores/:subjectId/:taskId` | bearer |
