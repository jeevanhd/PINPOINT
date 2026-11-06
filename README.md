# Pinpoint

**Explain it. Pin it. Own it.**

A student explains a topic out loud, sees exactly which key points they skipped, and pins each idea to a photo of a place they already know - then tests what stuck against a timer.

Monorepo: React + Vite web app, Express API, BullMQ worker, PostgreSQL, Socket.IO, Gemini.

---

## Architecture

```mermaid
flowchart LR
  subgraph Browser["PWA - apps/web"]
    UI["React + Tailwind<br/>Framer Motion"]
    CAM["CameraCapture<br/>getUserMedia"]
    SP["Web Speech API<br/>+ typed fallback"]
    SC["Typed socket client"]
  end

  subgraph API["apps/api - stateless"]
    RT["routes"]
    CT["controllers"]
    SV["services"]
    RP["repositories"]
    IO["Socket.IO<br/>JWT handshake"]
    RL["per-user rate limit"]
  end

  subgraph WORKER["apps/api/src/worker.ts"]
    W["BullMQ worker<br/>PDF/image + Gemini"]
  end

  subgraph INFRA
    PG[("PostgreSQL<br/>10 tables")]
    RD[("Redis<br/>queues + pub/sub")]
    ST[("Storage<br/>local or Cloudinary")]
  end

  GEM["Gemini API<br/>JSON only"]

  UI -->|REST + JWT| RT
  RT --> CT --> SV --> RP --> PG
  UI <-->|user:{id} room| IO
  SV -->|202 + enqueue| RD
  RD --> W
  W --> ST
  W -->|extract| GEM
  SV -->|judge| GEM
  W -->|publish progress| RD
  RD --> IO
  RL --> RD
```

Layers: **routes -> controllers -> services -> repositories (Prisma)**. No business logic in routes, every query scoped by `user_id`, no user id inside any socket payload.

---

## Quick start

### Option A - Docker (everything, one command)

```bash
cp .env.example .env          # compose interpolates this file automatically
docker compose up --build
```

Six services: `postgres`, `redis`, a one-shot `migrate` that applies the schema and seeds the demo account, then `api`, `worker` and `web`. Nothing starts before the migration exits 0, and the web container waits for the API's healthcheck.

- Web: http://localhost:5173
- API: http://localhost:4000/api/health
- Readiness (DB + Redis): http://localhost:4000/api/ready

One image, three roles: `api`, `worker` and `web` all run from the same build (`pinpoint-dev:latest`) and differ only in command, so `docker compose up --build` builds once and pulls one base image.

**No hot reload in Docker.** Source is baked into the image rather than bind-mounted, because a host `node_modules` mounted over `/app` shadows the container's and breaks argon2's native binary (glibc on the host, musl or a different glibc inside). For hot reload use `npm run dev:all` instead.

#### If the image pull fails

`failed to resolve reference "docker.io/library/node:20-bookworm-slim": TLS handshake timeout` or `read: connection reset by peer` on a `production.cloudfront.docker.com` URL is your network reaching Docker Hub's CDN, not this repo. In order of how often it works:

1. **Retry.** These are usually transient. `docker pull node:20-bookworm-slim` on its own, then `docker compose up`.
2. **Force IPv4.** The classic signature is an IPv6 route that dies mid-transfer (`read tcp [2401:...]->[2600:9000:...]`).
   - Docker Desktop: Settings -> Resources -> Network, turn IPv6 off, apply and restart.
   - Linux: add `{"ipv6": false}` to `/etc/docker/daemon.json`, then `sudo systemctl restart docker`. To test quickly: `sudo sysctl -w net.ipv6.conf.all.disable_ipv6=1`.
3. **Use a registry mirror** in `/etc/docker/daemon.json`, e.g. `{"registry-mirrors": ["https://<your-mirror>"]}`, then restart Docker.
4. **Skip Docker.** Use Option B against a Postgres you already have, or run only the data services: `docker compose up postgres redis` (two small images instead of the app image).

### Option B - Local Node (no Docker)

