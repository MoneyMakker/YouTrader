# App Store App Privacy review — Trade Vision

Last reviewed: 2026-07-15

## Current App Store Connect state

The live questionnaire currently lists seven data types: Name, Email Address, Emails or Text Messages, Photos or Videos, Audio Data, User ID, and Purchase History. Each is marked **Used for App Functionality** and **Linked to the user's identity**. The public product-page label shows Contact Info, User Content, Purchases, and Identifiers as linked to the user.

For Trade Vision specifically, **Photos or Videos** is already marked **Used for App Functionality** and **Linked to the user's identity**. No tracking use is shown for this data flow.

## Current evidence

- Trade Vision sends a user-selected chart image off-device to an external AI-processing service through an authenticated Supabase Edge Function.
- The same request is authenticated to the YouTrader account at the Edge Function. Apple says off-device transmission can be collection when it is retained beyond servicing, and data is generally linked unless it is de-identified and cannot be linked back.
- The current public policy does not clearly disclose this flow. The detailed App Store Connect answers must be reviewed in the owner account before any save/submit action.

## Proposed owner-review table

| App Store Connect field | Proposed answer | Basis | Effect/risk |
| --- | --- | --- | --- |
| Photos or Videos collected | **Keep Yes** | Already declared; the feature specifically enables image upload and external processing | No label change required for this item |
| Linked to the user | **Keep Yes** | Already declared; the request is authenticated at YouTrader before it reaches the processor | A less restrictive answer would need documented de-identification and non-retention evidence across the full chain |
| Purpose | **Keep App Functionality** | Already declared; the image is processed only to produce the requested chart review | Do not add Analytics, Advertising, Tracking, or Product Personalization for this image flow |
| Used for tracking | **Keep No** | No image is used to link the user/device with third-party data for ads or measurement | Do not add ATT without a separate tracking use case |
| Used for Agent-007 analytics | **No** | Agent-007 event allowlist blocks image/screenshot fields and the Trade Vision event is not allowed | Verify this remains true on every analytics schema change |
| Used for general product analytics | **No** for image content | The app emits only completion status/cache properties | Do not treat the image itself as analytics data |

## Owner approval required

No App Privacy data-type answer needs to be changed based on the Trade Vision implementation currently reviewed. Do not change or save the questionnaire as part of this remediation. The owner still needs to confirm the active production provider chain, retention configuration, and revised public policy before a new version is submitted.

## Related platform artifacts

- `ios/YouTrader/PrivacyInfo.xcprivacy` declares no tracking and required-reason APIs only. It is not a substitute for the App Store privacy label.
- Camera and photo-library usage descriptions now disclose that a chosen Trade Vision chart image can be sent to an external AI service.
