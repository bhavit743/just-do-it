// functions/.eslintrc.cjs
module.exports = {
  root: true,
  env: { node: true, es2021: true },
  parserOptions: { ecmaVersion: 2021, sourceType: 'script' }, // CommonJS
  rules: {
    'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
  },
  globals: {
    require: 'readonly',
    module: 'readonly',
    exports: 'readonly',
  },
  ignorePatterns: ['node_modules/', 'lib/', '.eslintrc.cjs'],
};