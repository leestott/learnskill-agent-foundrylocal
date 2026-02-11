# Starter Tasks

Good first issues for new contributors, ordered by difficulty.

## Legend

🟢 Easy (< 1 hour) | 🟡 Medium (1-2 hours) | 🔴 Hard (2+ hours)

## 🟢 Task 1: Fix broken links and tighten README navigation

**Difficulty:** easy | **Time:** 45–90m

Run the link checker workflow locally (or via `make`) and fix any broken/redirecting links in `README.md` and key docs; ensure anchors match headings and relative paths are correct.

### Acceptance Criteria

- [ ] `README.md` links resolve without redirects
- [ ] `docs/` links resolve with correct relative paths
- [ ] `.github/workflows/broken-links-checker.yml` passes on PR

### Hints

- Search for `](http` and `](docs/` patterns to spot common offenders
- verify heading anchors match GitHub’s generated slug rules

### Related Files

- `README.md`
- `.github/workflows/broken-links-checker.yml`

---

## 🟢 Task 2: Add a small backend unit test for chat history API

**Difficulty:** easy | **Time:** 60–120m

Create a focused unit test covering one happy-path and one error-path for the chat history endpoints implemented in `code/backend/api/chat_history.py` (e.g., missing conversation id / invalid payload), and wire it into the existing Python test runner configuration.

### Acceptance Criteria

- [ ] Test file added under the repo’s Python test layout
- [ ] tests run via existing `Makefile`/pytest invocation
- [ ] new test asserts both status code and response body shape

### Hints

- Look for existing pytest patterns and fixtures in the repo to reuse
- prefer FastAPI/Flask test client patterns already used by the project

### Related Files

- `code/backend/api/chat_history.py`
- `pyproject.toml`

---

## 🟢 Task 3: Frontend API client: add a typed wrapper for chat history fetch

**Difficulty:** easy | **Time:** 45–90m

In `code/frontend/src/api/`, add a small typed helper function (and types) to fetch chat history from the backend, and update one call site to use it (keeping behavior identical).

### Acceptance Criteria

- [ ] New function has explicit request/response types
- [ ] existing UI behavior unchanged
- [ ] `npm test`/lint/build passes via root tooling (`package.json`/`Makefile`)

### Hints

- Mirror patterns used by other API modules in `code/frontend/src/api/`
- keep the wrapper thin—no new state management

### Related Files

- `code/frontend/src/api/index.ts`
- `package.json`

---

## 🟡 Task 4: Refactor Makefile targets for clearer local dev flows

**Difficulty:** medium | **Time:** 1.5–3h

Review the root `Makefile` and refactor duplicated command sequences into shared variables/targets (e.g., install/lint/test), while keeping target names and outputs backward compatible.

### Acceptance Criteria

- [ ] No target regressions (existing targets still work)
- [ ] duplication reduced (common commands centralized)
- [ ] updated inline comments for the refactored targets

### Hints

- Use `make -n <target>` before/after to confirm command parity
- prefer pattern rules/variables over copy-paste

### Related Files

- `Makefile`
- `package.json`

---

## 🟡 Task 5: Improve Bicep audit signal by documenting and enforcing baseline

**Difficulty:** medium | **Time:** 1–2h

Update the Bicep audit workflow to produce clearer output and document how to run the same checks locally; add a short section in `README.md` describing the audit purpose and how contributors should address findings.

### Acceptance Criteria

- [ ] `.github/workflows/bicep-audit.yml` emits actionable logs (grouped/annotated if supported)
- [ ] `README.md` includes “Bicep audit” contributor guidance
- [ ] workflow still runs successfully on PRs

### Hints

- Check existing workflow steps for tool versions and flags that affect verbosity
- keep docs minimal and link to the workflow file for source-of-truth

### Related Files

- `.github/workflows/bicep-audit.yml`
- `README.md`

---

