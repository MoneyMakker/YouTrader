# Trade Vision privacy implementation

Last reviewed: 2026-07-15

## Verified application flow

1. A user chooses **Take Photo** or **Upload Screenshot** in Trade Vision. The app uses Expo Image Picker; it does not offer a file-picker route for this feature.
2. Before it requests camera/photo-library access or opens the picker, the app requires a local acknowledgement of the current Trade Vision disclosure version. Cancel leaves the picker closed.
3. The selected local image is re-encoded as a JPEG, limited to 1600 px wide at 0.72 compression. The original filename and picker metadata are not included in the upload payload. The mobile client does not request EXIF data.
4. The app sends the processed image, its JPEG MIME type, the user-entered question, and a reduced set of aggregate trading metrics to the authenticated `ai-coach` Supabase Edge Function.
5. The Edge Function authenticates the YouTrader session, performs entitlement and quota checks, then sends the image to a configured vision provider.
6. The app stores a locally cached **analysis response** for up to 30 days. It does not persist the source image in that cache. Settings provides deletion for only these cached Trade Vision responses and reset/revocation of the acknowledgement.

## Data that is not sent in the Trade Vision provider request

- the original filename or picker metadata
- EXIF data requested by the picker
- the mobile Supabase authorization header
- user email, account ID, or raw user ID
- Agent-007 analytics identifiers or product-analytics identifiers
- journal notes, screenshots, voice notes, trade symbols, dates, tags, moods, or individual recent trades

The Supabase Edge Function necessarily receives the user JWT to authenticate the call. It does not forward that JWT to Gemini or OpenRouter.

## Logging and analytics controls

- Trade Vision images are removed from server-side payload compaction used for non-vision prompts.
- OpenRouter diagnostics record provider/model/status/latency and approximate image size, but redact image data and authorization/key patterns.
- The mobile error path logs a static error label rather than the provider error object.
- Agent-007 has an explicit event allowlist and rejects image/screenshot properties. The Trade Vision completion event is not in that allowlist.
- Product analytics receives only the existing completion event name, provider status, and cache flag; it receives no image payload.

## Configuration-dependent facts that must be verified before public claims

- Which of Gemini or OpenRouter handles production Trade Vision traffic.
- The exact final model provider if OpenRouter is in use.
- Whether the configured Gemini project is a Paid Service and whether optional Google logs/datasets are enabled.
- Whether OpenRouter prompt logging, input/output-use opt-in, ZDR enforcement, and model/provider allowlists are enabled for the production key.
- Production provider, intermediary, and server log retention periods.

Do not claim zero retention, no training, a named final model provider, or a processing region until these configuration facts are verified from the production account and official provider documentation.

## Production configuration snapshot — 2026-07-15

The production Supabase secret inventory confirms `OPENROUTER_API_KEY` is configured and `GEMINI_API_KEY` is not configured. Therefore direct Gemini cannot process current Trade Vision requests. The code still supports Gemini as a future route, but it is **disabled in the current production secret configuration**.

`AI_PROVIDER` and `AI_MODEL_VISION` remain intentionally unreadable server secrets. The source code routes Trade Vision to OpenRouter when `AI_PROVIDER=openrouter`; if it is `auto`, Gemini is skipped because no Gemini key is configured and OpenRouter is attempted. No safe inspection method established the exact value of `AI_PROVIDER`, selected model, or downstream endpoint. Do not list a final model provider in public copy.

The OpenRouter workspace reviewed on this date has no guardrail attached to the visible YouTrader key and no default workspace model. Its global privacy page does not show a configured provider allowlist. This does **not** prove which key is deployed to Supabase, so it is not a basis for a claim about the production key. It does establish that zero-data-retention is not verified for the currently reviewed workspace.

## Claim matrix

| Candidate claim | Status | Approved wording / reason |
| --- | --- | --- |
| The image leaves your device. | Safe to publish | The app transmits the processed image to `ai-coach` after acknowledgement and the user presses Analyze. |
| The image is sent to an external AI provider. | Safe to publish | The Edge Function sends the image to a configured external vision provider. |
| YouTrader does not store the raw image in its database. | Safe to publish | The reviewed mobile and Edge Function paths do not write the source image to a YouTrader database. |
| The result may be cached locally. | Safe to publish | The app caches the generated analysis response locally for up to 30 days; Settings can remove it. |
| The image is not used for Agent-007 or general product analytics. | Safe to publish | Analytics schemas block image/screenshot properties; the completion event carries status/cache fields only. |
| The image is not used for advertising or cross-app tracking. | Safe to publish for YouTrader use | No reviewed code path uses the image for those purposes. This does not describe independent provider processing. |
| The image is not used to train models. | Unsupported | Requires exact provider, endpoint, account tier, and privacy configuration. |
| The provider does not retain the image. | Unsupported | ZDR is not confirmed for the deployed route. |
| The request may be logged for abuse prevention. | Safe only with qualification | Provider retention/logging is configuration- and endpoint-dependent; do not present it as confirmed for this deployment. |
| The image may be linked to the authenticated account in transit. | Safe only with qualification | The YouTrader request is authenticated at the Edge Function; no raw user ID/JWT is forwarded to the provider in application code. |
| Users should crop account or brokerage details before sending. | Safe to publish | Visible content in the selected image is transmitted for analysis. |
| Users can delete the local analysis cache. | Safe to publish | Settings exposes a narrowly scoped cache-deletion control. |
| YouTrader uses multiple AI-processing providers. | Unsupported for current public policy | Code supports Gemini and OpenRouter, but current production secrets show only OpenRouter configured. |

## User-facing requirements

- The disclosure must be shown before the first image selection/upload for each disclosure version.
- The user can cancel with no picker or upload action.
- The disclosure can be revisited from Settings.
- The policy URL must resolve to a public, current policy before the feature is released.
- A material provider or policy change requires a disclosure-version increment and renewed local acknowledgement.
