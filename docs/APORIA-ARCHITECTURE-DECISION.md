# APORIA — Decisión de arquitectura

**Estado:** decisión de diseño; todavía no implementada.  
**Fecha:** 2026-09-25  
**Metodología:** `destination-driven-construction` + diseño seguro por construcción.

## 1. Decisión central

APORIA será un espacio compartido para convertir información humana desordenada en planes colectivos que puedan ser inspeccionados, comparados y discutidos.

Una persona podrá crear una sala compartible por URL y aportar texto, mensajes pegados, capturas, links, preferencias, restricciones, disponibilidad, vetos, encuestas o propuestas. La IA interpretará entradas heterogéneas y propondrá estructura; la persona confirmará, corregirá o rechazará esa interpretación; y un motor determinístico evaluará los planes a partir del estado canónico confirmado.

La constitución del sistema es:

> **La IA propone. La persona confirma. APORIA decide de forma determinística y explica con evidencia.**

Gemini será el proveedor inicial de inteligencia para el despliegue del hackathon. Es una elección de infraestructura, no una dependencia del dominio. El dominio debe poder operar con otro proveedor, con entradas estructuradas directas o con degradación sin IA.

### Stack fijado

- **Cliente:** Vite + React + TypeScript.
- **Server-side:** endpoints/funciones compatibles con el entorno de despliegue, responsables de Gemini, validación de comandos, persistencia, autoridad y evaluación.
- **Contrato entre ambos:** comandos y snapshots versionados; el bundle React nunca es fuente de verdad.

Vite sólo construye y sirve la experiencia cliente. Ninguna variable `VITE_*` puede contener secretos. TypeScript mejora el contrato del cliente, pero no reemplaza validación server-side ni autorización.

## 2. Producto destino

El producto completo no es un scheduler vertical. Es un motor de decisión colectiva donde el tipo de decisión —cena, salida, alojamiento, viaje, compra o actividad— es una configuración del mismo dominio.

El usuario final debería poder:

1. crear una sala y compartir un link sin login obligatorio;
2. aportar información en el formato que ya tiene;
3. revisar la extracción propuesta por IA con su evidencia de origen;
4. confirmar, corregir o rechazar cada hecho antes de que afecte el modelo;
5. comparar candidatos y planes con sus restricciones satisfechas, incumplidas o desconocidas;
6. entender por qué una opción funciona o no funciona;
7. ver qué cambio mínimo podría desbloquear un plan cuando no hay solución;
8. inspeccionar un snapshot canónico y su verificación sin que la criptografía domine la experiencia.

El valor de APORIA no está en producir una respuesta conversacional. Está en hacer visible el camino desde información dispersa hasta una decisión compartida.

## 3. Invariantes que todos los niveles deben heredar

Estas propiedades no son un nivel posterior de “hardening”. Cualquier nivel que las necesite debe nacer con ellas.

### 3.1 Autoridad

- La entrada humana y la salida de Gemini son datos no confiables.
- Una extracción nunca es un hecho confirmado sin una transición explícita de confirmación humana.
- Gemini nunca decide disponibilidad, satisfacción de hard constraints, score final, resolución de conflictos o relajaciones mínimas.
- El cliente nunca es la autoridad sobre el estado compartido ni sobre el resultado evaluado.
- El dominio no puede importar una afirmación de un proveedor externo sin normalizarla y conservar su origen.

### 3.2 Provenance

Cada hecho aceptado debe poder relacionarse con:

- input original;
- participante o actor que lo aportó;
- extracción propuesta, si existió;
- proveedor/modelo y versión, si existió;
- incertidumbre entregada realmente por el proveedor, sin inventar confidence;
- corrección humana;
- evento de confirmación;
- snapshot y revisión en los que entró al modelo.

### 3.3 Determinismo

Mismo estado canónico + mismos candidatos normalizados + misma configuración/versiones del evaluador = mismo resultado y mismo orden de desempate.

El camino decisorio debe usar enteros, fracciones exactas o una representación decimal explícitamente fijada. Los floats pueden existir en una capa puramente visual, pero no en un score que determine ranking, relajación o evidencia.

### 3.4 Integridad y atomicidad

- El evento de aceptación, la nueva revisión y su registro de provenance se persisten atómicamente.
- Un error de Gemini no puede crear ni modificar un constraint.
- Un retry no puede duplicar una aceptación ni una contribución.
- Un hash verifica la integridad del payload canónico que cubre; no prueba que el contenido sea verdadero.
- Un snapshot debe declarar schema, canonicalization version, evaluator version y límites de cobertura.

