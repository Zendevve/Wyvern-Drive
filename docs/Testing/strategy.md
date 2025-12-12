# Test Strategy

## Test Levels

| Level | Scope | Tools |
|-------|-------|-------|
| Unit | Pure functions, utils | Vitest |
| Integration | Components + real services | Vitest + Docker |
| API | Server endpoints | Supertest |
| E2E | Full user flows | Playwright |

## Coverage Goals

- **Encryption/Decryption**: 100% branch coverage
- **File Operations**: Integration test for each operation
- **API Endpoints**: At least one test per endpoint
- **UI Flows**: E2E for critical paths (upload, download, delete)

## Running Tests

```bash
# Unit tests
npm test

# Integration tests (requires Docker)
npm run test:integration

# E2E tests
npm run test:e2e
```

## Test Environment

Integration tests use Docker Compose to spin up:
- SQLite database (file-based, reset between tests)
- Mock Discord webhook server (for testing without hitting real Discord)

## What to Test

### File Upload
- [ ] Single file upload succeeds
- [ ] Large file is chunked correctly
- [ ] Encryption is applied when enabled
- [ ] Progress callback is called

### File Download
- [ ] Download reconstructs original file
- [ ] Decryption works with correct key
- [ ] Wrong key fails gracefully

### Folder Operations
- [ ] Folder upload preserves structure
- [ ] Folder download creates valid ZIP
- [ ] Recursive delete removes all children

### Versioning
- [ ] New upload creates version
- [ ] Restore replaces current with old version
- [ ] Version delete removes from history
