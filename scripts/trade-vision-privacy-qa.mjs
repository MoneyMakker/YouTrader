#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

const app = read("App.tsx");
const privacy = read("src/privacy/tradeVisionPrivacy.ts");
const agent007 = read("src/observability/agent007Analytics.ts");
const analytics = read("src/observability/analytics.ts");
const provider = read("supabase/functions/_shared/aiProvider.ts");
const legalUrls = read("src/config/legalUrls.ts");

assert(app.includes('const [privacyDisclosureOpen, setPrivacyDisclosureOpen] = useState(false);'), "Trade Vision disclosure state is missing");
assert(app.includes('if (privacyAcknowledged) {\n      void pickTradeVisionImage(source);'), "Image selection must be gated by acknowledgement");
assert(app.includes('onPress={cancelPrivacyDisclosure}'), "Disclosure Cancel action is missing");
assert(app.includes('continueWithPrivacyAcknowledgement'), "Disclosure Continue action is missing");
assert(app.includes('base64: false, exif: false'), "Picker must not request base64 or EXIF metadata");
assert(app.includes('manipulateAsync(') && app.includes('SaveFormat.JPEG'), "Processed JPEG generation is missing");
assert(app.includes('width: 1600') && app.includes('compress: 0.72'), "Image-size minimization is missing");
const requestPayload = app.slice(app.indexOf("const response = await fetchAITradeVisionReview"), app.indexOf("if (response.usedFallback"));
assert(requestPayload.includes('tradeCount: journalContext?.tradeCount') && !requestPayload.includes("recentTrades"), "Provider payload must not include individual recent trades");
assert(privacy.includes('TRADE_VISION_PRIVACY_DISCLOSURE_VERSION'), "Disclosure version is missing");
assert(privacy.includes('clearTradeVisionLocalCache') && privacy.includes('revokeTradeVisionPrivacyAcknowledgement'), "Local cache/acknowledgement controls are missing");
assert(agent007.includes('screenshot|image') && !agent007.includes('"ai_trade_vision_review_completed"'), "Agent-007 must exclude Trade Vision image data");
assert(analytics.includes('lower.includes("screenshot")') && analytics.includes('lower.includes("payload")'), "Product analytics must block image/payload properties");
assert(provider.includes('delete safe.imageBase64') && provider.includes('[redacted-image]'), "Provider diagnostics must redact image payloads");
assert(legalUrls.includes("https://borovikgroup-static-pages.vercel.app/privacy"), "Trade Vision disclosure must use the App Store privacy-policy URL");
assert(!/never leaves your device|fully private|client-only/i.test(app), "Unsupported local-only privacy claim found");

console.log("PASS trade-vision privacy QA — disclosure gate, minimization, analytics exclusions, and redaction checks passed.");
