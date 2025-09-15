# Tasks: E-Commerce Website with User Authentication and Product Management

**Input**: Design documents from `/specs/001-i-want-to/`
**Prerequisites**: plan.md, research.md, data-model.md, contracts/api.yaml, quickstart.md
**Tech Stack**: React/TypeScript frontend, Node.js/Express backend, SQLite/PostgreSQL, Stripe

## Current Status: 48/94 Tasks Complete (51%)
**Phase**: Setup Complete ✅ | Contract Tests Complete ✅ | Integration Tests Complete ✅ | Database Models Complete ✅ | Library Services Complete ✅ | API Endpoints Complete ✅ | Frontend Implementation Pending

## Execution Flow (main)
```
1. Load plan.md from feature directory → Extract tech stack, libraries, structure
2. Load design documents:
   → data-model.md: Extract 7 entities → model tasks
   → contracts/api.yaml: Extract 18 endpoints → contract tests + implementation
   → research.md: Extract tech decisions → setup tasks
   → quickstart.md: Extract 7 scenarios → integration tests
3. Generate tasks by category:
   → Setup: project structure, dependencies, linting, config
   → Tests: 18 contract tests, 7 integration tests (all [P])
   → Core: 7 models, 6 services, 7 API endpoint files
   → Integration: DB, middleware, logging, security
   → Polish: unit tests, performance, docs, E2E tests
4. Apply task rules:
   → Different files = mark [P] for parallel execution
   → Same file = sequential (no [P])
   → Tests before implementation (TDD)
5. Number tasks sequentially (T001-T060)
6. Generate dependency graph
7. Create parallel execution examples
8. Validate task completeness: All 18 contracts tested, 7 entities modeled
9. Return: SUCCESS (tasks ready for execution)
```

## Format: `[ID] [P?] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- All paths absolute from repository root

## Phase 3.1: Setup
- [x] T001 Create project structure with backend/ and frontend/ directories
- [x] T002 Initialize backend Node.js project with TypeScript and dependencies
- [x] T003 Initialize frontend React project with TypeScript and dependencies
- [x] T004 [P] Configure ESLint and Prettier for backend
- [x] T005 [P] Configure ESLint and Prettier for frontend
- [x] T006 Set up Prisma ORM with SQLite (dev) and PostgreSQL (prod) configuration
- [x] T007 Configure environment variables and .env files
- [x] T008 Set up Jest testing framework for backend
- [x] T009 [P] Set up React Testing Library and Playwright for frontend
- [x] T010 Configure Stripe API integration

## Phase 3.2: Tests First (TDD) ✅ COMPLETE
**All tests (contract + integration) are now ready and should fail before implementation**

### Contract Tests [P] - All can run in parallel
- [x] T011 [P] Contract test POST /auth/register in backend/tests/contract/test_auth_register.ts
- [x] T012 [P] Contract test POST /auth/login in backend/tests/contract/test_auth_login.ts
- [x] T013 [P] Contract test POST /auth/verify in backend/tests/contract/test_auth_verify.ts
- [x] T014 [P] Contract test GET /products in backend/tests/contract/test_products_get.ts
- [x] T015 [P] Contract test POST /products in backend/tests/contract/test_products_post.ts
- [x] T016 [P] Contract test GET /products/{id} in backend/tests/contract/test_products_get_id.ts
- [x] T017 [P] Contract test PUT /products/{id} in backend/tests/contract/test_products_put_id.ts
- [x] T018 [P] Contract test DELETE /products/{id} in backend/tests/contract/test_products_delete_id.ts
- [x] T019 [P] Contract test GET /cart in backend/tests/contract/test_cart_get.ts
- [x] T020 [P] Contract test POST /cart/items in backend/tests/contract/test_cart_items_post.ts
- [x] T021 [P] Contract test PUT /cart/items/{id} in backend/tests/contract/test_cart_items_put_id.ts
- [x] T022 [P] Contract test DELETE /cart/items/{id} in backend/tests/contract/test_cart_items_delete_id.ts
- [x] T023 [P] Contract test GET /orders in backend/tests/contract/test_orders_get.ts
- [x] T024 [P] Contract test POST /orders in backend/tests/contract/test_orders_post.ts
- [x] T025 [P] Contract test GET /orders/{id} in backend/tests/contract/test_orders_get_id.ts
- [x] T026 [P] Contract test POST /orders/{id}/cancel in backend/tests/contract/test_orders_cancel_post.ts
- [x] T027 [P] Contract test POST /payments/create-payment-intent in backend/tests/contract/test_payments_create_intent.ts
- [x] T028 [P] Contract test POST /payments/{id}/confirm in backend/tests/contract/test_payments_confirm_post.ts
- [x] T029 [P] Contract test GET /users/profile in backend/tests/contract/test_users_profile_get.ts
- [x] T030 [P] Contract test PUT /users/profile in backend/tests/contract/test_users_profile_put.ts

