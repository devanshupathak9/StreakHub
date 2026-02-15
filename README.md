# StreakHub (PERN Starter)

A basic PERN implementation of the StreakHub concept with:
- **PostgreSQL + Express backend** for users, goals, activity logs, and streak summary.
- **React frontend** for creating users/goals and logging daily activity.

## Project Structure

- `server/` - Express + PostgreSQL API
- `client/` - React (Vite) UI

## Prerequisites

- Node.js 20+
- PostgreSQL 14+

## 1) Configure Backend

Copy env file:

```bash
cp server/.env.example server/.env
```

Default DB string in `.env`:

```bash
DATABASE_URL=postgres://postgres:postgres@localhost:5432/streakhub
PORT=4000
```

Create DB and run API (tables auto-create on start):

```bash
createdb streakhub
npm --prefix server install
npm --prefix server run dev
```

## 2) Start Frontend

```bash
npm --prefix client install
npm --prefix client run dev
```

If needed, set API base URL:

```bash
# client/.env
VITE_API_BASE_URL=http://localhost:4000/api
```

## API Endpoints

- `GET /api/health`
- `POST /api/users`
- `POST /api/goals`
- `POST /api/activity`
- `GET /api/dashboard/:username?date=YYYY-MM-DD`

## Notes

This is a foundational version intended to be extended with OAuth integrations, async ingestion jobs, anti-cheat heuristics, and group leaderboards.
