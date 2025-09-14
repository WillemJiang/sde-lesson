# Data Model: E-Commerce Website

## Entity Definitions

### User
Represents customer accounts with authentication credentials and personal information.

**Fields**:
- `id: UUID` (Primary Key)
- `email: String` (Unique, Required)
- `password_hash: String` (Required, BCrypt)
- `first_name: String` (Required)
- `last_name: String` (Required)
- `is_verified: Boolean` (Default: false)
- `verification_token: String?` (Nullable)
- `created_at: DateTime` (Default: now())
- `updated_at: DateTime` (Default: now(), onUpdate: now())

**Validation Rules**:
- Email must be valid format
- Password minimum 8 characters with complexity requirements
- Names must be at least 2 characters

**State Transitions**:
- `pending` → `verified` (via email verification)

### Product
Represents items for sale with attributes and inventory information.

**Fields**:
- `id: UUID` (Primary Key)
- `name: String` (Required)
- `description: String` (Required)
- `price: Decimal` (Required, Precision: 10, Scale: 2)
- `stock_quantity: Integer` (Required, Default: 0)
- `sku: String` (Unique, Required)
- `category: String` (Required)
- `image_url: String?` (Nullable)
- `is_active: Boolean` (Default: true)
- `created_at: DateTime` (Default: now())
- `updated_at: DateTime` (Default: now(), onUpdate: now())

**Validation Rules**:
- Price must be positive
- Stock quantity cannot be negative
- SKU must be unique and alphanumeric
- Name must be at least 3 characters

**State Transitions**:
- `active` ↔ `inactive` (toggled by admin)

### ShoppingCart
Represents user's shopping cart with product items.

**Fields**:
- `id: UUID` (Primary Key)
- `user_id: UUID` (Foreign Key to User)
- `created_at: DateTime` (Default: now())
- `updated_at: DateTime` (Default: now(), onUpdate: now())

**Validation Rules**:
- One cart per user
- Cart items must reference existing products

### CartItem
Represents individual items within a shopping cart.

**Fields**:
- `id: UUID` (Primary Key)
- `cart_id: UUID` (Foreign Key to ShoppingCart)
- `product_id: UUID` (Foreign Key to Product)
- `quantity: Integer` (Required, Minimum: 1)
- `price_at_time: Decimal` (Required, Precision: 10, Scale: 2)
- `created_at: DateTime` (Default: now())

**Validation Rules**:
- Quantity must be positive
- Price must match current product price at time of addition
- Cannot exceed available stock

### Order
Represents completed purchases with product and payment information.

**Fields**:
- `id: UUID` (Primary Key)
- `user_id: UUID` (Foreign Key to User)
- `status: OrderStatus` (Required, Default: PENDING)
- `total_amount: Decimal` (Required, Precision: 10, Scale: 2)
- `shipping_address: JSON` (Required)
- `billing_address: JSON` (Required)
- `created_at: DateTime` (Default: now())
- `updated_at: DateTime` (Default: now(), onUpdate: now())

**Validation Rules**:
- Total amount must match sum of order items
- Addresses must be valid JSON with required fields
- User must be verified

**State Transitions**:
- `PENDING` → `PROCESSING` → `SHIPPED` → `DELIVERED`
- `PENDING` → `CANCELLED`
- `PROCESSING` → `CANCELLED`

### OrderItem
Represents individual products within an order.

**Fields**:
- `id: UUID` (Primary Key)
- `order_id: UUID` (Foreign Key to Order)
- `product_id: UUID` (Foreign Key to Product)
- `quantity: Integer` (Required, Minimum: 1)
- `price_at_time: Decimal` (Required, Precision: 10, Scale: 2)
- `created_at: DateTime` (Default: now())

**Validation Rules**:
- Quantity must be positive
- Price must match product price at time of order
- Product must be active and in stock

### Payment
Represents payment transaction details and status.

**Fields**:
- `id: UUID` (Primary Key)
- `order_id: UUID` (Foreign Key to Order, Unique)
- `stripe_payment_intent_id: String` (Required)
- `amount: Decimal` (Required, Precision: 10, Scale: 2)
- `status: PaymentStatus` (Required, Default: PENDING)
- `payment_method: String` (Required)
- `created_at: DateTime` (Default: now())
- `updated_at: DateTime` (Default: now(), onUpdate: now())

**Validation Rules**:
- Amount must match order total
- Stripe payment intent must be valid
- Status transitions must follow payment flow

**State Transitions**:
- `PENDING` → `PROCESSING` → `SUCCEEDED`
- `PENDING` → `FAILED`
- `PROCESSING` → `FAILED`

## Enums

### OrderStatus
```typescript
enum OrderStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  SHIPPED = 'SHIPPED',
  DELIVERED = 'DELIVERED',
  CANCELLED = 'CANCELLED'
}
```

### PaymentStatus
```typescript
enum PaymentStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  SUCCEEDED = 'SUCCEEDED',
  FAILED = 'FAILED',
  REFUNDED = 'REFUNDED'
}
```

## Relationships

### User Relationships
- `User` has one `ShoppingCart` (one-to-one)
- `User` has many `Order` (one-to-many)

### Product Relationships
- `Product` has many `CartItem` (one-to-many)
- `Product` has many `OrderItem` (one-to-many)

### ShoppingCart Relationships
- `ShoppingCart` belongs to `User` (many-to-one)
- `ShoppingCart` has many `CartItem` (one-to-many)

