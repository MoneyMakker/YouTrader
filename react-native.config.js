/**
 * Keep Storybook-only native peers out of production autolinking.
 * They remain installable for on-device Storybook when STORYBOOK_ENABLED=true.
 */
module.exports = {
  dependencies: {
    "@react-native-community/datetimepicker": {
      platforms: {
        ios: null,
        android: null,
      },
    },
    "@react-native-community/slider": {
      platforms: {
        ios: null,
        android: null,
      },
    },
  },
};
