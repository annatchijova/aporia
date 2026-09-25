# ADR-0002 — Fijar `gemini-flash-latest` y cerrar el boundary de errores

**Fecha:** 2026-09-25
**Estado:** aceptada
**Reversibilidad:** one-way-ish; el modelo puede cambiarse por configuración, pero el contrato de errores y sus tests son parte del runtime.

## Evidencia

La integración anterior usaba `gemini-2.5-flash` como default. Una llamada directa contra la API con la key de producción devolvió HTTP 404 por modelo no disponible para esa key. El modelo `gemini-flash-latest` devolvió HTTP 200 en la misma verificación externa.

La key no se registra en este documento ni en el repositorio.

## Decisión

- El default de `GeminiProvider` es `gemini-flash-latest`.
- La API key se envía sólo en el header `x-goog-api-key`; nunca en query string.
- Respuestas no-2xx se consumen y clasifican dentro del adapter; el body del proveedor no se reenvía al cliente.
- 404 de modelo se expone como `unavailable` no retryable.
- 503/502/504 se expone como `unavailable` retryable con respuesta JSON 503 en la ruta de extracción.
- 429 se expone como `rate_limited` y respuesta JSON 429.
- Respuesta 2xx no-JSON o JSON inválido se expone como `invalid_output` y respuesta JSON 502.
- Falta de `GEMINI_API_KEY` falla antes de hacer network access y produce respuesta estructurada, sin simulación.
- El cliente no intenta parsear HTML como JSON y muestra un error genérico de extracción.

## No cambia

Esta decisión no modifica D1, el binding `DB`, el evaluator determinístico, la canonicalización ni la confirmación humana. Gemini sigue generando únicamente una propuesta no confiable.

## Falsificador

Reabrir si el endpoint/documentación vigente deja de aceptar `x-goog-api-key`, si el alias `gemini-flash-latest` devuelve 404 con una key válida, o si la API introduce un contrato de error que requiere distinguir nuevos estados para preservar retry/degradación honesta.

## Evidencia local

`src/intelligence/gemini.test.ts` cubre 404, 503, body no-JSON, key ausente, header sin query secret y preservación de `ProviderError`.