### 3.5 Separación de candidatos y decisión

Generar candidatos es una tarea abierta y potencialmente probabilística. Evaluarlos contra el estado confirmado es una tarea cerrada y determinística. Ningún texto del generador puede saltarse el evaluador.

### 3.6 Degradación honesta

Si Gemini está sin cuota, caído, lento o devuelve una estructura inválida:

- el estado confirmado existente sigue siendo válido;
- los inputs estructurados siguen funcionando;
- una extracción queda en `failed` o `needs_review`, nunca en `confirmed`;
- el usuario ve el error y puede corregir manualmente;
- no se reintenta indefinidamente ni se degrada silenciosamente a una decisión distinta.

## 4. Modelo de dominio

El dominio debe ser general sin ser abstracto hasta perder utilidad.

### Entidades principales

| Entidad | Propósito | Estado mínimo | Provenance requerida |
| --- | --- | --- | --- |
| `Room` | Espacio compartido de decisión | `active`, `closed`, `archived` | creador, timestamps, revisión actual |
| `Participant` | Actor humano dentro de una sala | identidad de sala, alias, presencia | método de ingreso, actor/id de sesión |
| `InputArtifact` | Texto, imagen, link, poll, grid o propuesta original | `received`, `processed`, `failed` | autor, hash/tamaño, tipo, momento |
| `ExtractionProposal` | Lectura propuesta por IA | `pending`, `confirmed`, `edited`, `rejected`, `failed` | input, proveedor/modelo, request id, respuesta |
| `Fact` | Afirmación estructurada candidata o confirmada | `proposed`, `confirmed`, `superseded`, `rejected` | cadena hasta el artifact y confirmación |
| `Constraint` | Regla que participa en evaluación | tipo, operador, valor tipado, dureza | fact(s) de origen, confirmador |
| `Preference` | Criterio blando o preferencia ordenable | peso/coste exacto, ámbito | fact(s) de origen, confirmador |
| `Candidate` | Lugar, horario, actividad o plan posible | `unverified`, `normalized`, `evaluated` | fuente, fetch, campos conocidos/desconocidos |
| `Evaluation` | Resultado determinístico sobre snapshot+candidatos | feasible/infeasible, razones, score | snapshot, evaluator config/version |
| `DecisionSnapshot` | Vista canónica verificable del estado | schema/version/hash | inputs y eventos incluidos |
| `RoomEvent` | Transición append-only del room | tipo, payload tipado, idempotency key | actor, anterior/siguiente revisión |

No se debe modelar una frase completa como una restricción opaca. Las restricciones deben tener tipos explícitos: intervalo temporal, zona/ubicación, distancia, presupuesto, capacidad, inclusión, exclusión, requisito alimentario, veto, preferencia y otras extensiones versionadas.

## 5. Capas y límites de confianza

```text
┌───────────────────────────────────────────────┐
│ Experiencia web: room, confirmación, planes    │  cliente no confiable
├───────────────────────────────────────────────┤
│ Room API / realtime: sesiones, comandos, rev.  │  valida + autoriza
├───────────────────────────────────────────────┤
│ Orquestación IA: jobs, cuotas, cache, retries │  proveedor no confiable
├───────────────────────────────────────────────┤
│ Canonical domain: facts/constraints/snapshots │  autoridad del dominio
├───────────────────────────────────────────────┤
│ Evaluator: feasibility, ranking, relaxation   │  determinístico
├───────────────────────────────────────────────┤
│ Persistencia + audit/provenance + verify      │  durable y verificable
└───────────────────────────────────────────────┘
```

### Fronteras

1. **Cliente → API:** todo input es una afirmación no confiable. Se valida tamaño, tipo, encoding, room, revisión e idempotencia.
2. **API → IA:** se envía sólo el artifact necesario, con límites de tamaño y política de privacidad explícita. El proveedor no recibe autoridad para escribir el dominio.
3. **IA → propuesta:** la respuesta se parsea contra un esquema cerrado; campos desconocidos, omisiones y ambigüedades permanecen visibles.
4. **Propuesta → canonical domain:** sólo una confirmación humana, con revisión válida, crea o cambia un `Fact` confirmado.
5. **Candidatos → evaluator:** cada fuente externa se normaliza; ausente/desconocido no equivale a verdadero.
6. **Evaluator → UI:** la UI recibe resultado, razones, versión y snapshot; nunca recalcula para corregir al backend.
7. **Persistencia → Verify:** el verificador declara exactamente qué bytes cubre el digest y qué queda fuera.

