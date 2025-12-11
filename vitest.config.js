import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Test file patterns
    include: ['frontend/**/*.test.js', 'tests/unit/**/*.test.js'],

    // Environment settings
    environment: 'node',

    // Reporter configuration
    reporters: ['default'],

    // Coverage configuration (optional, can be enabled with --coverage)
    coverage: {
      provider: 'v8',
      include: ['frontend/modules/**/*.js'],
      exclude: ['**/*.test.js', '**/test-*.js'],
    },

    // Global test settings
    globals: false,

    // Timeout for tests
    testTimeout: 10000,
  },
});
