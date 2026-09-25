# ADR-0004 — L3: descubrimiento de candidatos separado de evaluación

**Fecha:** 2026-09-25  
**Estado:** aceptada para L3

## Decisión

`GeminiProvider.propose()` devuelve como máximo ocho `CandidateDraft` tipados. El boundary valida estructura, rangos, intervalos, textos y valores monetarios antes de aceptar los drafts.

El comando explícito `POST /api/rooms/:id/candidate-discovery` usa el snapshot confirmado como contexto y crea un `CandidateProposal` pendiente con idempotency key. El usuario debe aceptar explícitamente esa propuesta mediante `/accept`; recién entonces el Worker asigna IDs, marca provenance `source.kind = gemini`, registra un evento `candidate.accepted` append-only y ejecuta el evaluator mediante el reducer. Gemini no recibe autoridad para afirmar que una opción cumple.

## Invariantes

- Un draft de Gemini nunca es un Fact, Constraint, Preference ni Candidate canónico antes de la aceptación humana.
- Sólo el Worker crea el provenance `gemini`; el cliente no puede etiquetar manualmente un candidato como generado por Gemini.
- El evaluator decide factibilidad, unknowns, violaciones, scoring y ranking.
- Mismos snapshot, candidatos y versión producen la misma evaluación.
- El descubrimiento exige sesión, `expectedRevision` e idempotency key; la aceptación exige además la revisión base de la propuesta. La mutación es una transacción de snapshot + evento + cambio de estado de propuesta.
- Candidato inválido, respuesta malformada o provider error no muta la room.

## Alternativas rechazadas

- **Mostrar candidatos sin persistirlos:** no ejercita L3 realmente y no deja evidencia evaluable.
- **Confiar en el texto “cumple todo” del modelo:** confunde generación con verificación.
- **Permitir que el cliente envíe `source.kind = gemini`:** falsifica provenance.
- **Crear Facts desde candidatos:** mezcla planes posibles con conocimiento confirmado.

## Riesgo aceptado

La propuesta puede contener lugares inexistentes, precios desactualizados o datos incompletos. Se muestra como sugerencia y el evaluator expresa `unknown` cuando no puede verificar un hard constraint. Verificación de lugares mediante APIs externas es un nivel posterior.

## Falsificadores

Reabrir esta decisión si la latencia o cuota de Gemini impide una interacción usable, si la transacción de descubrimiento no puede conservar revisión/evento de forma atómica, o si el modelo de candidatos requiere una fuente externa verificable antes de ser útil.