## 6. Arquitectura runtime

### Cliente Vite/React/TypeScript

El cliente mantiene estado de interacción y proyecciones: input local, propuestas pendientes, confirmaciones en curso, snapshot recibido, estado realtime y feedback de error. Puede ser modificado por el usuario y debe asumir que cualquier comando será repetido o alterado.

El cliente no contiene la API key de Gemini, no calcula la autoridad final y no persiste una aceptación como hecho sólo porque el estado local cambió. Tras una mutación, la UI espera el evento/snapshot server-side aceptado.

### Server-side

La capa server-side recibe comandos tipados, verifica room/sesión/revisión/idempotencia, ejecuta la transición autorizada, persiste evento + estado + provenance de manera atómica y publica la proyección realtime. Allí viven `GeminiProvider`, el canonical domain y el evaluator.

### Flujo de extracción

```text
InputArtifact
  → validate/bound
  → deduplicate by content identity
  → ExtractionJob
  → IntelligenceProvider.extract
  → schema parse + semantic validation
  → ExtractionProposal(pending)
  → human confirm/edit/reject
  → atomic RoomEvent + canonical state revision
```

La extracción no bloquea el room entero. Un job fallido queda asociado al artifact y puede reintentarse con una clave idempotente, sin volver a procesar silenciosamente una confirmación anterior.

### Flujo de decisión

```text
confirmed canonical snapshot
  → candidate sources / IntelligenceProvider.propose
  → normalize Candidate
  → deterministic evaluator
  → ranked Evaluation + reason trace
  → human-readable template explanation
  → realtime projection
```

`propose` puede producir candidatos; nunca produce una `Evaluation` confiable.

### Frontera determinista/no determinista

No determinístico o externo:

- interpretación de texto/imagen;
- detección de participantes cuando el input no lo declara;
- búsqueda y propuesta de lugares/actividades;
- redacción opcional de explicaciones.

Determinístico:

- confirmación como transición autorizada;
- canonicalización y hash;
- normalización de candidatos;
- satisfacción de constraints;
- scores, tie-breaks y ranking;
- diagnóstico de infeasibility;
- minimal relaxation;
- snapshot y provenance.

## 7. Contrato `IntelligenceProvider`

El contrato conceptual debe ser pequeño y orientado al dominio, no un espejo de Gemini.

```text
IntelligenceProvider
  capabilities() -> ProviderCapabilities
  extract(request: ExtractionRequest) -> ExtractionResponse
  propose(request: CandidateProposalRequest) -> CandidateProposalResponse
  interpret?(request: InterpretationRequest) -> InterpretationResponse
```

### Reglas del contrato

- Todas las operaciones reciben un `request_id`, `room_id`/scope, `input_hash`, límites y schema version.
- Cada respuesta tiene `provider`, `model`, `provider_request_id` cuando exista, `raw_reference` o artifact seguro, `structured_payload`, `warnings`, `usage` si se entrega y `failure` explícito.
- Un provider no recibe una capability para confirmar hechos ni escribir snapshots.
- `capabilities` declara multimodalidad, structured output, límites y funciones realmente disponibles; no se infieren por nombre de modelo.
- El dominio puede aceptar `ProviderUnavailable`, `InvalidStructuredOutput`, `RateLimited`, `Timeout`, `ContentRejected` y `UnknownProviderFailure` como estados distintos.
- El contrato debe tolerar que un proveedor no entregue confidence. En ese caso se conserva `confidence: unknown`, no se fabrica un número.

## 8. `GeminiProvider`

Gemini es el adapter construido inicialmente. Su responsabilidad es traducir entre el contrato interno y la API de Gemini.

### Reglas de seguridad

- La API key vive sólo en server-side secret storage/environment.
- Nunca se incluye en bundle, variables `VITE_*`, localStorage, logs, telemetry, URLs ni respuestas.
- El cliente recibe estados y resultados sanitizados, nunca headers ni errores crudos con secretos.
- Los inputs enviados se limitan por tamaño, tipo y política de privacidad.
- Se usan structured outputs/schema cuando la API lo soporte; la respuesta igual se valida localmente.
- Cache sólo cuando `input_hash + operation + model/config + schema_version` representa exactamente el mismo trabajo y la política de privacidad lo permite.
- Retries son acotados, con backoff y clasificación de errores; no reintentar errores de validación como si fueran transitorios.

### Criterio de proveedor

