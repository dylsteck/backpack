import globals from "globals";
import tseslint from "typescript-eslint";
import react from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";

const NO_USE_EFFECT_MESSAGE =
	"Direct useEffect is banned. Use useMountEffect for one-shot external sync on mount, or one of the other 4 alternatives (derived state, useQuery, event handler, key-prop reset). See .claude/skills/no-use-effect/SKILL.md";

export default tseslint.config(
	{
		ignores: [
			"**/node_modules/**",
			"**/.vite/**",
			"**/out/**",
			"**/dist/**",
		],
	},
	...tseslint.configs.recommended,
	{
		files: ["**/*.{ts,tsx,js,jsx,mjs,cjs}"],
		languageOptions: {
			ecmaVersion: 2022,
			sourceType: "module",
			parserOptions: {
				ecmaFeatures: { jsx: true },
			},
			globals: {
				...globals.browser,
				...globals.node,
				...globals.es2022,
			},
		},
		settings: {
			react: { version: "detect" },
		},
		plugins: {
			react,
			"react-hooks": reactHooks,
		},
		rules: {
			...react.configs.recommended.rules,
			...reactHooks.configs.recommended.rules,
			"max-lines": [
				"warn",
				{ max: 420, skipBlankLines: true, skipComments: true },
			],
			"max-lines-per-function": [
				"warn",
				{ max: 120, skipBlankLines: true, skipComments: true },
			],
			"react/react-in-jsx-scope": "off",
			"react/prop-types": "off",
			"@typescript-eslint/no-unused-vars": [
				"warn",
				{
					argsIgnorePattern: "^_",
					varsIgnorePattern: "^_",
					caughtErrorsIgnorePattern: "^_",
				},
			],
			"@typescript-eslint/no-explicit-any": "warn",
			"no-restricted-syntax": [
				"error",
				{
					selector: 'CallExpression[callee.name="useEffect"]',
					message: NO_USE_EFFECT_MESSAGE,
				},
				{
					selector: 'ImportSpecifier[imported.name="useEffect"]',
					message: NO_USE_EFFECT_MESSAGE,
				},
			],
		},
	},
	{
		files: ["src/hooks/useMountEffect.ts"],
		rules: {
			"no-restricted-syntax": "off",
		},
	},
	{
		files: ["src/components/ui/sidebar.tsx"],
		rules: {
			// Ref sync for Cmd/Ctrl+B handler registered once via useMountEffect (see toggleSidebarRef).
			"react-hooks/refs": "off",
			"max-lines": "off",
			"max-lines-per-function": "off",
		},
	},
	{
		files: ["src/components/ui/**/*.tsx"],
		rules: {
			"max-lines": ["warn", { max: 750, skipBlankLines: true, skipComments: true }],
			"max-lines-per-function": [
				"warn",
				{ max: 200, skipBlankLines: true, skipComments: true },
			],
		},
	},
	{
		files: ["src/components/onboarding/**/*.tsx"],
		rules: {
			"max-lines-per-function": [
				"warn",
				{ max: 280, skipBlankLines: true, skipComments: true },
			],
		},
	},
);
