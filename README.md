# Encodr Lite — Intern Take-Home

Thanks for taking the time on this. **Encodr Lite** is a small media-transcoding dashboard: a
signed-in user creates an encode **job** from a media URL, presses **Start encode**, watches the
progress update live, and sees the output files when it finishes.

The full brief — the six tasks, what we look for, and the ground rules — is in **`BRIEF.md`**.
**Read that first.** This file is just how to run things, and it's where you write up your work when
you're done.

## Run it

```bash
npm install
npm run dev          # http://localhost:3000
npm run test:run     # tests (one example test is included and passes)
npm run typecheck    # tsc --noEmit
npm run build        # production build
```

Requires **Node 20+** (`.nvmrc` says 20).

**Demo login:** `demo@encodr.dev` / `password123`

On a fresh checkout, sign-in works and the app loads, but the jobs list shows an error and the two
main screens are placeholders. That's expected — `GET /api/jobs` returns a 501 until you write it.
Search the project for `TODO(candidate)` to find everything that's yours; there are six.

Nothing here needs a database. State lives in memory, so restarting the dev server wipes your jobs.
That's fine — don't work around it.

## Where things are

```
app/
  signin/page.tsx              working sign-in — your example of RHF + Zod
  (app)/layout.tsx             route guard for everything signed-in
  (app)/jobs/page.tsx          TASK 4 — the create-job form
  (app)/jobs/[id]/page.tsx     TASK 5 — run controls, progress, results
  api/auth/login/route.ts      provided
  api/jobs/route.ts            TASK 2 — list + create
  api/jobs/[id]/route.ts       provided — your example route handler
  api/runs/route.ts            provided — starts a run
  api/runs/[id]/route.ts       provided — the endpoint you'll poll
lib/
  types.ts                     the data model + the run TIMELINE. Read this first.
  schemas.ts                   TASK 1 — source-URL validation
  server/auth.ts               provided — token signing
  server/http.ts               provided — json / error / withAuth / validationError
  server/store.ts              TASK 3 — computeRun()
  client/api.ts                provided — the fetch wrapper
  client/auth-context.tsx      provided
  client/hooks.ts              worked React Query examples + two TODOs
  client/use-run-polling.ts    TASK 5 — the polling hook
components/                    provided — StatusBadge, ProgressBar
__tests__/                     TASK 6 — your tests go here
```

## A suggested first hour

If you're not sure where to start:

1. `npm install && npm run dev`, sign in, look around. The jobs list will show an error — good, that's
   your first task.
2. Read `lib/types.ts` top to bottom. It's short and it's the whole data model.
3. Read `app/api/jobs/[id]/route.ts` — a complete route handler — then write Task 2 in the same style
   and check it with the curl commands in the file.
4. The list page lights up. Now do Task 1, then Task 3 (tests first).

## Useful to know

- `https://cdn.example.com/videos/corrupt.mp4` is rigged to **fail** partway through its run. Use it
  to build the error path.
- A run takes about **12 seconds** from start to finish, so you won't be waiting around.
- Run timings are constants in `TIMELINE` (`lib/types.ts`). Use them instead of typing numbers, so
  your tests and ours agree.
- `computeRun` takes `now` as an argument on purpose — you can test the 8-second mark without
  waiting eight seconds.

---

## Candidate Write-Up

## Candidate Write-Up

### 1. What I implemented

I completed the six tasks in the Encodr Lite assignment.

* Added HTTP/HTTPS source URL validation using Zod.
* Implemented the jobs `GET` and `POST` API routes with authentication and validation.
* Implemented the run state machine in `computeRun()`, including the simulated failure case.
* Built the create-job form using React Hook Form and Zod.
* Added live run progress using polling and handled completed and failed runs.
* Added retry support for failed runs.
* Added tests for the main validation, API, state-machine, form, and polling behavior.

The encoding itself is simulated by the provided server-side run timeline. The application does not perform real media transcoding.

---

### 2. Running the project

The project requires Node 20+.

Install dependencies:

```bash
npm install
```

Start the development server:

```bash
npm run dev
```

The application runs at:

