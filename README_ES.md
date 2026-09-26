# APORIA

**Dejen de discutir. Empiecen a organizarse.**

[English](README.md) · [Español](README_ES.md) · [Technical README](TECHNICAL-README.md) · [**Probalo online →**](https://aporia-bbb3f7.webflow.io/)

> Tirale a APORIA los mensajes, capturas y preferencias que ya tenés. APORIA encuentra los planes que realmente funcionan para el grupo.
>
> Y cuando ninguno funciona, muestra **qué tendría que cambiar**.

## Seguro que te pasó

Alguien pregunta en el grupo: “¿Cuándo nos juntamos?”.

Doce mensajes después, nadie respondió la pregunta. Una persona manda una captura de su calendario. Otra dice “cuando quieran”, pero tiene un presupuesto que nunca mencionó. Alguien más no puede viajar tan lejos. Todos quieren organizarse; la información simplemente quedó desparramada por todos lados.

Nadie está haciendo nada mal. Organizarse entre varias personas siempre fue una mezcla de mensajes incompletos, formatos incompatibles y pequeñas cosas que nadie sabe cómo poner en común.

## La sala común que faltaba

Creás una sala como **Cena después de Nerdearla**, compartís el link y cada persona aporta lo que ya sabe, sin completar un formulario interminable:

- escribe “sábado después de las 20”;
- pega un mensaje de WhatsApp;
- sube una captura de pantalla;
- agrega sus preferencias o restricciones.

APORIA convierte ese material desordenado en información que el grupo puede revisar. La IA propone qué entendió; las personas lo confirman, lo editan o lo rechazan; y el motor de APORIA calcula qué planes cumplen con lo que realmente está confirmado.

> **Plan A — sábado 20:30**  
> Cumple las condiciones confirmadas.

Si no existe ningún plan posible, APORIA no responde simplemente “no hay opciones”. Puede mostrar qué cambio acotado destraba alternativas: aceptar un presupuesto un poco mayor, ampliar una ventana de disponibilidad o permitir otro intervalo.

## IA para entender. Motor determinístico para decidir.

APORIA no es una encuesta de horarios ni un chatbot que inventa consenso.

La IA sirve para interpretar mensajes, capturas y propuestas, y para sugerir candidatos. Pero nunca puede decidir silenciosamente que alguien está disponible, que un lugar cumple una restricción o que un plan es válido.

La regla es simple:

```text
La IA propone
      ↓
Las personas confirman
      ↓
APORIA verifica
      ↓
El grupo ve planes explicables
```

Por eso el resultado no es una respuesta bonita generada por un modelo. Es una evaluación reproducible contra la información que el grupo confirmó.

## No es solamente para una cena

La misma sala puede servir para decidir cuándo juntarse, dónde comer, qué alojamiento reservar, qué actividad elegir o cómo organizar un viaje.

El problema es siempre parecido: varias personas tienen información válida, pero repartida en lugares y formatos incompatibles. APORIA la convierte en un plan que el grupo puede mirar, discutir y acordar.

## Construido para durar más que un concurso

APORIA nació para el concurso de Webflow Cloud, pero no está pensado como una demo descartable. Está publicado bajo Apache 2.0 para que otras personas puedan usarlo, forkearlo y mejorarlo.

Hoy el producto implementa cuatro niveles coherentes:

1. **Sala compartida** — texto, extracción confirmada, candidatos y explicaciones.
2. **Evidencia heterogénea** — capturas de pantalla con límites reales y confirmación humana.
3. **Descubrimiento de candidatos** — Gemini propone alternativas; una persona las acepta y APORIA las verifica.
4. **Relajación mínima** — cambios acotados que pueden volver posible un plan sin modificar silenciosamente las condiciones originales.

La participación estructurada, las encuestas, las grillas y el panel Verify forman parte del destino siguiente, sobre la misma arquitectura.

## Probalo ahora

**[aporia-bbb3f7.webflow.io](https://aporia-bbb3f7.webflow.io/)** — sin cuenta y sin instalar nada. Creá una sala, tirá adentro algo de ese caos que normalmente queda en el grupo y mirá cómo se convierte en una respuesta concreta.

## Documentos de diseño

- [Decisión de arquitectura](docs/APORIA-ARCHITECTURE-DECISION.md)
- [Revisión de arquitectura red team](docs/red-team/APORIA-RED-TEAM-ARCHITECTURE.md)
- [README técnico](TECHNICAL-README.md) — stack, arquitectura, estado de implementación y límites verificables.

## Licencia

Apache License 2.0 — ver [LICENSE](LICENSE).
