# GitHub and Deployment Adapters

Zeus prefers a connected GitHub tool that can inspect PRs, checks, workflow jobs,
steps, logs, artifacts and merge state. `gh` CLI is the portable fallback.

Deployment state may come from GitHub Deployments or a provider such as Vercel,
Netlify, Fly, Render or Kubernetes. Zeus must discover the real provider and configured
source. Provider-specific adapters may be added without changing the canonical lifecycle.

If only CI is visible and deployment is external, deployment remains Unknown rather
than Green.
