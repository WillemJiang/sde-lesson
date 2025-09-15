import winston from 'winston';
import { Request, Response, NextFunction } from 'express';

// Custom logger interface
interface Logger {
  info: (message: string, meta?: any) => void;
  error: (message: string, meta?: any) => void;
  warn: (message: string, meta?: any) => void;
  debug: (message: string, meta?: any) => void;
}

// Create Winston logger
const createLogger = (): winston.Logger => {
  const logLevel = process.env.NODE_ENV === 'production' ? 'info' : 'debug';

  const logFormat = winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json(),
    winston.format.printf(({ timestamp, level, message, stack, ...meta }) => {
      const log = {
        timestamp,
        level,
        message,
        ...(Object.keys(meta).length > 0 && { meta }),
        ...(stack && { stack })
      };
      return JSON.stringify(log);
    })
  );

  return winston.createLogger({
    level: logLevel,
    format: logFormat,
    transports: [
      // Console logging
      new winston.transports.Console({
        format: process.env.NODE_ENV === 'development'
          ? winston.format.combine(
              winston.format.colorize(),
              winston.format.simple(),
              winston.format.printf(({ timestamp, level, message, stack, ...meta }) => {
                const metaStr = Object.keys(meta).length > 0 ? JSON.stringify(meta, null, 2) : '';
                const stackStr = stack ? `\n${stack}` : '';
                return `${timestamp} [${level}]: ${message} ${metaStr}${stackStr}`;
              })
            )
          : logFormat
      }),

      // File logging for errors
      new winston.transports.File({
        filename: 'logs/error.log',
        level: 'error',
        format: logFormat,
        maxsize: 5242880, // 5MB
        maxFiles: 5
      }),

      // File logging for all logs
      new winston.transports.File({
        filename: 'logs/combined.log',
        format: logFormat,
        maxsize: 5242880, // 5MB
        maxFiles: 5
      })
    ]
  });
};

// Create logger instance
const logger: winston.Logger = createLogger();

// Request logging middleware
export const requestLogger = (req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();

  // Log request
  logger.info('Request received', {
    method: req.method,
    url: req.originalUrl,
    userAgent: req.get('User-Agent'),
    ip: req.ip,
    timestamp: new Date().toISOString()
  });

  // Override res.end to log response
  const originalEnd = res.end;
  res.end = function(chunk?: any, encoding?: any) {
    const duration = Date.now() - start;

    logger.info('Request completed', {
      method: req.method,
      url: req.originalUrl,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      timestamp: new Date().toISOString()
    });

    return originalEnd.call(this, chunk, encoding);
  };

  next();
};

// Error logging middleware
export const errorLogger = (error: Error, req: Request, res: Response, next: NextFunction) => {
  logger.error('Error occurred', {
    error: error.message,
    stack: error.stack,
    method: req.method,
    url: req.originalUrl,
    userAgent: req.get('User-Agent'),
    ip: req.ip,
    timestamp: new Date().toISOString()
  });

  next(error);
};

// Performance monitoring middleware
export const performanceMonitor = (req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - start;

    // Log slow requests (> 500ms)
    if (duration > 500) {
      logger.warn('Slow request detected', {
        method: req.method,
        url: req.originalUrl,
        duration: `${duration}ms`,
        statusCode: res.statusCode,
        timestamp: new Date().toISOString()
      });
    }

    // Log very slow requests (> 2000ms)
    if (duration > 2000) {
      logger.error('Very slow request detected', {
        method: req.method,
        url: req.originalUrl,
        duration: `${duration}ms`,
        statusCode: res.statusCode,
        timestamp: new Date().toISOString()
      });
    }
  });

  next();
};

// Database query logging
export const databaseLogger = {
  query: (query: string, params: any[], duration: number) => {
    if (duration > 100) { // Log slow queries (> 100ms)
      logger.warn('Slow database query', {
        query,
        params,
        duration: `${duration}ms`,
        timestamp: new Date().toISOString()
      });
    }
  },

  error: (query: string, params: any[], error: Error) => {
    logger.error('Database error', {
      query,
      params,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
};

// Security event logging
export const securityLogger = {
  failedLogin: (email: string, ip: string) => {
    logger.warn('Failed login attempt', {
      email,
      ip,
      timestamp: new Date().toISOString()
    });
  },

  successfulLogin: (email: string, ip: string) => {
    logger.info('Successful login', {
      email,
      ip,
      timestamp: new Date().toISOString()
    });
  },

  suspiciousActivity: (activity: string, details: any, ip: string) => {
    logger.warn('Suspicious activity detected', {
      activity,
      details,
      ip,
      timestamp: new Date().toISOString()
    });
  }
};

// Business event logging
export const businessLogger = {
  userRegistered: (userId: string, email: string) => {
    logger.info('User registered', {
      userId,
      email,
      timestamp: new Date().toISOString()
    });
  },

  orderCreated: (orderId: string, userId: string, amount: number) => {
    logger.info('Order created', {
      orderId,
      userId,
      amount,
      timestamp: new Date().toISOString()
    });
  },

  paymentCompleted: (paymentId: string, orderId: string, amount: number) => {
    logger.info('Payment completed', {
      paymentId,
      orderId,
      amount,
      timestamp: new Date().toISOString()
    });
  }
};

// Export logger for use in other modules
export { logger };

// Health check endpoint logging
export const healthLogger = (req: Request, res: Response, next: NextFunction) => {
  if (req.path === '/health') {
    logger.info('Health check requested', {
      timestamp: new Date().toISOString()
    });
  }
  next();
};