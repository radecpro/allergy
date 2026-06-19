---
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
---

## Why this stack

Allergen Finder is an existing TypeScript web app with a four-week after-hours expansion, a solo builder, preserved guest flows, and new email/password authentication plus user-owned symptom-check persistence. React Router remains the lowest-risk choice because the deployed application already uses its full-stack routing, loaders, actions, and Node server conventions; changing frameworks would consume the fixed deadline without improving the required CRUD or authorization behavior. Extend the stack with PostgreSQL, typed migrations and repositories, secure server-side sessions, and automated cross-user access tests. Run the container on Node.js 24 LTS and keep GCP Cloud Run as the production target. Deployment remains recorded as `self-host`, the React Router registry value for container hosting, with GitHub Actions driving checks and deployment on merge. Payments, realtime, AI, and background jobs remain out of scope.
