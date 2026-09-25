# APORIA

**Del caos de información a un plan que el grupo puede acordar.**

[English](README.md) · [Español](README_ES.md) · [Technical README](TECHNICAL-README.md)

Organizarse entre varias personas es desordenado. La información ya existe, pero está repartida entre mensajes, capturas, links, calendarios, preferencias, encuestas y vetos. APORIA está diseñado para convertir esas entradas heterogéneas en planes compartidos y explicables.

## La experiencia

Creás una sala como **Cena después de Nerdearla**, compartís un link y cada persona aporta la información en el formato que ya tiene:

- escribe “sábado después de las 20, pero no muy lejos de Caballito”;
- pega una conversación de WhatsApp;
- sube una captura del calendario o de Maps;
- agrega un link de un lugar, una grilla de disponibilidad, una encuesta, una preferencia o un veto.

APORIA extrae restricciones candidatas, muestra qué cree haber encontrado y pide confirmación antes de incorporar algo al modelo compartido. La sala presenta los planes en lenguaje humano:

> **Plan A — sábado 20:30**  
> Cumple la disponibilidad, el presupuesto, el viaje y las restricciones alimentarias confirmadas.

Cuando no existe un plan perfecto, APORIA debería explicar el cambio mínimo que puede abrir uno: una hora más tarde, un radio de viaje mayor o un presupuesto diferente.

## Qué lo diferencia

APORIA no es un formulario, una encuesta de horarios ni un chatbot que inventa consenso. Es una sala compartida de decisión: las personas aportan evidencia sobre lo que saben, un motor determinístico evalúa el modelo confirmado y la IA ayuda donde interpretar o descubrir candidatos es útil.

La IA no puede decidir silenciosamente que alguien está disponible, que un lugar cumple una restricción o que un plan es válido. La extracción requiere confirmación humana y las decisiones se derivan de datos estructurados tipados.

## Construcción guiada por destino

El destino es un motor general de decisiones colectivas. Los niveles son estados coherentes del producto, no prototipos descartables:

1. **Sala de planificación compartida** — texto, extracción confirmada, solapamiento determinístico, candidatos y explicaciones.
2. **Evidencia heterogénea** — capturas, links y otros inputs usando el mismo límite de extracción.
3. **Negociación por relajación mínima** — mostrar qué cambios mínimos vuelven resoluble una sala imposible.
4. **Participación estructurada** — grillas y encuestas como inputs de primera clase.
5. **Verify** — snapshots canónicos, provenance y verificación SHA-256 del registro de decisión.

Cada nivel conserva el límite de autoridad, la confirmación, el camino determinístico y la representación auditable.

## Estado del proyecto

**Estado de diseño:** el destino y los niveles de construcción están definidos. Este repositorio todavía no contiene implementación ni evidencia de ejecución.

El objetivo es una aplicación full-stack desplegada en Webflow Cloud para el hackathon de Webflow.

## Licencia

Apache License 2.0 — ver [LICENSE](LICENSE).
