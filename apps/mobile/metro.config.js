const { getDefaultConfig } = require('@react-native/metro-config');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

/**
 * Metro configuration for React Native in a pnpm monorepo.
 * @see https://reactnative.dev/docs/metro
 */
const config = getDefaultConfig(__dirname);

// Watch all files in the workspace (needed for monorepo packages)
config.watchFolders = [path.resolve(__dirname, '../..')];

// Resolve modules from both project and workspace node_modules
config.resolver.nodeModulesPaths = [
  path.resolve(__dirname, 'node_modules'),
  path.resolve(__dirname, '../../node_modules'),
];

config.resolver.disableHierarchicalLookup = false;

// Include .env in cache version so Metro invalidates transform cache
// when environment variables change (fixes react-native-dotenv @env issues)
const envPath = path.resolve(__dirname, '.env');
const envHash = fs.existsSync(envPath)
  ? crypto.createHash('md5').update(fs.readFileSync(envPath)).digest('hex').slice(0, 8)
  : 'no-env';
config.cacheVersion = `mobile-${envHash}`;

module.exports = config;
