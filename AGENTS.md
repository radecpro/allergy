# Repository Guidelines

## Project Structure & Module Organization

This repository is a React Router full-stack TypeScript app for Allergen Finder. App source lives in `app/`; route registration starts in `app/routes.ts`, and route modules live in `app/routes/`. Static assets belong in `public/`. Product and bootstrap planning artifacts live under `context/` and must be preserved when changing app code. Do not edit generated `build/` output by hand.

## Security & Configuration Tips

The MVP is guest-first but includes auth. Do not commit secrets, API keys, or GCP credentials. Keep environment-specific configuration in local env files and document each new required variable where it is introduced.

## Build, Test, and Development Commands

Use `@package.json` as the source of truth for scripts. Before handoff, run `npm run typecheck`. Before release handoff, run `npm audit --json` and either fix advisories or document accepted advisories in the PR.

## Coding Style & Naming Conventions

Use `@tsconfig.json` for TypeScript compiler settings and path aliases. Prefer route modules in `app/routes/` named by route purpose, for example `home.tsx` or `destination-search.tsx`. Route components over 150 lines should be split into local child components or helpers in the same route module. Use two-space indentation, descriptive camelCase variables/functions, PascalCase React components, and kebab-case filenames for multiword route files.

## Testing Guidelines

No test runner is configured yet. For now, run `npm run typecheck` and manually verify key flows through `npm run dev` before handing off. When adding tests, prefer colocated `*.test.ts` or `*.test.tsx` files near the code under test, and add a corresponding `npm test` script in `package.json`.

## Commit & Pull Request Guidelines

Recent history uses short imperative commits, sometimes with a conventional prefix, such as `feat: initialize project with React Router`. Each commit should cover one user-visible change or one mechanical refactor; do not mix app behavior changes with generated build output. Pull requests should include a short summary, verification commands run, linked issue or context note, and screenshots for UI changes.
