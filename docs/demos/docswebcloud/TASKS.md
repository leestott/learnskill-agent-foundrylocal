# Starter Tasks

Good first issues for new contributors, ordered by difficulty.

## Legend

🟢 Easy (< 1 hour) | 🟡 Medium (1-2 hours) | 🔴 Hard (2+ hours)

## 🟢 Task 1: Trace the Chat Request Path (Frontend → Backend)

**Difficulty:** easy | **Time:** 45–60m

Follow how a chat message is sent from the web app to the Python API by tracing calls starting in `code/frontend/src/api/` through the backend entrypoints in `code/app.py` and `code/create_app.py`. Write a short markdown note (in `docs/`) describing the request/response flow and where auth/config is

### 🎯 Learning Objective

Code navigation in a monorepo; understanding API boundaries between TypeScript frontend and Python backend

### Acceptance Criteria

- [ ] Identifies the exact frontend function(s) that issue the chat request
- [ ] Identifies the backend route/handler that receives it
- [ ] Includes a sequence diagram or bullet-step flow with file/line references

### Hints

- Search for the chat endpoint path in `code/frontend/src/api/*`
- Use “Find in files” for `FastAPI`/route decorators or app wiring in `code/create_app.py`

### Related Files

- `code/frontend/src/api/*`
- `code/create_app.py`

---

## 🟢 Task 2: Document the Batch/Ingestion Entry Point (Azure Functions)

**Difficulty:** easy | **Time:** 45–60m

Inspect the ingestion/batch workload entrypoint in `code/backend/batch/function_app.py` and map out what triggers exist and what each trigger does at a high level. Add a short section to an existing or new doc under `docs/` explaining how ingestion is invoked locally vs in Azure.

### 🎯 Learning Objective

Understanding Azure Functions structure in Python; separating batch workflows from request/response APIs

### Acceptance Criteria

- [ ] Lists each function trigger found in `function_app.py`
- [ ] Explains inputs/outputs at a conceptual level (queue/blob/timer/etc.)
- [ ] Notes how configuration is provided (env vars/settings) with file references

### Hints

- Look for decorators/registration patterns in `function_app.py`
- Search for local run instructions in `README.md` and relate them to the function entrypoint

### Related Files

- `code/backend/batch/function_app.py`
- `README.md`

---

## 🟢 Task 3: Add a Minimal “Smoke” Unit Test for App Creation

**Difficulty:** easy | **Time:** 30–60m

