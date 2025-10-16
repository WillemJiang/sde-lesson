# Backend Testing Best Practices

Quick reference guide based on lessons learned from stabilizing the backend test suite.

---

## Golden Rules

### 1. **Serial First, Parallel Later**
```
❌ Don't assume tests can run in parallel
✅ Default to serial execution (maxWorkers: 1)
✅ Only parallelize when you have complete data isolation
```

### 2. **Always Filter by User Context**
```typescript
// ❌ Bad - exposes all user data
const orders = await orderService.getOrders();

// ✅ Good - filters by authenticated user
const orders = await orderService.getOrdersByUser(userId);
```

### 3. **Protect Shared Test Resources**
```typescript
// ✅ Register critical test data for protection
testUtils.protectUser(userId);
testUtils.createProduct(productData);  // Auto-protected
```

### 4. **Clean Up Carefully in Multi-Suite Scenarios**
```typescript
// ✅ Reload protected resources before cleanup
const reloadedUsers = reloadFromFile();
await deleteNonProtectedUsers(reloadedUsers);
```

---

## Common Pitfalls & Solutions

| Problem | Cause | Solution |
|---------|-------|----------|
| 401 "Invalid user" | User deleted by another suite | Use `protectUser()` |
| 404 "Not found" | Resource deleted prematurely | Use file-based protection |
| "invalid signature" JWT | JWT_SECRET cached | Use dynamic getters |
| Flaky tests in CI | Parallel execution | Set `maxWorkers: 1` |
| Case sensitivity fails | Exact string matching | Use `.toLowerCase()` |

---

## Test Structure Template

```typescript
describe('API Endpoint', () => {
  let authToken: string;
  let testUserId: string;

  beforeEach(async () => {
    // 1. Create test user
    const user = await createTestUser();
    testUserId = user.id;
    
    // 2. Protect the user from deletion
    testUtils.protectUser(testUserId);
    
    // 3. Get auth token
    authToken = user.token;
  });

  it('should do something', async () => {
    const response = await request(app)
      .get('/api/v1/endpoint')
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);
    
    expect(response.body).toBeDefined();
  });
});
```

---

## Security Checklist

Before merging any API endpoint:

- [ ] Does the endpoint filter by `req.user?.userId`?
- [ ] Does it prevent users from accessing others' data?
- [ ] Is there a test for "prevent access to other users' data"?
- [ ] Does the test fail if you remove the user filter?

---

## Performance Considerations

| Setting | Benefit | Cost |
|---------|---------|------|
| Serial (maxWorkers: 1) | Stable, predictable | Takes ~60s |
| Parallel (maxWorkers: 4) | Fast, ~20s | Flaky, unreliable |

**Recommendation**: Use serial. Test reliability > Speed. Use `npm test` locally and in CI.

---

## Environment Setup

```typescript
// jest.config.ts (Required)
const config: Config = {
  maxWorkers: 1,                                    // Serial execution
  setupFiles: ['<rootDir>/tests/jest-setup.js'],   // Env setup
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'], // DB setup
  testTimeout: 30000,                              // Generous timeout
  // ... other config
};
```

```typescript
// tests/jest-setup.js (First to run)
process.env.NODE_ENV = 'test';  // MUST be first
// ... other setup
```

```typescript
// tests/setup.ts (Runs after jest-setup.js)
beforeAll(async () => {
  prisma = new PrismaClient();
  await prisma.$connect();
  loadProtectedUsers();
  loadProtectedProducts();
});

afterAll(async () => {
  // Reload, cleanup, disconnect
});
```

---

## Debugging Tips

### Show Protected Resources During Test
```typescript
// Temporarily modify setup.ts
beforeEach(() => {
  console.log('Protected users:', Array.from(testUserIds));
  console.log('Protected products:', Array.from(testProductIds));
});
```

### Keep Test Data Between Runs
```typescript
// Comment out cleanup in afterAll during debugging
// const fs.unlinkSync(TEST_USERS_FILE);
```

