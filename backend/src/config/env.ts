import dotenv from 'dotenv';
import { z } from 'zod';

// Load environment variables
dotenv.config();

// Provide test defaults early to ensure they're available at module load time
if (process.env.NODE_ENV === 'test') {
  process.env.DATABASE_URL = process.env.DATABASE_URL || 'file:./test.db';
  process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-key-for-testing-only-minimum-32-chars';
  process.env.STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || 'sk_test_dummy_key_for_testing_only';
  process.env.STRIPE_PUBLISHABLE_KEY = process.env.STRIPE_PUBLISHABLE_KEY || 'pk_test_dummy_key_for_testing_only';
  process.env.STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || 'whsec_test_dummy_key_for_testing_only';
}

// Environment configuration schema
const envSchema = z.object({
  // Node environment
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),

  // Server configuration
  PORT: z.coerce.number().default(3001),
  HOST: z.string().default('localhost'),

  // Database configuration
  DATABASE_URL: z.string().min(1),
  DATABASE_SSL: z.coerce.boolean().default(false),

  // JWT configuration
  JWT_SECRET: z.string().min(32),
  JWT_EXPIRES_IN: z.string().default('7d'),
  JWT_REFRESH_SECRET: z.string().min(32).optional(),
  JWT_REFRESH_EXPIRES_IN: z.string().default('30d'),

  // Stripe configuration
  STRIPE_SECRET_KEY: z.string().min(1),
  STRIPE_PUBLISHABLE_KEY: z.string().min(1),
  STRIPE_WEBHOOK_SECRET: z.string().min(1),
  STRIPE_WEBHOOK_ENDPOINT_SECRET: z.string().min(1).optional(),

  // Email configuration
  EMAIL_SERVICE: z.enum(['smtp', 'sendgrid', 'ses']).default('smtp'),
  EMAIL_HOST: z.string().default('smtp.gmail.com'),
  EMAIL_PORT: z.coerce.number().default(587),
  EMAIL_USER: z.string().optional(),
  EMAIL_PASS: z.string().optional(),
  EMAIL_FROM: z.string().email().optional(),

  // SendGrid configuration
  SENDGRID_API_KEY: z.string().optional(),
  SENDGRID_FROM_EMAIL: z.string().email().optional(),

  // AWS SES configuration
  AWS_ACCESS_KEY_ID: z.string().optional(),
  AWS_SECRET_ACCESS_KEY: z.string().optional(),
  AWS_REGION: z.string().default('us-east-1'),

  // Redis configuration (for caching)
  REDIS_URL: z.string().optional(),
  REDIS_HOST: z.string().optional(),
  REDIS_PORT: z.coerce.number().default(6379),
  REDIS_PASSWORD: z.string().optional(),

  // Frontend configuration
  FRONTEND_URL: z.string().url().default('http://localhost:3000'),
  FRONTEND_DOMAIN: z.string().default('localhost:3000'),

  // CORS configuration
  ALLOWED_ORIGINS: z.string().transform(val => val.split(',').map(origin => origin.trim())).default([
    'http://localhost:3000',
    'http://localhost:3001'
  ]),

  // Security configuration
  BCRYPT_ROUNDS: z.coerce.number().default(12),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().default(15 * 60 * 1000),
  RATE_LIMIT_MAX_REQUESTS: z.coerce.number().default(100),

  // Logging configuration
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'debug']).default('info'),
  LOG_FILE: z.string().default('logs/app.log'),
  LOG_MAX_SIZE: z.coerce.number().default(5242880), // 5MB
  LOG_MAX_FILES: z.coerce.number().default(5),

  // File upload configuration
  MAX_FILE_SIZE: z.coerce.number().default(5 * 1024 * 1024), // 5MB
  ALLOWED_FILE_TYPES: z.string().transform(val => val.split(',').map(type => type.trim())).default([
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp'
  ]),
  UPLOAD_DIR: z.string().default('uploads/'),

  // Analytics and monitoring
  ENABLE_ANALYTICS: z.coerce.boolean().default(false),
  ANALYTICS_ID: z.string().optional(),
  SENTRY_DSN: z.string().optional(),

  // Development configuration
  ENABLE_SWAGGER: z.coerce.boolean().default(false),
  ENABLE_MOCK_DATA: z.coerce.boolean().default(false),

  // Testing configuration
  TEST_DATABASE_URL: z.string().optional(),
  TEST_JWT_SECRET: z.string().default('test-secret-key-for-testing-only'),
});

