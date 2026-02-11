# Contributing to Repo Onboarding Pack Generator

Thank you for your interest in contributing! This document provides guidelines and information for contributors.

## Getting Started

### Prerequisites

- Node.js 20.x or later
- npm 9.x or later
- [Foundry Local](https://github.com/microsoft/foundry) (optional, for AI-powered generation)

### Setup

1. Fork and clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Build the project:
   ```bash
   npm run build
   ```
4. Run tests (when available):
   ```bash
   npm test
   ```

## Development Workflow

### Running in Development Mode

```bash
# CLI mode
npm run dev -- --path ./some-repo

# Web UI mode
npm run web
```

### Code Structure

```
src/
├── index.ts          # CLI entry point
├── server.ts         # Web UI server
├── orchestrator.ts   # Main workflow coordinator
├── localModelClient.ts # Foundry Local API client
├── repoScanner.ts    # Repository analysis
├── validation.ts     # Input validation utilities
└── types.ts          # TypeScript interfaces
```

## Contribution Guidelines

### Code Style

- Use TypeScript for all source files
- Follow the existing code style (2-space indentation)
- Use meaningful variable and function names
- Add JSDoc comments for public APIs

### Commit Messages

Use clear, descriptive commit messages:

```
feat: add support for Python dependency detection
fix: handle empty directories in repo scanner
docs: update README with new CLI options
```

### Pull Request Process

1. Create a feature branch from `main`
2. Make your changes with appropriate tests
3. Ensure the project builds without errors
4. Update documentation if needed
5. Submit a pull request with a clear description

### Pull Request Checklist

- [ ] Code follows the project style guidelines
- [ ] Self-review of the code completed
- [ ] Changes generate no new warnings
- [ ] Documentation updated if needed
- [ ] Commit messages are clear and descriptive

## Types of Contributions

### Bug Reports

- Use GitHub Issues to report bugs
- Include steps to reproduce
- Include expected vs actual behavior
- Include Node.js version and OS information

### Feature Requests

- Use GitHub Issues to suggest features
- Describe the use case
- Explain why the feature would be valuable

### Code Contributions

We welcome contributions including:

- Bug fixes
- New features
- Documentation improvements
- Test coverage improvements
- Performance optimizations

## Security

If you discover a security vulnerability, please follow our [Security Policy](SECURITY.md) for reporting.

## Code of Conduct

Be respectful and constructive in all interactions. We're here to build something useful together.

## Questions?

Feel free to open an issue for any questions about contributing.

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
