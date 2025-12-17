# Test Specification: [Test Suite Name]

> **Feature:** [Link to feature doc]
> **Test Level:** [Unit | Integration | API | UI/E2E]
> **Owner:** [Name or Team]
> **Created:** [YYYY-MM-DD]
> **Last Updated:** [YYYY-MM-DD]

---

## Test Objective

**What behavior is being verified?**

[1-2 paragraphs describing what this test suite validates, why it's important, and how it fits into the overall test strategy.]

---

## Test Environment

### Prerequisites

What must be set up before running these tests?

- **Dependencies:**
  - [Service 1: e.g., Docker container for Supabase]
  - [Service 2: e.g., Test Discord webhook]
  - [Test data: e.g., Seed script or fixture files]

- **Configuration:**
  - [Environment variable 1]
  - [Environment variable 2]

### Test Data

What data is required?

```typescript
// Example test fixture
const testUser = {
  id: "test-user-1",
  email: "test@example.com",
  // ...
};
```

**Data Reset Strategy:**
[How is the database/state cleaned between tests?]

---

## Test Cases

### Test Category 1: [Name] (Positive Flows)

#### Test 1.1: [Descriptive Name]

**Objective:** [What specific behavior is verified]

**Prerequisites:**
- [Initial state or setup]

**Steps:**
1. **Arrange:** [Set up test data]
   ```typescript
   const user = createTestUser();
   ```
2. **Act:** [Execute the action]
   ```typescript
   const result = await uploadFile(user, file);
   ```
3. **Assert:** [Verify the outcome]
   ```typescript
   expect(result.status).toBe('success');
   expect(result.fileId).toBeDefined();
   ```

**Expected Result:**
[What should happen]

**Edge Cases:**
- [Boundary condition to also check]

---

#### Test 1.2: [Descriptive Name]

[Same structure as Test 1.1]

---

### Test Category 2: [Name] (Negative Flows)

#### Test 2.1: [Error Scenario Name]

**Objective:** [What error handling is verified]

**Prerequisites:**
- [Setup that will trigger error]

**Steps:**
1. **Arrange:** [Set up invalid state]
2. **Act:** [Trigger error condition]
3. **Assert:** [Verify graceful handling]
   ```typescript
   expect(result.error).toMatch(/expected error message/);
   expect(systemState).toBe('stable'); // No crash
   ```

**Expected Result:**
[Specific error message, status code, fallback behavior]

---

### Test Category 3: [Name] (Edge Cases)

#### Test 3.1: [Boundary Condition]

**Objective:** [What edge case is verified]

**Prerequisites:**
- [Specific boundary setup]

**Steps:**
1. [Trigger boundary condition]
2. [Verify system handles it correctly]

**Expected Result:**
[How system should behave at boundary]

---

## Test Coverage

### Scenarios Covered

- [x] Main happy path
- [x] Alternative flow 1
- [x] Error condition 1
- [x] Error condition 2
- [x] Edge case 1
- [ ] Edge case 2 (TODO: Reason)

### Scenarios NOT Covered

**Scenario 1:** [What isn't tested]
**Reason:** [Why not - e.g., requires external service, covered by manual testing]
**Risk:** [Impact if this fails in production]

---

## Execution

### Running Tests

```bash
# Command to run this test suite
npm test -- tests/feature-name.test.ts

# Run with coverage
npm test -- --coverage tests/feature-name.test.ts
```

### Expected Runtime

**Duration:** [e.g., ~5 seconds for unit, ~30 seconds for integration]

### CI/CD Integration

- **When:** [On every PR | Nightly | Pre-deployment]
- **Pipeline:** [GitHub Actions workflow name]
- **Failure Action:** [Block merge | Alert team]

---

## Maintenance Notes

### Test Data Management

- **Fixtures Location:** [Path to test fixtures]
- **Data Refresh:** [How often test data is regenerated]
- **Sensitive Data:** [How PII/secrets are handled in tests]

### Known Flakes

**Flake 1:** [Description of intermittent failure]
**Cause:** [Root cause if known]
**Mitigation:** [Retry strategy, fix in progress]

---

## Related Documentation

- **Feature:** [Link to feature doc](file:///path/to/feature)
- **ADR:** [Link to relevant ADR](file:///path/to/adr)
- **Code:**
  - [Implementation](file:///path/to/code)
  - [Test Suite](file:///path/to/test)

---

*Complex test scenarios deserve documentation. This template is for integration/API/UI tests where setup and validation are non-trivial. Simple unit tests don't need this level of detail.*