## 🟡 Task 6: Improve Local Dev Documentation for Monorepo Workflows

**Difficulty:** medium | **Time:** 1-2 hours

Update `README.md` to include a clear “Local Development” section that covers running backend + frontend together, common `make` targets, and where to configure environment variables; cross-link to any deeper docs in `docs/` if they exist.

### Acceptance Criteria

- [ ] README includes step-by-step commands for running locally
- [ ] README references the correct `Makefile` targets and expected ports
- [ ] Instructions are validated by running the documented commands successfully.

### Hints

- Search `Makefile` for the canonical dev commands and reuse them verbatim
- Check `package.json` scripts for frontend dev server commands and ports.

### Related Files

- `README.md`
- `Makefile`

---

## 🟡 Task 7: Add a Fast Unit Test for Chat History API Contract

**Difficulty:** medium | **Time:** 2-4 hours

Create a unit test that exercises the chat history API module and validates the response shape for a basic “list history” or “get conversation” call; keep it hermetic by mocking external dependencies (storage/DB) and run it via the existing Python test tooling.

### Acceptance Criteria

- [ ] New test file is added and passes locally
- [ ] Test fails if the API response schema changes unexpectedly
- [ ] External services are mocked (no network calls).

### Hints

- Start from `code/backend/api/chat_history.py` and test the smallest callable surface (function/route handler)
- Use `pytest` fixtures and monkeypatching to stub persistence.

### Related Files

- `code/backend/api/chat_history.py`
- `pyproject.toml`

---

## 🔴 Task 8: Refactor Backend App Creation to Reduce Import Side Effects

**Difficulty:** hard | **Time:** 4-6 hours

Audit `code/app.py` and `code/create_app.py` for import-time side effects (env reads, client initialization, logging setup) and refactor so initialization happens inside the app factory; ensure existing entrypoints still work.

### Acceptance Criteria

- [ ] App can be created without requiring all runtime env vars at import time
- [ ] Existing startup paths still function (local run and tests)
- [ ] Refactor reduces global initialization and improves testability.

### Hints

- Move client construction into `create_app()` and pass dependencies via parameters or a lightweight container
- Add a minimal smoke test that imports modules without env configured.

### Related Files

- `code/app.py`
- `code/create_app.py`

---

## 🔴 Task 9: Add CI Coverage for Frontend Type Checking and Linting

**Difficulty:** hard | **Time:** 3-5 hours

Extend the GitHub Actions workflows to run frontend type-check and lint steps in CI (using existing scripts in `package.json`); ensure it runs on PRs and fails the build on errors.

### Acceptance Criteria

- [ ] Workflow runs `npm`/`pnpm` install and executes type-check + lint
- [ ] CI fails when lint/type errors are introduced
- [ ] Workflow changes are documented briefly in the repo (e.g., in README or workflow comments).

### Hints

- Reuse patterns from existing workflows in `.github/workflows/`
- Prefer `npm ci` (or the repo’s chosen package manager) for reproducible installs.

### Related Files

- `.github/workflows/broken-links-checker.yml`
- `package.json`

---

## 🔴 Task 10: Add an End-to-End Test for a Minimal “Chat Roundtrip”

**Difficulty:** hard | **Time:** 1-2 days

Implement a new e2e test that starts from the existing harness in `tests/` and validates a minimal chat roundtrip: frontend (or API client) sends a message, backend returns a response, and the conversation is persisted/retrievable via chat history; make it runnable locally and in CI where applicable

### Acceptance Criteria

- [ ] New e2e test is deterministic (no flaky timing assumptions)
- [ ] Test validates both response and persistence via a follow-up history call
- [ ] Test is integrated into existing test runner/Makefile target.

### Hints

- Look for existing e2e scaffolding under `tests/` and copy the setup/teardown patterns
- If LLM calls are involved, use a stubbed mode or recorded responses to keep it stable.

### Related Files

- `tests/`
- `Makefile`

---

