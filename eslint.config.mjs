// @ts-check
import eslint from '@eslint/js';
import eslintPluginPrettierRecommended from 'eslint-plugin-prettier/recommended';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: ['eslint.config.mjs', 'dist/**', 'node_modules/**', 'prisma.config.ts'],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  eslintPluginPrettierRecommended,
  {
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.jest,
      },
      sourceType: 'commonjs',
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    rules: {
      // ━━ TypeScript strict : "Pas de any TypeScript"
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unsafe-argument': 'error',
      '@typescript-eslint/no-unsafe-assignment': 'error',
      '@typescript-eslint/no-unsafe-member-access': 'error',
      '@typescript-eslint/no-unsafe-return': 'error',
      '@typescript-eslint/no-unsafe-call': 'error',

      // ━━ Promesses — une promesse non-awaited = bug silencieux potentiel
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/require-await': 'error',

      // ━━ Sécurité : variables d'env via ConfigService uniquement
      'no-process-env': 'error',

      // ━━ Sécurité : ne jamais logger de valeurs sensibles
      'no-console': 'error',

      // ━━ Qualité générale
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],

      'prettier/prettier': ['error', { endOfLine: 'auto' }],
    },
  },
  {
    // Assouplissements spécifiques aux fichiers de test
    files: ['**/*.spec.ts', '**/*.e2e-spec.ts'],
    // Faux positifs connus : module.get(), jest.Mocked<T> et expect() ne sont pas
    // pleinement résolus par le type checker d'ESLint dans le contexte NestJS Testing + Jest.
    rules: {
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/require-await': 'off',
      '@typescript-eslint/unbound-method': 'off',
    },
  },
);
