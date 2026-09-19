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



### 1. What I implemented
I completed all six tasks in the Encodr Lite take-home assignment:
- Added HTTP/HTTPS source URL validation using Zod.
- Implemented the jobs `GET` and `POST` API routes with authentication and validation.
- Implemented the run state machine in `computeRun()`, including the simulated failure case.
- Built the create-job form using React Hook Form and Zod.
- Added live run progress using polling and handled completed and failed runs.
- Added retry support for failed runs starting a fresh independent run.
- Added comprehensive tests for validation, API routes, state-machine boundaries, form behavior, and polling cleanup.

*Note: Media transcoding is simulated by the provided server-side run timeline over 12 seconds. The application does not perform real ffmpeg media transcoding.*

### 2. Running the project
The project requires Node 20+.

Install dependencies:
```bash
npm install
```

Start the development server (runs at http://localhost:3000):
```bash
npm run dev
```

Run automated tests:
```bash
npm run test:run
```

Run TypeScript check:
```bash
npm run typecheck
```

Create production build:
```bash
npm run build
```

**Demo login:**
- Email: `demo@encodr.dev`
- Password: `password123`

### 3. What is working
- [x] Login and authenticated route guards
- [x] Create a job from a source URL
- [x] Optional job title support
- [x] Client-side validation with instant inline errors
- [x] Server-side validation returning 422 field errors
- [x] Job list and job detail pages
- [x] Start an encoding run
- [x] Live progress updates (~1s interval)
- [x] Completed run and renditions table display
- [x] Failed run handling with clear server error panel
- [x] Retry functionality launching a fresh run
- [x] Polling cleanup when the run finishes, page changes, or component unmounts
- [x] Automated tests (38 tests passing across 5 suites)

### 4. Decisions and assumptions
- **Source URL validation**: 
Used `new URL()` with Zod refinements. The URL must use `http:` or `https:` and contain a non-empty file path (stripping trailing slashes to reject origin-only URLs like `https://cdn.example.com`). I did not restrict to specific extensions like `.mp4` or `.mov` since the requirement is for a generic media URL with a path.
- **Run state**:
 Kept the run calculation exclusively on the server in `computeRun()`. Current stage and progress are pure functions of elapsed time. The client only polls and displays state; it never duplicates timing logic.
- **Detail page state modeling**: 
Modeled the screen with an explicit single-state union (`idle | starting | running | failed | completed`) rather than multiple independent booleans, making invalid combinations like `isRunning && isFailed` impossible.
- **Polling & cleanup**: 
The detail page fires an immediate request and then polls every 1,000ms until reaching a terminal stage (`COMPLETED` or `FAILED`). Cleanup clears the interval and uses a cancellation guard to prevent in-flight promises from updating state after unmounting.
- **Storage**: Kept the provided in-memory Maps in `lib/server/store.ts`. No database was added as persistent storage is explicitly out of scope.

### 5. What was hardest
- **Exact timeline boundary handling in `computeRun()`**: 
The state changes at exact millisecond marks (`2000ms` for DOWNLOADING, `6000ms` for TRANSCODING, `8000ms` for corrupt URL failure, and `12000ms` for COMPLETED). I wrote tests for `1999ms`, `2000ms`, `5999ms`, `6000ms`, etc., before coding to ensure no `<` vs `<=` edge errors existed.
- **Asynchronous polling cleanup**: 
Clearing an interval stops future ticks, but an HTTP request already in flight can still resolve after navigating away. I implemented a cancellation guard flag alongside `clearInterval` to prevent unmounted state updates.
- **Testing React 19 async route params in jsdom**: 
In Next.js 16 / React 19, `params` is a Promise unwrapped via `use(params)`. In the component tests, this suspended rendering; wrapping tests in `<Suspense>` and awaiting an asynchronous `act()` ensured promises resolved cleanly before assertions ran.
- **Mapping server-side 422 errors**: 
Catching `ApiError` in the form's `handleSubmit` and translating `fieldErrors` records into React Hook Form `setError` calls while maintaining a fallback for generic errors.

### 6. Testing
Tests are in `__tests__/` using Vitest and React Testing Library:
- `computeRun()` at exact timeline boundaries (0ms, 1999ms, 2000ms, 5999ms, 6000ms, 7999ms, 8000ms, 11999ms, 12000ms).
- Corrupt source failure at 8 seconds (verifying frozen progress at 67%, error message, and undefined result).
- Progress monotonicity across the 12-second timeline.
- HTTP/HTTPS source URL validation (accepting valid URLs, rejecting empty, malformed, non-HTTP, and pathless URLs).
- Jobs API routes (401 unauthenticated, 200 list, 422 validation, 201 creation).
- Create-job form validation (preventing API calls on bad input, submitting valid data, mapping 422 field errors).
- Polling hook lifecycle (immediate fetch, intervals, stopping on terminal states, unmount cleanup).

**Final test result:**
```text
Test Files  5 passed (5)
Tests       38 passed (38)
```
The starter `example.test.ts` file was removed after the full suite was completed.

### 7. Verification
- `npm run test:run` → 5 test files passed, 38 tests passed.
- `npm run typecheck` → Passed with 0 errors (`tsc --noEmit`).
- `npm run build` → Production build succeeded with Next.js 16.

### 8. Failure path
To reproduce the failure path:
1. Create a job using the assignment's corrupt URL:
   ```text
   https://cdn.example.com/videos/corrupt.mp4
   ```
2. Open the job detail page and click **Start encode**.
3. Watch the progress move through `QUEUED` → `DOWNLOADING` → `TRANSCODING`.
4. At exactly 8 seconds, the stage transitions to `FAILED`:
   - Progress bar turns red and freezes at 67%.
   - Server error message is displayed: *"The source video appears corrupt and cannot be transcoded."*
   - Polling stops immediately.
5. Click **Retry encode** to initiate a new run with a fresh run ID that is polled independently.

### 9. What I would improve next
If extending this application beyond the assignment scope, I would:
- Replace the in-memory store with PostgreSQL and an ORM (Prisma or Drizzle) for data persistence across server restarts.
- Move transcoding to an asynchronous worker queue (e.g., BullMQ / Redis or AWS SQS + MediaConvert).
- Use WebSockets or Server-Sent Events (SSE) instead of HTTP polling to reduce request volume.
- Implement tab visibility pausing (`document.visibilityState`) to pause polling while the browser tab is hidden.
- Add relative timestamps ("created 5 minutes ago") and conduct an accessibility audit for screen readers.

### 10. Time spent
- Approximately 5 hours across implementation, testing, and the final write-up.

