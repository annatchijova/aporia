# APORIA — Arquitectura vigente

**Estado:** fuente de verdad para la implementación.
**Fecha:** 2026-09-25
**Alcance:** L1 primero; los límites de L2–L4 están definidos aquí aunque sólo se implementan cuando el nivel anterior es coherente.

## Constitución

```text
AI PROPOSES
    ↓
HUMAN CONFIRMS / EDITS / REJECTS
    ↓
CANONICAL STATE
    ↓
APORIA DETERMINISTICALLY EVALUATES
    ↓
EXPLAINABLE PLANS + PROVENANCE
```

Gemini es un proveedor de inteligencia no confiable. Nunca es la autoridad epistemológica ni escribe directamente un `Fact`, `Constraint`, `Evaluation` o `DecisionSnapshot` confirmado.

## Producto destino

APORIA es una sala compartida por URL donde varias personas vuelcan información desordenada —texto, mensajes, screenshots, links, disponibilidad, preferencias, restricciones, vetos y propuestas— y la convierten en planes colectivos comparables.

El dominio no es un scheduler. Las cenas, salidas, alojamientos, viajes, compras y actividades son casos de uso del mismo modelo de participantes, artifacts, facts, constraints, preferences, candidates, evaluations y decisions.

## Stack y runtime

- **Cliente:** Vite + React 19 + TypeScript.
- **Runtime server-side:** Webflow Cloud sobre Cloudflare Workers, usando el camino Vite con `src/worker.ts` para endpoints y fallback de assets.
- **Core:** TypeScript puro, sin importar React, Vite, Webflow ni Gemini.
- **IntelligenceProvider:** contrato propio; `GeminiProvider` es el adapter inicial.
- **Persistencia estructurada:** SQLite/D1 mediante binding, sujeto a prueba de transacciones y despliegue.
- **Artifacts binarios:** Object Storage/R2 cuando se alcance L2; no guardar screenshots grandes en rows.
- **KV:** sólo cache/sesiones o datos que toleren consistencia eventual; no es la autoridad de rooms.
- **Realtime:** no se asume WebSocket/SSE persistente. La primera implementación usa comandos HTTP, snapshots versionados y polling o streaming HTTP sólo si la prueba de plataforma lo valida.

Webflow Cloud detecta Vite y requiere Vite 6.1 o posterior. La plataforma sobrescribe el `base` de Vite según el mount path; el código debe usar `import.meta.env.BASE_URL` para URLs propias y no fijar `base` manualmente.

## Hechos de plataforma y límites relevantes

Estos hechos provienen de la documentación oficial consultada el 2026-09-25:

- Vite, incluido React, es un camino de despliegue soportado.
- Un Vite SPA puede añadir `src/worker.ts` para endpoints server-side.
- Variables `VITE_*` se incrustan en el bundle; la key de Gemini sólo puede leerse desde `env` del Worker.
- Webflow Cloud soporta SQLite/D1, KV y Object Storage mediante bindings declarados en `wrangler.json`.
- Límites publicados: request body 100 MB, timeout de request 20 s, CPU de Worker 30 s, memoria 128 MB, bundle de Worker 10 MB, 6 requests salientes simultáneas.
- GitHub puede disparar deployments automáticos por branch; el repositorio debe conectarse a un environment.
- Webflow documenta streaming HTTP de respuestas, pero este documento no trata ese mecanismo como un canal de presencia/realtime durable.