Create a Python unit test that imports the backend app factory and verifies the application can be created without raising exceptions (and optionally that a health or root route exists if present). Place the test alongside existing Python tests under `code/` (use the repo’s existing test framework/c

### 🎯 Learning Objective

Running and extending the Python test suite; validating app wiring/DI doesn’t regress

### Acceptance Criteria

- [ ] Test runs via the repo’s standard test command
- [ ] Test fails if app creation raises
- [ ] Test is placed in the appropriate test folder and follows existing naming conventions

### Hints

- Inspect `pyproject.toml` for pytest configuration
- Search existing tests under `code/` for patterns/fixtures

### Related Files

- `pyproject.toml`
- `code/**/tests/*.py`

---

## 🟡 Task 4: Add Contract Tests for a Frontend API Wrapper

**Difficulty:** medium | **Time:** 1.5–3h

Pick one API wrapper in `code/frontend/src/api/` (e.g., chat/history) and add unit tests that validate it calls `fetch` with the correct method, URL, headers, and body. Use the frontend’s existing test tooling from `package.json` (e.g., Vitest/Jest) and mock `fetch`.

### 🎯 Learning Objective

Writing TypeScript unit tests; testing API client contracts without hitting the backend

### Acceptance Criteria

- [ ] Tests cover success and error cases (non-2xx)
- [ ] Tests assert request shape (URL/method/body)
- [ ] Tests run in CI/local via the standard frontend test command

### Hints

- Check `package.json` for the configured test runner and scripts
- Use a `fetch` mock/spies and assert on calls rather than responses only

### Related Files

- `package.json`
- `code/frontend/src/api/*`

---

## 🟡 Task 5: Implement and Wire a New Backend “/version” Endpoint + Frontend Display

**Difficulty:** medium | **Time:** 3–5h

Add a backend endpoint that returns build/version information (e.g., git SHA or package version) and expose it in the frontend (e.g., footer or about panel). Backend: implement route in the app created by `code/create_app.py` (or wherever routes are registered) and ensure it’s reachable from `code/a

### 🎯 Learning Objective

Full-stack feature addition; API design; writing tests across Python and TypeScript

### Acceptance Criteria

- [ ] `/version` returns JSON with stable keys (e.g., `version`, `commit`)
- [ ] Frontend displays the value and handles failure gracefully
- [ ] Both Python and frontend tests added and passing

### Hints

- Use environment variables for commit/version to avoid runtime git calls
- Follow existing route patterns in `code/create_app.py` and existing API wrapper patterns in `code/frontend/src/api/`

### Related Files

- `code/create_app.py`
- `code/frontend/src/api/*`

---

## 🟡 Task 6: Trace the Chat Request Path (Frontend → Backend)

**Difficulty:** medium | **Time:** 1-2 hours

Follow a chat request from `code/frontend/src/api/*` through the backend entrypoints in `code/app.py` and `code/create_app.py`; write a short developer note in `docs/` describing the call flow, key functions, and where auth/config is applied.

### 🎯 Learning Objective

Code navigation across a monorepo; understanding request lifecycles and module boundaries

### Acceptance Criteria

- [ ] Document includes the exact frontend function(s) that initiate the request
- [ ] Document names the backend route/handler and the app factory wiring
- [ ] Document explains where configuration/environment is loaded

### Hints

- Start at `code/frontend/src/api/` and search for the chat/history call sites
- Use ripgrep for route names in `code/app.py`

### Related Files

- `code/frontend/src/api`
- `code/app.py`

---

## 🟡 Task 7: Add Backend Unit Tests for a Core API Behavior

**Difficulty:** medium | **Time:** 2-4 hours

Identify one backend API behavior implemented via `code/app.py`/`code/create_app.py` (e.g., request validation, error mapping, or a small helper used by routes) and add/extend unit tests under `code/tests/` to cover success + failure cases.

### 🎯 Learning Objective

Writing focused Python tests; using fixtures/mocking to isolate external services

### Acceptance Criteria

- [ ] Tests include at least one success and one failure case
- [ ] Tests run locally via the repo’s Python test command (per `pyproject.toml`)
- [ ] New tests fail before the fix/change and pass after

### Hints

- Look for existing patterns in `code/tests/` for client/fixture setup
- Prefer testing pure functions/helpers or dependency-injected components over live Azure calls

### Related Files

- `code/tests`
- `pyproject.toml`

---

## 🔴 Task 8: Implement a Small Backend Feature and Wire It to the Frontend API Layer

**Difficulty:** hard | **Time:** 4-6 hours

Add a new lightweight backend endpoint (e.g., `/healthz/details` or `/api/config`) in `code/app.py` (wired via `code/create_app.py`) that returns structured JSON; then add a matching client function in `code/frontend/src/api/*` and a minimal usage point (or export) so it’s callable from the frontend

### 🎯 Learning Objective

Designing API contracts; end-to-end wiring across backend and frontend; maintaining backward compatibility

### Acceptance Criteria

- [ ] Backend endpoint returns JSON with at least 3 fields and appropriate HTTP status codes
- [ ] Frontend API wrapper calls the endpoint and parses the response type-safely
- [ ] Tests added/updated to validate the endpoint response shape

### Hints

- Mirror existing endpoint patterns in `code/app.py`
- In the frontend, follow existing fetch wrapper conventions in `code/frontend/src/api`

### Related Files

- `code/app.py`
- `code/frontend/src/api`

---

## 🔴 Task 9: Refactor Backend App Initialization for Clearer Dependency Injection

**Difficulty:** hard | **Time:** 6-8 hours

Refactor `code/create_app.py` to make dependency construction (clients/services/config) explicit and testable (e.g., extract a `build_services(config)` function or similar); update `code/app.py` accordingly; adjust/add tests to validate the new wiring without changing runtime behavior.

### 🎯 Learning Objective

Refactoring for testability; dependency injection patterns; minimizing behavioral diffs

### Acceptance Criteria

- [ ] No functional behavior changes (existing tests still pass)
- [ ] New unit tests cover service construction with different config inputs
- [ ] Refactor reduces direct global/env access in request handlers

### Hints

- Identify where config is read and where clients are instantiated
- Keep the public app factory signature stable if possible

### Related Files

- `code/create_app.py`
- `code/app.py`

---

## 🔴 Task 10: Add a CI Check That Runs Targeted Tests for Changed Areas

**Difficulty:** hard | **Time:** 6-10 hours

Update or add a GitHub Actions workflow under `.github/workflows/` to run targeted tests when files under `code/` change (Python tests) and when files under `code/frontend/` change (frontend lint/test/build); ensure it integrates cleanly with existing workflows and repo scripts.

### 🎯 Learning Objective

CI pipeline design in monorepos; path filters; balancing coverage vs runtime

### Acceptance Criteria

- [ ] Workflow uses path-based triggers or conditional steps for `code/` vs `code/frontend/`
- [ ] Workflow runs successfully on a PR that changes only backend or only frontend
- [ ] Documentation added to `README.md` describing how CI decides what to run

### Hints

- Review existing workflows in `.github/workflows/` for conventions
- Use `paths`/`paths-ignore` or `if:` conditions with `github.event.pull_request.changed_files` patterns

### Related Files

- `.github/workflows`
- `README.md`

---

