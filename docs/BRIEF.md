# Pinpoint - product brief

*Source of truth for scope. Derived from the Pinpoint PRD (v1.0) and the build brief. Where the two disagree, the PRD wins on product scope and the build brief wins on architecture.*

## 1. What it is

Pinpoint is a mobile-first web app that helps a student learn faster by combining two techniques in one loop: **speaking a topic aloud to expose gaps**, and **pinning each idea to a photo of a familiar place** so it sticks.

**One-line pitch:** *Explain it. Pin it. Own it.*

**Platform:** Progressive web app - React front end, Node/Express API, PostgreSQL, Gemini for content analysis, Socket.IO for live updates.

## 2. Problem

Students re-read notes, which feels productive and works poorly. They cannot tell which parts of a topic they actually understand, and what they do learn fades. Tools in the market solve one piece each (flashcards, notes, timers) and none connect checking understanding with long-term retention.

## 3. Goals

1. In under three minutes, tell a student which key points of a topic they can and cannot explain.
2. Make a memory palace easy to build from photos of places the student already knows.
3. Test retention under a self-set time limit and show what to revisit.
4. One dashboard: progress, tasks, and days left until the next exam.

### Non-goals (MVP)

Teacher or classroom features, collaboration, social features, leaderboards, native apps, spaced repetition, offline mode, AI-graded voice answers in Recall, uploads larger than two pages.

## 4. Users

One account type, no roles. Two personas that shape the copy:

- **Aarav**, fast learner - moves quickly, builds larger palaces.
- **Meera**, *learns at their own pace* - retries until the gaps close.

**Copy rule:** say "learns at their own pace". Never use the word "slow" anywhere in the UI.

## 5. Core loop

Sign up -> **Topic**: upload a PDF or photos (max 2 pages), review AI key points -> **Explain**: pick a topic and a time, speak, get a score and a gap map -> retry the gaps -> **Palace**: add a place (photo), add flags -> **Recall**: random place, time per flag, green/red results -> **Home**: tasks tick off, mastery rises, countdown drops.

Explaining precedes pinning by design: a student should only memorise what they have shown they understand.

## 6. Data model - exactly ten tables

`users, units, topics, topic_files, explanations, places, flags, recall_rounds, recall_results, exams`

- Key points live on `topics.key_points_json`, each with a **stable integer id** that is never reused or renumbered, because flags and explanation results reference it.
- Flag positions are stored as **percentages** of the image.
- Dashboard tasks are **computed**, never stored.
- Upload job status lives in BullMQ/Redis, never in Postgres.

## 7. Functional requirements (P0 unless noted)

### Auth
Sign up with name, email, password; log in; hashed passwords; signed token; all data private to the account; no route returns another user's data. *(P2: edit name and pass mark, default 70%.)*

### Home
Greeting "Hey {name}"; units and topics with a mastery indicator and whether notes were uploaded or AI-generated; auto-generated per-topic task list (Add material, Explain it, Pin it, Recall it); a calendar with exam dates and one large number of days left to the nearest exam; countdown colour calm -> amber -> red *(P2)*; add exams *(P2: edit, delete)*.

Task completion: a file exists (Add material); an explanation meets the pass mark (Explain it); at least one flag is linked to the topic (Pin it); the latest recall round is mostly green (Recall it).

### Topic
Upload PDFs or images; the server enforces a maximum of **two pages per topic** and returns a clear error; on upload extract a title, short notes and **5 to 8 key points**; the user can edit everything before and after saving; *(P1: group topics into units; P2: re-run extraction, remove a file)*.

### Explain
Choose a topic and a time (1/2/3/5 min) with a visible countdown; live browser transcription with a typed fallback; the transcript is editable and submissions under ~15 words are blocked; each key point is marked covered / partial / incorrect / missing with a short evidence quote and one sentence of feedback; score computed in code - **covered 1, partial 0.5, incorrect and missing 0** - shown as a percentage and as "You covered X of Y key points"; *(P1: retry only the unmet points; "Pin the gaps" creates flags in the Palace; every attempt is saved)*.

