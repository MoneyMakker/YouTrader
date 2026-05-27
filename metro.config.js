const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

config.resolver.blockList =
  /(\/\.git\/.*|\/\.expo\/.*|\/ios\/Pods\/.*|\/ios\/build\/.*|\/android\/build\/.*|\/android\/app\/build\/.*)/;

module.exports = config;
