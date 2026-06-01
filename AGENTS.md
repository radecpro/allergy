# Repository Guidelines

## Project Structure & Module Organization

This repository is a React Router full-stack TypeScript app for Allergen Finder. App source lives in `app/`: `app/root.tsx` defines the document shell, `app/routes.ts` registers routes, `app/routes/` contains route modules, and `app/app.css` holds global styles and Tailwind imports. Static assets belong in `public/`; starter welcome assets currently live in `app/welcome/`. Product and bootstrap planning artifacts live under `context/` and should be preserved when changing app code. Build output is generated in `build/` and should not be edited by hand.

## Build, Test, and Development Commands

- `npm run dev` starts the local React Router dev server with HMR at `http://localhost:5173`.
- `npm run build` creates the production client/server build in `build/`.
- `npm run start` serves the production build via `react-router-serve`.
- `npm run typecheck` regenerates React Router types and runs `tsc`.
- `npm audit --json` checks dependency advisories; keep the tree clean before releases.

## Coding Style & Naming Conventions

Use TypeScript, React 19, ESM imports, and strict types. Prefer route modules in `app/routes/` named by route purpose, for example `home.tsx` or `destination-search.tsx`. Use the `~/*` path alias for imports from `app/`. Keep components small, typed, and colocated with the route until reuse is clear. Use two-space indentation, descriptive camelCase variables/functions, PascalCase React components, and kebab-case filenames for multiword route files.

## Testing Guidelines

No test runner is configured yet. For now, run `npm run typecheck` and manually verify key flows through `npm run dev` before handing off. When adding tests, prefer colocated `*.test.ts` or `*.test.tsx` files near the code under test, and add a corresponding `npm test` script in `package.json`.

## Commit & Pull Request Guidelines

Recent history uses short imperative commits, sometimes with a conventional prefix, such as `feat: initialize project with React Router`. Keep commits focused and explain user-visible changes. Pull requests should include a short summary, verification commands run, linked issue or context note, and screenshots for UI changes.

## Security & Configuration Tips

The MVP is guest-first but includes auth. Do not commit secrets, API keys, or GCP credentials. Keep environment-specific configuration in local env files and document required variables when they are introduced.
