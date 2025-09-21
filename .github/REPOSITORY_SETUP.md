# GitHub Organization Repository Setup

## Repository Structure (Best Practice)

```
your-github-org/
├── advotecate-platform/          # Main monorepo (THIS REPO)
│   ├── backend/                  # Node.js API
│   ├── frontend/                 # React/Next.js app
│   ├── infrastructure/           # Terraform IaC
│   ├── .github/workflows/        # CI/CD pipelines
│   └── docs/                     # Documentation
├── advotecate-infrastructure/    # Optional: Separate infra repo
└── advotecate-docs/             # Optional: Public docs
```

## Quick Setup Commands

1. **Create Organization Repository:**
```bash
# Using GitHub CLI (recommended)
gh repo create your-org/advotecate-platform --public --source=. --remote=origin --push

# Or manually:
# 1. Go to GitHub.com → Your Org → New Repository
# 2. Name: advotecate-platform
# 3. Initialize with current code
```

2. **Push Current Code:**
```bash
git remote add origin https://github.com/YOUR_ORG/advotecate-platform.git
git branch -M main
git push -u origin main
```

3. **Set Branch Protection:**
```bash
# Protect main branch
gh api repos/YOUR_ORG/advotecate-platform/branches/main/protection \
  --method PUT \
  --field required_status_checks='{"strict":true,"contexts":["test","build"]}' \
  --field enforce_admins=true \
  --field required_pull_request_reviews='{"required_approving_review_count":1}' \
  --field restrictions=null
```

## Environment Strategy

- **main branch** → Production deployment (auto)
- **staging branch** → Staging deployment (auto)
- **feature branches** → Preview deployments (auto)
- **Pull requests** → Preview + testing (auto)

## Required Secrets (Set in GitHub Org)

Organization-level secrets (shared across repos):
- GCP_PROJECT_ID_PRODUCTION
- GCP_PROJECT_ID_STAGING
- GCP_SA_KEY (Service Account JSON)
- VERCEL_TOKEN
- VERCEL_ORG_ID
- SLACK_WEBHOOK_URL (optional)

Repository-level secrets (specific to this app):
- FLUIDPAY_API_KEY_PROD
- FLUIDPAY_API_SECRET_PROD
- FLUIDPAY_API_KEY_STAGING
- FLUIDPAY_API_SECRET_STAGING
- JWT_SECRET_PROD
- JWT_SECRET_STAGING