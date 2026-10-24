# APORIA

**Dejen de discutir. Empiecen a organizarse.**

[English](README.md) · [Español](README_ES.md) · [Technical README](TECHNICAL-README.md) · [**Beta anterior en Webflow →**](https://aporia-bbb3f7.webflow.io/)

> Tirale a APORIA los mensajes, capturas y preferencias que ya tenés. APORIA encuentra los planes que realmente funcionan para el grupo.
>
> Y cuando ninguno funciona, muestra **qué tendría que cambiar**.

## Seguro que te pasó

Alguien pregunta en el grupo: “¿Cuándo nos juntamos?”.

Doce mensajes después, nadie respondió la pregunta. Una persona manda una captura de su calendario. Otra dice “cuando quieran”, pero tiene un presupuesto que nunca mencionó. Alguien más no puede viajar tan lejos. Todos quieren organizarse; la información simplemente quedó desparramada por todos lados.

Nadie está haciendo nada mal. Organizarse entre varias personas siempre fue una mezcla de mensajes incompletos, formatos incompatibles y pequeñas cosas que nadie sabe cómo poner en común.

## La sala común que faltaba

Creás una sala para **una cena con amigos**, compartís el link y cada persona aporta lo que ya sabe, sin completar un formulario interminable:

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

## Build With AI: Basics

APORIA es nuestro proyecto para [Build With AI: Basics de Devpost](https://learn-ai-basics.devpost.com/). El repo empezó el 25 de septiembre de 2026, dentro del período de entrega y con solo el scaffolding inicial. El scope, el PRD y el primer borrador técnico se hicieron con Devpost Learn Skill Pack; el desarrollo continúa con las skills personales de la dueña del proyecto.

Hoy el producto incluye búsqueda de salas por número, acceso de observador antes de participar, chat compartido, aportes de texto y capturas, confirmación de extracciones por quien las subió, información alimentaria que no afecta la evaluación, propuestas de candidatos con aceptación explícita, evaluación determinista y sugerencias acotadas sobre qué habría que cambiar. Las salas tienen cierre en modo lectura, papelera de siete días y recuperación de un resumen acotado por mail. Para habilitar la gestión del creador hay que configurar el envío de correo en Cloudflare; Google todavía no está integrado. Las rutas públicas tienen límites de ráfaga para búsquedas, creación, ingreso y acceso del creador. Cada participante y sala también tienen límites separados de cinco extracciones y cinco búsquedas de candidatos por minuto. Si alguien vuelve a ingresar, recibe una identidad de participante nueva y otro cupo. Cloudflare aplica esos límites aproximados por ubicación: se pueden superar y no equivalen a un presupuesto compartido de uso o gasto. Siguen faltando controles contra abuso distribuido. Ver [cómo funcionan los límites de Cloudflare](https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/).

APORIA limita cada respuesta de Gemini a 256 KiB antes de procesarla, y acepta como máximo 64 afirmaciones extraídas u ocho propuestas de planes. También limita la cantidad y longitud de advertencias y ambigüedades. Esto acota cómo la app procesa una respuesta, pero no limita los tokens ni el gasto total del proveedor. Ver [la revisión de la ronda 43](docs/red-team/ROUND-43-GEMINI-OUTPUT-BOUNDS.md) y el [README técnico](TECHNICAL-README.md).

El producto conserva cuatro niveles coherentes:

1. **Sala compartida** — texto, extracción confirmada, candidatos y explicaciones.
2. **Evidencia heterogénea** — capturas de pantalla con límites reales y confirmación humana.
3. **Descubrimiento de candidatos** — Gemini propone alternativas; una persona las acepta y APORIA las verifica.
4. **Relajación mínima** — cambios acotados que pueden volver posible un plan sin modificar silenciosamente las condiciones originales.

La participación estructurada, las encuestas, las grillas y el panel Verify forman parte del destino siguiente, sobre la misma arquitectura.

## Beta anterior

La beta anterior sigue alojada en **[Webflow](https://aporia-bbb3f7.webflow.io/)** y es independiente de la versión actual del repo. La página de la hackathon se va a apagar cuando termine el concurso; la demo puede seguir disponible. La nueva versión está pensada para usar un frontend en Vercel con el backend existente de Cloudflare Worker/D1; ese despliegue todavía no está configurado ni verificado. Quien clone APORIA después configura su propio despliegue y sus credenciales de proveedor, y revisa los términos de ese servicio.

## Documentos de diseño

- [Decisión de arquitectura](docs/APORIA-ARCHITECTURE-DECISION.md)
- [Revisión de arquitectura red team](docs/red-team/APORIA-RED-TEAM-ARCHITECTURE.md)
- [Plan de rondas red team y variant analysis](docs/red-team/APORIA-ROUND-PLAN.md) — hallazgos, arreglos, evidencia y verificaciones de despliegue pendientes.
- [README técnico](TECHNICAL-README.md) — stack, arquitectura, estado de implementación y límites verificables.

## Privacidad y alojamiento

En la instancia oficial, las salas y los mensajes viven en un backend compartido de APORIA. Quien tenga el link o el número de reunión puede leer una sala activa o cerrada; después de reabrirla, el link viejo muestra un archivo de solo lectura sin datos vinculados a participantes. La sala en papelera queda oculta y el resumen recuperado solo lo puede leer su creador. Ese resumen es acotado, pero **no se garantiza que sea anónimo**: conserva títulos y horarios de opciones, precios, conteos agregados y, si se indica, el número de la sala siguiente. Compartí los links solo con tu grupo. Para procesar aportes, APORIA envía a Gemini el texto o la captura y los nombres visibles de quienes participan; “Buscar ideas” también envía el objetivo de la sala y las restricciones confirmadas. Cuando Gemini responde, APORIA no conserva el texto o la imagen originales ni su hash en la propuesta. Los fragmentos extraídos quedan disponibles para quien aportó mientras cada dato espera revisión; después de confirmarlo o marcarlo como duplicado, se borran. Los datos estructurados siguen sujetos a las reglas de retención de la sala. Evitá enviar información sensible. Las condiciones de Google dependen del nivel de la API: en el nivel gratuito pueden usar prompts y respuestas para mejorar productos, incluso con revisión humana; en servicios pagos no se usan para mejorar productos, pero puede haber registros limitados por seguridad y requisitos legales. APORIA no puede verificar el nivel de la clave configurada. Leé el [mapa de datos y condiciones del proveedor](docs/PRIVACY-DATA-FLOW.md) antes de usar una instalación.

Los límites de ráfaga de IA no imponen un tope global de llamadas ni de gasto. Un conjunto suficientemente distribuido de participantes puede superar en conjunto los límites individuales; la cuota y la facturación del proyecto Gemini del operador siguen gobernando el uso del proveedor.

El creador puede cerrar la sala en modo lectura y después mandarla a papelera. Al reabrirla en modo lectura se quitan nombres, chat y aportes vinculados a participantes. Al eliminarla, se conservan durante siete días los títulos, horarios y precios de las opciones, los conteos agregados y, opcionalmente, el número de la sala siguiente. Esos datos todavía pueden identificar un evento o vincular dos salas. El creador puede recuperarla mediante un link de un solo uso; la sala recuperada sigue en modo lectura. Una tarea horaria procesa hasta 100 salas vencidas por ejecución. Cuando ya no quedan salas ni enlaces de acceso vigentes para esa cuenta, también se borra la cuenta del creador. La configuración de Gemini y correo pertenece al operador del backend.

Si hospedás un frontend aparte, el operador del backend tiene que habilitar su origen exacto. Para despliegues en Vercel puede permitir opcionalmente `https://*.vercel.app`; eso habilita el acceso desde cualquier frontend HTTPS hospedado en Vercel y no autentica a quienes llaman a la API. Si clonás APORIA, Apache 2.0 te permite desplegar tu propia app, pero tenés que configurar tu propio backend, base de datos y credenciales; el repo no te da acceso al backend compartido ni a su clave de Gemini.

## Licencia

Apache License 2.0 — ver [LICENSE](LICENSE).
