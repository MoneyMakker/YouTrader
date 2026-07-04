/** @type {import('expo/config').ExpoConfig} */
const appJson = require("./app.json");

function googleIosUrlScheme() {
  const clientId = (process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID || "").trim();
  if (!clientId || /your/i.test(clientId) || !clientId.includes(".apps.googleusercontent.com")) {
    return null;
  }
  const core = clientId.replace(/\.apps\.googleusercontent\.com$/, "");
  return `com.googleusercontent.apps.${core}`;
}

module.exports = () => {
  const expo = { ...appJson.expo };
  const plugins = [...(expo.plugins || [])];
  const scheme = googleIosUrlScheme();
  if (scheme) {
    plugins.unshift([
      "@react-native-google-signin/google-signin",
      { iosUrlScheme: scheme },
    ]);
  }
  return { ...expo, plugins };
};