Fuentes: [Vite y Workers](https://developers.webflow.com/webflow-cloud/environment/framework-customization), [storage](https://developers.webflow.com/webflow-cloud/storing-data/overview), [límites](https://developers.webflow.com/webflow-cloud/limits), [deployments](https://developers.webflow.com/webflow-cloud/deployments), [streaming HTTP](https://developers.webflow.com/home/changelog/2026/3/2).

Lo que no se verificó en un environment real: deployment de este repositorio, bindings provisionados, semántica transaccional concreta de la instancia, consumo real de Gemini, soporte WebSocket/SSE persistente y comportamiento de upload bajo carga.

## Capas

```text
src/client/       React: interacción y proyección, no autoridad
src/worker.ts     HTTP server-side: límites, sesión, comando, revisión
src/core/         dominio puro: tipos, transiciones, evaluator
src/intelligence/ provider boundary + Gemini adapter
src/persistence/  repositorios y transacciones detrás de interfaces
src/verify/       canonicalización, hash y snapshot inspection
```

La dirección de dependencias es hacia el core. `core` no importa capas externas.

## Modelo de autoridad

```text
InputArtifact
  → ExtractionProposal (untrusted)
  → confirm/edit/reject humano
  → Fact confirmado
  → Constraint / Preference
  → Canonical Snapshot
  → Candidate normalizado
  → Evaluator determinístico
  → Evaluation + reason trace
```

No existen caminos `Gemini → confirmed constraint` ni `client state → authoritative shared state`.

## Entidades mínimas

- `Room`: scope compartido, revisión monotónica y capabilities.
- `Participant`: actor de sala; sin login obligatorio, pero con sesión/capability explícita.
- `InputArtifact`: original preservado, acotado y atribuible.
- `ExtractionProposal`: claims propuestos, ambiguities, warnings y referencia al input/provider.
- `Fact`: afirmación con estado y provenance; la edición no sobrescribe la propuesta original.
- `Constraint`: regla tipada, versionable, con hard/soft semantics explícitas.
- `Preference`: criterio blando con peso/coste exacto.
- `Candidate`: opción externa/manual normalizada con campos known/unknown y source.
- `Evaluation`: resultado del evaluator sobre snapshot + candidates + config.
- `DecisionSnapshot`: estado canónico versionado y hasheable.
- `RoomEvent`: comando aceptado como evento append-only e idempotente.

No se modelan constraints como strings opacos ni se construye un DSL universal antes de necesitarlo.

## Determinismo

```text
same canonical snapshot
+ same normalized candidates
+ same evaluator config/version
= same evaluation + same tie-breaking
```

Hard constraint incumplida produce `infeasible`. Unknown permanece `unknown`; nunca se convierte en `satisfied` por default. Scoring, ranking, tie-breaks y minimal relaxation deben usar enteros, rationales o fixed representation exacta, no IEEE floats cuando el resultado sea evidencia o cambie una decisión.

## Persistencia y colaboración

Las mutaciones tienen `event_id`, idempotency key, actor/session, room, `expected_revision`, schema version, payload tipado, timestamp server-side y provenance references. Una revisión vieja se rechaza o se devuelve como conflicto explícito; no hay last-write-wins silencioso para confirmaciones o constraints.

El evento, el cambio canónico y el registro de provenance se persisten atómicamente. El cliente recibe snapshots/eventos aceptados y puede quedar stale; al reconectar debe rehidratar desde la revisión canónica.

## Gemini y secrets

```text
IntelligenceProvider
  capabilities()
  extract(request)
  propose(request)
```

`GeminiProvider` traduce ese contrato a la API actual y valida la respuesta de nuevo contra el schema local. La respuesta es untrusted data. API key exclusivamente en secret environment del Worker: nunca `VITE_*`, bundle, localStorage, URL, logs o response.

Calls son intencionales, acotadas, con timeout, retries limitados, clasificación explícita de errores y cache sólo cuando el input/config/schema/model hash sea idéntico y la política de privacidad lo permita. Un fallo de Gemini no modifica el estado confirmado.

## Niveles

### L1 — Sala de planificación confirmable

Room compartible, participantes, texto, Gemini extraction, confirm/edit/reject, constraints básicas tipadas, candidatos explícitos, evaluator determinístico, reason trace, explicaciones derivadas y persistencia con revisión/idempotencia.

### L2 — Evidencia heterogénea

Screenshots y links como artifacts, mismo boundary de extracción, provenance, límites de upload y failure handling.

### L3 — Candidate discovery

Gemini/APIs proponen candidatos; APORIA normaliza y el evaluator verifica. Los claims del generador nunca son prueba de cumplimiento.

### L4 — Negotiation / minimal relaxation

Consulta separada sobre el snapshot original, con policy versionada y cálculo determinístico de concesiones acotadas. No muta el estado factual.

### L5 — Participation + Verify

Polls/grids compilados al mismo modelo y panel técnico para snapshot, provenance, versiones y digest con cobertura explícita.

## Orden de construcción de hoy

Después de cada nivel: revisión adversarial del nivel y de los invariantes heredados. Al detenernos: integrated adversarial review, verificación integrada, production build y smoke test de deployment si existen credenciales y environment.

El horizonte no autoriza mocks cosméticos. El nivel alcanzado debe funcionar con inputs reales y errores reales; el siguiente nivel se omite si no puede completarse con la misma integridad.

## Documentos relacionados

- [Decisión de arquitectura anterior](APORIA-ARCHITECTURE-DECISION.md)
- [Red-team arquitectónico](red-team/APORIA-RED-TEAM-ARCHITECTURE.md)
- [ADR-0001 — Platform probe](decisions/ADR-0001-webflow-platform-probe.md)
