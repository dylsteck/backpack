import tseslint from "typescript-eslint";

export default tseslint.config(
	{ ignores: ["dist/**"] },
	...tseslint.configs.recommended,
	{
		files: ["src/**/*.ts"],
		languageOptions: {
			parserOptions: { projectService: false },
		},
		rules: {
			"@typescript-eslint/no-unused-vars": [
				"warn",
				{
					argsIgnorePattern: "^_",
					varsIgnorePattern: "^_",
					caughtErrorsIgnorePattern: "^_",
				},
			],
			"@typescript-eslint/no-explicit-any": "warn",
			"max-lines": [
				"warn",
				{ max: 450, skipBlankLines: true, skipComments: true },
			],
			"max-lines-per-function": [
				"warn",
				{ max: 120, skipBlankLines: true, skipComments: true },
			],
		},
	},
	{
		files: ["src/index.ts"],
		rules: {
			// Large inline bootstrap SQL + migrations wiring.
			"max-lines": "off",
			"max-lines-per-function": "off",
			"@typescript-eslint/no-require-imports": "off",
		},
	},
	{
		files: ["src/schema/**/*.ts"],
		rules: {
			"@typescript-eslint/no-explicit-any": "off",
		},
	},
);