### Integration Tests [P] - All can run in parallel
- [x] T031 [P] Integration test user registration and email verification in backend/tests/integration/test_user_registration.js
- [x] T032 [P] Integration test authentication flow (login/logout) in backend/tests/integration/test_auth_flow.js
- [x] T033 [P] Integration test product browsing and search in backend/tests/integration/test_product_browsing.js
- [x] T034 [P] Integration test shopping cart management in backend/tests/integration/test_cart_management.js
- [x] T035 [P] Integration test order creation and payment flow in backend/tests/integration/test_order_payment.js
- [x] T036 [P] Integration test order management and cancellation in backend/tests/integration/test_order_management.js
- [x] T037 [P] Integration test user profile management in backend/tests/integration/test_user_profile.js

## Phase 3.3: Core Implementation (ONLY after tests are failing) ⚠️ READY TO START

### Database Models [P] - All can run in parallel
- [x] T038 [P] User model in backend/src/models/User.ts
- [x] T039 [P] Product model in backend/src/models/Product.ts
- [x] T040 [P] ShoppingCart model in backend/src/models/ShoppingCart.ts
- [x] T041 [P] CartItem model in backend/src/models/CartItem.ts
- [x] T042 [P] Order model in backend/src/models/Order.ts
- [x] T043 [P] OrderItem model in backend/src/models/OrderItem.ts
- [x] T044 [P] Payment model in backend/src/models/Payment.ts

### Library Services [P] - All can run in parallel
- [x] T045 [P] Auth library with JWT in backend/src/lib/auth/AuthService.ts
- [x] T046 [P] Product management library in backend/src/lib/product/ProductService.ts
- [x] T047 [P] Shopping cart library in backend/src/lib/cart/CartService.ts
- [x] T048 [P] Order processing library in backend/src/lib/order/OrderService.ts
- [x] T049 [P] Payment processing library in backend/src/lib/payment/PaymentService.ts
- [x] T050 [P] User management library in backend/src/lib/user/UserService.ts

### API Endpoints (Sequential - all modify route files)
- [x] T051 Authentication endpoints (register, login, verify) in backend/src/api/auth.routes.ts
- [x] T052 Product endpoints (CRUD operations) in backend/src/api/product.routes.ts
- [x] T053 Shopping cart endpoints in backend/src/api/cart.routes.ts
- [x] T054 Order endpoints in backend/src/api/order.routes.ts
- [x] T055 Payment endpoints in backend/src/api/payment.routes.ts
- [x] T056 User profile endpoints in backend/src/api/user.routes.ts
- [x] T057 API router and middleware setup in backend/src/api/index.ts

### Frontend Implementation [P] - Can run in parallel
- [ ] T058 [P] Authentication components (Login, Register, Verify) in frontend/src/components/auth/
- [ ] T059 [P] Product components (List, Detail, Search) in frontend/src/components/product/
- [ ] T060 [P] Shopping cart components in frontend/src/components/cart/
- [ ] T061 [P] Order components in frontend/src/components/order/
- [ ] T062 [P] User profile components in frontend/src/components/user/
- [ ] T063 [P] Page components and routing in frontend/src/pages/
- [ ] T064 [P] API service layer in frontend/src/services/
- [ ] T065 [P] Custom hooks in frontend/src/hooks/

## Phase 3.4: Integration

### Backend Integration
- [ ] T066 Database connection and Prisma client setup in backend/src/config/database.ts
- [ ] T067 JWT authentication middleware in backend/src/middleware/auth.ts
- [ ] T068 Input validation middleware in backend/src/middleware/validation.ts
- [ ] T069 Error handling middleware in backend/src/middleware/error.ts
- [ ] T070 CORS and security middleware in backend/src/middleware/security.ts
- [ ] T071 Logging and observability setup in backend/src/config/logging.ts
- [ ] T072 Environment configuration management in backend/src/config/env.ts
- [ ] T073 Stripe webhook handler in backend/src/webhooks/stripe.ts

### Frontend Integration
- [ ] T074 State management setup (Redux/Context) in frontend/src/store/
- [ ] T075 React Router configuration in frontend/src/App.tsx
- [ ] T076 API integration with React Query/SWR in frontend/src/services/api.ts
- [ ] T077 Form handling and validation in frontend/src/utils/validation.ts
- [ ] T078 Error handling and user notifications in frontend/src/utils/notifications.ts
- [ ] T079 Responsive design and styling setup in frontend/src/styles/

## Phase 3.5: Polish

### Testing [P] - Can run in parallel
- [ ] T080 [P] Unit tests for utilities in backend/tests/unit/test_utils.js
- [ ] T081 [P] Unit tests for middleware in backend/tests/unit/test_middleware.js
- [ ] T082 [P] Unit tests for services in backend/tests/unit/test_services.js
- [ ] T083 [P] Component tests in frontend/tests/component/
- [ ] T084 [P] Performance tests (<500ms API response) in backend/tests/performance/
- [ ] T085 [P] End-to-end tests with Playwright in frontend/tests/e2e/

