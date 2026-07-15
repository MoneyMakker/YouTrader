# Trade Vision privacy implementation

Last reviewed: 2026-07-15

## Verified application flow

1. A user chooses **Take Photo** or **Upload Screenshot** in Trade Vision. The app uses Expo Image Picker; it does not offer a file-picker route for this feature.
2. Before it requests camera/photo-library access or opens the picker, the app requires a local acknowledgement of the current Trade Vision disclosure version. Cancel leaves the picker closed.
3. The selected local image is re-encoded as a JPEG, limited to 1600 px wide at 0.72 compression. The original filename and picker metadata are not included in the upload payload. The mobile client does not request EXIF data.
4. The app sends the processed image, its JPEG MIME type, the user-entered question, and a reduced set of aggregate trading metrics to the authenticated `ai-coach` Supabase Edge Function.
5. The Edge Function authenticates the YouTrader session, performs entitlement and quota checks, then sends the image to a configured vision provider. The code supports direct Gemini or OpenRouter. When the provider setting is automatic, Gemini is tried before OpenRouter if both keys are configured.
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

## User-facing requirements

- The disclosure must be shown before the first image selection/upload for each disclosure version.
- The user can cancel with no picker or upload action.
- The disclosure can be revisited from Settings.
- The policy URL must resolve to a public, current policy before the feature is released.
- A material provider or policy change requires a disclosure-version increment and renewed local acknowledgement.
