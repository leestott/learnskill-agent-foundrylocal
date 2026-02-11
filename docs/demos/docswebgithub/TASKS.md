# Starter Tasks

Good first issues for new contributors, ordered by difficulty.

## Legend

🟢 Easy (< 1 hour) | 🟡 Medium (1-2 hours) | 🔴 Hard (2+ hours)

## 🟢 Task 1: Explore the RAG Architecture Documentation

**Difficulty:** easy | **Time:** 1-2 hours

Read through the main README.md to understand the solution accelerator's purpose, then explore the docs/ directory to find the architecture diagrams (docs/images/architecture_pg.png, docs/images/architecture_cdb.png). Document the data flow from document upload to chat response.

### 🎯 Learning Objective

Understanding RAG (Retrieval Augmented Generation) patterns and Azure service integration

### Acceptance Criteria

- [ ] Can explain the role of Azure OpenAI and Azure AI Search
- [ ] Can describe the difference between Cosmos DB and PostgreSQL options
- [ ] Can identify the three main application tiers

### Hints

- Start with README.md sections on "About this repo" and "Key features"
- Look for ADRs in docs/design/adrs/ for architectural decisions

### Related Files

- `README.md`
- `docs/integrated_vectorization.md`
- `docs/conversation_flow_options.md`

---

## 🟢 Task 2: Trace the Document Ingestion Pipeline

**Difficulty:** easy | **Time:** 2-3 hours

Follow the code path for document ingestion starting from the Streamlit admin page (code/backend/pages/01_Ingest_Data.py) through to the Azure Functions batch processing (code/backend/batch/). Map out which functions handle each stage of document processing.

### 🎯 Learning Objective

Understanding event-driven serverless architectures and Azure Functions triggers

### Acceptance Criteria

- [ ] Can identify the entry point for file uploads
- [ ] Can explain what batch_start_processing.py does
- [ ] Can describe how embeddings are generated and stored

### Hints

- Look at function_app.py for Azure Function definitions
- Check host.json for function configuration

### Related Files

- `code/backend/pages/01_Ingest_Data.py`
- `code/backend/batch/function_app.py`
- `code/backend/batch/batch_start_processing.py`

---

## 🟢 Task 3: Navigate the React Frontend Chat Components

**Difficulty:** easy | **Time:** 2-3 hours

Explore the frontend chat application in code/frontend/src/. Identify the main components, understand the API integration in src/api/, and trace how user messages flow from input to display. Review the speech-to-text utility implementation.

### 🎯 Learning Objective

React component architecture and TypeScript API patterns

### Acceptance Criteria

- [ ] Can locate the main chat component
- [ ] Can explain how src/api/api.ts communicates with backend
- [ ] Can describe the SpeechToText utility's purpose

### Hints

- Start from index.tsx and follow imports
- Look at src/api/models.ts for data structures

### Related Files

- `code/frontend/src/index.tsx`
- `code/frontend/src/api/api.ts`
- `code/frontend/src/util/SpeechToText.ts`

---

## 🟡 Task 4: Add Unit Tests for Environment Helper

**Difficulty:** medium | **Time:** 3-4 hours

Review the existing test file code/tests/utilities/helpers/test_env_helper.py and add new test cases for edge cases such as missing environment variables, invalid values, or empty strings. Follow the existing pytest patterns and mocking conventions.

### 🎯 Learning Objective

Python unit testing with pytest, mocking environment variables, test coverage improvement

### Acceptance Criteria

- [ ] Tests cover at least 3 new edge cases
- [ ] Tests use proper pytest fixtures and assertions
- [ ] All existing tests still pass

### Hints

- Use pytest's monkeypatch for environment variable mocking
- Review conftest.py for shared fixtures

### Related Files

- `code/tests/utilities/helpers/test_env_helper.py`
- `code/tests/conftest.py`
- `pyproject.toml`

---

## 🟡 Task 5: Extend the Chat History API Tests

**Difficulty:** medium | **Time:** 4-5 hours

Examine the chat history implementation in code/backend/api/chat_history.py and its tests in code/tests/chat_history/. Add integration tests that verify the database factory correctly instantiates either Cosmos DB or PostgreSQL clients based on configuration.

### 🎯 Learning Objective

Database abstraction patterns, factory design pattern, testing database integrations

### Acceptance Criteria

- [ ] Tests verify correct client instantiation for both database types
- [ ] Tests handle configuration edge cases
- [ ] Tests use appropriate mocking for Azure SDK calls

### Hints

- Review test_database_factory.py for existing patterns
- Check test_cosmosdb.py and test_postgresdbservice.py for service-specific mocking

### Related Files

- `code/backend/api/chat_history.py`
- `code/tests/chat_history/test_database_factory.py`
- `code/tests/chat_history/test_cosmosdb.py`

---

## 🟡 Task 6: Add Frontend Component Tests with Jest