### Documentation and Quality
- [ ] T086 API documentation update in backend/docs/api.md
- [ ] T087 README.md with setup and usage instructions
- [ ] T088 Library documentation (llms.txt format) for each library
- [ ] T089 Code review and refactoring
- [ ] T090 Security audit and vulnerability fixes
- [ ] T091 Performance optimization and caching strategies
- [ ] T092 Database query optimization
- [ ] T093 Frontend bundle size optimization
- [ ] T094 Run comprehensive test suite and quickstart validation

## Dependencies

### Critical Dependencies
- **Setup (T001-T010)** blocks all other tasks
- **Tests (T011-T037)** MUST complete before any implementation (T038+)
- **Models (T038-T044)** block **Services (T045-T050)**
- **Services (T045-T050)** block **Endpoints (T051-T057)**
- **Backend integration (T066-T073)** must follow backend endpoints
- **Frontend implementation (T058-T079)** depends on API endpoints being complete

### Parallel Groups
```
Group 1 (Setup): T001-T010
Group 2 (Tests): T011-T037 [ALL P]
Group 3 (Models): T038-T044 [ALL P]
Group 4 (Services): T045-T050 [ALL P]
Group 5 (Frontend Components): T058-T065 [ALL P]
Group 6 (Unit Tests): T080-T085 [ALL P]
```

### Sequential Chains
```
T001-T010 → T011-T037 → T038-T044 → T045-T050 → T051-T057 → T066-T073 → T058-T079 → T080-T094
```

## Parallel Execution Examples

### Example 1: Contract Tests (T011-T030)
```bash
# Launch all contract tests in parallel:
Task: "Contract test POST /auth/register in backend/tests/contract/test_auth_register.js"
Task: "Contract test POST /auth/login in backend/tests/contract/test_auth_login.js"
Task: "Contract test POST /auth/verify in backend/tests/contract/test_auth_verify.js"
Task: "Contract test GET /products in backend/tests/contract/test_products_get.js"
# ... continue for all 20 contract tests
```

### Example 2: Model Creation (T038-T044)
```bash
# Launch all model creation tasks in parallel:
Task: "User model in backend/src/models/User.ts"
Task: "Product model in backend/src/models/Product.ts"
Task: "ShoppingCart model in backend/src/models/ShoppingCart.ts"
Task: "CartItem model in backend/src/models/CartItem.ts"
Task: "Order model in backend/src/models/Order.ts"
Task: "OrderItem model in backend/src/models/OrderItem.ts"
Task: "Payment model in backend/src/models/Payment.ts"
```

### Example 3: Service Libraries (T045-T050)
```bash
# Launch all service library tasks in parallel:
Task: "Auth library with JWT in backend/src/lib/auth/AuthService.ts"
Task: "Product management library in backend/src/lib/product/ProductService.ts"
Task: "Shopping cart library in backend/src/lib/cart/CartService.ts"
Task: "Order processing library in backend/src/lib/order/OrderService.ts"
Task: "Payment processing library in backend/src/lib/payment/PaymentService.ts"
Task: "User management library in backend/src/lib/user/UserService.ts"
```

## Task Generation Rules Applied

### From Contracts (api.yaml)
- 1 contract file → 20 contract test tasks [T011-T030, all P]
- 18 endpoints → 7 implementation tasks [T051-T057]

### From Data Model
- 7 entities → 7 model creation tasks [T038-T044, all P]
- 7 entities → 6 service layer tasks [T045-T050, all P]

### From User Stories (quickstart.md)
- 7 scenarios → 7 integration test tasks [T031-T037, all P]
- Validation scenarios → polish and testing tasks [T080-T094]

### Constitution Compliance
- Library-first architecture: 6 independent libraries [T045-T050]
- TDD enforced: Tests (T011-T037) before implementation (T038+)
- Real dependencies: Actual DB setup [T006, T066]

## Validation Checklist
- [x] All 18 contracts have corresponding tests [T011-T030]
- [x] All 7 integration tests are complete [T031-T037]
- [x] All 7 entities have model tasks [T038-T044]
- [x] All tests (T011-T037) come before implementation (T038+)
- [x] Parallel tasks are truly independent (different files)
- [x] Each task specifies exact file path
- [x] No [P] task modifies same file as another [P] task
- [x] Constitutional requirements satisfied
- [x] Estimated 94 tasks complete the full implementation

## Notes
- [P] tasks = different files, no dependencies → safe for parallel execution
- Verify ALL tests fail before implementing ANY functionality
- Commit after each task with descriptive messages
- Follow RED-GREEN-REFACTOR cycle strictly
- Use real databases (SQLite/PostgreSQL) for all tests