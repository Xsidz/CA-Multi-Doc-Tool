# Helium Developer Standards

This document outlines the mandatory coding standards, workflows, and best practices that every developer on the Helium (he2.ai) team must follow. Non-compliance will result in PR rejection.

---

## Table of Contents

1. [Git & Branch Standards](#git--branch-standards)
2. [Commit Message Standards](#commit-message-standards)
3. [Pull Request Standards](#pull-request-standards)
4. [Feature Flags](#feature-flags)
5. [Security & Secrets](#security--secrets)
6. [Environment & Tooling](#environment--tooling)
7. [Frontend Standards](#frontend-standards)
8. [Backend Standards](#backend-standards)
9. [Testing Standards](#testing-standards)
10. [Code Review Checklist](#code-review-checklist)

---

## Git & Branch Standards

### Branch Naming

All branches **must** follow this format:

```
<prefix>/<ticket>-<description>
```

- Use **kebab-case** (lowercase, hyphens)
- Always include the ticket/issue number when one exists

**Allowed prefixes:**

| Prefix | Use When |
|---|---|
| `feature/` | Adding new functionality |
| `bugfix/` | Fixing a bug |
| `hotfix/` | Urgent production fix |
| `release/` | Preparing a release |
| `chore/` | Maintenance, dependency updates |
| `docs/` | Documentation changes only |
| `refactor/` | Code restructuring without behavior change |

**Examples:**

```
feature/HE2-142-add-team-invite-flow
bugfix/HE2-305-fix-thread-pagination
hotfix/HE2-410-patch-auth-redirect
chore/HE2-99-upgrade-nextjs
refactor/HE2-200-simplify-billing-service
```

**Not allowed:**

```
myfix                          # No prefix, no ticket
Feature/add-stuff              # Wrong case
feature/addTeamInviteFlow      # camelCase not allowed
fix_something_quick            # Underscores not allowed
john/testing                   # Developer names are not prefixes
```

### Main Branch

- The main branch is **`main`**
- Never push directly to `main` — always go through a PR
- All feature branches are merged via **squash-and-merge**

### Branch Cleanup

- **Branches are deleted immediately after PR merge** — no exceptions
- Enable "Delete branch after merge" in your GitHub settings
- Do not keep stale branches around. If a branch has been inactive for more than 2 weeks without an open PR, it will be deleted
- Before starting work, always pull the latest from `main` and create a fresh branch

---

## Commit Message Standards

All commits **must** follow the [Conventional Commits](https://www.conventionalcommits.org/) format:

```
<type>(<scope>): <subject>
```

### Rules

- **Subject**: imperative mood, max 72 characters, no trailing period
- **Scope**: the domain or area affected (e.g., `auth`, `billing`, `agent`, `frontend`)
- **Body** (optional): explain *why*, not *what* — the diff shows what changed

### Allowed Types

| Type | When to Use |
|---|---|
| `feat` | New feature or functionality |
| `fix` | Bug fix |
| `docs` | Documentation only |
| `refactor` | Code change that neither fixes a bug nor adds a feature |
| `test` | Adding or updating tests |
| `chore` | Build process, tooling, dependency updates |
| `ci` | CI/CD pipeline changes |
| `perf` | Performance improvement |

### Examples

```
feat(agent): add retry logic for failed sandbox executions
fix(billing): prevent duplicate Stripe webhook processing
refactor(knowledge-base): extract chunking into dedicated service
test(auth): add integration tests for phone auth flow
chore(deps): upgrade @tanstack/react-query to v5
ci(deploy): add staging environment to GitHub Actions
perf(redis): batch cache invalidation for thread updates
```

**Not allowed:**

```
fixed stuff                    # No type, vague description
feat: Add New Feature.         # Trailing period, wrong case
update                         # No type, no scope, no description
WIP                            # Never commit WIP to shared branches
```

### No Co-Author Attribution

Do not add `Co-Authored-By` lines for Anthropic or Claude in commit messages.

---

## Pull Request Standards

### PR Size

There is **no hard line-count cap** on PRs — our development pace makes rigid limits counterproductive, so the old 400/1000-line gate has been removed.

The principle still holds, though: **keep PRs small and self-contained.** Smaller PRs are reviewed faster and more thoroughly, introduce fewer bugs, and roll back cleanly.

- One PR = one self-contained change. Split unrelated work.
- Keep refactors in their own PR, separate from features and bugfixes.
- If a PR is growing unwieldy, split it into logical, independently reviewable chunks — each functional on its own (stacked PRs, by file/reviewer, or by vertical slice).

See [CODE_REVIEW.md](CODE_REVIEW.md) for the full reviewer standard and how we keep changes reviewable.

### PR Title

Follow the same Conventional Commits format as commit messages:

```
feat(agent): add retry logic for failed sandbox executions
```

### PR Description (Required)

The **title / first line** is a standalone summary in imperative mood, present tense — it lands in git history and must make sense on its own (`feat(billing): remove size limit on webhook retry freelist`, not `Fix bug`, `update`, or `WIP`). The body answers **what** changed and **why** (rationale, alternatives considered, known limitations, links). Re-read it before submitting — PRs evolve during review and a stale description misleads every future reader. See [Writing good PR descriptions](https://google.github.io/eng-practices/review/developer/cl-descriptions.html).

Every PR **must** include the following sections:

```markdown
## Summary
<!-- 2-3 bullet points explaining WHAT changed and WHY -->

- Added retry logic for sandbox execution failures
- Implements exponential backoff with max 3 retries
- Addresses intermittent timeout issues reported in #142

## Related Issue
<!-- Link the ticket -->
Fixes #142

## Type of Change
<!-- Check one -->
- [ ] New feature
- [ ] Bug fix
- [ ] Refactor
- [ ] Documentation
- [ ] CI/CD
- [ ] Other (describe)

## Testing
<!-- How was this tested? -->
- [ ] Unit tests added/updated
- [ ] Integration tests added/updated
- [ ] Manual testing performed (describe steps)
- [ ] Feature flag verified in staging

## Self-Review Checklist
- [ ] Code follows project conventions
- [ ] No secrets, API keys, or tokens committed
- [ ] No `console.log` or debug statements left in
- [ ] No `any` types in TypeScript
- [ ] Feature flag wraps new functionality
- [ ] Database migrations are backward-compatible
- [ ] Error handling follows project patterns
- [ ] Accessibility checked (if UI change)
```

### PR Review Rules

- Minimum **1 approval** required before merge
- All CI checks must pass
- Resolve all review comments before merging
- Do not merge your own PR without at least one review
- Use "Request Changes" for blocking issues, "Comment" for suggestions

---

## Feature Flags

### Mandatory for All New Changes

Every new feature, UI change, or behavioral modification **must** be wrapped in a feature flag. This allows:

- Safe rollback without redeployment
- Gradual rollout to subsets of users
- A/B testing and validation
- Decoupling deployment from release

### Implementation

**Frontend:**

```typescript
// Use the feature flag hook
const { isEnabled } = useFeatureFlag('new-thread-ui');

if (isEnabled) {
  return <NewThreadUI />;
}
return <LegacyThreadUI />;
```

**Backend:**

```python
from utils.feature_flags import is_feature_enabled

async def process_request(team_id: str):
    if await is_feature_enabled("new-billing-logic", team_id):
        return await new_billing_flow()
    return await legacy_billing_flow()
```

### Feature Flag Lifecycle

1. **Create**: Add the flag before starting development
2. **Develop**: All new code behind the flag (default: OFF)
3. **Test**: Enable in staging, run full test suite
4. **Release**: Gradually enable in production (10% -> 50% -> 100%)
5. **Cleanup**: Once stable for 2+ weeks at 100%, remove the flag and dead code

### Naming Convention

```
<domain>-<feature-description>
```

Examples: `agent-retry-logic`, `billing-new-checkout`, `thread-markdown-preview`

---

## Security & Secrets

### Never Commit Secrets

This is a **zero-tolerance policy**. Committing secrets (API keys, tokens, passwords, credentials) is a terminable offense in regulated environments.

**Banned from source code:**

- API keys (Anthropic, Gemini, Stripe, Tavily, Daytona, etc.)
- Database connection strings
- JWT secrets or signing keys
- OAuth client secrets
- AWS credentials or access keys
- Any `.env` or `.env.local` file contents
- Private keys, certificates, or PEM files

### Where Secrets Belong

| Environment | Method |
|---|---|
| Local development | `.env` / `.env.local` files (already in `.gitignore`) |
| CI/CD | GitHub Actions secrets or environment variables |
| Staging/Production | AWS Secrets Manager / environment variables |

### Pre-Commit Checks

- A pre-commit hook scans for potential secrets before allowing commits
- If the hook blocks your commit, **do not bypass it** with `--no-verify`
- If you accidentally commit a secret, notify the team **immediately** — the secret must be rotated, not just removed from history

### Frontend-Specific Security

- Never expose server-side keys via `NEXT_PUBLIC_` prefix
- Never use `dangerouslySetInnerHTML` without DOMPurify sanitization
- Set auth cookies as `HttpOnly`, `Secure`, `SameSite=Strict`
- Never return raw exception details to the client

### Backend-Specific Security

- Use the `secrets` module for OTP/token generation — never `random`
- Use `hmac.compare_digest` for secret/token comparison — never `==`
- Never log PII (emails, phone numbers, names) in plaintext — always mask
- Encrypt PII fields at rest
- Use verified SSL for all database and API connections

---

## Environment & Tooling

### Tool Versions

All developers must use the versions specified in `mise.toml`:

- **Node.js**: 20
- **Python**: 3.11.10
- **UV**: 0.6.5

Use [mise](https://mise.jdx.dev/) to manage tool versions automatically.

### Running Commands in the Right Directory

This is a common mistake. **Know where to run what.**

| Command | Run From | Not From |
|---|---|---|
| `npm install` | `frontend/` | **Never from project root** |
| `npm run dev` | `frontend/` | **Never from project root** |
| `npm run build` | `frontend/` | **Never from project root** |
| `uv sync` | `backend/` | **Never from project root** |
| `uv run api.py` | `backend/` | **Never from project root** |
| `uv run pytest` | `backend/` | **Never from project root** |
| `docker compose up` | Project root (`he2-beta/`) | Not from subdirectories |
| `python setup.py` | Project root (`he2-beta/`) | Not from subdirectories |

**Running `npm install` from the project root will create a rogue `node_modules/` and `package-lock.json` in the root — this breaks the build and pollutes the repo.**

### Local Development Setup

```bash
# 1. Clone and enter the repo
git clone <repo-url> && cd he2-beta

# 2. Run the setup wizard
python setup.py

# 3. Install frontend dependencies
cd frontend && npm install

# 4. Install backend dependencies
cd ../backend && uv sync

# 5. Start Redis (required for backend)
docker compose up redis

# 6. Start backend (new terminal, from backend/)
cd backend && source .venv/bin/activate && uv run api.py

# 7. Start frontend (new terminal, from frontend/)
cd frontend && npm run dev
```

### Environment Variables

**Backend** (`.env` in `backend/`):

- `REDIS_HOST` — use `localhost` for local dev, `redis` inside Docker
- `ANTHROPIC_API_KEY`, `GEMINI_API_KEY` — LLM provider keys
- `DAYTONA_API_KEY` — sandbox provider
- `TAVILY_API_KEY` — web search

**Frontend** (`.env.local` in `frontend/`):

- `NEXT_PUBLIC_BACKEND_URL` — defaults to `http://localhost:8000/api`
- `NEXT_PUBLIC_ENV_MODE` — environment mode flag

---

## Frontend Standards

### TypeScript

- **Strict mode** — no exceptions
- **No `any` types** — use proper typing or `unknown` if truly needed
- Use TypeScript interfaces/types for all props, API responses, and state

### Components

- **Always use shadcn/ui** components from `components/ui/` — never raw HTML elements (`<button>`, `<input>`, `<select>`, etc.)
- **Always use Remix Icons** via `<i className="ri-icon-name-line">` — never `import` from `react-icons`
- Functional components with hooks only — no class components
- Keep components focused and small

### State Management

| What | Tool |
|---|---|
| Server state (API data) | React Query (`@tanstack/react-query`) |
| Global client state | Zustand stores (`stores/`) |
| Local component state | `useState` / `useReducer` |
| Form state | React Hook Form |

### Styling

- **Tailwind CSS 4** for all styling
- **shadcn/ui** + **DaisyUI** for component primitives
- CSS variables for theming
- No inline `style={{}}` attributes unless absolutely necessary
- No external CSS files for component-specific styles

### Code Quality

- No `console.log` in committed code — use proper logging or remove
- No commented-out code blocks — delete them, git has history
- No unused imports or variables
- Run `npm run lint` and `npm run format:check` before pushing

---

## Backend Standards

### Python

- All functions **must** have type annotations
- Use `async/await` for **all** I/O operations (database, API calls, file I/O)
- Use Pydantic models for all request/response schemas
- Follow the domain-driven structure:
  - Routes in `domain/<feature>/api/`
  - Business logic in `domain/<feature>/service/`
  - Data access in `domain/<feature>/repository/`
  - Models in `domain/<feature>/models/`

### Database

- All database operations use asyncpg (async)
- Migrations go in `backend/aurora/migrations/<domain>/` as SQL files (Aurora-only — Supabase migrations are fully removed). Hand `.sql` files to the owner to run; never auto-run them
- Migrations **must** be backward-compatible — never drop columns that production code still reads
- Always add indexes for columns used in WHERE clauses or JOINs
- Use parameterized queries — never string-concatenate SQL

### Error Handling

- Never expose internal error details to the client
- Use structured error responses with appropriate HTTP status codes
- Log errors with context using structlog
- Never catch and silently swallow exceptions

### LLM Integration

- All LLM calls go through the LiteLLM abstraction (`infrastructure/llm/`)
- Never hardcode model names — use configuration
- Always handle rate limits and timeouts gracefully

---

## Testing Standards

### Backend

- **Coverage threshold: 70% minimum** — PRs that drop coverage below this will be blocked
- Use pytest markers appropriately:

| Marker | When to Use |
|---|---|
| `@pytest.mark.unit` | No external dependencies needed |
| `@pytest.mark.integration` | Requires DB, Redis, or external services |
| `@pytest.mark.property` | Hypothesis property-based tests |
| `@pytest.mark.slow` | Tests that take >5 seconds |

- Run unit tests before pushing: `uv run pytest -m "not integration"`
- Write tests for all new business logic
- Mock external services, not internal ones

### Frontend

- Write tests for utility functions and hooks
- Use React Testing Library for component tests
- Test user interactions, not implementation details
- Run tests before pushing: `npm test`

---

## Code Review Checklist

Use this checklist when reviewing (or self-reviewing) a PR. For *how* to review — the code-health standard, comment etiquette, speed, and strict-tier surfaces — see [CODE_REVIEW.md](CODE_REVIEW.md).

> **Approve when the PR improves overall code health, not when it's perfect.** Block only real problems; label everything else. Tag each comment's severity: `Blocking:` (must fix) / `Nit:` (minor) / `Optional:` (worth weighing) / `FYI:` (context). Respond within one business day.

### General
- [ ] PR title follows Conventional Commits format and reads as a standalone summary
- [ ] PR description includes all required sections and explains *what* + *why*
- [ ] PR is small and self-contained; refactors split from behavior changes
- [ ] Branch name follows the naming convention
- [ ] No merge commits — rebase on `main` if needed

### Code Quality
- [ ] No `any` types in TypeScript
- [ ] No `console.log` or debug statements
- [ ] No commented-out code
- [ ] No unused imports or variables
- [ ] Functions have proper type annotations (Python)
- [ ] Error handling is appropriate

### Security
- [ ] No secrets, keys, or tokens in code
- [ ] No PII logged in plaintext
- [ ] No `dangerouslySetInnerHTML` without sanitization
- [ ] No raw SQL string concatenation
- [ ] Auth/permissions checked on new endpoints

### Architecture
- [ ] New features behind feature flags
- [ ] Follows domain-driven structure (backend)
- [ ] Uses shadcn/ui components (frontend)
- [ ] Uses React Query for API data (frontend)
- [ ] Database migrations are backward-compatible

### Testing
- [ ] Tests added for new functionality
- [ ] All existing tests pass
- [ ] Coverage threshold maintained

---

## Compliance Reminder

Helium is pursuing **SOC 2 Type 2** and **GDPR** compliance. Any code touching authentication, user data, encryption, or access control must follow the policies in `compliance/policies/`. When in doubt, ask before shipping.

---

## Quick Reference Card

```
Branch:    feature/HE2-123-add-widget
Commit:    feat(widget): add interactive widget to dashboard
PR Title:  feat(widget): add interactive widget to dashboard
PR Size:   No hard cap; keep small & self-contained
Review:    Approve on code-health; label nits; respond < 1 business day
Secrets:   .env only, never in code
npm:       Run from frontend/, NEVER from root
uv:        Run from backend/
Flags:     All new features behind feature flags
Branches:  Deleted after merge
Tests:     Required, 70% coverage minimum
Types:     No `any` in TypeScript, type all Python functions
```

---

*Last updated: 2026-06-10*
