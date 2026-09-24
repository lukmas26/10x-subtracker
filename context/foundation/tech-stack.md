---
starter_id: 10x-astro-starter
package_manager: npm
project_name: subtracker
hints:
  language_family: js
  team_size: solo
  deployment_target: cloudflare-workers
  ci_provider: github-actions
  ci_default_flow: auto-deploy-on-merge
  bootstrapper_confidence: first-class
  path_taken: standard
  quality_override: false
  self_check_answers: null
  has_auth: true
  has_payments: false
  has_realtime: true
  has_ai: true
  has_background_jobs: false
---

## Why this stack

Solo developer shipping a subscription-tracking MVP in one week of after-hours work, against a fixed deadline. The PRD's must-have set is login with two roles, CRUD on subscriptions, a spending summary, and a duplicate-category recommendation — so auth plus a relational store are the load-bearing needs, and neither deserves hand-rolling under a one-week budget. 10x Astro Starter is the recommended default for a web app in JavaScript/TypeScript and ships auth, PostgreSQL, and edge deploy together; it clears all four agent-friendly gates, and its TypeScript-first posture suits a developer who is experienced in code but new to supervising agents. Bootstrapper confidence is first-class, so scaffolding should be smooth with occasional hiccups rather than manual assembly. Payments are false deliberately: the product records subscriptions, it never charges for them, and PRD non-goals rule out bank integration. AI and background jobs are false for the MVP — automatic categorization and fetching plan details from provider sites are nice-to-have requirements scoped out for later, and the starter's edge runtime will need a separate worker when they land.
