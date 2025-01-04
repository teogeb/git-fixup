import eslint from '@eslint/js'
import tseslint from 'typescript-eslint'

export default tseslint.config(
    eslint.configs.recommended,
    tseslint.configs.strict,
    tseslint.configs.stylistic,
    {
        rules: {
            'curly': 'warn',
            'eol-last': ['error', 'always'],
            'eqeqeq': 'warn',
            'no-throw-literal': 'warn',
            'quotes': ['error', 'single'],
            'semi': ["error", "never"],
            '@typescript-eslint/naming-convention': ['warn', {
                selector: 'import',
                format: ['camelCase', 'PascalCase']
            }]
        }
    }
)
