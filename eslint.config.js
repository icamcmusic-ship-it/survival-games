/**
 * AUDIT-7 §1.10: the linter the codebase was already writing comments for.
 *
 * `npm run lint` was `tsc --noEmit` and nothing else, there was no ESLint
 * dependency and no config — and thirteen
 * `// eslint-disable-next-line react-hooks/exhaustive-deps` directives sat
 * across `App.tsx`, `GameScreen.tsx`, `ChronicleScreen.tsx`, `EventFeed.tsx`,
 * `DossierPanel.tsx` and `StandingsTable.tsx`, suppressing a rule that was not
 * running. Thirteen places where somebody consciously decided to lie to a
 * linter that was not listening, in a 13,798-line React interface with a
 * hand-rolled store, a router, an autosave, a rewind stack and a run-to-end
 * loop — every one of which is a stale-closure bug waiting to happen.
 *
 * Deliberately narrow. This is not a style pass: the repository has a house
 * style and a formatter would produce a diff nobody asked for. It turns on the
 * correctness rules and leaves the prose alone. `exhaustive-deps` is a warning
 * rather than an error for the same reason the existing disables exist — some
 * of them are legitimate — but it now *prints*, and a new one is visible in CI
 * rather than invisible in a comment.
 */
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';

export default tseslint.config(
    { ignores: ['dist/**', 'node_modules/**', 'coverage/**'] },
    js.configs.recommended,
    ...tseslint.configs.recommended,
    {
        files: ['src/**/*.{ts,tsx}'],
        languageOptions: {
            globals: { ...globals.browser },
            parserOptions: { ecmaFeatures: { jsx: true } },
        },
        plugins: { 'react-hooks': reactHooks },
        rules: {
            ...reactHooks.configs.recommended.rules,
            // The rule this whole config exists for. A warning, not an error:
            // several of the thirteen existing disables are legitimate (a deps
            // array deliberately keyed on `log.length` rather than on `log`, so
            // a 900-entry array is not compared every render). What matters is
            // that it runs and prints — and on the first run it found two
            // disables suppressing nothing at all, which is the failure mode
            // the audit predicted.
            'react-hooks/exhaustive-deps': 'warn',

            /*
             * The React Compiler rules, reported and not enforced — for now.
             *
             * `set-state-in-effect`, `refs` and `immutability` flag fourteen
             * real patterns in the store-driven screens (a ref written during
             * render to keep a callback fresh, an effect that syncs derived
             * state). They are advisory for the compiler rather than bugs
             * today, and rewriting fourteen sites in a working interface on the
             * same pass that adds the linter is how a lint adoption breaks an
             * app. They print, they are visible in CI, and they are a
             * follow-up rather than a silent pass.
             */
            'react-hooks/set-state-in-effect': 'warn',
            'react-hooks/refs': 'warn',
            'react-hooks/immutability': 'warn',

            // `tsc --noEmit` already owns type errors; these are the ones it
            // does not see.
            'no-console': 'off',
            'no-empty': ['error', { allowEmptyCatch: true }],
            '@typescript-eslint/no-unused-vars': ['error', {
                argsIgnorePattern: '^_',
                varsIgnorePattern: '^_',
                caughtErrors: 'none',
                // Destructuring a property purely to drop it from a rest spread
                // is an idiom this codebase uses (`{ tags, excludes, ...rest }`).
                ignoreRestSiblings: true,
            }],
            // The codebase uses `as any` 23 times, each at a boundary where the
            // alternative is worse. Flagged, not failed.
            '@typescript-eslint/no-explicit-any': 'warn',
        },
    },
    {
        /*
         * Check scripts are Node programs — except the Playwright harness,
         * whose `page.evaluate` callbacks are serialised and run *in the
         * browser*, so `document` and `window` are legitimately in scope there.
         * Both global sets, because the file genuinely contains both.
         */
        files: ['scripts/**/*.{ts,mjs}'],
        languageOptions: { globals: { ...globals.node, ...globals.browser } },
        rules: {
            '@typescript-eslint/no-explicit-any': 'off',
            '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', caughtErrors: 'none' }],
        },
    },
);
