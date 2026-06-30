# YouTrader MY UI

This is the project-level visual source of truth for YouTrader UI work. It preserves the existing app direction and prevents future UI changes from drifting into generic dashboards, cheap crypto styling, or clutter.

## Visual Direction

- Premium iOS 26 / Liquid Glass inspired trading journal.
- Dark luxury interface: mostly black, glass, graphite, soft borders, and disciplined highlights.
- Institutional, trader-first, calm, expensive, and readable.
- Not cyberpunk, not gamer, not casino, not cheap crypto-dashboard.
- Dense where traders need data, but never crowded or contradictory.

## Color Rules

- Green means positive performance, profitable outcome, or safe buffer.
- Red means loss, risk, danger, drawdown, or negative performance.
- Purple is the secondary premium accent for AI, emphasis, selected states, or high-end visual polish.
- Avoid neon overload. Lime/green should not dominate non-positive surfaces.
- Empty and disabled states should be quiet graphite, not broken black holes.

## Layout And Hierarchy

- The main action or next decision should be clear within 3 seconds.
- One card should answer one question.
- Keep metric labels small, clear, and uppercase when matching the existing UI.
- Keep large numbers readable at real iPhone size.
- Align cards, chips, and chart labels carefully.
- Do not nest cards inside cards unless the existing component pattern already requires it.
- Keep spacing consistent across screens and avoid cramped glass blocks.

## Trader-First UX

Every screen should answer: “What should the trader do next?”

Examples:

- Journal: log, review, or select the trade/day.
- Stats: understand what improved, what leaked, and what to focus on.
- AI Analytics: explain discipline, risk, consistency, and prop-firm survival path.
- News: read the market context without triggering paid or per-user generation.
- Calculator: quickly size risk and avoid accidental overexposure.

## Pro And Paywall Moments

- Show Pro/paywall moments only after value.
- Never block basic Journal viewing, Calendar P&L, Basic Stats, Calculator, readable News, or cached Market Intelligence read-only data.
- Pro locks should feel premium and useful, not punitive.
- Upgrade copy should be trader-specific, educational, and compliant.

## Charts, Exports, And Reports

- Charts must be intuitive at a glance.
- Heatmaps should use clear green for wins and red for losses.
- Radar/AI accents should use premium purple when not representing direct profit/loss.
- Share cards, saved images, exports, and PDFs must be centered, branded with YouTrader, readable, and not cropped or stretched.
- Reports must include the educational/non-financial-advice disclaimer where relevant.

## Design Review Gate

Every future UI change must pass the project `design-review` skill before completion.

Before finishing any UI task:

1. Run `frontend-design` thinking first.
2. Compare the change against this `docs/MY_UI.md` file.
3. Run `.agents/skills/design-review/SKILL.md` checklist.
4. Fix obvious UI issues.
5. Only then summarize completed changes.

This gate applies to screens, components, navigation, charts, cards, paywalls, exports, PDFs, share images, empty states, and any visible UI copy.