### Palace
Grid of places (photo tile, name, flag count); open a place to see the photo with flags, zoom and pan; tapping a flag opens a side panel (bottom sheet on mobile) with an Edit button at the bottom; add flag = tap a spot and enter the information, optionally linked to a topic key point; add place = take or upload a photo and name it; positions stored as percentages; *(P1: compress photos on the device; delete flags and places)*.

### Recall
Random place the user owns; time allowed per flag set before starting; flags hidden; tap, recall, reveal, then "Got it" or "Missed"; **self-graded** - green within the limit, red if not (timeout counts as red); at the end the photo shows all flags coloured green or red; results update mastery and the Recall task; *(P2: prioritise red flags next round)*.

## 8. Non-functional

Screens under 2s on a typical mobile connection; Explain result in about 6s; keyword fallback if the AI fails; typed input if speech is unsupported; private by default with every query scoped to the user; secrets server-side only; non-guessable file URLs; mobile-first with five tabs (Home, Topic, Explain, Palace, Recall); Chrome/Edge for voice, others with typed input; red/green always paired with an icon or label; AI rate-limited per user and cached in development.

## 9. AI behaviour

| Operation | Input | Output |
| --- | --- | --- |
| Extract | Uploaded PDF or images | Title, notes summary, 5-8 key points |
| Check explanation | Key points, notes, transcript | Per-point status, evidence, feedback, summary, next-focus ids |

Rules: JSON only, validated server-side, retried once if malformed; judge by meaning against the uploaded material only; the prompt states the transcript may contain speech-recognition errors; the AI never computes the score; no personal details in prompts.

## 10. Design

Not AI-generated looking: no purple/blue gradients, no glassmorphism, no neon glows, no identical-card grids, no emoji as UI icons, no default shadcn blue.

Tokens: paper `#F6F1E7`, surface `#FFFDF8`, pine `#2F5D50` (primary), burnt orange `#E07A3F` (exam X marks, key actions), mustard `#C9A227` (highlights), text `#23201C`, muted `#6B645A`. Dark mode: `#1C1A17` with slightly desaturated accents. Headings Fraunces or DM Serif Display, body DM Sans. Lucide icons at one stroke width. Corner radii vary by component type, subtle paper grain, hand-drawn underline on the active nav item. Mobile-first installable PWA.

Animation: circular progress rings for mastery and scores, number ticker for the countdown, staggered fade-in for cards and gap-map items, animated lists, shimmer on primary actions, an animated border on the active recording card, an animated tab bar, tooltips on the calendar X marks, confetti on task completion, skeleton loading. Custom with Framer Motion: page transitions (fade + 8px slide, under 300ms), the X mark drawing itself, a pulse on the nearest exam, flags dropping onto the photo with a spring, flags flipping green/red in Recall, gap-map items turning colour one by one. Respect `prefers-reduced-motion`, keep every animation under 400ms, never block interaction. Gentle nudges that deep-link to the right screen.

## 11. Build order

0. Setup, auth, schema, API contract, shell. 1. Topic upload and extraction. 2. Explain. 3. Palace. 4. Recall. 5. Dashboard. 6. Polish, seed, deploy, backup recording.

### Cut order if time runs short

1. Full calendar grid (keep the countdown). 2. Manual tasks. 3. Spaced repetition. 4. Voice answers in Recall. 5. Unit grouping.

**The loop of upload, explain, pin and recall must never be cut.**

## 12. Success metrics

The loop works end to end without errors; upload to first gap map under 3 minutes; Explain latency under 6 seconds; a majority of testers agree "I could see exactly what I was missing".

## 13. Demo script (about two minutes)

1. **Hook (15s):** "Re-reading doesn't work. Explaining does, and so does your own room."
2. **Explain (40s):** explain a topic aloud, skipping one part on purpose; the gap map shows what is missing.
3. **Fix (15s):** re-explain the missing part, watch the score rise.
4. **Pin (30s):** photograph a desk and drop flags for the key ideas.
5. **Recall (15s):** hide the flags, recall against the timer, one turns red.
6. **Close (5s):** "Explain it. Pin it. Own it."
