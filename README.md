# Mini Secrets Manager

A production-grade secrets management API built with security at every layer — from code to deployment.

Inspired by HashiCorp Vault, this project demonstrates a complete **Shift-Left Security** approach: every stage of the CI/CD pipeline enforces security controls before code reaches production.

---

## Table of Contents

- [Security Pipeline](#security-pipeline)
- [Architecture](#architecture)
- [Stack](#stack)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [Local Development](#local-development)
- [Testing](#testing)
- [API Endpoints](#api-endpoints)
- [Monitoring & Alerting](#monitoring--alerting)
- [Operational Notes](#operational-notes)
- [What I Learned](#what-i-learned)
- [What's Next](#whats-next)

---

## Security Pipeline

The CI/CD pipeline is the core of this project. Security is not added at the end — it is enforced at each step, and each tool blocks the pipeline on critical findings (`exit 1`). There is no `|| true` on any security scan.

```
Code Push
  → SAST           (Semgrep)       — detects vulnerabilities at the code level
  → Secrets Scan   (Trufflehog)    — detects hardcoded secrets in git history
  → SCA            (Snyk)          — detects CVEs in npm dependencies
  → Tests          (Jest)          — 31 unit tests against isolated logic
  → Tests E2E      (Jest)          — 19 tests against a real isolated database
  → Build          (Docker)        — multi-stage, non-root, minimal attack surface
  → Container Scan (Trivy)         — detects CVEs in the Docker image
  → Deploy Staging (AWS EC2)       — migrations applied before container starts
  → DAST           (OWASP ZAP)     — 146 security checks against the live API
  → Deploy Prod    (AWS EC2)       — migrations applied before container starts
```

**Real incidents caught by the pipeline:**

- **Snyk blocked the first deployment** on a critical CVE — Race Condition in `effect@3.18.4`, a transitive dependency introduced by Prisma. The pipeline did not deploy. The dependency was pinned and the pipeline passed on the next push.
- **E2E tests caught a silent production bug** — the `DELETE /secrets/:id` transaction had its operations in the wrong order, causing a foreign key violation that returned HTTP 500 on every delete call. Unit tests missed it because Prisma was mocked. E2E tests hit the real database and surfaced the failure immediately.

Dependabot opens weekly PRs for npm dependencies (grouped by ecosystem: NestJS, Prisma) and GitHub Actions to keep the supply chain current.

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                       NestJS API                         │
│                                                          │
│  Auth Module        → JWT (15min TTL), bcrypt cost 12    │
│  Secrets Module     → CRUD + AES-256-GCM encryption      │
│  Crypto Module      → Node.js native crypto, no deps     │
│  Audit Module       → Every access logged (who/when/IP)  │
│  Monitoring Module  → Prometheus metrics + interceptor   │
└──────────────────────┬───────────────────────────────────┘
                       │
            ┌──────────┴──────────┐
            │                     │
       PostgreSQL            Prometheus
       (Neon)                     │
                             Grafana
                          (auto-provisioned)
```

**Key security decisions:**

| Decision | Reason |
|---|---|
| AES-256-GCM with random IV per encryption | Semantic security — identical plaintexts produce different ciphertexts |
| IV stored separately from ciphertext | Required for correct GCM decryption; never exposed to the client |
| Encryption key via env only, never in code | Prevents key leakage through version control or logs |
| Ownership violations return `404` not `403` | Prevents attackers from confirming whether a secret exists |
| Auth errors return a generic message | Prevents user enumeration regardless of failure reason |
| Audit logs contain no secret values | Traceability without data leakage |
| Prisma `select` explicit on every query | No accidental exposure of `password`, `iv`, or other sensitive fields |

---

## Stack

| Layer | Technology | Reason |
|---|---|---|
| API | NestJS + TypeScript | Structured, typed, production-standard |
| Database | PostgreSQL (Neon) | Relational integrity, UUID primary keys |
| ORM | Prisma | Explicit `select`, no accidental data exposure |
| Encryption | Node.js `crypto` (native) | No external dependency for sensitive operations |
| Auth | JWT + Passport | Stateless, 15min TTL |
| Container | Docker multi-stage | Non-root user, minimal image, no dev deps in prod |
| Registry | AWS ECR | Private registry |
| Deployment | AWS EC2 | Docker Compose, staging + production environments |
| CI/CD | GitHub Actions | Shift-Left pipeline with 6 security tools |
| Monitoring | Prometheus + Grafana | Auto-provisioned datasource, dashboard, and alert rules |

---

## Project Structure

```
.
├── .github/
│   ├── workflows/
│   │   └── ci.yml              # Full CI/CD pipeline (SAST → deploy prod)
│   └── dependabot.yml          # Weekly dependency updates
├── src/
│   ├── auth/                   # JWT authentication, bcrypt, rate limiting
│   ├── secrets/                # CRUD endpoints + encryption + audit logging
│   ├── crypto/                 # AES-256-GCM service (zero external deps)
│   ├── audit/                  # Access log service + GET /audit (admin only)
│   ├── monitoring/             # Prometheus counters, histograms, HTTP interceptor
│   ├── common/
│   │   ├── decorators/         # @Roles('admin')
│   │   ├── filters/            # GlobalExceptionFilter — hides Prisma errors
│   │   └── guards/             # RolesGuard
│   ├── prisma/                 # PrismaService
│   └── main.ts                 # App bootstrap — pipes, filters, interceptors
├── prisma/
│   └── schema.prisma           # Data model: users, secrets, audit_logs
├── test/
│   ├── app.e2e-spec.ts         # Health check
│   ├── secrets-flow.e2e-spec.ts # Full flow: register → create → read → audit → delete
│   └── jest-e2e.json
├── docker/
│   └── Dockerfile              # Multi-stage build (deps → build → production)
├── monitoring/
│   ├── prometheus.yml          # Scrape config (app:3000/metrics, 15s interval)
│   └── grafana/
│       └── provisioning/
│           ├── datasources/    # Prometheus datasource
│           ├── dashboards/     # Dashboard JSON (7 panels)
│           └── alerting/       # Alert rules (brute force, latency)
├── docker-compose.yml          # API + PostgreSQL + Prometheus + Grafana
└── .env.example                # Environment variable template
```

---

## Getting Started

**Prerequisites:** Docker, Docker Compose

```bash
# 1. Clone
git clone https://github.com/hadimouter/mini-secrets-manager
cd mini-secrets-manager

# 2. Configure environment
cp .env.example .env
# Edit .env — fill in DATABASE_URL, JWT_SECRET, ENCRYPTION_KEY

# 3. Start all services
docker compose up --build
```

| Service | URL |
|---|---|
| API | http://localhost:3000 |
| Swagger UI | http://localhost:3000/api |
| Prometheus | http://localhost:9090 |
| Grafana | http://localhost:3001 |

Grafana credentials: `admin` / `admin` (or `GRAFANA_PASSWORD` from `.env`).

The Grafana dashboard and alert rules are provisioned automatically — no manual setup required.

---

## Environment Variables

| Variable | Required | Format | Description |
|---|---|---|---|
| `DATABASE_URL` | ✅ | `postgresql://user:pass@host/db` | PostgreSQL connection string |
| `JWT_SECRET` | ✅ | Any string (min 32 chars recommended) | Signing key for JWT tokens |
| `ENCRYPTION_KEY` | ✅ | 64 hex characters (32 bytes) | AES-256-GCM encryption key |
| `METRICS_TOKEN` | ✅ | 64 hex characters recommended | Bearer token required to scrape `/metrics` |
| `JWT_EXPIRES_IN` | — | Duration string (default: `15m`) | JWT token lifetime |
| `PORT` | — | Integer (default: `3000`) | HTTP port |
| `NODE_ENV` | — | `development` \| `production` | Runtime environment |

**Generating `ENCRYPTION_KEY`:**

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

> The `ENCRYPTION_KEY` must be generated once and never changed while secrets are stored in the database. See [Key Rotation](#key-rotation) below.

The application validates all required variables at startup and refuses to start if any are missing (fail-fast).

---

## Local Development

**Prerequisites:** Node.js 22, a PostgreSQL database (local or Neon)

```bash
# Install dependencies
npm install

# Configure environment
cp .env.example .env
# Edit .env with your local DATABASE_URL, JWT_SECRET, ENCRYPTION_KEY

# Apply database schema
npx prisma db push

# Generate Prisma client
npx prisma generate

# Start in watch mode
npm run start:dev
```

**Other useful commands:**

```bash
npm run build          # Compile TypeScript
npm run typecheck      # Type-check without emitting
npm run lint           # ESLint with auto-fix
npm run check          # Full check: tsc + eslint + unit tests
```

---

## Testing

### Unit tests

```bash
npm test
```

31 tests covering the crypto service (AES-256-GCM round-trip, tamper detection, IV uniqueness) and the secrets service (create, read, delete, access control, audit log production, expiration).

### E2E tests

```bash
npm run test:e2e
```

19 tests covering the full application flow against a real PostgreSQL database:

1. `POST /auth/register` — creates account, returns JWT, rejects duplicates and short passwords
2. `POST /auth/login` — authenticates, returns JWT, rejects wrong credentials
3. `POST /secrets` — stores encrypted secret, never returns plaintext or IV
4. `GET /secrets/:id` — decrypts and returns the original value (encryption round-trip validated)
5. `GET /audit` — returns 403 for viewers, paginated logs for admin, secret value never in logs
6. `DELETE /secrets/:id` — removes the secret, confirmed by subsequent 404

> E2E tests require a valid `.env` file with a real `DATABASE_URL`. Test data is created under dedicated emails (`e2e-*@test.local`) and cleaned up after each run.

### Full check

```bash
npm run check   # tsc --noEmit + eslint + jest unit tests
```

---

## API Endpoints

Full interactive documentation available at `http://localhost:3000/api` (Swagger UI).

| Method | Route | Auth | Description |
|---|---|---|---|
| `POST` | `/auth/register` | — | Create an account (role: viewer) |
| `POST` | `/auth/login` | — | Authenticate, returns JWT |
| `POST` | `/secrets` | JWT | Store an encrypted secret |
| `GET` | `/secrets/:id` | JWT | Retrieve and decrypt a secret |
| `DELETE` | `/secrets/:id` | JWT | Delete a secret |
| `GET` | `/audit` | JWT (admin) | List audit logs (paginated, 50/page) |
| `GET` | `/health` | — | Health check |
| `GET` | `/metrics` | Bearer `METRICS_TOKEN` | Prometheus metrics scrape endpoint |

**Access control:**
- `viewer` — can create, read, and delete their own secrets
- `admin` — can read and delete any secret, access audit logs

**Rate limiting:** `/auth/login` is limited to 5 requests/minute per IP to mitigate brute force attacks.

---

## Monitoring & Alerting

Grafana is fully provisioned on startup — datasource, dashboard, and alert rules require no manual configuration.

**Metrics exposed at `/metrics` (requires `Authorization: Bearer <METRICS_TOKEN>`):**

| Metric | Type | Description |
|---|---|---|
| `secrets_created_total` | Counter | Secrets stored |
| `secrets_read_total` | Counter | Secrets decrypted and returned |
| `secrets_deleted_total` | Counter | Secrets deleted |
| `auth_failures_total` | Counter | Failed login attempts |
| `http_request_duration_seconds` | Histogram | Request latency by method, route, status |

Standard Node.js metrics (event loop lag, heap usage, GC) are also collected via `prom-client`.

**Alert rules (provisioned):**

| Alert | Condition | Severity |
|---|---|---|
| High Authentication Failure Rate | `increase(auth_failures_total[5m]) > 20` | warning |
| High API Latency | `p99 latency > 2s over 5 minutes` | warning |

---

## Operational Notes

### Key rotation

The `ENCRYPTION_KEY` must never change after secrets are stored. All existing secrets are decrypted using the current key — rotating the key without migrating the data makes every stored secret permanently unreadable.

Key rotation requires a migration script that:
1. Reads every secret from the database
2. Decrypts each value with the old key
3. Re-encrypts with the new key and a fresh IV
4. Writes the new ciphertext and IV back in a single transaction

This is a known operational constraint of symmetric encryption at rest.

### Database migrations

Migrations run automatically on every deployment — before the container starts in both staging and prod. If `prisma migrate deploy` fails, the script exits (`set -e`) and the running container is left untouched.

On a fresh EC2 instance with no prior container, the same automatic step applies. No manual intervention required.

---

## What I Learned

Building this project taught me that security and development are not separate concerns — they are the same concern at different stages of the pipeline.

**Shift-Left is a mindset, not a checklist.** Adding Trivy at the end of a pipeline and calling it "secure" is not Shift-Left. Real Shift-Left means each stage has an owner: the developer owns SAST, the pipeline owns SCA and container scanning, the runtime owns DAST. When Snyk blocked the pipeline on a transitive CVE in Prisma during the first real run, that was the pipeline doing exactly what it was designed to do.

**The hardest security decisions are architectural.** Choosing to store the IV separately, returning 404 instead of 403 on ownership violations, using generic error messages on authentication — none of these require complex code. They require thinking about what information an attacker can extract from your API's behavior.

**`|| true` is a security decision.** Every `|| true` in a pipeline is a conscious choice to ignore a failure. The only justified use in this project is `docker stop || true` on deployment — because the container may not exist on first deploy. This is not the same as `trivy scan || true`, which silently disables a security control.

**Mocking is a trap.** Unit tests passed on the delete endpoint for months. E2E tests found the bug in 3 seconds. The difference is that unit tests validated the logic in isolation — E2E tests validated the behavior of the system as a whole, including the database constraints that the mocks had silently absorbed.

---

## What's Next

**Terraform**
The current infrastructure (ECR, EC2 staging + prod, security groups, IAM roles) was provisioned manually via the AWS CLI. The next step is to replace this with Terraform — a `terraform apply` should be able to recreate the entire infrastructure from scratch with no manual intervention. Without IaC, infrastructure state lives in the AWS console, not in version control.

**AWS Secrets Manager**
Application secrets (JWT_SECRET, ENCRYPTION_KEY, DATABASE_URL) are currently injected via GitHub Secrets. In a production environment, the right approach is AWS Secrets Manager — automatic rotation, fine-grained IAM access per service, and a full audit trail of every secret access. GitHub Secrets is sufficient for this project scope but does not scale to a multi-service architecture.

---

## Project Context

Built as a portfolio project for a DevSecOps Master's program (Oteria Cyber Sécurité).
The goal was to demonstrate a production-grade Shift-Left Security pipeline, not a tutorial project.