**Difficulty:** medium | **Time:** 4-5 hours

Examine the existing frontend test setup in code/frontend/jest.config.ts and setupTests.ts. Create new unit tests for the NoPage component (code/frontend/src/pages/NoPage.tsx) and extend test coverage to include the API module (code/frontend/src/api/api.ts) using mocked fetch responses.

### 🎯 Learning Objective

Jest testing patterns for React components, mocking HTTP requests in TypeScript

### Acceptance Criteria

- [ ] Tests achieve >80% coverage for targeted files
- [ ] Tests properly mock API responses
- [ ] Tests follow existing patterns in NoPage.test.tsx

### Hints

- Review jest.polyfills.js for fetch mocking setup
- Use __mocks__/SampleData.ts for test data patterns

### Related Files

- `code/frontend/jest.config.ts`
- `code/frontend/src/pages/NoPage.test.tsx`
- `code/frontend/src/api/api.ts`

---

## 🟡 Task 7: Enhance the CI Workflow with Test Coverage Reporting

**Difficulty:** medium | **Time:** 3-4 hours

Modify the GitHub Actions CI workflow (.github/workflows/ci.yml) to integrate with the existing comment_coverage.yml workflow. Ensure pytest runs with coverage reporting enabled (as configured in pyproject.toml) and that coverage results are properly uploaded as artifacts.

### 🎯 Learning Objective

GitHub Actions workflow composition, pytest-cov integration, CI/CD best practices

### Acceptance Criteria

- [ ] Coverage report generates successfully in CI
- [ ] Artifacts are uploaded correctly
- [ ] Workflow fails if coverage drops below threshold

### Hints

- Check the Makefile for existing test commands with coverage
- Review pyproject.toml [tool.coverage] sections

### Related Files

- `.github/workflows/ci.yml`
- `.github/workflows/comment_coverage.yml`
- `pyproject.toml`

---

## 🔴 Task 8: Implement a New Search Handler for Hybrid Search

**Difficulty:** hard | **Time:** 8-10 hours

Study the existing search handler implementations in code/tests/search_utilities/ to understand the interface patterns. Design and implement a new hybrid search handler that combines keyword and vector search strategies, following the patterns established in test_azure_search_handler.py and test_pos

### 🎯 Learning Objective

Search algorithm design, Azure AI Search hybrid queries, handler abstraction patterns

### Acceptance Criteria

- [ ] Handler implements the existing search interface
- [ ] Supports configurable keyword/vector weight balance
- [ ] Includes comprehensive unit tests

### Hints

- Review Azure AI Search documentation for hybrid query syntax
- Study test_integrated_vectorization_search_handler.py for advanced patterns

### Related Files

- `code/tests/search_utilities/test_azure_search_handler.py`
- `code/tests/search_utilities/test_postgres_search_handler.py`
- `code/tests/search_utilities/test_search.py`

---

## 🔴 Task 9: Extend Infrastructure with New Bicep Module

**Difficulty:** hard | **Time:** 8-10 hours

Create a new Bicep module in infra/modules/ that provisions Azure Application Insights with custom availability tests for the deployed web applications. Integrate this module into the main.bicep deployment, following the patterns established in existing modules like infra/modules/core/monitor/monito

### 🎯 Learning Objective

Bicep infrastructure-as-code, Azure monitoring services, modular IaC design

### Acceptance Criteria

- [ ] Module follows existing naming conventions from abbreviations.json
- [ ] Integrates cleanly with main.bicep parameters
- [ ] Includes proper resource dependencies

### Hints

- Study infra/modules/app/web.bicep for App Service integration patterns
- Review main.parameters.json for parameter conventions

### Related Files

- `infra/main.bicep`
- `infra/modules/core/monitor/monitoring.bicep`
- `infra/abbreviations.json`

---

## 🔴 Task 10: Refactor Orchestrator Architecture for Plugin System

**Difficulty:** hard | **Time:** 12-15 hours

Analyze the existing orchestrator tests in code/tests/utilities/orchestrator/ covering LangChain, Semantic Kernel, OpenAI Functions, and Prompt Flow. Design and implement a plugin-based architecture that allows runtime registration of new orchestration strategies without modifying core code, followi

### 🎯 Learning Objective

Plugin architecture design, dependency injection, strategy pattern implementation

### Acceptance Criteria

- [ ] Existing orchestrators work without modification
- [ ] New orchestrators can be registered via configuration
- [ ] Architecture documented with ADR in docs/design/adrs/

### Hints

- Study test_orchestrator_base.py for the current abstraction
- Review docs/design/adrs/template.md for ADR format

### Related Files

- `code/tests/utilities/orchestrator/test_orchestrator_base.py`
- `code/tests/utilities/orchestrator/test_semantic_kernel.py`
- `code/tests/utilities/plugins/test_chat_plugin.py`

---

