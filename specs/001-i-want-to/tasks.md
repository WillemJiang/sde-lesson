# Tasks: E-Commerce Website with User Authentication and Product Management

**Input**: Design documents from `/specs/001-i-want-to/`
**Prerequisites**: plan.md, research.md, data-model.md, contracts/api.yaml, quickstart.md
**Tech Stack**: React/TypeScript frontend, Node.js/Express backend, SQLite/PostgreSQL, Stripe

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
   → Core: 7 models, 6 services, 18 endpoints, 6 CLI commands
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
- [ ] T001 Create project structure with backend/ and frontend/ directories
- [ ] T002 Initialize backend Node.js project with TypeScript and dependencies
- [ ] T003 Initialize frontend React project with TypeScript and dependencies
- [ ] T004 [P] Configure ESLint and Prettier for backend
- [ ] T005 [P] Configure ESLint and Prettier for frontend
- [ ] T006 Set up Prisma ORM with SQLite (dev) and PostgreSQL (prod) configuration
- [ ] T007 Configure environment variables and .env files
- [ ] T008 Set up Jest testing framework for backend
- [ ] T009 [P] Set up React Testing Library and Playwright for frontend
- [ ] T010 Configure Stripe API integration

## Phase 3.2: Tests First (TDD) ⚠️ MUST COMPLETE BEFORE 3.3
**CRITICAL: These tests MUST be written and MUST FAIL before ANY implementation**

### Contract Tests [P] - All can run in parallel
- [ ] T011 [P] Contract test POST /auth/register in backend/tests/contract/test_auth_register.js
- [ ] T012 [P] Contract test POST /auth/login in backend/tests/contract/test_auth_login.js
- [ ] T013 [P] Contract test POST /auth/verify in backend/tests/contract/test_auth_verify.js
- [ ] T014 [P] Contract test GET /products in backend/tests/contract/test_products_get.js
- [ ] T015 [P] Contract test POST /products in backend/tests/contract/test_products_post.js
- [ ] T016 [P] Contract test GET /products/{id} in backend/tests/contract/test_products_get_id.js
- [ ] T017 [P] Contract test PUT /products/{id} in backend/tests/contract/test_products_put_id.js
- [ ] T018 [P] Contract test DELETE /products/{id} in backend/tests/contract/test_products_delete_id.js
- [ ] T019 [P] Contract test GET /cart in backend/tests/contract/test_cart_get.js
- [ ] T020 [P] Contract test POST /cart/items in backend/tests/contract/test_cart_items_post.js
- [ ] T021 [P] Contract test PUT /cart/items/{id} in backend/tests/contract/test_cart_items_put_id.js
- [ ] T022 [P] Contract test DELETE /cart/items/{id} in backend/tests/contract/test_cart_items_delete_id.js
- [ ] T023 [P] Contract test GET /orders in backend/tests/contract/test_orders_get.js
- [ ] T024 [P] Contract test POST /orders in backend/tests/contract/test_orders_post.js
- [ ] T025 [P] Contract test GET /orders/{id} in backend/tests/contract/test_orders_get_id.js
- [ ] T026 [P] Contract test POST /orders/{id}/cancel in backend/tests/contract/test_orders_cancel_post.js
- [ ] T027 [P] Contract test POST /payments/create-payment-intent in backend/tests/contract/test_payments_create_intent.js
- [ ] T028 [P] Contract test POST /payments/{id}/confirm in backend/tests/contract/test_payments_confirm_post.js
- [ ] T029 [P] Contract test GET /users/profile in backend/tests/contract/test_users_profile_get.js
- [ ] T030 [P] Contract test PUT /users/profile in backend/tests/contract/test_users_profile_put.js

### Integration Tests [P] - All can run in parallel
- [ ] T031 [P] Integration test user registration and email verification in backend/tests/integration/test_user_registration.js
- [ ] T032 [P] Integration test authentication flow (login/logout) in backend/tests/integration/test_auth_flow.js
- [ ] T033 [P] Integration test product browsing and search in backend/tests/integration/test_product_browsing.js
- [ ] T034 [P] Integration test shopping cart management in backend/tests/integration/test_cart_management.js
- [ ] T035 [P] Integration test order creation and payment flow in backend/tests/integration/test_order_payment.js
- [ ] T036 [P] Integration test order management and cancellation in backend/tests/integration/test_order_management.js
- [ ] T037 [P] Integration test user profile management in backend/tests/integration/test_user_profile.js

