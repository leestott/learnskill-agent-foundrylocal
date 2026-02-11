# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 1.x.x   | :white_check_mark: |

## Reporting a Vulnerability

We take security seriously. If you discover a security vulnerability, please report it responsibly.

### How to Report

1. **Do NOT** create a public GitHub issue for security vulnerabilities
2. Email security concerns to the repository maintainers
3. Include as much detail as possible:
   - Description of the vulnerability
   - Steps to reproduce
   - Potential impact
   - Suggested fix (if any)

### What to Expect

- **Acknowledgment**: We'll acknowledge receipt within 48 hours
- **Assessment**: We'll assess the vulnerability and its impact
- **Resolution**: We'll work on a fix and coordinate disclosure
- **Credit**: We'll credit reporters in the release notes (unless you prefer anonymity)

## Security Considerations

### Input Validation

This tool processes user-provided paths and URLs. We implement:

- **Path validation**: Prevents path traversal attacks (`../` sequences)
- **URL validation**: Only allows HTTPS GitHub URLs with strict format checking
- **Command injection prevention**: Uses `spawnSync` with array arguments instead of string interpolation

### Local Model Communication

- Foundry Local runs locally on `localhost:5273` by default
- No credentials are transmitted to external services
- Model responses are processed locally

### File System Access

- The tool reads repository contents for analysis
- Output files are written to user-specified directories
- No sensitive file access outside the target repository

### Dependencies

We regularly audit dependencies for known vulnerabilities:

```bash
npm audit
```

### Best Practices

When using this tool:

1. **Review generated content** before sharing publicly
2. **Don't include secrets** in repositories being analyzed
3. **Keep dependencies updated** with `npm update`
4. **Run security audits** with `npm audit`

## Security Updates

Security patches will be released as soon as fixes are available. Monitor the repository releases for updates.

## Scope

This security policy covers:

- The core `repo-onboarding-pack` tool
- The web UI server component
- Official documentation

Out of scope:

- Third-party dependencies (report to respective maintainers)
- Foundry Local itself (report to Microsoft)
- User-generated content

## Security Checklist for Contributors

Before submitting code:

- [ ] No hardcoded credentials or secrets
- [ ] User inputs are validated
- [ ] File paths are sanitized
- [ ] External URLs are validated
- [ ] No use of `eval()` or similar
- [ ] Dependencies are from trusted sources
- [ ] Sensitive data is not logged

## Acknowledgments

We appreciate responsible disclosure from security researchers helping keep this project secure.
