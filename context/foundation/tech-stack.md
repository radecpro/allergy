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

Allergen Finder is a small web app with a 3-week after-hours MVP timeline, a solo builder, guest-first usage, and a login module included in the first release. React Router gives the project a TypeScript-first full-stack React structure with recognizable routing and data-loading conventions while avoiding a Vercel-specific deployment path. The hand-off records auth as in scope, while payments, realtime, AI, and background jobs stay out of scope. Deployment is recorded as `self-host` because that is the registry-compatible target for a containerized deployment; the intended infrastructure shape is GCP Cloud Run with GitHub Actions driving checks and deployment on merge.
