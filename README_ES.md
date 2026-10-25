[English](README.md) · [Español](README_ES.md) · [**README técnico**](TECHNICAL-README.md)

# APORIA

<p align="center">
  <img src="docs/logoaporia.png" alt="Logo de APORIA" width="400">
</p>

## Un plan que nos encuentre a todos.

APORIA es un espacio compartido para que grupos de amigos y comunidades organicen cosas de la vida real. Junta en un mismo lugar los mensajes, capturas, horarios, presupuestos y preferencias que cada persona ya tiene, y los convierte en opciones que el grupo puede revisar.

## Por qué existe APORIA

Los mejores momentos se comparten: salir después de un meetup, cenar con amigos, hacer una escapada. Coordinar para que todas las personas puedan estar puede llevar decenas de mensajes, datos desperdigados y mucho trabajo silencioso.

APORIA le da al grupo una sala común para reunir esas partes y dejar más energía para el encuentro que están organizando.

## Del chat a un plan compartido

1. **Abrí una sala.** Poné nombre al plan y compartí el link o el número de reunión.
2. **Sumá lo que sabés.** Cada persona puede aportar un mensaje, una captura, horarios, presupuesto o preferencias.
3. **Hagan visibles los detalles.** APORIA ayuda a interpretar los aportes y cada persona puede revisar y confirmar qué quiso decir.
4. **Elijan en común.** El grupo compara opciones con los datos que confirmó y ve qué cambio pequeño podría abrir otra posibilidad.

La IA ayuda a ordenar la conversación. Las personas construyen la información compartida y APORIA compara las opciones con ella.

## Un recorrido de muestra

Probá la sala ficticia en tu compu. El recorrido funciona en el navegador con datos de ejemplo.

```bash
npm install
npm run dev
```

Después abrí `http://localhost:5173/?mode=demo`.

## Hecho para Build With AI: Basics

APORIA empezó desde el scaffolding del proyecto el 25 de septiembre de 2026, durante el período de entrega de [Build With AI: Basics de Devpost](https://learn-ai-basics.devpost.com/). El alcance, los requisitos de producto y el plan técnico iniciales se crearon con el Devpost Learn Skill Pack oficial.

## Para conocer más

- [README técnico](TECHNICAL-README.md) — cómo funciona APORIA, su arquitectura y la evidencia de implementación.
- [Flujo de datos y detalles del proveedor](docs/PRIVACY-DATA-FLOW.md) — qué se envía a Gemini y cómo circulan los datos de una sala.
- [Alcance del producto](devpost/scope.md) · [Requisitos](devpost/prd.md) · [Especificación técnica](devpost/spec.md)
- [Plan de revisión red team](docs/red-team/APORIA-ROUND-PLAN.md) — revisiones de seguridad, arreglos y evidencia.

## Licencia

Apache License 2.0 — ver [LICENSE](LICENSE).
