
# Test Strategy

> **Last Updated:** 2025-12-18
> **MCAF-Compliant Testing Discipline**

---

## Test Levels

| Level | Scope | Tools | Coverage Target |
|-------|-------|-------|-----------------|
| **Unit** | Pure functions, utils | Vitest | Critical algorithms only |
| **Integration** | Components + real services | Vitest + Docker | Primary focus |
| **API** | Server endpoints | Supertest | All endpoints |
| **E2E** | Full user flows | Playwright | Critical paths |

---

## Coverage Expectations (MCAF Standards)

### Core Principle

> **Each significant feature or functional behavior has sufficient tests to cover its possible cases; at minimum, one integration-level test for the core flow.**

One test is the **minimum**, not the **target**. Complex features require multiple tests for different scenarios.

### By Feature Type

**User-Facing Features:**
- **Minimum:** 1 integration/API test for happy path
- **Standard:** Happy path + 2-3 error scenarios + 1-2 edge cases
- **Critical:** Happy path + comprehensive error coverage + UI/E2E test

**Public API Endpoints:**
- **Minimum:** 1 test per endpoint
- **Complex endpoints:** Multiple tests for different inputs, auth states, error conditions

**UI Flows:**
- **Critical paths:** At least 1 UI/E2E test (upload, download, delete, share)
- **Alternative flows:** Integration tests (don't need full browser)

**Unit Tests:**
- Only for complex algorithms (encryption, chunking, parsing)
- Not required for simple getters/setters
- Not for React components (prefer integration tests)

### Specific Coverage Targets

- **Encryption/Decryption Logic:** 100% branch coverage (security-critical)
- **File Operations:** Integration test for each operation (upload, download, delete, move, rename)
- **API Endpoints:** At least one test per endpoint; complex endpoints have tests for different input variations
- **UI Flows:** E2E for critical paths (upload, download, delete)
- **Error Handling:** All error paths have tests

---

## Code Coverage Measurement

### Tool: c8 (for Node.js/Vite)

```bash
# Run tests with coverage
npm test -- --coverage

# Generate HTML report
npm test -- --coverage --reporter=html
```

### Interpretation

**Coverage is a tool for finding gaps, not a target to game.**

- **70%+ coverage for critical modules** = Good
- **100% coverage with weak assertions** = Bad
- **50% coverage with meaningful tests** = Better than 90% with shallow tests

### Coverage Report Review

Check coverage report for:
- ✅ **Uncovered branches:** Are these edge cases or dead code?
- ✅ **Untested functions:** Are these critical or trivial?
- ❌ **Don't game coverage:** Adding tests that don't assert behavior to hit 100% is forbidden

---

## Test Quality Standards

### Each Test Must:

- [x] **Verify a real flow or scenario**, not just call a function
- [x] **Have meaningful assertions** (not just `expect(result).toBeDefined()`)
- [x] **Test behavior, not implementation** (don't test internal state)
- [x] **Be independent** (tests don't depend on each other)
- [x] **Be deterministic** (same input = same output, no flaky tests)

### Forbidden Patterns

❌ **Tests without assertions:**
```typescript
// ❌ BAD: No verification
test('uploadFile executes', async () => {
  await uploadFile(file);
  // No assertion - useless test
});
```

✅ **Good test:**
```typescript
// ✅ GOOD: Verifies outcome
test('uploadFile stores metadata in database', async () => {
  const result = await uploadFile(file);

  expect(result.status).toBe('success');
  expect(result.fileId).toMatch(/^[a-f0-9-]{36}$/); // UUID format

  const stored = await db.files.findById(result.fileId);
  expect(stored.name).toBe(file.name);
  expect(stored.size).toBe(file.size);
});
```

---

## Test Environment Setup

### Integration/API Tests

Integration tests run against **real infrastructure** (no mocks for internal services).

**Docker Compose Configuration:**

```yaml
# docker-compose.test.yml
version: '3.8'
services:
  postgres:
    image: supabase/postgres:15
    environment:
      POSTGRES_PASSWORD: test
      POSTGRES_DB: wyvern_test
    ports:
      - "5433:5432"

  discord-mock:
    image: mockserver/mockserver:latest
    ports:
      - "1080:1080"
```

**Start Test Environment:**

```bash
# Start containers
docker-compose -f docker-compose.test.yml up -d

# Run migrations
npm run db:migrate:test

# Run tests
npm run test:integration

# Cleanup
docker-compose -f docker-compose.test.yml down
```

### Test Data Management

**Fixtures:**
- Located in `tests/fixtures/`
- JSON files for test users, files, folders
- Reset before each test suite

```typescript
// Example fixture
// tests/fixtures/test-user.json
{
  "id": "test-user-1",
  "email": "test@wyvern.app",
  "password": "SecureTestPass123!"
}
```

**Database Reset Strategy:**

```typescript
// Before each test suite
beforeAll(async () => {
  await db.migrate.latest();
  await seedTestData();
});

afterAll(async () => {
  await db.destroy();
});
```

---

## Running Tests

### Commands

```bash
# Unit tests (fast, no Docker)
npm test

# Integration tests (requires Docker)
npm run test:integration

# E2E tests (requires running web app)
npm run test:e2e

# All tests + coverage
npm run test:all

# Watch mode (for TDD)
npm test -- --watch
```

### CI/CD Integration

Tests run on every PR via GitHub Actions:

```yaml
# .github/workflows/test.yml
- name: Run tests
  run: |
    docker-compose -f docker-compose.test.yml up -d
    npm run test:all
    docker-compose -f docker-compose.test.yml down
```

---

## What to Test (Checklist)

### File Upload

- [ ] Single file upload succeeds
- [ ] Large file (> 25MB) is chunked correctly
- [ ] Encryption is applied when enabled
- [ ] Progress callback is called with correct percentages
- [ ] Rate limit retry logic works
- [ ] Network failure is retried
- [ ] Duplicate filename creates version

### File Download

- [ ] Download reconstructs original file (byte-for-byte)
- [ ] Decryption works with correct key
- [ ] Wrong decryption key fails gracefully with error message
- [ ] Large file chunks are fetched in order
- [ ] Partial download can resume

### Folder Operations

- [ ] Folder upload preserves directory structure
- [ ] Folder download creates valid ZIP
- [ ] Recursive delete removes all children
- [ ] Move folder updates all file paths

### Versioning

- [ ] New upload of existing file creates version
- [ ] Restore replaces current with old version
- [ ] Version delete removes from history
- [ ] Version list shows all revisions

### Sharing

- [ ] Public share generates valid link
- [ ] Private share requires authentication
- [ ] Expired share returns 404
- [ ] Share delete revokes access

### Authentication

- [ ] Login with valid credentials succeeds
- [ ] Login with invalid credentials fails
- [ ] Session persists across page refresh
- [ ] Logout clears session

---

## Mocking Strategy (MCAF Compliance)

### Internal Systems: NO MOCKS

**Never mock:**
- ❌ Database (use real Postgres via Docker)
- ❌ File manager (use real file system or temp directory)
- ❌ Supabase client (use local Supabase instance)

### External Systems: MOCKS ALLOWED

**Mock only when necessary:**
- ✅ Discord API (use mock server to avoid rate limits)
- ✅ External webhooks (use test endpoints)
- ✅ Payment gateways (use sandbox/test accounts)

**When mocking external APIs:**
- Mock server must realistically match real API (same endpoints, fields, errors)
- Update mock when external API changes
- Document mock limitations

---

## Test Organization

```
tests/
├── unit/
│   ├── encryption.test.ts
│   └── chunking.test.ts
├── integration/
│   ├── file-upload.test.ts
│   ├── file-download.test.ts
│   └── folder-operations.test.ts
├── api/
│   └── endpoints.test.ts
├── e2e/
│   ├── upload-flow.spec.ts
│   └── share-flow.spec.ts
├── fixtures/
│   ├── test-user.json
│   └── test-files.json
└── helpers/
    ├── db-setup.ts
    └── mock-discord.ts
```

---

## Failure Handling

### When Tests Fail

1. **Never delete or weaken a test** to make it pass
2. **Fix the code or the test** (if test is wrong)
3. **Document flaky tests** (and fix root cause ASAP)

### Flaky Test Policy

- **Flaky tests are bugs**, not acceptable
- If test fails intermittently, investigate immediately
- Common causes: race conditions, timing dependencies, shared state

---

## Related Documentation

- **AGENTS.md:** [Testing Discipline](file:///d:/COMPROG/Wyvern%20Drive/AGENTS.md)
- **Templates:** [Test-Template.md](file:///d:/COMPROG/Wyvern%20Drive/docs/templates/Test-Template.md)
- **Features:** All feature docs include test flows

