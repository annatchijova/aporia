# APORIA

**Del caos de información a un plan que el grupo puede acordar.**

[English](README.md) · [Español](README_ES.md) · [Technical README](TECHNICAL-README.md) · [**Probalo online →**](https://aporia-bbb3f7.webflow.io/)

> Volcá mensajes, capturas y preferencias. APORIA encuentra los planes que funcionan para el grupo.
>
> Y cuando ninguno funciona, muestra **qué tendría que cambiar**.

## Seguro que te pasó

Creás una sala como **Cena después de Nerdearla**, compartís el link y cada persona aporta lo que ya sabe, en el formato que le resulte más natural. Una persona escribe su disponibilidad. Otra pega un mensaje. Otra sube una captura de pantalla. APORIA convierte ese material desordenado en información que el grupo puede revisar.

Antes de que una extracción de IA entre al modelo compartido, las personas la confirman, editan o rechazan. Después, el motor verifica los candidatos contra la información confirmada y explica por qué un plan funciona o qué lo impide.

> **Plan A — sábado 20:30**  
> Cumple las condiciones confirmadas.

Si no hay ningún plan posible, APORIA puede calcular cambios acotados sobre las restricciones que destraban alternativas:

- aceptar un presupuesto un poco mayor;
- ampliar una ventana de disponibilidad;
- permitir un intervalo distinto, cuando la política de relajación lo contempla.

El resultado sigue siendo una propuesta de cambio: APORIA no modifica silenciosamente las condiciones originales.

## Qué lo diferencia

APORIA no es un formulario, una encuesta de horarios ni un chatbot que inventa consenso. Es una sala compartida de decisión: las personas aportan evidencia, la IA ayuda a interpretarla o a proponer candidatos y un motor determinístico evalúa el modelo confirmado.

La IA no puede decidir silenciosamente que alguien está disponible, que un lugar cumple una restricción o que un plan es válido. La extracción requiere confirmación humana; los candidatos propuestos por Gemini también requieren aceptación explícita; y las decisiones se derivan de datos estructurados tipados.

## Construcción guiada por destino

El destino es un espacio general para decisiones colectivas. Los niveles son estados coherentes del producto, no prototipos descartables:

1. **Sala de planificación compartida** — texto, extracción confirmada, candidatos y explicaciones.
2. **Evidencia heterogénea** — capturas con el mismo límite de extracción y confirmación humana.
3. **Descubrimiento de candidatos** — Gemini puede proponer alternativas; la persona las acepta y el evaluador las verifica.
4. **Relajación mínima** — mostrar qué cambios acotados vuelven resoluble una sala imposible.
5. **Participación estructurada** — grillas y encuestas como inputs de primera clase.
6. **Verify** — snapshots canónicos, provenance y verificación SHA-256 del registro de decisión.

Hoy el producto implementa los niveles 1 a 4. Los niveles 5 y 6 siguen siendo parte de la arquitectura destino. Cada nivel conserva el límite de autoridad, la confirmación, el camino determinístico y la representación auditable.

## Estado del proyecto

**Estado:** L1 a L4 están implementados y desplegados. La verificación local incluye typecheck, 22 tests, build de producción y migraciones D1 locales. El flujo desplegado fue probado con una sala real y Gemini; los errores transitorios del proveedor se muestran como reintentables y no corrompen el estado.

El resultado es una aplicación full-stack desplegada en Webflow Cloud para el hackathon de Webflow. La extracción perfecta no está garantizada: la IA propone y las personas confirman.

## Licencia

Apache License 2.0 — ver [LICENSE](LICENSE).