Las condiciones de cuota y disponibilidad del free tier son una dependencia operativa a verificar en el despliegue, no una garantía del dominio. Si la cuota desaparece, la arquitectura debe seguir pudiendo confirmar inputs estructurados y evaluar planes existentes.

## 9. Structured extraction

La salida de Gemini debe representar una propuesta, no un estado confirmado.

```text
ExtractionResponse {
  response_schema_version
  input_ref { artifact_id, content_hash }
  provider_ref { provider, model, request_id }
  participants[]
  claims[]
  ambiguities[]
  unsupported_inferences[]
  warnings[]
}

ClaimProposal {
  proposal_id
  subject_ref?                 # participante identificado o unknown
  kind                         # availability | constraint | preference | veto | proposal
  value                        # typed, bounded, never free-form only
  source_span?                 # text region / image region if available
  provider_confidence?         # omitted means unknown, not zero or certainty
  ambiguity_refs[]
  status = pending
}
```

Un `ClaimProposal` puede estar incompleto: “jueves después de las 18” necesita timezone y quizá fecha; “no muy lejos” necesita una definición humana antes de evaluar distancia. El sistema debe pedir aclaración o dejar el campo como desconocido.

La confirmación debe permitir:

- aceptar propuesta;
- editar valor, sujeto o alcance;
- rechazarla;
- dividir una propuesta ambigua;
- confirmar algunas claims y no otras.

La edición humana crea una nueva relación de provenance; no sobrescribe la extracción original.

## 10. Candidate generation y evaluación

### Generación

Fuentes posibles: Gemini, APIs de lugares/mapas/eventos, links aportados por participantes y candidatos manuales. Toda fuente devuelve datos normalizados con identidad, timestamp/fetch, campos conocidos, campos desconocidos y referencia a origen.

### Evaluación

El evaluator recibe solamente:

```text
EvaluationInput {
  canonical_snapshot
  normalized_candidates[]
  evaluator_config_version
}
```

Devuelve:

```text
Evaluation {
  snapshot_hash
  candidate_results[]
  feasible_plans[]
  violated_constraints[]
  unknown_requirements[]
  ranking_trace
  relaxation_frontier?
  evaluator_version
}
```

Una hard constraint no satisfecha no puede ser compensada por un buen score blando. Un dato desconocido no puede presentarse como satisfecho. La explicación debe derivarse del `ranking_trace` y de los campos evaluados.

### Sin solución y relajaciones

`No feasible plan` es un resultado válido con reason trace. La operación de relajación es una consulta separada sobre el snapshot original:

```text
snapshot original + relaxation policy
  → bounded relaxation candidates
  → deterministic re-evaluation
  → minimal useful changes + resulting plans
```

“Mínima” requiere una política explícita: coste por persona, tipo de constraint, límites máximos, prioridades y desempates. Gemini puede redactar el resultado; no puede inventar la frontera ni el conteo de planes.

## 11. Persistencia, rooms y colaboración

### Room

Una room tiene un identificador no adivinable, una revisión monotónica y un log de eventos tipados. El link permite entrar, pero no debe otorgar capacidades implícitas fuera del scope de esa room. La identidad sin cuenta necesita una sesión efímera y un modelo explícito de permisos de sala.

### Eventos y revisión

Las mutaciones se expresan como comandos/eventos con:

- `event_id` e idempotency key;
- actor/sesión y room;
- `expected_revision`;
- payload tipado y schema version;
- timestamp del servidor;
- provenance references;
- revisión anterior y siguiente.

Una escritura concurrente con revisión vieja se rechaza o se devuelve para resolución explícita. No usar last-write-wins silencioso para confirmaciones o cambios de constraints.

### Realtime

Realtime es una proyección de eventos aceptados, no el canal de autoridad. Un cliente puede desconectarse, recibir eventos duplicados o quedar stale. Al reconectar debe pedir snapshot/revisión canónica y reconciliar la UI.

### Persistencia inicial

La elección concreta —Supabase/Postgres u otra base disponible en Webflow Cloud— debe preservar transacciones, revisión, idempotencia y acceso server-side. Un JSON compartido o estado sólo en memoria no alcanza para un nivel que prometa colaboración durable y provenance.

## 12. Niveles de construcción

### L1 — Sala de planificación confirmable

Producto completo por sí mismo: room compartible, input de texto, propuesta de extracción, confirmación/edición/rechazo, modelo tipado, overlap determinístico, candidatos explícitos y planes explicados desde razones.

