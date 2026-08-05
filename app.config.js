/** @type {import('expo/config').ConfigContext} */
/**
 * Canonical Expo config: static app.json values arrive via `{ config }`.
 * Dynamic layer only adds env-derived plugins (Google Sign-In iosUrlScheme).
 * Native ios/android folders are the release source of truth for synced fields;
 * app.json remains the static documentation + EAS metadata surface.
 */
function googleIosUrlScheme() {
  const clientId = (process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID || "").trim();
  if (!clientId || /your/i.test(clientId) || !clientId.includes(".apps.googleusercontent.com")) {
    return null;
  }
  const core = clientId.replace(/\.apps\.googleusercontent\.com$/, "");
  return `com.googleusercontent.apps.${core}`;
}

module.exports = ({ config }) => {
  const plugins = [...(config.plugins || [])];
  const scheme = googleIosUrlScheme();
  if (scheme) {
    // Keep Google plugin first so URL scheme registration wins over later plugins.
    plugins.unshift([
      "@react-native-google-signin/google-signin",
      { iosUrlScheme: scheme },
    ]);
  }
  return {
    ...config,
    plugins,
  };
};
