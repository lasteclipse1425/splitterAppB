module.exports = function (api) {
  api.cache(true);

  return {
    presets: [['babel-preset-expo', { unstable_transformImportMeta: true }]],
    plugins: [
      // Tamagui runs at runtime via TamaguiProvider + tamagui.config.ts (Metro transpiles it).
      // @tamagui/babel-plugin is omitted: it loads the config with Node require() and fails on .ts/ESM.
      [
        'module-resolver',
        {
          root: ['./'],
          alias: {
            '@': './src'
          },
          extensions: ['.ts', '.tsx', '.js', '.jsx', '.json']
        }
      ],
      'react-native-reanimated/plugin' // Must stay last.
    ]
  };
};
