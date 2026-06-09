---
project: Allergen Finder
assessed_at: 2026-06-09T21:37:22Z
agent_readiness: ready-with-compensation
context_type: brownfield
stack_components:
  language: TypeScript 5.9
  framework: React Router 7.16
  build_tool: Vite 8
  test_runner: null
  package_manager: npm
  ci_provider: null
  deployment_target: containerized Node service
gates_passed: 10
gates_failed: 2
---

## Stack Components

**Language:** TypeScript 5.9 with `strict: true`, no emitted JavaScript during type checking, and path aliases configured in `tsconfig.json`. Application and server contracts are represented with explicit types.

**Framework:** React Router 7.16 in framework mode with route registration in `app/routes.ts`, route modules under `app/routes/`, generated route-specific types, server rendering, loaders for resource routes, and a shared root error boundary.

**Build tool:** Vite 8 with the official React Router and Tailwind plugins. React Router owns production compilation through the `react-router build` script.

**Test runner:** No general-purpose test runner is configured. Two `vite-node` smoke-check scripts verify allergen ranking and provider contracts, but they do not provide test discovery, isolation, coverage, or a standard `npm test` workflow.

**Package and deployment:** npm with a committed lockfile. The application builds and runs as a Node container through the repository Dockerfile. No CI workflow is currently present.

## Quality Gate Assessment

| Component | Typed | Convention | Training Data | Documented | Verdict |
|---|---|---|---|---|---|
| TypeScript | ✓ | — | ✓ | ✓ | pass |
| React Router | ✓ | ✓ | ✓ | ✓ | pass |
| Vite | ✓ | ~ | ✓ | ✓ | pass with project conventions |
| Test runner | — | ✗ | ✗ | — | missing |

Legend: ✓ = pass, ✗ = fail, ~ = partial, — = not applicable.

### Gate Details

**Type safety:** Pass. `tsconfig.json` enables strict TypeScript and includes generated React Router types. Route modules import generated `Route` contracts, and `npm run typecheck` runs both route type generation and TypeScript checking.

**Conventions:** React Router passes. Routes are centrally registered in `app/routes.ts`; route modules, loaders, actions, SSR boundaries, and generated `+types` contracts have documented framework roles. Vite is intentionally flexible, but `AGENTS.md` compensates by defining the repository layout, route naming, and verification commands.

**Training-data familiarity:** Pass for TypeScript, React, React Router, and Vite within the JavaScript/TypeScript ecosystem. The patterns used here are mainstream and recognizable.

**Documentation:** Pass. React Router maintains current official framework documentation covering route configuration, generated route types, route-module server/client exports, loaders, actions, and server rendering. Vite and TypeScript also have current official documentation.

**Test infrastructure:** Missing. The smoke-check scripts are useful, but there is no configured runner or standard test script. This is the main agent-readiness gap and directly conflicts with the expanded MVP requirement for risk-based automated tests.

## Gaps & Compensation

### No general-purpose test runner

The repository cannot currently express focused authentication, authorization, CRUD, and route behavior tests through a standard test workflow.

Compensation: the first technical foundation for the expansion must add a test runner, `npm test`, and `test-plan.md`. The first automated risk must verify that one authenticated user cannot read, update, or delete another user's saved checks.

### New auth and persistence boundaries are not yet conventionalized

The current application has no established placement or contract for sessions, credential handling, persistent repositories, ownership checks, or data validation.

Compensation: each implementation plan must establish the minimum conventions before adding user-facing history behavior. These conventions should stay narrow and follow existing React Router route-module patterns rather than creating a second application architecture.

### Manual route registration requires discipline

React Router provides strong route-module conventions, but this repository registers routes explicitly rather than deriving them solely from filenames.

Compensation: every new route must be registered in `app/routes.ts`, use generated route types, and keep server-only dependencies outside browser-importable modules.

### Recommended Instruction File Additions

```markdown
## Authentication And Ownership

- Guest current-symptoms and destination routes must remain usable without authentication.
- History loaders and actions must derive the current user from the authenticated session and scope every record operation to that user.
- Never authorize a history operation solely from a user or owner identifier supplied by the browser.
- Password and session code must remain in server-only modules.
```

```markdown
## Persistence

- Keep persistence access behind typed repository functions rather than issuing storage queries directly from React components.
- Validate all mutation inputs at the route boundary.
- Saved symptom checks are immutable outside the explicitly editable symptoms and per-symptom intensities defined by the PRD.
```

```markdown
## Tests

- Add a standard `npm test` script and colocated `*.test.ts` or `*.test.tsx` files.
- Every test set must reference a named risk in `test-plan.md`.
- Authorization tests must create two users and prove cross-user read, update, and delete attempts fail.
- Preserve the existing smoke checks as fast contract verification.
```

```markdown
## React Router

- Register every route in `app/routes.ts`.
- Use generated `Route` types in route loaders, actions, and components.
- Keep server-only dependencies in `.server.ts` modules or route server exports that are excluded from browser bundles.
```

## Summary

The existing TypeScript and React Router stack is appropriate for the expanded MVP and does not need replacement. Its main gap is operational rather than architectural: no standard test runner exists, while authentication and user-owned persistence introduce new security-sensitive conventions. Add the test foundation first and make ownership enforcement explicit in every history slice plan.
