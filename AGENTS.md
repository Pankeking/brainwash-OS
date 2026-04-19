# Brainwash Engineering Rules

Use this file as the first-pass guide for humans and LLMs editing this repo.

## Core Rules

1. Do not hardcode user-owned or domain records in code.
   Examples: body metrics, exercises, categories, logs, goals, per-user labels.
   These belong in the database and must be created from user actions or inferred from persisted user data.

2. Constants are only for real application configuration.
   Allowed examples: timezone, route ids, protocol values, UI palettes, animation timings, validation limits, model fallback order.
   Not allowed: seed domain objects that the user is supposed to define.

3. Keep schema, model, and runtime data separate.

- Models define shape and persistence rules.
- Server functions load and mutate persisted data.
- UI renders data returned from server functions.
- Never mix “example/default records” into utility files.

4. User-facing decimal input must accept both `,` and `.` separators.
   Use shared parsing helpers instead of ad hoc `Number(...)` calls.

5. Prefer one shared utility per domain rule.
   Examples: day-key parsing, decimal parsing, sorting, log grouping.
   If the same rule appears twice, extract it.

6. Keep files small and single-purpose.
   Default target: under 300 lines.
   If a file exceeds that, split by concern unless it is an intentional integration boundary.

7. Optimize for LLM readability.

- Use explicit names.
- Keep server modules focused by domain.
- Prefer flat, obvious data flow over clever abstractions.
- Avoid “hidden” behavior in broad utility modules.

8. Optimize for production behavior, not just passing builds.

- Avoid duplicate fetches and duplicate DB scans.
- Prefer exact-key lookups over range-based identity logic.
- Validate input at the server boundary.
- Keep auth and user scoping explicit.

9. Remove placeholder and scaffold code.

- Do not keep unused example queries, empty server files, placeholder routes, or UI buttons with no behavior.
- If the shipped app does not use it, delete it instead of keeping “maybe later” code in the main tree.

10. Dead code must fail lint.

- Unused imports and unused locals are treated as lint errors.
- If a helper/export/file is not used, remove it or justify it by wiring it into the shipped app.

## Body Metric Rule

Body metric definitions must come from:

- `BodyMetricDefinition` documents created by the user, or
- previously persisted `BodyMeasurementLog` entries

They must never come from a hardcoded in-repo array of metric records.

## Editing Checklist

Before finishing a change:

- Check whether any new constant is actually user/domain data.
- Check whether any numeric input should use shared locale-tolerant parsing.
- Check whether any placeholder/example code should be deleted instead of preserved.
- Check whether the file can be split further.
- Run `pnpm exec eslint .`
- Run `pnpm exec tsc --noEmit`
- Run `pnpm test`
- Run `pnpm build`
