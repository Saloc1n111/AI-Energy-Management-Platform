# EnergyHub API (Go)

Backend de la plataforma SaaS de gestión energética: ingesta de CSV → SQLite → motor de detección determinista → explicación con IA (Claude) con respaldo determinista.

## Arquitectura (hexagonal / Clean Architecture)

```
cmd/api                  composition root (wiring, config, graceful shutdown)
internal/domain          reglas de negocio puras, sin dependencias externas
  meter, reading, event, anomaly, analysis   entidades, invariantes, puertos (Repository)
  detection              motor analítico: baseline, detección, correlación, calidad, clasificación
internal/app             casos de uso (orquestan dominio + puertos)
  analysis               "Run AI Analysis": pipeline de 7 pasos, asíncrono
  meters, anomalies, dashboard
internal/infrastructure  adaptadores
  sqlite                 repositorios (modernc.org/sqlite, sin CGO)
  seed                   carga idempotente de CSV
  ai                     Claude (tool_choice forzado) + determinista + decorador Fallback
  httpapi                REST (chi), DTOs, mapeo de errores
```

La dependencia apunta siempre hacia el dominio. El LLM **no clasifica**: el motor determinista decide tipo, severidad y confianza (reproducible y testeable); Claude solo redacta la explicación y la recomendación a partir de la evidencia calculada.

## Cómo razona el motor

1. **Baseline**: perfil por hora del día con los primeros 7 días (mediana + MAD, robusto a outliers).
2. **Detección**: una hora es anómala si se desvía ≥ 25 % **y** su z robusto ≥ 3,5; se agrupan en ventanas de ≥ 3 h.
3. **Correlación**: dentro de cada ventana compara corriente, FP, voltaje y la coherencia consumo / (V·I·FP).
4. **Calidad de datos**: fuera de las ventanas busca saltos de voltaje/FP, incoherencia física, huecos y duplicados.
5. **Eventos**: `OPERATIONAL_CHANGE` explica subidas y bajadas, `SCHEDULED_OUTAGE` solo bajadas, `UNKNOWN` **no explica nada**.
6. **Clasificación + confianza** con factores trazables (`confidence_factors`).
7. **Priorización**: severidad > tipo (real > calidad > explicable) > confianza; un falso positivo nunca escala.

## Ejecutar

```bash
go mod tidy                 # requiere Go >= 1.23; resuelve chi y modernc.org/sqlite
go test ./...               # unitarios + dataset real + integración HTTP
go run ./cmd/api            # http://localhost:8080
```

Con Docker (desde la raíz `energyhub/`): `cp .env.example .env` (opcional: poner la API key) y `docker compose up --build`.

## Endpoints (`/api/v1`)

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/dashboard/summary` | KPIs, estados, top 3 prioridades, último análisis |
| GET | `/meters?status=&q=&sort=meter_id\|consumption\|variation\|severity&order=asc\|desc` | Lista con métricas |
| GET | `/meters/{id}` | Detalle + baseline (24 valores horarios, voltaje, FP) |
| GET | `/meters/{id}/readings?from=YYYY-MM-DD&to=YYYY-MM-DD` | Lecturas + `expected_kwh` |
| GET | `/anomalies?meter_id=&type=&severity=&status=` | Lista **priorizada** |
| GET | `/anomalies/{id}` | Evidencia, factores de confianza, evento, pasos de investigación |
| PATCH | `/anomalies/{id}` `{"status":"ACKNOWLEDGED\|RESOLVED\|OPEN"}` | Acción del operador |
| POST | `/ai/analyze` | Lanza el análisis → `202` + `Location` (`409` si ya corre) |
| GET | `/ai/analysis/{id\|latest}` | Estado y pasos (para polling) |
| GET | `/health` | Healthcheck |
