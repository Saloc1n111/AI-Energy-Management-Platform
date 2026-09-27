# Project: AI Energy Management Platform Technical Remediation

## Architecture
- **Backend**: Go with Clean Architecture / DDD:
  - `internal/domain`: Pure enterprise business rules. Must NOT import `crypto/*` or `encoding/*`. Bounded contexts: `auth`, `meters`, `anomalies`, `analysis`, `copilot`, `visit`.
  - `internal/app`: Application services orchestrating use cases (`auth`, `meters`, `anomalies`, `analysis`, `copilot`, `visits`).
  - `internal/infrastructure`: Frameworks, drivers, and external adapters:
    - `sqlite`: Database repository implementations.
    - `security`: Cryptographic token generation, validation, and password hashing.
    - `httpapi`: HTTP handlers, Chi router, authentication & CORS middleware.
    - `ai`: Gemini & Claude LLM clients, deterministic fallback explainer.
  - `cmd/api`: Composition root injecting configuration and dependencies.
- **Frontend**: React 19 + TypeScript + Vite + Tailwind CSS:
  - Declarative routing with `react-router-dom` (`/login`, `/dashboard`, `/meters`, `/meters/:meterId`, `/anomalies`, `/anomalies/:anomalyId`).
  - Reactive state management driven strictly by backend API endpoints (`/api/v1/*`), zero mock dictionaries or synthetic timer simulations.
  - Automated testing via Vitest + React Testing Library + JSDOM (`npm test`).

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | JWT Authentication Middleware | Protect all business routes (`/api/v1/meters`, `/anomalies`, `/ai/analyze`, `/ai/ask`, `/technical-visits`) returning HTTP 401 when token is missing/invalid | M1 | R1.1 |
| 2 | Strict CORS Origin Policy | Enforce strict Origin matching against `CORS_ORIGIN`, eliminating arbitrary origin reflection | M1 | R1.2 |
| 3 | Environment-Driven JWT Secret | Inject `JWT_SECRET` via environment config with no hardcoded fallback defaults | M1 | R1.3 |
| 4 | Clean Git Version Control | Formal git tracking of all system source code with no uncommitted logic files | M1/M5 | R1.4 |
| 5 | Domain Cryptography Isolation | Relocate token generation/validation to `internal/infrastructure/security`; zero `crypto/*` or `encoding/*` in `domain/auth` | M2 | R2.1 |
| 6 | TechnicalVisit Bounded Context Decoupling | Extract `TechnicalVisit` out of `copilot` into `internal/domain/visit` and dedicated `VisitHandler` | M2 | R2.2 |
| 7 | Orphaned Interface Elimination | Delete unused `AnomalyStatusUpdater` and `MeterFinder` with `any` types | M2 | R2.3 |
| 8 | Frontend Dead Code Removal | Delete unused components: `BreakdownChart`, `HumanDiagnosisBanner`, `CompactAlertBanner`, `TremorCard`, `TremorProgressBar`, `telemetry.ts`, `Baseline24hChart`, `App.css` | M3 | R3.1 |
| 9 | Purge Mock Data & Dictionaries | Remove `defaultMeters`, `meterProfiles`, `meterAIDiagnostics`, and static M-109/M-112 branches | M3 | R3.2 |
| 10 | Dynamic MeterTracker Health | Drive `meterTracker` visual blocks and status directly from real `readings` and `anomalies` | M3 | R3.3 |
| 11 | Authentic Baseline & Anomaly Actions | Eliminate fake `setTimeout` simulations; wire baseline actions and anomaly status updates to real API calls | M3 | R3.4 |
| 12 | Graceful AI Provider Transparency | Transparent error/status handling when LLM keys are absent, avoiding brittle fallbacks | M4 | R4.1 |
| 13 | Dynamic Copilot Summaries | Generalize copilot deterministic explainer and prompts to dynamic SQLite metrics, removing fixed 12-meter / 4,032-reading assumptions | M4 | R4.2 |
| 14 | Official LLM Model Identifiers | Configure official production model identifiers (`gemini-2.0-flash`, `claude-3-5-sonnet-20241022`) replacing fictional names | M4 | R4.3 |
| 15 | Declarative Routing & Deep-Linking | Standardize navigation on `react-router-dom` with URL history, deep-links, and route protection | M4 | R4.4 |
| 16 | Frontend Automated Test Suite | Vitest + Testing Library test runner (`npm test`) with unit/component tests for `StatCard`, `RunAnalysisModal`, and `client.ts` | M5 | R5.1 |
| 17 | Backend Repository & Service Tests | Unit tests for SQLite repos (`meter`, `reading`, `anomaly`, `event`, `analysis`, `visit`) and services (`analysis`, `meters`, `anomalies`) passing 100% via `go test -v ./...` | M5 | R5.2 |
| 18 | Code Quality & Linter Compliance | Clean compilation and linter execution (`npm run build`, `npm run lint`, `go test`) with 0 errors | M5 | R5.3 |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M1 | API Security, Secret Management & Auth | Features 1, 2, 3: JWT Secret in config, Strict CORS, 401 Auth Middleware, Integration test bearer tokens | none | DONE |
| M2 | Architectural Decoupling & DDD | Features 5, 6, 7: Domain auth purity (no crypto/encoding), TechnicalVisit context extraction, orphan interface cleanup | M1 | DONE |
| M3 | Dead Code Elimination & Real Data | Features 8, 9, 10, 11: Purge dead components, remove mock dictionaries, dynamic meterTracker, eliminate simulated timers | M1, M2 | DONE |
| M4 | AI Copilot Robustness & Declarative Routing | Features 12, 13, 14, 15: Official LLM model names, dynamic copilot summaries, declarative router with deep-linking | M3 | DONE |
| M5 | Automated Test Suites & Full Verification | Features 4, 16, 17, 18: Frontend Vitest suite (`npm test`), Backend SQLite repo tests & service tests, 100% test pass, git clean | M1, M2, M3, M4 | DONE |