```text
http://localhost:3000
```

Run the tests:

```bash
npm run test:run
```

Run the TypeScript check:

```bash
npm run typecheck
```

Create a production build:

```bash
npm run build
```

#### Demo login

```text
Email: demo@encodr.dev
Password: password123
```

---

### 3. What is working

* [x] Login and authenticated routes
* [x] Create a job from a source URL
* [x] Optional job title
* [x] Client-side validation
* [x] Server-side validation with field errors
* [x] Job list and job detail pages
* [x] Start an encoding run
* [x] Live progress updates
* [x] Completed run and rendition display
* [x] Failed run handling
* [x] Retry after failure
* [x] Polling cleanup when the run finishes or the page changes
* [x] Automated tests

---

### 4. Decisions and assumptions

#### Source URL validation

I used `new URL()` together with Zod refinements to validate the source URL.

The URL must use either HTTP or HTTPS and must contain a meaningful path. I did not restrict the URL to specific extensions such as `.mp4` or `.mov`, since the requirement is for a media URL with a path rather than a fixed list of file extensions.

#### Run state

I kept the run calculation on the server in `computeRun()`.

The current stage and progress are calculated from the elapsed time of the run. The client only requests the current run state and displays it; it does not duplicate the timing logic.

#### Polling

The detail page starts with an immediate request and then polls approximately once per second.

Polling stops when the run reaches `COMPLETED` or `FAILED`.

I also made sure the interval is cleaned up when the component unmounts or when the active run changes. This was important because an old request should not update the UI after the user has moved away from that run.

#### Storage

I kept the provided in-memory Maps for jobs and runs. I did not add a database because persistent storage is outside the scope of this assignment.

---

### 5. What was hardest

The part I found most interesting was getting the run boundaries correct.

For example, the state changes exactly at:

```text
2000ms  → DOWNLOADING
6000ms  → TRANSCODING
8000ms  → FAILED for the corrupt URL
12000ms → COMPLETED
```

I wrote tests around those boundaries because a small `<` versus `<=` mistake could change the displayed stage.

The other challenging part was polling cleanup. Clearing an interval stops future polling, but an HTTP request that has already started can still finish later. I therefore had to make sure those stale responses could not update the component after it was unmounted or the run had changed.

I also had to handle server-side validation errors in the create-job form and map those errors back to the correct form fields.

---

### 6. Testing

I added tests under `__tests__/` using Vitest and React Testing Library.

The main areas covered are:

* `computeRun()` at the important timeline boundaries
* the corrupt-source failure at 8 seconds
* HTTP/HTTPS source URL validation
* invalid job creation requests
* successful job creation
* create-job form validation
* mapping server `422` errors to form fields
* polling at one-second intervals
* stopping polling after completion/failure
* polling cleanup on unmount

The final test run was:

```text
Test Files  5 passed (5)
Tests       38 passed (38)
```

I also removed the original `example.test.ts` starter test after replacing it with the actual assignment tests.

---

### 7. Verification

I verified the project with:

```bash
npm run test:run
```

Result:

```text
5 test files passed
38 tests passed
```

TypeScript check:

```bash
npm run typecheck
```

Result:

```text
Passed with 0 errors
```

Production build:

```bash
npm run build
```

Result:

```text
Build succeeded
```

---

### 8. Failure path

The application also handles the simulated corrupt-source case.

Using the assignment's failure URL, the flow is:

```text
Start encode
    ↓
QUEUED
    ↓
DOWNLOADING
    ↓
TRANSCODING
    ↓
FAILED
```

At the failure point, the error returned by the server is displayed and polling stops.

The user can then click **Retry**, which creates a new run and starts polling that run instead of reusing the failed run.

---

### 9. What I would improve next

If this were being taken beyond the scope of the assignment, I would consider:

* replacing the in-memory store with PostgreSQL
* moving real transcoding to a background worker/queue
* using WebSockets or Server-Sent Events instead of polling
* adding persistent job history
* improving accessibility and status announcements
* handling browser tab visibility so polling can be reduced while the page is inactive

These were intentionally left out because they are outside the scope of the take-home assignment.