### CartItem Relationships
- `CartItem` belongs to `ShoppingCart` (many-to-one)
- `CartItem` belongs to `Product` (many-to-one)

### Order Relationships
- `Order` belongs to `User` (many-to-one)
- `Order` has one `Payment` (one-to-one)
- `Order` has many `OrderItem` (one-to-many)

### OrderItem Relationships
- `OrderItem` belongs to `Order` (many-to-one)
- `OrderItem` belongs to `Product` (many-to-one)

### Payment Relationships
- `Payment` belongs to `Order` (many-to-one)

## Database Schema (Prisma)

```prisma
model User {
  id              UUID      @id @default(uuid())
  email           String    @unique
  password_hash   String
  first_name      String
  last_name       String
  is_verified     Boolean   @default(false)
  verification_token String?
  created_at      DateTime  @default(now())
  updated_at      DateTime  @updatedAt

  shopping_cart   ShoppingCart?
  orders          Order[]
  
  @@map("users")
}

model Product {
  id            UUID    @id @default(uuid())
  name          String
  description   String
  price         Decimal @db.Decimal(10, 2)
  stock_quantity Int     @default(0)
  sku           String  @unique
  category      String
  image_url     String?
  is_active     Boolean @default(true)
  created_at    DateTime @default(now())
  updated_at    DateTime @updatedAt

  cart_items    CartItem[]
  order_items   OrderItem[]
  
  @@map("products")
}

model ShoppingCart {
  id         UUID   @id @default(uuid())
  user_id    UUID   @unique
  created_at DateTime @default(now())
  updated_at DateTime @updatedAt

  user       User   @relation(fields: [user_id], references: [id])
  cart_items CartItem[]
  
  @@map("shopping_carts")
}

model CartItem {
  id             UUID    @id @default(uuid())
  cart_id        UUID
  product_id     UUID
  quantity       Int
  price_at_time  Decimal @db.Decimal(10, 2)
  created_at     DateTime @default(now())

  cart    ShoppingCart @relation(fields: [cart_id], references: [id])
  product Product      @relation(fields: [product_id], references: [id])
  
  @@map("cart_items")
}

model Order {
  id              UUID        @id @default(uuid())
  user_id         UUID
  status          OrderStatus @default(PENDING)
  total_amount    Decimal     @db.Decimal(10, 2)
  shipping_address Json
  billing_address  Json
  created_at      DateTime    @default(now())
  updated_at      DateTime    @updatedAt

  user      User       @relation(fields: [user_id], references: [id])
  payment   Payment?
  order_items OrderItem[]
  
  @@map("orders")
}

model OrderItem {
  id             UUID    @id @default(uuid())
  order_id       UUID
  product_id     UUID
  quantity       Int
  price_at_time  Decimal @db.Decimal(10, 2)
  created_at     DateTime @default(now())

  order   Order   @relation(fields: [order_id], references: [id])
  product Product @relation(fields: [product_id], references: [id])
  
  @@map("order_items")
}

model Payment {
  id                       UUID          @id @default(uuid())
  order_id                 UUID          @unique
  stripe_payment_intent_id String
  amount                   Decimal       @db.Decimal(10, 2)
  status                   PaymentStatus @default(PENDING)
  payment_method           String
  created_at               DateTime      @default(now())
  updated_at               DateTime      @updatedAt

  order Order @relation(fields: [order_id], references: [id])
  
  @@map("payments")
}

enum OrderStatus {
  PENDING
  PROCESSING
  SHIPPED
  DELIVERED
  CANCELLED
}

enum PaymentStatus {
  PENDING
  PROCESSING
  SUCCEEDED
  FAILED
  REFUNDED
}
```

## Indexing Strategy

### Primary Indexes
- All primary keys automatically indexed
- Unique constraints automatically indexed

### Secondary Indexes
- `users.email` (unique index)
- `products.sku` (unique index)
- `products.category` (for category searches)
- `products.is_active` (for active product filtering)
- `orders.user_id` (for user order history)
- `orders.status` (for order management)
- `payments.status` (for payment reconciliation)
- `payments.stripe_payment_intent_id` (unique index)

### Composite Indexes
- `(products.category, products.is_active)` for category browsing
- `(orders.user_id, orders.created_at)` for user order history
- `(orders.status, orders.created_at)` for order management

## Data Integrity Constraints

### Business Rules
1. **Stock Management**: Product stock cannot go negative
2. **Order Total**: Must equal sum of order items
3. **Payment Amount**: Must match order total
4. **User Verification**: Only verified users can place orders
5. **Product Status**: Only active products can be ordered
6. **Cart Ownership**: Users can only access their own cart
7. **Order Cancellation**: Only pending orders can be cancelled

### Cascade Rules
- Deleting a user deletes their shopping cart
- Deleting a shopping cart deletes its cart items
- Deleting an order deletes its order items
- Deleting a product doesn't affect historical orders (price snapshot preserved)

## Security Considerations

### Sensitive Data
- `password_hash`: Always hashed, never exposed
- `verification_token`: Temporary, expires after use
- `stripe_payment_intent_id`: Securely stored, limited access

### Access Control
- Users can only access their own data
- Admin access required for product management
- Payment data access limited to payment processing

This data model provides a comprehensive foundation for the e-commerce system while maintaining simplicity and constitutional compliance.