const key = (process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY || "").trim();

const invalid =
  !key ||
  !key.startsWith("appl_") ||
  /your|replace|example|changeme/i.test(key);

if (invalid) {
  console.error(
    "Release configuration error: EXPO_PUBLIC_REVENUECAT_IOS_API_KEY must be a valid RevenueCat public iOS SDK key.",
  );
  process.exit(1);
}

console.log("Release configuration check passed: RevenueCat public iOS SDK key is configured.");