## Phase 3.3: Core Implementation (ONLY after tests are failing)

### Database Models [P] - All can run in parallel
- [ ] T038 [P] User model in backend/src/models/User.ts
- [ ] T039 [P] Product model in backend/src/models/Product.ts
- [ ] T040 [P] ShoppingCart model in backend/src/models/ShoppingCart.ts
- [ ] T041 [P] CartItem model in backend/src/models/CartItem.ts
- [ ] T042 [P] Order model in backend/src/models/Order.ts
- [ ] T043 [P] OrderItem model in backend/src/models/OrderItem.ts
- [ ] T044 [P] Payment model in backend/src/models/Payment.ts

### Library Services [P] - All can run in parallel
- [ ] T045 [P] Auth library with JWT in backend/src/lib/auth/AuthService.ts
- [ ] T046 [P] Product management library in backend/src/lib/product/ProductService.ts
- [ ] T047 [P] Shopping cart library in backend/src/lib/cart/CartService.ts
- [ ] T048 [P] Order processing library in backend/src/lib/order/OrderService.ts
- [ ] T049 [P] Payment processing library in backend/src/lib/payment/PaymentService.ts
- [ ] T050 [P] User management library in backend/src/lib/user/UserService.ts

### CLI Commands [P] - All can run in parallel
- [ ] T051 [P] Auth CLI in backend/src/cli/auth-cli.ts
- [ ] T052 [P] Product CLI in backend/src/cli/product-cli.ts
- [ ] T053 [P] Cart CLI in backend/src/cli/cart-cli.ts
- [ ] T054 [P] Order CLI in backend/src/cli/order-cli.ts
- [ ] T055 [P] Payment CLI in backend/src/cli/payment-cli.ts
- [ ] T056 [P] User CLI in backend/src/cli/user-cli.ts

### API Endpoints (Sequential - all modify route files)
- [ ] T057 Authentication endpoints (register, login, verify) in backend/src/api/auth.routes.ts
- [ ] T058 Product endpoints (CRUD operations) in backend/src/api/product.routes.ts
- [ ] T059 Shopping cart endpoints in backend/src/api/cart.routes.ts
- [ ] T060 Order endpoints in backend/src/api/order.routes.ts
- [ ] T061 Payment endpoints in backend/src/api/payment.routes.ts
- [ ] T062 User profile endpoints in backend/src/api/user.routes.ts
- [ ] T063 API router and middleware setup in backend/src/api/index.ts

### Frontend Implementation [P] - Can run in parallel
- [ ] T064 [P] Authentication components (Login, Register, Verify) in frontend/src/components/auth/
- [ ] T065 [P] Product components (List, Detail, Search) in frontend/src/components/product/
- [ ] T066 [P] Shopping cart components in frontend/src/components/cart/
- [ ] T067 [P] Order components in frontend/src/components/order/
- [ ] T068 [P] User profile components in frontend/src/components/user/
- [ ] T069 [P] Page components and routing in frontend/src/pages/
- [ ] T070 [P] API service layer in frontend/src/services/
- [ ] T071 [P] Custom hooks in frontend/src/hooks/

## Phase 3.4: Integration

### Backend Integration
- [ ] T072 Database connection and Prisma client setup in backend/src/config/database.ts
- [ ] T073 JWT authentication middleware in backend/src/middleware/auth.ts
- [ ] T074 Input validation middleware in backend/src/middleware/validation.ts
- [ ] T075 Error handling middleware in backend/src/middleware/error.ts
- [ ] T076 CORS and security middleware in backend/src/middleware/security.ts
- [ ] T077 Logging and observability setup in backend/src/config/logging.ts
- [ ] T078 Environment configuration management in backend/src/config/env.ts
- [ ] T079 Stripe webhook handler in backend/src/webhooks/stripe.ts

