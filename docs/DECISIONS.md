# Decisions and deviations

Every judgement call made while building, with the reason. If something here looks wrong, this is the file to argue with.

## D-01 The repository was empty

`jeevanhd/PINPOINT` at `ad054ae` contained only a `README.md`: no `docs/BRIEF.md`, no Phase 0 scaffold, no Prisma schema. The approved Phase 0 design existed only in an earlier chat that was not available to this session. Everything was rebuilt from the product brief and the build brief, and this file records that reconstruction.

## D-02 AI and storage sit behind provider interfaces

`AiProvider` has two implementations: `GeminiProvider` (real, JSON-only, zod-validated, retried once) and `MockProvider` (deterministic, no network, no key). The mock is selected automatically when `GEMINI_API_KEY` is empty, so the demo works with zero credentials and a real key is a one-line env change. Storage has `LocalStorage` (default) and `CloudinaryStorage` (signed server-side upload) behind `StorageDriver`.

## D-03 Redis is optional in development, required for the worker

The brief says upload job status lives in BullMQ/Redis and the worker publishes progress through Redis. That is the implementation. For a keyless single-process dev run, an empty `REDIS_URL` switches three things: the extraction job runs **inline** off the request path instead of in BullMQ, socket fan-out uses an in-process event bus instead of Redis pub/sub, and rate limiting falls back to an in-memory store. The worker process refuses to start without Redis rather than pretending. `/api/ready` reports Redis separately so this is never hidden.

## D-04 Key point ids are stable and never reused

`topics.key_point_seq` is a monotonic counter. Saving key points keeps the id of an edited point, gives new points `seq++`, and never hands a deleted point's id to a new one. Flags and explanation results therefore keep pointing at the right idea even after edits. Covered by `keyPoints.service.ts` and exercised in the loop test.

## D-05 The score is computed in one place, in code

`computeScore()` in `@pinpoint/shared` is the only implementation: covered 1, partial 0.5, incorrect and missing 0, rounded to a whole percent, compared with the user's pass mark (default 70). The AI returns verdicts; it never returns a number. The loop test recomputes the score from the verdicts and asserts equality.

## D-06 Mastery is a blend, not an AI output

`mastery = round(0.4 x bestExplainScore + 0.4 x latestRecallGreenPct + 0.2 x pinned)`, where `pinned` is 100 when at least one flag links to the topic. Rationale: understanding (Explain), retention (Recall) and encoding (Pin) are the three things the product claims, so the ring should not be driven by any one of them. Implemented in `computeMastery()` and unit-testable.

## D-07 Dashboard tasks are computed on read

Nothing about tasks is stored. `buildTasks()` derives Add material / Explain it / Pin it / Recall it from files, best explanation score, linked flags and the latest recall green ratio ("mostly green" = 60%). Changing the pass mark therefore changes the dashboard immediately.

## D-08 Two pages means two pages

The upload endpoint inspects magic bytes (never the declared mime type), counts PDF pages with `pdf-lib`, treats one photo as one page, and rejects anything that would push a topic past `MAX_PAGES_PER_TOPIC`. `assertPageBudget()` is a pure function with its own tests, including a 3-page PDF and a file that only claims to be a PDF.

## D-09 21st.dev components were hand-built

The brief asks for `npx shadcn@latest add "<url from 21st.dev>"`. That CLI needs an interactive shadcn init and network access to a registry that this build environment cannot reach, and unverifiable component names would have produced broken imports. Each requested effect was implemented directly with Framer Motion, keeping the same roles:

| Requested | Built as |
| --- | --- |
| circular progress ring | `ui/Ring.tsx` |
| number ticker | `ui/Ticker.tsx` |
| blur-fade / staggered fade-in | `ui/Motion.tsx` (`FadeIn`, `Stagger`, `StaggerItem`) |
| animated list | `Stagger` + `AnimatePresence` in gap map, tasks, sheets |
| shimmer / pulsating button | `.skeleton` shimmer, pulsing recording card |
| border beam | animated `boxShadow` pulse on the active recording card |
| dock / animated tab bar | `BottomNav.tsx` with `layoutId` pill + scribble underline |
| animated tooltip on X marks | `title` + pulse on the nearest exam X |
| confetti | skipped (see D-16) |
| skeleton shimmer | `.skeleton`, `CardSkeleton` |

## D-10 No shadcn/ui, no Radix

