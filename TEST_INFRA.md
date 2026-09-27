# E2E Test Infra: AI Energy Management Platform

## Test Philosophy
- Opaque-box, requirement-driven. No dependency on internal implementation design.
- Methodology: Category-Partition + Boundary Value Analysis + Pairwise Combinations + Real-World Workload Testing.

## Feature Inventory & Test Mapping
| # | Feature | Requirement Source | Tier 1 | Tier 2 | Tier 3 |
|---|---------|-------------------|:------:|:------:|:------:|
| 1 | JWT Authentication & Route Protection | R1.1 | 5 | 5 | ✓ |
| 2 | CORS Origin Policy Validation | R1.2 | 5 | 5 | ✓ |
| 3 | Environment Secret Ingestion | R1.3 | 5 | 5 | ✓ |
| 4 | Clean Architecture Domain Purity | R2.1 | 5 | 5 | ✓ |
| 5 | TechnicalVisit Bounded Context Decoupling | R2.2 | 5 | 5 | ✓ |
| 6 | Orphaned Interface Cleanup | R2.3 | 5 | 5 | ✓ |
| 7 | Dead Code Elimination | R3.1 | 5 | 5 | ✓ |
| 8 | Purge Mock Data & Dictionaries | R3.2 | 5 | 5 | ✓ |
| 9 | Dynamic MeterTracker Calculation | R3.3 | 5 | 5 | ✓ |
| 10 | Authentic Anomaly & Baseline Actions | R3.4 | 5 | 5 | ✓ |
| 11 | AI Provider Key Transparency | R4.1 | 5 | 5 | ✓ |
| 12 | Dynamic Copilot Summaries | R4.2 | 5 | 5 | ✓ |
| 13 | Official Production Model Identifiers | R4.3 | 5 | 5 | ✓ |
| 14 | Declarative Routing & Deep-Linking | R4.4 | 5 | 5 | ✓ |
| 15 | Frontend Vitest Suite (`npm test`) | R5.1 | 5 | 5 | ✓ |
| 16 | Backend SQLite Repo & Service Tests | R5.2 | 5 | 5 | ✓ |
| 17 | Full Clean Compilation & Linter | R5.3 | 5 | 5 | ✓ |

## Test Architecture
- **Backend Test Runner**:
  - `cd backend && go test -v ./...`
  - In-memory SQLite tests for repositories (`meter`, `reading`, `anomaly`, `event`, `analysis`, `visit`).
  - Unit tests for application services (`auth`, `copilot`, `visits`, `analysis`, `meters`, `anomalies`).
  - HTTP integration tests verifying 401 on unauthenticated access and CORS origin verification.
- **Frontend Test Runner**:
  - `cd frontend && npm.cmd test` (Vitest + React Testing Library)
  - Unit tests for API client authentication header injection and error handling.
  - Component tests for `StatCard`, `RunAnalysisModal`, `MeterTracker`.
- **E2E Integration Verification**:
  - Unauthenticated requests to `/api/v1/meters`, `/api/v1/anomalies`, `/api/v1/ai/analyze`, `/api/v1/ai/ask`, `/api/v1/technical-visits` return HTTP 401.
  - Disallowed origin receives no `Access-Control-Allow-Origin`.
  - Vite production build (`tsc -b && vite build`) executes with code 0.

## Real-World Application Scenarios (Tier 4)
| # | Scenario | Features Exercised | Complexity |
|---|----------|--------------------|------------|
| 1 | Operator Login, Dashboard Load & Real Meter Inspection | F1, F3, F8, F9, F14 | High |
| 2 | Anomaly Identification, Health Tracking & Technical Visit Creation | F1, F5, F10, F14 | High |
| 3 | AI Copilot Analysis on Dynamic Meter Dataset | F1, F11, F12, F13 | High |
| 4 | Direct Deep-Linking to Meter Detail & Anomaly Resolution | F1, F10, F14 | Medium |
| 5 | Unauthorized Cross-Origin & Missing Token Rejection Flow | F1, F2, F3 | Medium |

## Coverage Thresholds
- Tier 1: >= 5 tests per feature (happy path isolation).
- Tier 2: >= 5 tests per feature (boundary, nil inputs, malformed tokens, unknown IDs).
- Tier 3: Pairwise cross-feature combinations.
- Tier 4: >= 5 real-world multi-step user workflows.
