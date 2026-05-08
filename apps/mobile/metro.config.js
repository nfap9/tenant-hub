const { getDefaultConfig } = require('@react-native/metro-config');
const path = require('path');

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

module.exports = config;
