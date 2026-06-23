const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Packages that ship ESM or raw TypeScript source (not pre-built CJS) must be
// included here so Metro transpiles them via Babel instead of skipping them.
config.transformIgnorePatterns = [
  `node_modules/(?!(` +
    [
      'react-native',            // catches all react-native-* packages
      '@react-native',           // catches @react-native/* and @react-native-masked-view
      '@react-native-community',
      'expo',                    // catches all expo-* packages
      '@expo',                   // catches @expo/*
    ].join('|') +
    `))`,
];

module.exports = config;
