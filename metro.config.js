const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// @expo/ui and react-native-worklets ship TypeScript source with no pre-built JS.
// Add them to the Babel transform allow-list so Metro processes them.
config.transformIgnorePatterns = [
  `node_modules/(?!(` +
    [
      'react-native',
      '@react-native',
      '@react-native-community',
      'expo',
      '@expo',
      'react-native-worklets',
      'react-native-reanimated',
      'react-native-gesture-handler',
      'react-native-safe-area-context',
      'react-native-screens',
      'react-native-vosk',
    ].join('|') +
    `))`,
];

module.exports = config;