### Run Single Test
```bash
npm test -- --testNamePattern="should filter products by category"
npm test -- test_products_get.ts
```

### Run Tests Serially (Debug)
```bash
npm test -- --maxWorkers=1 --verbose
```

---

## Common Test Patterns

### Pattern 1: Create User + Test
```typescript
it('should do something with user data', async () => {
  const user = await testUtils.createTestUserWithToken({...});
  testUtils.protectUser(user.user.id);
  
  const response = await request(app)
    .get('/api/v1/user-endpoint')
    .set('Authorization', `Bearer ${user.token}`);
    
  expect(response.status).toBe(200);
});
```

### Pattern 2: Create Product + Test
```typescript
it('should filter products by category', async () => {
  const product = await testUtils.createProduct({
    category: 'electronics'
  });
  // product is auto-protected!
  
  const response = await request(app)
    .get('/api/v1/products?category=electronics');
    
  expect(response.body.data.products).toContain(product);
});
```

### Pattern 3: Multi-User Isolation Test
```typescript
it('should prevent access to other users orders', async () => {
  // User 1 creates order
  const user1Order = await createOrderAsUser(user1Token);
  
  // User 2 tries to access User 1's order
  const response = await request(app)
    .get(`/api/v1/orders/${user1Order.id}`)
    .set('Authorization', `Bearer ${user2Token}`);
    
  expect(response.status).toBe(403 || 401 || 404);
});
```

---

## Key Metrics to Monitor

```bash
# Run these regularly to catch regressions:
npm test                    # All tests
npm run test:contract       # Contract tests only
npm run test:integration    # Integration tests only

# Expected output:
# Test Suites: 30 passed, 30 total
# Tests:       347 passed, 347 total
```

---

## Decision Tree

**Tests running slow?**
→ Are they flaky? If no → OK to leave serial  
→ If yes, suspect parallelism → Force `maxWorkers: 1`

**Getting 401 errors?**
→ Is user data isolated? → Add `testUtils.protectUser()`  
→ Is route filtering by user? → Fix endpoint security

**Tests pass locally but fail in CI?**
→ Database state issue? → Check cleanup logic  
→ Timing issue? → Increase `testTimeout`  
→ Different Node version? → Update CI config

**New test keeps failing?**
→ Run it alone: `npm test -- --testNamePattern="..."`  
→ If passes alone, it's a race condition → Need isolation  
→ If fails alone, it's a real bug → Fix the test

---

## Files to Know

| File | Purpose | Modify? |
|------|---------|---------|
| `jest.config.ts` | Test runner config | ⚠️ Carefully (maxWorkers) |
| `tests/jest-setup.js` | Env initialization | ⚠️ Only for env vars |
| `tests/setup.ts` | Database & utilities | ✅ Add new protections |
| `src/api/*.routes.ts` | API endpoints | ✅ Add user filtering |
| `src/lib/*/*.ts` | Business logic | ✅ Add tests for new features |

---

## Quick Start: Adding a New Test

```typescript
// 1. Create test file
tests/contract/test_new_feature.ts

// 2. Add test template
describe('New Feature', () => {
  let authToken: string;
  
  beforeEach(async () => {
    const user = await testUtils.createTestUserWithToken({...});
    testUtils.protectUser(user.user.id);
    authToken = user.token;
  });
  
  it('should work', async () => {
    const response = await request(app)
      .get('/api/v1/new-endpoint')
      .set('Authorization', `Bearer ${authToken}`);
    expect(response.status).toBe(200);
  });
});

// 3. Run test
npm test -- test_new_feature

// 4. Implement endpoint until test passes
```

---

## Summary

**The Test Triangle** (in order of implementation):

1. **Isolation** → Each test is independent ✅
2. **Security** → User data is filtered properly ✅  
3. **Stability** → Tests run reliably every time ✅

When you have all three, your tests are production-ready.

---

**Last Updated**: 2025-10-16  
**Status**: Active  
**Questions?**: See BACKEND_TEST_MAINTENANCE_MEMO.md for details
