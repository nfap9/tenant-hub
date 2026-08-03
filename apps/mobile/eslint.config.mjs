import rootConfig from '../../eslint.config.mjs';

export default [
  ...rootConfig,
  {
    ignores: ['.expo/**', 'dist/**'],
  },
];
