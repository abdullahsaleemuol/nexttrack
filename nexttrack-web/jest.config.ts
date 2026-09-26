import type { Config } from 'jest';

const config: Config = {
  testEnvironment: 'jsdom',
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      tsconfig: 'tsconfig.json',
      // Needed for JSX support in test files
      jsx: 'react-jsx',
    }],
  },
  moduleNameMapper: {
    // Mirror the path alias defined in tsconfig.json so imports like
    // `@/store/usePlayerStore` resolve correctly inside tests.
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
};

export default config;
