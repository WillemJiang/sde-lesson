import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';

// Import API router
import apiRouter from './api';

// Import error handler
import { errorHandler, notFoundHandler } from './middleware/error';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(helmet());
app.use(cors());
app.use(morgan('combined'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Basic health check route
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    message: 'E-Commerce Backend API is running',
    timestamp: new Date().toISOString()
  });
});

// Mount API routes
app.use('/api/v1', apiRouter);

// 404 handler
app.use(notFoundHandler);

// Error handler
app.use(errorHandler);

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
  });
}

export default app;