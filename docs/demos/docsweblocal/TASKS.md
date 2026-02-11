# Starter Tasks

Good first issues for new contributors, ordered by difficulty.

## Legend

🟢 Easy (< 1 hour) | 🟡 Medium (1-2 hours) | 🔴 Hard (2+ hours)

## 🟡 Task 1: {1}. Review Code Structure

**Difficulty:** medium | **Time:** 30 minutes

Navigate through the `backend` directory and understand the structure of the codebase. Identify key directories and their functions.
   Difficulty: medium
   Time: 30 minutes
   Learning: Understand file organization and directory structure
   Criteria: Know the location of the `api`, `database`, an

### 🎯 Learning Objective

Understand file organization and directory structure
   Criteria: Know the location of the `api`, `database`, and `orchestrator` directories
   Hints: Use command-line tools like `tree` or `ls -la` to

### Acceptance Criteria

- [ ] Know the location of the `api`, `database`, and `orchestrator` directories
   Hints: Use command-line tools like `tree` or `ls -la` to explore the directory tree
   Files: README.md, package.json, Makefile
   Skills: File navigation, directory structure

### Hints

- Use command-line tools like `tree` or `ls -la` to explore the directory tree
   Files: README.md, package.json, Makefile
   Skills: File navigation, directory structure

### Related Files

- `README.md`
- `package.json`
- `Makefile
   Skills: File navigation`

---

## 🟡 Task 2: {2}. Modify Backend Service Configuration

**Difficulty:** medium | **Time:** 60 minutes

Open the `backend/config.py` file and modify the configuration settings for the backend service. This includes setting up environment variables, configuring logging, and adjusting security settings.
   Difficulty: medium
   Time: 60 minutes
   Learning: Modify configuration files and understand envi

### 🎯 Learning Objective

Modify configuration files and understand environment variables
   Criteria: Change the value of an environment variable (e.g., `DB_HOST`)
   Hints: Use a text editor to edit the file and save changes

### Acceptance Criteria

- [ ] Change the value of an environment variable (e.g., `DB_HOST`)
   Hints: Use a text editor to edit the file and save changes
   Files: backend/config.py
   Skills: File editing, environment variables

### Hints

- Use a text editor to edit the file and save changes
   Files: backend/config.py
   Skills: File editing, environment variables

### Related Files

- `backend/config.py
   Skills: File editing`
- `environment variables`

---

## 🔴 Task 3: {3}. Add New Feature to Frontend

**Difficulty:** hard | **Time:** 90 minutes

Create a new feature in the frontend that allows users to add URLs to contracts. This involves modifying the `frontend/src/components/ContractForm.js` file to include a new input field for URLs and updating the backend service to handle these URLs.
   Difficulty: hard
   Time: 90 minutes
   Learning

### 🎯 Learning Objective

Implement new functionality in React components and backend services
   Criteria: Add a new URL input field to the form and update the backend service to accept and process URLs
   Hints: Use React ho

### Acceptance Criteria

- [ ] Add a new URL input field to the form and update the backend service to accept and process URLs
   Hints: Use React hooks and Axios to make HTTP requests to the backend service
   Files: frontend/src/components/ContractForm.js, backend/src/services/contractService.js
   Skills: React component creation, Axios, backend service integration

### Hints

- Use React hooks and Axios to make HTTP requests to the backend service
   Files: frontend/src/components/ContractForm.js, backend/src/services/contractService.js
   Skills: React component creation, Axios, backend service integration

### Related Files

- `frontend/src/components/ContractForm.js`
- `backend/src/services/contractService.js
   Skills: React component creation`
- `Axios`

---

## 🟡 Task 4: {4}. Test Backend Service Endpoints

**Difficulty:** medium | **Time:** 45 minutes

Write unit tests for the backend service endpoints to ensure they work correctly. This includes testing the `addUrl` endpoint and verifying that it returns the expected response.
   Difficulty: medium
   Time: 45 minutes
   Learning: Write unit tests using Jest or similar testing framework
   Criter

### 🎯 Learning Objective

Write unit tests using Jest or similar testing framework
   Criteria: Write test cases for the `addUrl` endpoint
   Hints: Use Jest's mocking capabilities to simulate different scenarios
   Files: bac

### Acceptance Criteria

- [ ] Write test cases for the `addUrl` endpoint
   Hints: Use Jest's mocking capabilities to simulate different scenarios
   Files: backend/src/tests/unit/api.test.js
   Skills: Unit testing, Jest, mocking

### Hints

- Use Jest's mocking capabilities to simulate different scenarios
   Files: backend/src/tests/unit/api.test.js
   Skills: Unit testing, Jest, mocking

### Related Files

- `backend/src/tests/unit/api.test.js
   Skills: Unit testing`
- `Jest`
- `mocking`

---

## 🔴 Task 5: {5}. Refactor Backend Service Architecture

**Difficulty:** hard | **Time:** 120 minutes

Refactor the backend service architecture to improve scalability and maintainability. This might involve breaking down large components into smaller ones, using microservices, or implementing caching mechanisms.
   Difficulty: hard
   Time: 120 minutes
   Learning: Design and implement microservices

### 🎯 Learning Objective

Design and implement microservices architecture
   Criteria: Break down the `api` service into multiple smaller services
   Hints: Use Docker Compose to manage multiple services and configure load bal

### Acceptance Criteria

- [ ] Break down the `api` service into multiple smaller services
   Hints: Use Docker Compose to manage multiple services and configure load balancing
   Files: backend/docker-compose.yml, backend/src/services/*.js
   Skills: Microservices architecture, Docker, load balancing

### Hints

- Use Docker Compose to manage multiple services and configure load balancing
   Files: backend/docker-compose.yml, backend/src/services/*.js
   Skills: Microservices architecture, Docker, load balancing

### Related Files

- `backend/docker-compose.yml`
- `backend/src/services/*.js
   Skills: Microservices architecture`
- `Docker`

---

## 🟢 Task 6: Review README and documentation

**Difficulty:** easy | **Time:** 30 minutes

Read through the README and any documentation to understand the project

### 🎯 Learning Objective

Learn to navigate project documentation and understand project purpose at a high level

### Acceptance Criteria

- [ ] Summarize the project purpose

### Hints

- Start with README.md

### Related Files

- `README.md`

---

## 🟢 Task 7: Set up local development environment

**Difficulty:** easy | **Time:** 30 minutes

Install dependencies and verify you can run the project

### 🎯 Learning Objective

Learn to set up development environments and manage project dependencies

### Acceptance Criteria

- [ ] Project runs locally

### Hints

- Follow the runbook setup steps

### Related Files

- `package.json`

---

## 🟢 Task 8: Run the test suite

**Difficulty:** easy | **Time:** 30 minutes

Execute all tests and understand the testing strategy

### 🎯 Learning Objective

Learn how automated testing works and how to interpret test results

### Acceptance Criteria

- [ ] All tests pass

### Hints

- Check for test commands in package.json

---

## 🟡 Task 9: Add a missing unit test

**Difficulty:** medium | **Time:** 1 hour

Find an untested function and add test coverage

### 🎯 Learning Objective

Learn to write unit tests and understand code coverage principles

### Acceptance Criteria

- [ ] New test passes
- [ ] Coverage increases

### Hints

- Look for complex functions without tests

---

## 🟢 Task 10: Fix a typo or improve documentation

**Difficulty:** easy | **Time:** 30 minutes

Find and fix documentation issues

### 🎯 Learning Objective

Learn the PR workflow: branch, commit, push, and submit a pull request

### Acceptance Criteria

- [ ] PR submitted with fix

### Hints

- Check code comments and README

---