You need Node 20+, PostgreSQL 14+ and (optionally) Redis.

```bash
npm install
cp .env.example apps/api/.env       # then edit DATABASE_URL, JWT_SECRET
npm run db:migrate                  # creates the 10 tables
npm run db:seed                     # demo account + one topic, one place, one exam
npm run dev:all                     # api + worker + web together
```

Open http://localhost:5173.

**No Redis?** Leave `REDIS_URL` empty. The API runs extraction inline instead of in BullMQ, socket fan-out uses an in-process bus, and rate limiting uses memory. The separate worker needs Redis; `npm run dev:all` will log its refusal and the API keeps working.

**No Gemini key?** Leave `GEMINI_API_KEY` empty. A deterministic mock provider returns the same JSON contract, so the whole loop - upload, extract, explain, score, pin, recall - works offline. Add a key to switch to the real model with no code change.

### Demo account

```
demo@pinpoint.app / pinpoint123
```

Seeded with: unit *Biology - Unit 3*, topic *Photosynthesis* (6 key points), place *Study desk* (4 flags, 3 linked to key points), exam *Physics - Unit 2* in 3 days.

---

## Environment variables

| Variable | Default | Notes |
| --- | --- | --- |
| `DATABASE_URL` | - | **required**, Postgres connection string |
| `JWT_SECRET` | - | **required**, 16+ chars (32+ in production) |
| `API_PORT` | `4000` | |
| `WEB_ORIGIN` | `http://localhost:5173` | CORS allowlist, comma separated |
| `PUBLIC_API_URL` | `http://localhost:4000` | base for locally served files |
| `REDIS_URL` | empty | empty = inline queue, memory rate limit, local bus |
| `GEMINI_API_KEY` | empty | empty = deterministic mock provider |
| `GEMINI_MODEL` | `gemini-2.0-flash` | Flash-class model name |
| `AI_CACHE_TTL_SECONDS` | `86400` | repeated AI calls are cached |
| `STORAGE_DRIVER` | `local` | `local` or `cloudinary` |
| `LOCAL_STORAGE_DIR` | `./storage` | relative to `apps/api` |
| `CLOUDINARY_*` | empty | required when `STORAGE_DRIVER=cloudinary` |
| `MAX_UPLOAD_MB` | `10` | |
| `MAX_PAGES_PER_TOPIC` | `2` | hard cap, also enforced in code |
| `LOG_LEVEL` | `info` | pino |

Environment is validated with zod at startup; a bad config fails loudly with the exact field.

---

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev:all` | api + worker + web with prefixed logs |
| `npm run dev:api` / `dev:worker` / `dev:web` | one process each |
| `npm run lint` | ESLint (flat config, no `any`) |
| `npm run typecheck` | tsc for shared, api and web |
| `npm test` | vitest: 26 tests |
| `npm run verify` | lint + typecheck + tests |
| `npm run db:migrate` / `db:seed` / `db:studio` | Prisma |
| `npm run build` | production web bundle |

### What the tests cover

`apps/api/src/__tests__`

- `auth.test.ts` - signup, duplicate email, weak password, login, `/me` guard.
- `isolation.test.ts` - user B cannot read or modify user A's topics, places, flags, rounds, exams; B's dashboard stays empty.
- `pages.test.ts` - the 2-page limit: 2-page PDF accepted, 3-page rejected, second upload over budget rejected, photo counts as one page, fake PDF rejected, empty file rejected.
- `score.test.ts` - covered 1 / partial 0.5 / incorrect and missing 0, rounding, pass mark, short-transcript rule.
- `socket.test.ts` - every documented event exists, every event has a schema, payloads reject malformed data and never carry a `userId`.
- `loop.test.ts` - the whole loop end to end: upload -> 202 -> job done -> extract -> explain -> score matches the verdicts -> pin -> drag -> recall -> dashboard tasks.

Tests run against a real PostgreSQL database and truncate between cases.

---

## Desktop launcher

Starts api, worker and web in the background, waits on `/api/ready` (no fixed sleeps), opens the app in app mode (`chrome --app=URL`, falling back to Edge, then the default browser), logs to `logs/`, refuses to start twice, and shuts down cleanly.

```bash
node scripts/launcher.mjs start    # or stop / status
```

Platform shortcuts:

| OS | Install | Remove |
| --- | --- | --- |
| Windows | `scripts\install-shortcut\windows\Install-Pinpoint.bat` | `Uninstall-Pinpoint.bat` |
| macOS | `scripts/install-shortcut/macos/Install-Pinpoint.command` | `Uninstall-Pinpoint.command` |
| Linux | `scripts/install-shortcut/linux/install-linux.sh` | `uninstall-linux.sh` |

Windows installs a `.lnk` that runs a hidden `.vbs` wrapper, so no console window appears.

---

## Camera and HTTPS

`<CameraCapture />` uses `getUserMedia`, which browsers only allow on **HTTPS or localhost**.

- `http://localhost:5173` - camera works.
- Phone on your LAN via `http://192.168.x.x:5173` - camera is blocked, so the component falls back to `<input type="file" accept="image/*" capture="environment">`, which still opens the phone camera. This is intentional, not a bug.
- To test the real camera on a phone, put the app behind HTTPS (Caddy, ngrok, Cloudflare Tunnel) or install it as a PWA from an HTTPS origin.

