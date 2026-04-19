# Brainwash

Workout-first TanStack Start app with GitHub auth, MongoDB persistence, voice transcription, and an assistant flow for logging sets.

Engineering/editing rules for humans and LLMs live in [AGENTS.md](./AGENTS.md).

## Stack

- React 19
- TanStack Start + Router + React Query
- MongoDB via Mongoose
- GitHub OAuth
- Google transcription models for voice input

## Main Concepts

- A workout is scoped by `(userId, dayKey)`.
- `dayKey` is a stable calendar date string in `YYYY-MM-DD` format using the app timezone (`Europe/Berlin`).
- Individual sets still keep precise timestamps in `loggedAt`.
- Assistant actions should respect `context.selectedDay` when present.
- User-owned domain records must not be hardcoded in source files. Persist them or infer them from persisted user data.
- User-facing decimal input should accept both `,` and `.` separators through shared parsing utilities.

## Scripts

- `pnpm dev`: run the app in development mode
- `pnpm build`: production build
- `pnpm lint`: ESLint across the repo
- `pnpm test`: helper-level tests compiled with `tsc` and run with `node:test`

## Tests

Current tests focus on the date/day-key behavior because that logic is the identity boundary for workout logging:

- formatting and parsing of `dayKey`
- timezone-aware conversion between timestamps and workout days
- selected-day fallback behavior
- creation of per-day log timestamps

## Environment

Expected environment variables include:

- `SESSION_SECRET`
- `MONGO_URI`
- `APP_URL`
- `GITHUB_CLIENT_ID`
- `GITHUB_CLIENT_SECRET`
- `AI_PROVIDER`
- `GOOGLE_API_KEY`

Voice transcription is authenticated on the server and rejects oversized audio payloads.