// Validate environment variables
const env = envSchema.parse({
  ...process.env,
  // Handle array environment variables
  ALLOWED_ORIGINS: process.env.ALLOWED_ORIGINS || 'http://localhost:3000,http://localhost:3001',
  ALLOWED_FILE_TYPES: process.env.ALLOWED_FILE_TYPES || 'image/jpeg,image/png,image/gif,image/webp',
});

// Configuration object
export const config = {
  // App configuration
  app: {
    env: env.NODE_ENV,
    port: env.PORT,
    host: env.HOST,
    isDevelopment: env.NODE_ENV === 'development',
    isProduction: env.NODE_ENV === 'production',
    isTest: env.NODE_ENV === 'test',
  },

  // Database configuration
  database: {
    url: env.NODE_ENV === 'test' ? env.TEST_DATABASE_URL || 'sqlite::memory:' : env.DATABASE_URL,
    ssl: env.DATABASE_SSL,
  },

  // JWT configuration
  jwt: {
    secret: env.JWT_SECRET,
    expiresIn: env.JWT_EXPIRES_IN,
    refreshSecret: env.JWT_REFRESH_SECRET || env.JWT_SECRET,
    refreshExpiresIn: env.JWT_REFRESH_EXPIRES_IN,
  },

  // Stripe configuration
  stripe: {
    secretKey: env.STRIPE_SECRET_KEY,
    publishableKey: env.STRIPE_PUBLISHABLE_KEY,
    webhookSecret: env.STRIPE_WEBHOOK_SECRET,
    webhookEndpointSecret: env.STRIPE_WEBHOOK_ENDPOINT_SECRET,
  },

  // Email configuration
  email: {
    service: env.EMAIL_SERVICE,
    host: env.EMAIL_HOST,
    port: env.EMAIL_PORT,
    user: env.EMAIL_USER,
    pass: env.EMAIL_PASS,
    from: env.EMAIL_FROM,
    sendgridApiKey: env.SENDGRID_API_KEY,
    sendgridFromEmail: env.SENDGRID_FROM_EMAIL,
    awsAccessKeyId: env.AWS_ACCESS_KEY_ID,
    awsSecretAccessKey: env.AWS_SECRET_ACCESS_KEY,
    awsRegion: env.AWS_REGION,
  },

  // Redis configuration
  redis: {
    url: env.REDIS_URL,
    host: env.REDIS_HOST,
    port: env.REDIS_PORT,
    password: env.REDIS_PASSWORD,
  },

  // Frontend configuration
  frontend: {
    url: env.FRONTEND_URL,
    domain: env.FRONTEND_DOMAIN,
  },

  // CORS configuration
  cors: {
    allowedOrigins: env.ALLOWED_ORIGINS,
  },

  // Security configuration
  security: {
    bcryptRounds: env.BCRYPT_ROUNDS,
    rateLimitWindowMs: env.RATE_LIMIT_WINDOW_MS,
    rateLimitMaxRequests: env.RATE_LIMIT_MAX_REQUESTS,
  },

  // Logging configuration
  logging: {
    level: env.LOG_LEVEL,
    file: env.LOG_FILE,
    maxSize: env.LOG_MAX_SIZE,
    maxFiles: env.LOG_MAX_FILES,
  },

  // File upload configuration
  upload: {
    maxFileSize: env.MAX_FILE_SIZE,
    allowedFileTypes: env.ALLOWED_FILE_TYPES,
    uploadDir: env.UPLOAD_DIR,
  },

  // Analytics and monitoring
  analytics: {
    enabled: env.ENABLE_ANALYTICS,
    id: env.ANALYTICS_ID,
    sentryDsn: env.SENTRY_DSN,
  },

  // Development configuration
  development: {
    enableSwagger: env.ENABLE_SWAGGER,
    enableMockData: env.ENABLE_MOCK_DATA,
  },

  // Testing configuration
  testing: {
    databaseUrl: env.TEST_DATABASE_URL,
    jwtSecret: env.TEST_JWT_SECRET,
  },
} as const;

// Export environment and config
export { env };

// Utility functions
export const getConfigValue = <K extends keyof typeof config>(key: K): typeof config[K] => {
  return config[key];
};

export const isDevelopment = () => config.app.isDevelopment;
export const isProduction = () => config.app.isProduction;
export const isTest = () => config.app.isTest;

// Validate required environment variables
export const validateEnv = (): void => {
  const requiredEnvVars = [
    'DATABASE_URL',
    'JWT_SECRET',
    'STRIPE_SECRET_KEY',
    'STRIPE_PUBLISHABLE_KEY',
    'STRIPE_WEBHOOK_SECRET',
  ];

  const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);

  if (missingVars.length > 0) {
    throw new Error(`Missing required environment variables: ${missingVars.join(', ')}`);
  }
};

// Export configuration for use in other modules
export default config;