# Code Style

## Naming and Organization

- Use descriptive PascalCase for React components, camelCase for functions and values, and `UPPER_SNAKE_CASE` for constants.
- Keep pure domain logic in feature/domain modules (`src/analytics`, `src/propFirm`, `src/security`), not in UI components.
- Keep platform, network, and privileged behavior behind explicit service boundaries.
- Prefer existing folders and primitives; do not create parallel helpers for the same job.

## React and TypeScript

- Use functional components and typed props.
- Keep screens focused; extract feature components only when they reduce coupling or duplication.
- Avoid `any`; validate external input at boundaries.
- Keep derived analytics deterministic and separate from presentation.
- Preserve backward compatibility unless an approved task explicitly changes it.

## Error Handling and Logging

- Return safe, actionable user-facing errors.
- Log structured, minimal diagnostic metadata.
- Never log tokens, secrets, prompts, private notes, screenshots, or sensitive trading data.
- Do not silently ignore security, sync, or purchase failures.

## Imports, Formatting, and Comments

- Group imports: platform/library, internal modules, then types.
- Follow repository TypeScript/Expo formatting; keep diffs minimal.
- Comments explain non-obvious intent, invariants, or security decisions—not syntax.

## Architecture Boundaries

- UI does not access privileged credentials.
- AI does not mutate user trading data.
- Analytics calculations remain independent of provider/network calls.
- Sync and offline behavior stay outside presentation components.
- Supabase migrations are forward-only and Edge Functions enforce authorization.

See [ARCHITECTURE.md](./ARCHITECTURE.md) and [SECURITY.md](./SECURITY.md).
