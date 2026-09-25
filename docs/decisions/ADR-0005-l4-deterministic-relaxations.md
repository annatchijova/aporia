# ADR-0005 — L4: relajaciones mínimas determinísticas

**Fecha:** 2026-09-25  
**Estado:** propuesta implementada para revisión

## Decisión

L4 expone un cálculo what-if sobre el snapshot actual. `POST /api/rooms/:id/relaxations` exige sesión y `expectedRevision`, pero no muta la room ni crea eventos.

La política `l4.0.0` considera sólo las constraints tipadas que hoy tienen una relajación concreta:

- `budget_max`: subir el máximo hasta el precio conocido del candidato, en la misma moneda;
- `availability`: ampliar el intervalo para contener el candidato o cambiar el día al intervalo del candidato.

Se generan opciones sólo cuando el candidato es actualmente infeasible y retirar una única constraint lo vuelve factible. Valores desconocidos no se relajan silenciosamente. El resultado se limita a ocho opciones y ordena determinísticamente por coste entero, candidate ID y fact ID.

La política usa un coste local a cada tipo: centavos para presupuesto y minutos para disponibilidad. Esas unidades no se presentan como una magnitud universal; el orden entre tipos sigue la prioridad versionada presupuesto antes que disponibilidad y debe cambiarse mediante una nueva versión de policy, no mediante un ajuste incidental.

## Invariantes

- El snapshot factual no cambia.
- El evaluator sigue siendo la autoridad sobre factibilidad.
- `unknown` no se convierte en satisfecho.
- Una opción referencia la constraint y candidate que la originaron.
- Mismo snapshot + misma policy producen el mismo conjunto y orden.
- Una revisión stale recibe conflicto explícito.

## Límites

No se implementan todavía relajaciones de área, múltiples concesiones simultáneas, viajes, preferencias complejas ni optimización global. Presentar una opción de una sola constraint como “el cambio mínimo absoluto” fuera de esta política sería una afirmación incorrecta.

## Falsificadores

Revisar la policy si usuarios necesitan comparar presupuesto y tiempo en una escala común, si la eliminación de una constraint deja de ser una concesión comprensible, o si una solución requiere necesariamente dos cambios coordinados.
