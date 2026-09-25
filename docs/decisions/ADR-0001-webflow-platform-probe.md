# ADR-0001 — Usar el camino Vite + Worker de Webflow Cloud

**Fecha:** 2026-09-25
**Estado:** aceptada con límites documentados
**Reversibilidad:** one-way-ish; cambiar de runtime después de crear bindings, endpoints y despliegue requiere migración coordinada.

## Fuerzas en el momento

- Deadline del Nerdearla 2026 Webflow App Showcase: 2026-09-25 23:59 ART.
- Stack fijado por producto: Vite, React 19, TypeScript.
- Gemini debe permanecer server-side.
- L1 necesita persistencia, revisión monotónica, idempotencia y un evaluator determinístico.
- L2 puede necesitar screenshots y Object Storage.
- Webflow Cloud es el destino de deployment; no se dispone todavía de un environment real de APORIA ni de credenciales de despliegue en este workspace.

## Evidencia consultada

La documentación oficial consultada el 2026-09-25 indica:

- Webflow Cloud despliega apps Vite, incluyendo React; Vite 6.1+ es requerido.
- Un Vite SPA puede añadir `src/worker.ts` para server-side routes y fallback a assets.
- `VITE_*` se incrusta en el bundle; secrets deben leerse desde `env` del Worker.
- Hay bindings para SQLite/D1, KV y Object Storage.
- Límites publicados: 100 MB request body, 20 s request timeout, 30 s CPU, 128 MB memory, 10 MB Worker bundle, 6 outgoing requests simultáneas.
- GitHub push puede disparar deployment del branch conectado.
- Hay streaming HTTP documentado; no se encontró documentación oficial suficiente para afirmar WebSocket/SSE persistente como realtime durable de rooms.

Fuentes:

- <https://developers.webflow.com/webflow-cloud/environment/framework-customization>
- <https://developers.webflow.com/webflow-cloud/storing-data/overview>
- <https://developers.webflow.com/webflow-cloud/limits>
- <https://developers.webflow.com/webflow-cloud/deployments>
- <https://developers.webflow.com/home/changelog/2026/3/2>

## Decisión

Construir APORIA como una app Vite + React 19 + TypeScript desplegable por el camino Vite de Webflow Cloud, con `src/worker.ts` como frontera server-side para endpoints, secrets, comandos de room, Gemini, persistencia y evaluator. El core de dominio será TypeScript puro y no importará React, Webflow ni Gemini.

La persistencia estructurada objetivo es SQLite/D1. KV queda limitado a cache/sesiones tolerantes a consistencia eventual. Object Storage queda reservado para artifacts binarios cuando L2 se implemente. El realtime no será una premisa de L1: usaremos comandos HTTP, snapshots versionados y un mecanismo de actualización que sólo se promoverá a realtime si se prueba en el environment real.

## Alternativas rechazadas

- **Next.js:** rechazado para este producto porque el stack fijado es Vite + React y Webflow documenta Vite con Worker routes suficiente para el boundary requerido. Mejor argumento: tiene un camino full-stack más conocido.
- **Astro:** rechazado porque el producto es una aplicación React interactiva y la decisión explícita fija React 19. Mejor argumento: Webflow ofrece guías server-side maduras para Astro.
- **Backend externo separado:** rechazado para L1 porque introduce otro deployment, secret boundary y coordinación durante el deadline. Mejor argumento: puede ofrecer primitives realtime o persistencia más familiares.
- **KV como autoridad de rooms:** rechazado porque la documentación lo describe como eventual y orientado a key/value, no como storage transaccional de constraints/eventos. Mejor argumento: menor fricción inicial.
- **Estado sólo en memoria o JSON:** rechazado porque no preserva rooms durables, revisión/idempotencia ni provenance ante reinicio. Mejor argumento: implementación local más rápida.
- **WebSocket/SSE asumido sin prueba:** rechazado como premisa. Mejor argumento: UX realtime más fluida; falta evidencia oficial/empírica para este environment.

## Supuestos que sostienen la decisión

1. Webflow Cloud permitirá desplegar este Vite app con `src/worker.ts` y sus endpoints.
2. El environment elegido permitirá provisionar un binding SQLite/D1 y ejecutar migraciones.
3. Los endpoints server-side podrán acceder a secrets sin exponerlos durante el build o al cliente.
4. L1 puede entregar valor con snapshots/polling o streaming HTTP si realtime persistente no está disponible.
5. La latencia y timeout del Worker permiten una llamada Gemini acotada; si no, extraction se convierte en job diferido y no en una mutación bloqueante.

Si alguno falla en la prueba real, no se reemplaza por mock: se reabre este ADR y se adapta el nivel conservando autoridad, provenance, determinismo e idempotencia.

## Consecuencias

Aceptadas ahora:

- Dependencia del Workers runtime y sus APIs Web estándar.
- Necesidad de mantener el bundle Worker bajo límites estrictos.
- Requests Gemini y uploads deben ser acotados y no bloquear más allá del timeout.
- La experiencia inicial puede no tener presencia realtime continua.

Postergadas, no eliminadas:

- WebSocket/SSE durable, si un probe real lo valida.
- Optimización avanzada de candidate discovery.
- Object Storage y screenshots como parte de L2.

## Falsificadores y revisit triggers

Reabrir este ADR si:

- un Vite app con Worker route no puede desplegarse o servir endpoints en el environment;
- los bindings SQLite/D1 no ofrecen la semántica necesaria para la transición atómica L1;
- el runtime no puede mantener la API key server-side sin exposición;
- los límites impiden extraction acotada incluso con payloads bajo el límite publicado;
- la única forma de colaboración aceptable exige un canal que Webflow no soporta;
- Webflow cambia el camino Vite, el runtime, los límites o el modelo de secrets.

## Estado del probe

**Confirmado por documentación:** soporte Vite/React, Worker route, secrets server-side, storage options, límites publicados y GitHub deployments.
**No confirmado por ejecución real:** deployment de APORIA, bindings activos, transacciones reales, Gemini en producción, realtime durable y smoke test público.