### Frontend Integration
- [ ] T080 State management setup (Redux/Context) in frontend/src/store/
- [ ] T081 React Router configuration in frontend/src/App.tsx
- [ ] T082 API integration with React Query/SWR in frontend/src/services/api.ts
- [ ] T083 Form handling and validation in frontend/src/utils/validation.ts
- [ ] T084 Error handling and user notifications in frontend/src/utils/notifications.ts
- [ ] T085 Responsive design and styling setup in frontend/src/styles/

## Phase 3.5: Polish

### Testing [P] - Can run in parallel
- [ ] T086 [P] Unit tests for utilities in backend/tests/unit/test_utils.js
- [ ] T087 [P] Unit tests for middleware in backend/tests/unit/test_middleware.js
- [ ] T088 [P] Unit tests for services in backend/tests/unit/test_services.js
- [ ] T089 [P] Component tests in frontend/tests/component/
- [ ] T090 [P] Performance tests (<500ms API response) in backend/tests/performance/
- [ ] T091 [P] End-to-end tests with Playwright in frontend/tests/e2e/

### Documentation and Quality
- [ ] T092 API documentation update in backend/docs/api.md
- [ ] T093 README.md with setup and usage instructions
- [ ] T094 Library documentation (llms.txt format) for each library
- [ ] T095 Code review and refactoring
- [ ] T096 Security audit and vulnerability fixes
- [ ] T097 Performance optimization and caching strategies
- [ ] T098 Database query optimization
- [ ] T099 Frontend bundle size optimization
- [ ] T100 Run comprehensive test suite and quickstart validation

## Dependencies

### Critical Dependencies
- **Setup (T001-T010)** blocks all other tasks
- **Tests (T011-T037)** MUST complete before any implementation (T038+)
- **Models (T038-T044)** block **Services (T045-T050)**
- **Services (T045-T050)** block **Endpoints (T057-T063)**
- **Backend integration (T072-T079)** must follow backend endpoints
- **Frontend implementation (T064-T085)** depends on API endpoints being complete

### Parallel Groups
```
Group 1 (Setup): T001-T010
Group 2 (Tests): T011-T037 [ALL P]
Group 3 (Models): T038-T044 [ALL P]  
Group 4 (Services): T045-T050 [ALL P]
Group 5 (CLI): T051-T056 [ALL P]
Group 6 (Frontend Components): T064-T071 [ALL P]
Group 7 (Unit Tests): T086-T091 [ALL P]
```

### Sequential Chains
```
T001-T010 → T011-T037 → T038-T044 → T045-T050 → T057-T063 → T072-T079 → T064-T085 → T086-T100
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
- 18 endpoints → 18 implementation tasks [T057-T063]

### From Data Model
- 7 entities → 7 model creation tasks [T038-T044, all P]
- 7 entities → 6 service layer tasks [T045-T050, all P]
- 6 libraries → 6 CLI command tasks [T051-T056, all P]

### From User Stories (quickstart.md)
- 7 scenarios → 7 integration test tasks [T031-T037, all P]
- Validation scenarios → polish and testing tasks [T086-T100]

### Constitution Compliance
- Library-first architecture: 6 independent libraries [T045-T050]
- CLI interfaces: 6 CLI commands [T051-T056]
- TDD enforced: Tests (T011-T037) before implementation (T038+)
- Real dependencies: Actual DB setup [T006, T072]

## Validation Checklist
- [x] All 18 contracts have corresponding tests [T011-T030]
- [x] All 7 entities have model tasks [T038-T044]
- [x] All tests (T011-T037) come before implementation (T038+)
- [x] Parallel tasks are truly independent (different files)
- [x] Each task specifies exact file path
- [x] No [P] task modifies same file as another [P] task
- [x] Constitutional requirements satisfied
- [x] Estimated 60 tasks complete the full implementation

## Notes
- [P] tasks = different files, no dependencies → safe for parallel execution
- Verify ALL tests fail before implementing ANY functionality
- Commit after each task with descriptive messages
- Follow RED-GREEN-REFACTOR cycle strictly
- Use real databases (SQLite/PostgreSQL) for all tests