**Adversarial gate:** no puede existir un hecho confirmado sin actor, artifact, evento y revisión; Gemini caído no corrompe el room; el mismo snapshot produce el mismo ranking; dos confirmaciones concurrentes no se pierden.

### L2 — Evidencia heterogénea

Se agregan screenshots y links como artifacts usando exactamente el mismo boundary de extracción-confirmación. Sigue siendo un producto de planificación real, no una galería de inputs.

**Adversarial gate:** una imagen ambigua produce pending/needs review; una URL maliciosa o enorme no compromete el worker; el input original queda preservado y la extracción no lo reemplaza.

### L3 — Candidatos externos y decisión explicable

Gemini/APIs proponen lugares, actividades u horarios; APORIA normaliza y evalúa con constraints confirmadas. El usuario puede distinguir “propuesto”, “verificado por fuente” y “cumple según evaluator”.

**Adversarial gate:** ningún candidato puede autoatribuirse cumplimiento; datos faltantes quedan unknown; un cambio de orden no altera ranking; errores de provider no inventan alternativas.

### L4 — Negociación por relajación mínima

Si no hay solución, el sistema calcula alternativas de relajación acotadas y muestra qué concede cada participante, qué planes aparecen y qué restricciones permanecen duras.

**Adversarial gate:** la relajación no muta el snapshot factual; la política es versionada; “mínima” es reproducible; no se oculta una restricción por conveniencia narrativa.

### L5 — Participación y Verify

Grids/polls se compilan al mismo modelo; el usuario puede abrir Verify para inspeccionar snapshot, provenance, versions y digest. Es un instrumento portátil de decisión colectiva, no un vertical de restaurantes.

**Adversarial gate:** el digest cubre exactamente lo declarado; verificar no requiere confiar en la UI; eventos fuera de la cadena son detectables; el room puede recuperarse sin mezclar revisiones.

## 13. Riesgos específicos de Webflow Cloud

Estos son riesgos de arquitectura a verificar en la documentación y en un entorno real; no son hechos confirmados sobre la plataforma en este repositorio.

- límites de runtime, memoria, duración y tamaño para recibir screenshots y llamar a Gemini;
- disponibilidad de variables secretas exclusivamente server-side;
- diferencias entre rutas server-side, funciones y bundle cliente;
- compatibilidad real de WebSocket/SSE/realtime y comportamiento detrás de CDN;
- almacenamiento durable y transacciones disponibles para rooms/eventos;
- límites de despliegue, cold starts y concurrencia;
- configuración CORS/CSRF, upload y URLs públicas;
- observabilidad sin registrar screenshots, API keys o contenido sensible;
- proceso de build que pudiera incrustar accidentalmente variables privadas;
- límites de egreso, timeouts y retries contra Gemini y APIs externas.

Cada riesgo requiere una prueba de plataforma antes de prometerlo como capacidad.

## 14. Alcance razonable para hoy

El máximo defendible depende de alcanzar un nivel completo, no de tocar todas las features. La recomendación es llegar a **L1 completo** y avanzar a **L2 sólo si screenshots pueden atravesar el mismo contrato con límites, provenance y confirmación real**.

L1 ya debe incluir Gemini server-side, pero no depende de que Gemini esté siempre disponible: debe aceptar texto estructurado/manual cuando el provider falle. No se debe construir una fachada con botones para L3–L5. Si el tiempo termina, una sala de texto confirmable y determinística debe seguir siendo APORIA, con el mismo boundary que sostendrá screenshots, candidatos externos y relajaciones futuras.

## 15. Preguntas abiertas que sí cambian la arquitectura

1. ¿Qué capacidades server-side y persistencia transaccional ofrece exactamente el entorno de Webflow Cloud elegido?
2. ¿Cuál es la política de identidad mínima para rooms sin login y cómo se evita que un link sea autoridad total?
3. ¿Qué tipos de constraint entran en L1 sin convertir el modelo en un lenguaje abstracto inmantenible?
4. ¿Qué evidencia de fuente podemos conservar para screenshots y URLs sin almacenar datos innecesarios?
5. ¿Qué configuración exacta de Gemini y structured output está disponible en el despliegue y cómo se testea su schema drift?
6. ¿Cuál es la política de coste para minimal relaxation y cómo se comunica sin llamar “mínima” a una preferencia arbitraria?
7. ¿Qué mecanismo de realtime es durable y cómo se recupera desde snapshot ante eventos perdidos o duplicados?
8. ¿Qué datos pueden enviarse a Gemini bajo el modelo de privacidad del producto?
