# YouTrader 3.0 Product Roadmap

> **Track separation (do not conflate):**
>
> | Track | Progress |
> |---|---:|
> | UI Infrastructure (YDL platform) | ~**97%** (Phase 6 PNG baselines closed) |
> | YouTrader 3.0 Product | **0%** |
> | App readiness to *transform* (infra + product) | ~**20–25%** |
>
> The UI factory is ready. The new product has not been built yet.

## Product Filter (mandatory)

Every candidate feature must pass:

1. **Utility Test** — Helps the trader make a better decision, avoid a prop-firm rule violation, or improve long-term profitability odds. If none, it does not ship.
2. **Evidence Test** — On which user data is the claim based?
3. **Action Test** — What concrete decision can the user take after seeing it?
4. **Confidence Test** — Is the sample large enough to show the claim confidently?
5. **Simplicity Test** — Can the core value be one card, one number, or one action?
6. **Safety Test** — Does the recommendation push unjustified risk?

## Correct build order

```text
1. Close UI Phase 6 PNG baselines          ✅
2. Document this YouTrader 3.0 roadmap     ← this file
3. Phase 0 — Prop Domain & Data Architecture (approve before code)
4. Repository / domain audit (audit-only; no product redesign)
5. Only after Phase 0 approval → production implementation
```

**Do not** start by redesigning `AI Analytics` → `Prop Pass`, inventing `84% Pass Probability` UI, or deleting legacy screens before Phase 0.

Naming note: React Native + Expo remains. UI language is **premium native iOS / SwiftUI-inspired**, not a SwiftUI rewrite.

---

## Phase 0 — Prop Domain & Data Architecture

**Goal:** mathematical and product foundation. No major UI redesign.

### Prop account model

Define (at least): firm; account size; challenge type; evaluation / funded phase; profit target; daily loss limit; maximum drawdown; static vs trailing drawdown; EOD vs intraday trailing; consistency rule; max contracts; minimum trading days; permitted instruments; reset status; payout conditions; current balance; high-water mark; current buffer.

### Rule engine

Configurable `PropRuleSet` — not hard-coded to one firm:

```ts
type PropRuleSet = {
  profitTarget: number;
  dailyLossLimit?: number;
  maxDrawdown: number;
  drawdownType: "static" | "trailing";
  trailingMode?: "intraday" | "endOfDay";
  consistencyRule?: PropConsistencyRule;
  maxContracts?: number;
  minimumTradingDays?: number;
};
```

Exact fields may evolve; the principle is mandatory.

### Trade normalization

Ensure trades carry: instrument; direction; contracts; entry/exit; realized P&L; fees; timestamp; session; setup/tag; stop; initial risk; R multiple; duration; account/challenge; rule context at trade time.

### Deterministic calculation layer

Separate from UI and AI: daily P&L; remaining daily loss; remaining drawdown; distance to target; HWM; contract exposure; consistency; rolling metrics; streaks; violation detection; recovery speed; expectancy; session/instrument/setup performance.

### Probability / readiness model

`Prop Pass Probability` must not be GPT output or an ad-hoc formula.

Required: model version; features; weights; ranges; confidence; minimum data threshold; change explanation; small-sample fallback; historical snapshots; future calibration path.

Until calibrated on real outcomes, prefer honest scoring:

```text
Prop Readiness Score
84 / 100
```

over implying a validated `84% probability`.

### Phase 0 deliverables

- Domain schema
- Calculation specifications
- Migration plan
- Rule engine design
- Versioned scoring model
- Test fixtures
- **No** major UI redesign

---

## Phase 1 — Prop OS Foundation

Only after Phase 0 approval.

### Navigation

Do not hard-delete `AI Analytics` immediately:

1. Remove from primary product navigation
2. Replace user entry with `Prop Pass`
3. Keep legacy behind an internal flag temporarily
4. Delete after confirming no dependent consumers

### Prop Pass screen

Answers: *How safely am I progressing toward passing this challenge today?*

Structure: Readiness / Pass score; today’s change; ≤3 drivers; Buffer Health; nearest risk; Daily Mission; account/challenge context; clear empty/low-data state.

### Motion / polish budget

Glass, semantic gradients, live numbers, restrained springs, morphing containers, haptics, SF Symbols, Dynamic Type, Reduce Motion — applied selectively.

Dynamic Island–style patterns are **rare**: Smart Intervention, active challenge warning, daily mission completion, important state transitions — not permanent chrome.

---

## Phase 2 — Performance Intelligence

Deterministic analytics engine — not a GPT summary.

- **Performance Delta** — rolling 10 / 20 / 50 / 100 trades with sample size + confidence.
- **Edge Discovery** — min sample, profit factor, expectancy, win rate, avg R, net, drawdown, statistical confidence.
- **What Actually Makes Money** — believed edge vs actual P&L contribution.
- **Session / Instrument DNA** — net, expectancy, trade count — not bare percentages.

---

## Phase 3 — Prop Challenge Engine

Pass/readiness score; Buffer Health (daily / trailing / max DD / target distance / consistency — not one unexplained color); Pass Timeline with **versioned snapshots**; Rule Health; Live Prop Dashboard; risk state; account phase.

Pass Timeline snapshots must store `timestamp`, `modelVersion`, `score`, `drivers`, `accountState` so history is not rewritten by formula changes.

---

## Phase 4 — Decision Engine

- **Decision Replay** — one thought on the surface; evidence with sample sizes in detail.
- **Smart Intervention** — requires a defined event source (broker / live feed / manual pre-trade / session state). Without live data it is **post-trade warning**, not real-time intervention. Do not mix labels.
- **What If Simulator** — deterministic replay; never mutate original journal data.

---

## Phase 5 — Futures Operating Modes

Facts stay fixed (P&L, drawdown, rules, expectancy, trade count). Modes change **policy** only: recommended risk, contract cap, stopping rules, intervention sensitivity, daily mission, drawdown usage, recommendation thresholds.

Position recommendations: never exceed prop rules; tick value + stop distance + remaining buffer; round conservatively; explain; no guarantees; low-data → conservative fallback.

---

## Phase 6 — Product Polish & Release Hardening

Visual consistency; authenticated device testing; Instruments; a11y audit; offline/error states; migration cleanup; TestFlight cohort; analytics events; model calibration; App Store positioning; gradual rollout; rollback plan.

---

## Next engineering prompt (audit-only)

After this roadmap is accepted, run an **audit-only** exploration:

- Existing trade model, Stats calculations, account types
- Supabase schema relevant to journal / accounts
- AI Analytics consumers and navigation entry points
- Gaps vs Phase 0 domain needs

**Forbidden in that pass:** product code changes, deleting AI Analytics, UI redesign, inventing probability UI.
