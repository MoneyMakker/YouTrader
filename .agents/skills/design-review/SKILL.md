---
name: design-review
description: Review every YouTrader UI change before completion against docs/MY_UI.md, the existing frontend-design skill, Apple HIG-inspired premium iOS quality, readability, trader-first UX, Pro/paywall timing, charts, exports, and business-logic preservation. Use whenever Codex/Cursor/GitHub Copilot changes screens, components, navigation, charts, cards, paywalls, exports, PDFs, share images, empty states, or any visible UI in YouTrader.
---

# Design Review

Use this skill as the final quality gate for every YouTrader UI task. Treat `docs/MY_UI.md` as the local design source of truth and preserve the user's existing UI direction.

## Required Workflow

Before finishing any UI task:

1. Run `frontend-design` thinking first.
2. Compare the changed screen or artifact against `docs/MY_UI.md`.
3. Run the checklist below.
4. Fix obvious UI issues before summarizing.
5. Only then report completed changes.

If no code changes are needed, still state whether the design-review gate passed and what was checked.

## Review Checklist

- Does the screen match `docs/MY_UI.md`?
- Does it feel premium, dark, expensive, institutional, and trader-first?
- Is the main action obvious within 3 seconds?
- Is there duplicate or contradictory information?
- Are metrics readable at iPhone size?
- Are tap targets large enough?
- Is spacing consistent?
- Are cards aligned and not crowded?
- Are empty states premium, not broken?
- Are Pro/paywall moments shown only after value?
- Are charts intuitive?
- Is green used for positive, red for risk/loss, and purple for secondary premium accent?
- Are exports, PDFs, and share cards properly centered and branded?
- Does the screen answer: “What should the trader do next?”
- Does it avoid cheap crypto-casino visual style?
- Does it preserve business logic?

## YouTrader-Specific Judgment

Prefer calm, disciplined clarity over decoration. Keep dark Liquid Glass hierarchy, generous spacing, readable metric labels, and trader-first next actions. Do not add duplicated cards, noisy badges, neon-heavy visuals, or generic SaaS copy. When a visual problem is obvious, fix it in the smallest safe change that preserves current behavior.

## Completion Standard

A UI task is not complete until the changed surface has passed this review or the remaining issue is explicitly documented with a reason it could not be fixed in the current task.
