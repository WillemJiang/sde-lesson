# Quickstart: E-Commerce Website

## Prerequisites

### System Requirements
- Node.js 18+ 
- npm 9+
- SQLite 3 (for development)
- PostgreSQL 14+ (for production)

### Accounts Required
- [Stripe Account](https://stripe.com) for payment processing
- [SendGrid Account](https://sendgrid.com) or similar for email verification (optional)

### Environment Variables
```bash
# Database
DATABASE_URL="file:./dev.db" # Development
DATABASE_URL="postgresql://user:password@localhost:5432/ecommerce" # Production

# JWT
JWT_SECRET="your-super-secret-jwt-key-here"
JWT_EXPIRES_IN="7d"

# Stripe
STRIPE_SECRET_KEY="sk_test_..."
STRIPE_WEBHOOK_SECRET="whsec_..."

# Email (SendGrid)
SENDGRID_API_KEY="SG.your-sendgrid-api-key"
FROM_EMAIL="noreply@yourdomain.com"

# Frontend
FRONTEND_URL="http://localhost:3000"
API_BASE_URL="http://localhost:3001"
```

## Quickstart Test Scenarios

### Scenario 1: User Registration and Email Verification
```bash
# 1. Register a new user
curl -X POST http://localhost:3001/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "SecurePass123!",
    "first_name": "John",
    "last_name": "Doe"
  }'

# Expected response: 201 Created with verification message
# Check database for user with is_verified=false and verification_token
```

### Scenario 2: User Login (After Verification)
```bash
# 1. First, simulate email verification (in development, use test endpoint)
curl -X POST http://localhost:3001/api/v1/auth/verify \
  -H "Content-Type: application/json" \
  -d '{"token": "verification-token-from-database"}'

# 2. Login with verified credentials
curl -X POST http://localhost:3001/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "SecurePass123!"
  }'

# Expected response: 200 OK with JWT token
# Save token for subsequent requests: AUTH_TOKEN="..."
```

### Scenario 3: Product Browsing and Search
```bash
# 1. Browse all products
curl -X GET "http://localhost:3001/api/v1/products"

# Expected response: 200 OK with product array
# Should return empty array or sample products

# 2. Search for products
curl -X GET "http://localhost:3001/api/v1/products?search=electronics"

# Expected response: 200 OK with filtered products

# 3. Filter by category
curl -X GET "http://localhost:3001/api/v1/products?category=Electronics"

# Expected response: 200 OK with category-filtered products
```

### Scenario 4: Shopping Cart Management
```bash
# 1. Add item to cart (requires product and AUTH_TOKEN)
# First, create a test product via admin interface or directly in database
curl -X POST http://localhost:3001/api/v1/cart/items \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  -d '{
    "product_id": "test-product-uuid",
    "quantity": 2
  }'

# Expected response: 201 Created with cart item

# 2. View cart
curl -X GET http://localhost:3001/api/v1/cart \
  -H "Authorization: Bearer $AUTH_TOKEN"

# Expected response: 200 OK with cart details including total

# 3. Update cart item quantity
curl -X PUT http://localhost:3001/api/v1/cart/items/cart-item-uuid \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  -d '{"quantity": 3}'

# Expected response: 200 OK with updated cart item

# 4. Remove item from cart
curl -X DELETE http://localhost:3001/api/v1/cart/items/cart-item-uuid \
  -H "Authorization: Bearer $AUTH_TOKEN"

# Expected response: 204 No Content
```

### Scenario 5: Order Creation and Payment
```bash
# 1. Create order from cart
curl -X POST http://localhost:3001/api/v1/orders \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  -d '{
    "shipping_address": {
      "street": "123 Main St",
      "city": "Anytown",
      "state": "CA",
      "zip_code": "12345",
      "country": "US"
    },
    "billing_address": {
      "street": "123 Main St",
      "city": "Anytown", 
      "state": "CA",
      "zip_code": "12345",
      "country": "US"
    }
  }'

# Expected response: 201 Created with order details
# Order status should be PENDING

# 2. Create payment intent (simulate Stripe integration)
curl -X POST http://localhost:3001/api/v1/payments/create-payment-intent \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  -d '{"order_id": "created-order-uuid"}'

# Expected response: 200 OK with Stripe client secret

# 3. Simulate successful payment confirmation
curl -X POST http://localhost:3001/api/v1/payments/payment-uuid/confirm \
  -H "Authorization: Bearer $AUTH_TOKEN"

# Expected response: 200 OK with payment status SUCCEEDED
# Order status should change to PROCESSING
```

### Scenario 6: Order Management
```bash
# 1. View order history
curl -X GET "http://localhost:3001/api/v1/orders" \
  -H "Authorization: Bearer $AUTH_TOKEN"

# Expected response: 200 OK with user's orders

# 2. View specific order
curl -X GET "http://localhost:3001/api/v1/orders/order-uuid" \
  -H "Authorization: Bearer $AUTH_TOKEN"

# Expected response: 200 OK with detailed order information

# 3. Cancel pending order
curl -X POST "http://localhost:3001/api/v1/orders/order-uuid/cancel" \
  -H "Authorization: Bearer $AUTH_TOKEN"

# Expected response: 200 OK with order status CANCELLED
```

### Scenario 7: User Profile Management
```bash
# 1. Get user profile
curl -X GET "http://localhost:3001/api/v1/users/profile" \
  -H "Authorization: Bearer $AUTH_TOKEN"

# Expected response: 200 OK with user profile including order stats

# 2. Update user profile
curl -X PUT "http://localhost:3001/api/v1/users/profile" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  -d '{"first_name": "Jane", "last_name": "Smith"}'

# Expected response: 200 OK with updated profile
```

## Database Setup

### Development (SQLite)
```bash
# 1. Install Prisma
npm install -g prisma

# 2. Generate Prisma client
npx prisma generate

# 3. Run migrations
npx prisma migrate dev --name init

# 4. Seed database with test data
npx prisma db seed
```

### Production (PostgreSQL)
```bash
# 1. Create database
createdb ecommerce

# 2. Set production DATABASE_URL
export DATABASE_URL="postgresql://user:password@localhost:5432/ecommerce"

# 3. Run migrations
npx prisma migrate deploy

# 4. Generate Prisma client
npx prisma generate
```

## Frontend Development Setup

### Install Dependencies
```bash
cd frontend
npm install
```

### Environment Configuration
```bash
# Create .env.local file
echo "REACT_APP_API_BASE_URL=http://localhost:3001" > .env.local
echo "REACT_APP_STRIPE_PUBLISHABLE_KEY=pk_test_..." >> .env.local
```

### Start Development Server
```bash
npm start
```

### Frontend Test Scenarios
1. **Landing Page**: Navigate to `http://localhost:3000`
   - Should display product listing
   - Search functionality should work
   - Category filters should be functional

2. **Product Details**: Click on any product
   - Should show product details, price, and "Add to Cart" button
   - Should display product images and description

3. **Authentication Flow**:
   - Click "Login/Register" 
   - Should show registration form
   - After registration, should show login form
   - Successful login should update UI with user info

4. **Shopping Cart Flow**:
   - Add products to cart
   - Cart icon should update with item count
   - Navigate to cart page
   - Should show cart items and total
   - Should allow quantity updates and item removal

5. **Checkout Flow**:
   - Proceed to checkout from cart
   - Should show shipping/billing address forms
   - Should integrate with Stripe for payment
   - Should show order confirmation after payment

## Backend Development Setup

### Install Dependencies
```bash
cd backend
npm install
```

### Start Development Server
```bash
npm run dev
```

### Run Tests
```bash
# Run all tests
npm test

# Run specific test type
npm run test:contract
npm run test:integration
npm run test:unit
```

## Key Test Validations

### Database Validations
- User creation with proper email validation
- Product inventory management (stock cannot go negative)
- Order total calculation accuracy
- Payment processing with proper status tracking

### API Validations
- Authentication middleware on protected routes
- Authorization checks (admin-only endpoints)
- Input validation and sanitization
- Error handling with proper HTTP status codes

### Business Logic Validations
- Only verified users can place orders
- Products must be active and in stock to be ordered
- Order total must match sum of order items
- Payment amount must match order total
- Only pending orders can be cancelled

### Security Validations
- Password complexity requirements
- JWT token validation and expiration
- Rate limiting on authentication endpoints
- SQL injection prevention
- XSS protection in frontend

## Performance Validations
- API response times under 500ms
- Database query optimization with proper indexing
- Frontend bundle size optimization
- Image loading optimization
- Caching strategies for product data

## Integration Tests
- End-to-end user journey: registration → verification → login → shopping → checkout
- Payment flow integration with Stripe test environment
- Email verification workflow
- Order status transitions
- Stock management across concurrent orders

This quickstart provides comprehensive test scenarios to validate all core e-commerce functionality.