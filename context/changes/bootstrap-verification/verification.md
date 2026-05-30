---
bootstrapped_at: 2026-05-30T14:37:40Z
starter_id: react-router
starter_name: "React Router (formerly Remix)"
project_name: allergen-finder
language_family: js
package_manager: npm
cwd_strategy: subdir-then-move
bootstrapper_confidence: verified
phase_3_status: ok
audit_command: "npm audit --json"
---

## Hand-off

```yaml
starter_id: react-router
package_manager: npm
project_name: allergen-finder
hints:
  language_family: js
  team_size: solo
  deployment_target: self-host
  ci_provider: github-actions
  ci_default_flow: auto-deploy-on-merge
  bootstrapper_confidence: verified
  path_taken: custom
  quality_override: false
  self_check_answers:
    typed: true
    from_official_starter: true
    conventions: true
    docs_current: true
    can_judge_agent: true
  has_auth: true
  has_payments: false
  has_realtime: false
  has_ai: false
  has_background_jobs: false
```

Allergen Finder is a small web app with a 3-week after-hours MVP timeline, a solo builder, guest-first usage, and a login module included in the first release. React Router gives the project a TypeScript-first full-stack React structure with recognizable routing and data-loading conventions while avoiding a Vercel-specific deployment path. The hand-off records auth as in scope, while payments, realtime, AI, and background jobs stay out of scope. Deployment is recorded as `self-host` because that is the registry-compatible target for a containerized deployment; the intended infrastructure shape is GCP Cloud Run with GitHub Actions driving checks and deployment on merge.

## Pre-scaffold verification

| Signal             | Value                                                  | Severity | Notes                           |
| ------------------ | ------------------------------------------------------ | -------- | ------------------------------- |
| npm package        | create-react-router v7.16.0 published 2026-05-28      | fresh    | resolved from cmd_template      |
| GitHub repo        | not run                                                | n/a      | card docs_url is not GitHub     |

## Scaffold log

**Resolved invocation**: `npx create-react-router@latest .bootstrap-scaffold --yes --package-manager npm`
**Strategy**: subdir-then-move
**Exit code**: 0
**Files moved**: 10
**Conflicts (.scaffold siblings)**: `.git.scaffold`, `README.md.scaffold`
**.gitignore handling**: append-merged
**.bootstrap-scaffold cleanup**: deleted

## Post-scaffold audit

**Tool**: `npm audit --json`
**Summary**: 0 CRITICAL, 0 HIGH, 0 MODERATE, 0 LOW
**Direct vs transitive**: 0/0/0/0 direct of total 0/0/0/0

#### CRITICAL findings

None.

#### HIGH findings

None.

#### MODERATE findings

None.

#### LOW / INFO findings

None.

## Hints recorded but not acted on

| Hint                    | Value                                                                                                      |
| ----------------------- | ---------------------------------------------------------------------------------------------------------- |
| bootstrapper_confidence | verified                                                                                                   |
| quality_override        | false                                                                                                      |
| path_taken              | custom                                                                                                     |
| self_check_answers      | typed=true, from_official_starter=true, conventions=true, docs_current=true, can_judge_agent=true          |
| team_size               | solo                                                                                                       |
| deployment_target       | self-host                                                                                                  |
| ci_provider             | github-actions                                                                                             |
| ci_default_flow         | auto-deploy-on-merge                                                                                       |
| has_auth                | true                                                                                                       |
| has_payments            | false                                                                                                      |
| has_realtime            | false                                                                                                      |
| has_ai                  | false                                                                                                      |
| has_background_jobs     | false                                                                                                      |

## Next steps

Next: a future skill will set up agent context (CLAUDE.md, AGENTS.md). For now, your project is scaffolded and verified.

Useful manual steps in the meantime:
- Review any `.scaffold` siblings the conflict policy created and decide which version of each file to keep.
- Address audit findings per your project's risk tolerance. The full breakdown is in this log.
