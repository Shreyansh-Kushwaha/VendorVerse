import js from '@eslint/js';
import globals from 'globals';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';

export default [
  { ignores: ['dist/**', 'node_modules/**'] },
  js.configs.recommended,
  {
    files: ['**/*.{js,jsx}'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: { ...globals.browser, ...globals.serviceworker },
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    settings: { react: { version: 'detect' } },
    plugins: { react, 'react-hooks': reactHooks },
    rules: {
      ...react.configs.recommended.rules,
      ...reactHooks.configs.recommended.rules,
      // The new JSX transform means React does not need to be in scope.
      'react/react-in-jsx-scope': 'off',
      'react/prop-types': 'off',
      // This is the rule that would have caught the toast refetch loop.
      'react-hooks/exhaustive-deps': 'error',
      'no-unused-vars': ['error', {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
        caughtErrorsIgnorePattern: '^_',
      }],

      // localStorage throws in private mode and a few other places. Swallowing
      // that is deliberate everywhere it appears here.
      'no-empty': ['error', { allowEmptyCatch: true }],

      // Apostrophes in prose render fine and escaping them makes the copy
      // harder to read and edit.
      'react/no-unescaped-entities': 'off',

      // Advisory. Setting a loading flag at the top of a fetch effect is a
      // normal pattern and not worth contorting the code to avoid.
      'react-hooks/set-state-in-effect': 'warn',
    },
  },
];
