// vitest config — sets up the test environment for PromptMentor
// using jsdom so tests can poke at DOM stuff without a real browser
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // jsdom gives us a fake browser DOM — needed for any test touching document/window
    environment: 'jsdom',

    // where our tests live
    include: ['src/__tests__/**/*.test.ts'],

    // coverage report goes here (run: npm run test:coverage)
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/backend/**', 'src/shared/**'],
      // we don't cover frontend/content directly — too DOM-heavy, use integration tests for that
    },
  },
});
