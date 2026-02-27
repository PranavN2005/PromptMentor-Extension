import tseslint from 'typescript-eslint';
import prettierConfig from 'eslint-config-prettier';

export default tseslint.config(
  // apply TypeScript recommended rules to all .ts files
  ...tseslint.configs.recommended,

  // project-wide rule overrides
  {
    rules: {
      
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',      // function params like _originalPrompt, _mutationsList
          varsIgnorePattern: '^_',      // variables like _someVar
          caughtErrorsIgnorePattern: '^_', // *used AI for these*
        },
      ],
    },
  },

  prettierConfig,

  {
    files: ['src/backend/**/*.ts'],
    rules: {
      'no-restricted-globals': [
        'error',
        {
          name: 'document',
          message: "DOM APIs don't belong in backend/. Move this logic to frontend/ instead.",
        },
        {
          name: 'window',
          message: "DOM APIs don't belong in backend/. Move this logic to frontend/ instead.",
        },
        {
          name: 'navigator',
          message: "DOM APIs don't belong in backend/. Move this logic to frontend/ instead.",
        },
      ],
    },
  },

  {
    ignores: ['dist/**', 'node_modules/**', 'vitest.config.ts'],
  }
);