`Button`, `Sheet`, `Ring`, `Ticker`, `States`, `Toaster` are local primitives built with `class-variance-authority` and Tailwind. Fewer dependencies, and the visual language is bespoke rather than a themed default - which the brief explicitly asks for.

## D-11 Realtime is one contract, validated twice

`packages/shared/src/socket.ts` holds a zod schema for every event. The API validates before emitting (a bad payload is dropped and logged), and the client validates on arrival before touching the cache. Payloads never carry a user id; the JWT in the handshake decides the `user:{id}` room. `socket.test.ts` asserts the event list, the schemas and the absence of `userId`.

## D-12 Stateless API, access token only

JWT (HS256) in `Authorization: Bearer`, argon2id password hashes, no refresh tokens, no server session store. `GET /auth/me` rehydrates the client on load.

## D-13 Camera is one component, used twice

`CameraCapture` does `getUserMedia` with `facingMode: environment`, capture to canvas, client-side compression with `browser-image-compression`, preview, retake, and falls back to `<input type="file" accept="image/*" capture="environment">` when permission is denied or `getUserMedia` is missing. Used for Topic pages and for adding a place. Needs HTTPS or localhost - documented in the README.

## D-14 Exam calendar lives on Home only

Desktop: a sticky side panel. Mobile: a section under the countdown. Every exam date carries an X drawn beside the date number (`XMark`), and the nearest exam pulses. There is no separate calendar screen.

## D-15 Copy rules

"learns at their own pace" is the only phrasing used; the banned word does not appear anywhere in the UI. Recall is self-graded with a timer. The pass mark is 70%. Flags can link to a key point or hold a free note. The product is called Pinpoint.

## D-16 Not built, deliberately

- **Confetti** on task completion: the brief lists it, but a full confetti dependency for one moment was not worth the bundle; the task chips animate instead. Recorded here rather than silently dropped.
- **`explain:transcript` streaming from the server**: the transcript is produced in the browser, so the server event only echoes the final word count for other devices.
- **Red-flag prioritisation in Recall (P2)**: a random place is chosen, as specified for P0.
- **Editing and deleting exams**: add and delete exist (delete is P2 and cheap); edit does not.

## D-17 Local verification used an embedded Postgres

The build sandbox has no Docker, no Postgres server and no Redis. Verification ran against a real PostgreSQL 16 instance started from the Python `pgserver` wheel: migrations, seed, all 26 tests and an end-to-end smoke run against the live API. Nothing about `pgserver` is shipped in the repository; it was a test harness only. Redis-backed paths (BullMQ worker, Redis adapter, Redis rate limiter) were **not** executed here and are unverified at runtime - see README's "What is verified".

## D-18 Rate limiting is per user, not per IP

`createUserRateLimiter` keys on `req.user.id` with the IP as a fallback for the unauthenticated auth routes. A shared campus NAT must not lock out a class. Redis store when available, memory store otherwise.

## D-19 Uploads go through the API, not the browser

The brief mentions a signed upload. The API receives the multipart body, validates magic bytes and the page budget, then stores it server-side (local disk or a signed Cloudinary call) and enqueues the job. This keeps the 2-page rule authoritative - a browser that lies about page count cannot get past it.

## D-20 Docker packaging: one image, three roles, no bind mount

The first compose file ran `npm install` inside three containers against a bind-mounted source tree. That was wrong twice over: three concurrent installs racing over the same `node_modules`, and a host `node_modules` (glibc, macOS or otherwise) shadowing the container's, which breaks argon2's native binary. Replaced with a real `Dockerfile`:

- `node:20-bookworm-slim`, not alpine. argon2 ships glibc prebuilds and Prisma needs openssl; on alpine both would compile from source and need a toolchain in the runtime image.
- Dependency layer (`npm ci`) keyed on the manifests and lockfile only, so source edits do not reinstall.
- `prisma generate` in the build stage, after the source copy.
- One image (`pinpoint-dev:latest`) with three commands, so a build happens once and one base image is pulled.
- Source is baked in, not bind-mounted. Consequence: **no hot reload in Docker** - stated in the README rather than papered over.
- A one-shot `migrate` service runs `migrate deploy` + seed and exits; `api` and `worker` wait on `service_completed_successfully`, and `web` waits on the API healthcheck (`/api/ready`). No fixed sleeps, no race between the API booting and the schema existing.

Docker itself was never executed in the build sandbox (no daemon), so the compose graph is validated by parsing it, not by running it.