## Interface Contracts

### 1. Auth & Security Contract
- **Config**:
  ```go
  type Config struct {
      ...
      JWTSecret string // read from JWT_SECRET env, required (no hardcoded fallback)
  }
  ```
- **Security Infrastructure (`internal/infrastructure/security/jwt.go`)**:
  ```go
  type TokenManager interface {
      GenerateToken(user *domainauth.User, duration time.Duration) (string, error)
      ValidateToken(tokenStr string) (*domainauth.Claims, error)
  }
  ```
- **Auth Middleware (`internal/infrastructure/httpapi/middleware.go`)**:
  - Validates `Authorization: Bearer <token>` header on protected routes.
  - Returns HTTP 401 JSON `{ "error": "Unauthorized" }` if missing, invalid, or expired.
- **CORS Middleware**:
  - Compares client `Origin` header strictly with `config.CORSOrigin`.
  - Sets `Access-Control-Allow-Origin: <origin>` ONLY if it equals `config.CORSOrigin`. Otherwise does NOT emit header.

### 2. Domain & Bounded Contexts Contract
- **Domain Auth (`internal/domain/auth/auth.go`)**:
  - Zero imports of `crypto/*` or `encoding/*`.
  - Defines pure entities: `User`, `Role`, `Claims`.
- **Domain Visit (`internal/domain/visit/visit.go`)**:
  ```go
  type TechnicalVisit struct {
      ID          string     `json:"id"`
      MeterID     string     `json:"meter_id"`
      AnomalyID   *string    `json:"anomaly_id,omitempty"`
      ScheduledAt time.Time  `json:"scheduled_at"`
      Status      string     `json:"status"`
      Technician  string     `json:"technician"`
      Notes       string     `json:"notes"`
      CreatedAt   time.Time  `json:"created_at"`
  }
  type Repository interface {
      Save(ctx context.Context, v *TechnicalVisit) error
      FindByID(ctx context.Context, id string) (*TechnicalVisit, error)
      FindByMeterID(ctx context.Context, meterID string) ([]*TechnicalVisit, error)
      List(ctx context.Context) ([]*TechnicalVisit, error)
  }
  ```
- **HTTP Routing**:
  - `POST /api/v1/technical-visits` -> `VisitHandler.Create`
  - `GET /api/v1/technical-visits` -> `VisitHandler.List`

### 3. Frontend Real Data Contract
- **API Client**:
  - Attaches `Authorization: Bearer <token>` from auth state.
- **MeterTracker Health Calculation**:
  - Input: `readings: ReadingDTO[]`, `anomalies: AnomalyDTO[]`.
  - Output: 14 dynamic day blocks with status:
    - Critical (rose) if critical anomaly overlaps day window.
    - Warning (amber) if warning anomaly or threshold exceeded.
    - Nominal (emerald) if readings within normal range.
- **Routing**:
  - Declarative routes: `/login`, `/dashboard`, `/meters`, `/meters/:meterId`, `/anomalies`, `/anomalies/:anomalyId`.

## Code Layout
- `backend/internal/domain/auth/`: Pure auth domain entities.
- `backend/internal/domain/visit/`: Technical visit domain entity & repository port.
- `backend/internal/domain/copilot/`: Conversational AI context only.
- `backend/internal/infrastructure/security/`: JWT creation, validation, password hashing.
- `backend/internal/infrastructure/httpapi/`: HTTP handlers and middleware.
- `backend/internal/infrastructure/sqlite/`: SQLite repository implementations.
- `frontend/src/views/`: Routed pages (`DashboardView`, `MetersView`, `MeterDetailView`, `AnomaliesView`, `LoginView`).
- `frontend/src/components/`: Reusable active components (dead components purged).
- `frontend/src/test/`: Frontend automated test setup and test specs.
