# E-Commerce Website

A full-stack e-commerce application with user authentication, product management, and payment processing capabilities.

## Project Overview

This project is built using a modern tech stack with a Node.js/Express backend and React frontend. It implements a complete e-commerce solution including:

- User authentication with email verification
- Product catalog with search and filtering
- Shopping cart functionality
- Order management
- Payment processing with Stripe
- Responsive user interface

## Tech Stack

### Backend
- **Runtime**: Node.js 18+
- **Framework**: Express.js
- **Language**: TypeScript
- **Database**: SQLite (development), PostgreSQL (production)
- **ORM**: Prisma
- **Authentication**: JWT
- **Payment**: Stripe
- **Testing**: Jest
- **API Documentation**: OpenAPI/Swagger

### Frontend
- **Framework**: React 19
- **Language**: TypeScript
- **Build Tool**: Vite
- **Routing**: React Router
- **HTTP Client**: Axios
- **Testing**: Vitest, Playwright
- **Styling**: CSS modules (extensible for any CSS framework)

## Features

### User Management
- User registration and login
- Email verification system
- Profile management
- Order history tracking

### Product Management
- Product catalog browsing
- Search functionality
- Category filtering
- Product detail pages
- Inventory management

### Shopping Experience
- Shopping cart with quantity management
- Checkout process
- Shipping and billing address forms
- Order confirmation

### Payment Processing
- Stripe integration for secure payments
- Payment intent creation
- Order status tracking
- Receipt generation

## Project Structure

```
sde-lesson/
├── backend/                 # Node.js/Express backend
│   ├── src/
│   │   ├── controllers/     # Business logic
│   │   ├── routes/         # API routes
│   │   ├── middleware/     # Express middleware
│   │   ├── services/       # Business services
│   │   ├── models/         # Data models
│   │   └── utils/          # Utility functions
│   ├── tests/              # Backend tests
│   ├── prisma/             # Database schema and migrations
│   └── package.json
├── frontend/               # React frontend
│   ├── src/
│   │   ├── components/     # React components
│   │   ├── pages/         # Page components
│   │   ├── hooks/         # Custom hooks
│   │   ├── services/      # API services
│   │   ├── types/         # TypeScript types
│   │   └── utils/         # Utility functions
│   ├── tests/             # Frontend tests
│   └── package.json
├── specs/                 # Feature specifications
│   └── 001-i-want-to/     # E-commerce feature spec
└── README.md              # This file
```

## Getting Started

### Prerequisites
- Node.js 18+
- npm 9+
- SQLite 3 (development)
- PostgreSQL 14+ (production)
- Stripe account for payment processing

### Environment Setup

1. Clone the repository:
```bash
git clone <repository-url>
cd sde-lesson
```

2. Install backend dependencies:
```bash
cd backend
npm install
```

3. Install frontend dependencies:
```bash
cd ../frontend
npm install
```

4. Set up environment variables:
```bash
# Backend
cp .env.example .env
# Edit .env with your database and API keys

# Frontend
cp .env.example .env.local
# Edit .env.local with your API URLs
```

### Database Setup

1. Generate Prisma client:
```bash
cd backend
npx prisma generate
```

2. Run database migrations:
```bash
npx prisma migrate dev --name init
```

3. Seed database with test data:
```bash
npx prisma db seed
```

### Running the Application

1. Start the backend server:
```bash
cd backend
npm run dev
```

2. Start the frontend development server:
```bash
cd frontend
npm run dev
```

3. Access the application:
- Frontend: http://localhost:3000
- Backend API: http://localhost:3001

## API Documentation

The backend API follows RESTful conventions and includes:

- Authentication endpoints
- Product management endpoints
- Shopping cart endpoints
- Order management endpoints
- Payment processing endpoints

For detailed API documentation, refer to the OpenAPI specification in `specs/001-i-want-to/contracts/api.yaml`.

## Testing

### Backend Tests
```bash
cd backend
npm test                # Run all tests
npm run test:unit       # Run unit tests
npm run test:integration # Run integration tests
npm run test:contract   # Run contract tests
```

### Frontend Tests
```bash
cd frontend
npm test                # Run unit tests
npm run test:e2e        # Run end-to-end tests
```

## Development

### Code Style and Quality
- ESLint for code linting
- Prettier for code formatting
- TypeScript for type safety
- Pre-commit hooks for code quality

### Contributing
1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests and linting
5. Submit a pull request

## Feature Specifications

Detailed feature specifications are located in the `specs/` directory:
- `specs/001-i-want-to/spec.md` - E-commerce feature specification
- `specs/001-i-want-to/quickstart.md` - Quickstart guide and test scenarios
- `specs/001-i-want-to/data-model.md` - Data model documentation
- `specs/001-i-want-to/contracts/api.yaml` - API contract

## Deployment

### Backend Deployment
1. Build the TypeScript code:
```bash
cd backend
npm run build
```

2. Set up production database
3. Configure environment variables
4. Start the application:
```bash
npm start
```

### Frontend Deployment
1. Build the React application:
```bash
cd frontend
npm run build
```

2. Deploy the `dist` folder to your web server

## Security Considerations

- JWT-based authentication
- Password hashing with bcrypt
- Input validation and sanitization
- CORS configuration
- Helmet for security headers
- Stripe integration for secure payments

## Performance Considerations

- Database query optimization
- API response caching
- Frontend bundle optimization
- Image optimization
- Lazy loading for components

## License

This project is licensed under the ISC License.

## Support

For support and questions, please refer to the project documentation or open an issue in the repository.