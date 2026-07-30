const { getDefaultConfig } = require("expo/metro-config");
const { withStorybook } = require("@storybook/react-native/withStorybook");

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

config.resolver.blockList =
  /(\/\.git\/.*|\/\.expo\/.*|\/ios\/Pods\/.*|\/ios\/build\/.*|\/android\/build\/.*|\/android\/app\/build\/.*)/;

// Bundler-agnostic wrapper: Storybook is a no-op unless STORYBOOK_ENABLED=true.
// Production / normal `expo start` keeps zero Storybook code in the bundle.
module.exports = withStorybook(config, {
  configPath: "./.rnstorybook",
});
