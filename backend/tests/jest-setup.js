// Set test environment at the very beginning before any imports
process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'warn';

// Jest setup file to control logging output
const originalConsoleLog = console.log;
const originalConsoleWarn = console.warn;
const originalConsoleError = console.error;

// Filter out Prisma query logs, dotenv tips, and Apache-style logs
const shouldFilterLog = (message) => {
  if (typeof message === 'string') {
    return (
      message.includes('prisma:query') ||
      message.includes('dotenv@') ||
      message.includes('injecting env') ||
      message.includes('encrypt with Dotenvx') ||
      message.includes('override existing env vars') ||
      message.includes('auto-backup env') ||
      message.includes('specify custom .env file') ||
      message.includes('write to custom object') ||
      message.includes('prevent committing .env') ||
      message.includes('prevent building .env in docker') ||
      message.includes('run anywhere with') ||
      message.includes('enable debug logging') ||
      message.includes('load multiple .env files') ||
      message.includes('observe env with Radar') ||
      message.includes('suppress all logs') ||
      // Filter Apache-style access logs (showing IP and timestamp)
      message.includes('::ffff:127.0.0.1') ||
      message.match(/^\d+\.\d+\.\d+\.\d+/) ||
      message.includes('HTTP/1.1"') ||
      message.includes('HTTP/2"') ||
      message.match(/"-" "-"$/)
    );
  }
  return false;
};

// Override console.log to filter out unwanted messages
console.log = (...args) => {
  const message = args.join(' ');

  // Filter out our custom API logs and other unwanted messages
  if (shouldFilterLog(message) ||
      message.match(/^(GET|POST|PUT|DELETE|PATCH)\s\/api\//) ||
      message.includes('ms') && message.includes('-') && message.match(/\d{3}/)) {
    return;
  }

  originalConsoleLog.apply(console, args);
};

// Keep warnings and errors for debugging
console.warn = (...args) => {
  const message = args.join(' ');
  if (!shouldFilterLog(message)) {
    originalConsoleWarn.apply(console, args);
  }
};

console.error = (...args) => {
  const message = args.join(' ');
  if (!shouldFilterLog(message)) {
    originalConsoleError.apply(console, args);
  }
};

// Set environment for warning logs
process.env.LOG_LEVEL = 'warn';
process.env.NODE_ENV = 'test';