---

## PWA

`manifest.webmanifest` plus a hand-written service worker. The shell is cached; `/api` and `/socket.io` are never cached - stale study data is worse than no data. Install from the browser menu on a phone.

---

## Two-minute demo

**Before you present:** `npm run db:seed`, then `node scripts/launcher.mjs start` and wait for "Ready".

| Time | Beat | What to do |
| --- | --- | --- |
| 0:00 | Hook | "Re-reading doesn't work. Explaining does, and so does your own room." |
| 0:15 | Explain | Open **Explain**, pick *Photosynthesis*, 1 min, speak and deliberately skip the Calvin cycle |
| 0:40 | Gap map | Score ring + "You covered 4 of 6 key points"; the missing point is red, one is amber |
| 0:50 | Fix | **Retry the gaps**, add the Calvin cycle, score rises, ring turns pine |
| 1:05 | Pin | **Pin the gaps** -> Palace -> tap the photo twice, flags drop with a spring |
| 1:35 | Recall | **Recall**, 15s per flag, tap a flag, reveal, mark one **Missed** so it turns red |
| 1:55 | Close | Home: tasks ticked, mastery ring up, "Physics in 3 days". "Explain it. Pin it. Own it." |

The one red flag is the point: the product shows you what to revisit, it does not flatter you.

---

## What is verified, and what is not

**Verified in this build** (real PostgreSQL 16, real HTTP, 26 tests + a live smoke run): migrations, seed, auth, user isolation, 2-page limit, extraction job via the inline driver, explain + code-side scoring, gap endpoint, places, flags, flag drag persistence, recall start/hide/submit/finish, dashboard tasks, exam countdown, socket payload contract, web production build, and the API serving stored images.

**Not executed here** (no Redis or Docker in the build environment): the BullMQ worker process, the Redis socket adapter, and the Redis rate-limit store. The code paths exist and typecheck; treat them as unverified until you run `docker compose up`. The Docker packaging itself (`Dockerfile`, `docker-compose.yml`) is likewise unrun - the compose graph was validated by parsing it, not by building it.

**Also not exercised here**: real Gemini calls (no key - the mock provider ran instead) and real Cloudinary uploads. Both sit behind the same interfaces the mock and local drivers implement.

---

## Project layout

```
apps/api        Express API, Prisma schema, BullMQ worker, AI + storage providers
apps/web        React PWA: Home, Topic, Explain, Palace, Recall
packages/shared zod schemas + inferred types for REST bodies and socket events
docs/BRIEF.md   product scope (source of truth)
docs/DECISIONS.md every judgement call and deviation
scripts         dev runner, desktop launcher, per-OS shortcuts
```
