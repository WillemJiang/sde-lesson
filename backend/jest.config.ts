import type { Config } from 'jest';

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src', '<rootDir>/tests'],
  testRegex: ['(/tests/.*|(\\.|/)(test|spec))\\.(ts|js)$'],
  testPathIgnorePatterns: [
    '/tests/setup\\.ts$',
    '/tests/jest-setup\\.js$',
  ],
  transform: {
    '^.+\\.(ts|js)$': ['ts-jest', {
      diagnostics: {
        ignoreCodes: [7016, 7006],
      },
    }],
  },
  moduleNameMapper: {},
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/index.ts',
    '!src/generated/**',
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
  setupFiles: ['<rootDir>/tests/jest-setup.js'],
  testTimeout: 30000,
  verbose: true,
  forceExit: true,
  clearMocks: true,
  resetMocks: true,
  restoreMocks: true,
  silent: false,
  maxWorkers: 1,
  testEnvironmentOptions: {
    verbose: true
  },
  projects: [
    {
      displayName: 'unit',
      testMatch: ['<rootDir>/tests/unit/**/*.ts'],
      preset: 'ts-jest',
      testEnvironment: 'node',
      setupFiles: ['<rootDir>/tests/jest-setup.js'],
      setupFilesAfterEnv: [],
    },
    {
      displayName: 'integration-contract',
      testMatch: ['<rootDir>/tests/contract/**/*.ts', '<rootDir>/tests/integration/**/*.ts'],
      preset: 'ts-jest',
      testEnvironment: 'node',
      setupFiles: ['<rootDir>/tests/jest-setup.js'],
      setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
    },
  ],
};

export default config;