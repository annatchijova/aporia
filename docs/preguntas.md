# Preguntas para completar el flujo de Build With AI: Basics

Este archivo reúne las preguntas que el flujo oficial puede necesitar. Está escrito ahora como guía de entrevista; **no es un registro de respuestas ni un plan aprobado**. Completá lo que quieras directamente debajo de cada pregunta. Algunas preguntas corresponden a etapas posteriores: las vamos a retomar cuando lleguemos a esa skill y con el contexto de los documentos aprobados.

Las respuestas se van a usar para redactar `devpost/learner-profile.md` (antes de crearlo, se agregará a `.gitignore` como pide la skill), `devpost/scope.md`, `devpost/prd.md` y `devpost/spec.md`. Los documentos públicos van a distinguir el estado actual del repo, lo que se haya verificado durante este proceso y lo que siga pendiente. No se van a atribuir decisiones de ahora a septiembre.

## 1. Inicio — `1-start`

### Experiencia y forma de trabajo

1. ¿Qué experiencia tenés programando y usando agentes que trabajan sobre un repo? Si te sirve, contá qué tareas ya les delegaste.

   **Varios meses siempre con asistencia de LLM, comencé con repositorios orientados a DFIR y memoria, son como compañeros de trabajo, para hacer más rápido, creé 92 skills para no repetir mil veces las instrucciones**

2. ¿Ya trabajaste con un flujo de planificar antes de programar? Por ejemplo, definir el alcance, escribir requisitos o armar una especificación técnica.

   **Sí, siempre. Vengo de gastronomía y así se trabaja en cocina, así que lo traslado al código**

3. ¿Qué te gustaría entender o mejorar mientras trabajamos en APORIA con estas skills?

   **Si al menos una de ellas la puedo adaptar al conjunto de las mías, muchas veces puedo notar algo interesante en una skill sin tomarla literalmente**

4. ¿Preferís explicaciones breves o más guiadas? ¿Te resulta mejor responder de a una pregunta o recibir grupos chicos de preguntas relacionadas?

   **Depende de la tarea, tengo tdah, si me agobio una tarea tiene que hacerse en muchas pequeñas tareas, depende de mis funciones ejecutivas, escribí una skill llamada terminal first que es justo para esto**

### Idea inicial — ya compartiste esto; corregilo o completalo si hace falta

APORIA busca ayudar a grupos de amistades a organizar planes cuando coordinar horarios, preferencias y opciones se vuelve difícil. Querés que sea útil y copado para personas de aproximadamente 25 a 40 años. También te interesa que se entienda cómo se entra a una sala, cómo se conservan y comparten las capturas o fotos, y qué implica el modelo de privacidad y alojamiento.

5. ¿Qué cambiarías o agregarías a este resumen de la idea y de lo que te importa del proyecto?

   **que luego pueda existir un mini "chat" en tiempo real, casi como una red social efímera"**

## 2. Alcance — `2-scope`

Estas preguntas ayudan a definir el experimento pequeño que queremos mostrar. No implican que esas funciones ya estén implementadas.

1. ¿En qué situación concreta usarías APORIA, y quiénes estarían en el grupo?

   **Aporia lo usaría con gente que NO es mi amiga sino que conozco en eventos y somos muchos y tenemos que coordinar qué hacer post charla etc**

2. ¿Cuál sería el recorrido mínimo que demuestra que APORIA resuelve esa situación, desde que alguien llega hasta que el grupo obtiene un resultado útil?

   **El recorrido mínimo es de alguien que entra a la sala a OBSERVAR sin necesariamente interactuar al inicio**

3. ¿Qué hace que APORIA tenga una identidad propia? ¿Qué extrañaría el grupo si usara un chat común en su lugar?

   **La automatización de una IA integrada --Gemini en este caso**

4. Para esta demo, ¿qué resultado visible te haría decir “esto ya funciona”? ¿Qué dejarías explícitamente para más adelante?

   **Que funcione end to end**

5. ¿Qué estilo o sensación querés que tenga la experiencia para ese público? Podés describirlo con referencias, colores, tono o ejemplos, sin necesidad de diseñar una interfaz.

   **Que trasmita un estilo jovial, adaptado a neurodivergencia, sin complejidad y sin que agobie a quien lo use, minimalista**

## 3. Requisitos de producto — `3-prd`

Se responden después de revisar y aprobar el alcance. Acá definimos lo que ve y hace la gente, sin decidir todavía la arquitectura.

1. Al abrir un enlace de sala, ¿qué debería ver una persona que todavía no se unió? ¿Qué explicación necesita para saber cómo entrar?

   **Las opciones disponibles**

2. ¿Quién puede entrar a una sala: cualquiera que tenga el enlace, alguien con un código o contraseña, o querés otro mecanismo? ¿Qué debería poder hacer quien comparte el enlace?

   **Únicamente quien tenga el enlace**

3. Cuando alguien sube una captura o foto, ¿qué debería pasar después? ¿Quién tendría que verla, durante cuánto tiempo y qué acción debería permitir borrarla?

   **Esto es lo que quiero definir**

4. ¿Qué debería ver el resto del grupo si el análisis de texto o imagen falla, tarda, o no encuentra información útil?

   **Una imagen estática con un mensaje de error pero con una pizca de humor**

5. ¿Qué debería pasar si una sala está vacía, si el enlace no es válido, o si alguien vuelve a una sala que ya había abierto?

   **1. Si la sala está vacía, está vacía. No hay mucha magia ahí. 2. Si el enlace no es válido solicitar a quien creó la sala de nuevo. 3. Un usuario debería poder entrar y salir de la sala las veces que quiera mientras siga existiendo o hasta que sea expulsado**

6. ¿Qué señales concretas mostrarían que el recorrido principal funciona en la demo?

   **Todas las que lleguemos a implementar**

7. ¿Qué parte de la interfaz actual te gusta conservar y qué comportamiento te parece confuso o incompleto?

   **Me gusta cómo está, pero debería verse mejor el enlace de la sala**

## 4. Especificación técnica — `4-spec`

Se responde después de aprobar el PRD. El repo ya tiene una app React/TypeScript, un Worker de Cloudflare y D1. La especificación va a describir esa arquitectura existente y cualquier ajuste acordado; no va a reemplazarla sin una razón aprobada.

1. Sobre tu pregunta de privacidad y alojamiento: ¿querés que la demo represente una instancia central donde las salas y sus datos viven en el servicio de APORIA, o preferís que cada grupo tenga su propia instancia? ¿Qué necesitás que la gente entienda al respecto?

   **La demo es una demo, para eso que cada quien clone el repo, use nuestro backend, la api de Gemini que es gratis --tiene un tier-- y la deploye en el lugar que crea conveniente**

2. Si alguien clona el repo y lo despliega por su cuenta, ¿esperás que use el backend central de APORIA o que configure su propio backend y almacenamiento? ¿Querés que eso sea parte de esta demo o solo explicarlo como posibilidad futura?

   **El repositorio tiene licencia Apache 2, quien lo clone puede hacer lo que quiera**

3. ¿Qué expectativa querés comunicar sobre el acceso a salas y archivos: acceso por enlace, protección adicional, borrado o plazo de retención? Si todavía no lo sabés, anotá qué te preocupa más.

   **Cómo vamos a gestionar el borrado de la sala y quién tiene permiso y qué mecanismo existe de recuperación**

4. ¿Querés que la demo corra localmente para grabar el video, que tenga un despliegue público opcional para probarla, o ambas cosas?

   **Desplegada**

5. ¿Qué parte técnica de APORIA o de este flujo te genera más dudas y te gustaría entender mejor?

   **Cómo se van a organizar las capturas está claro que van a estar, pero las ve solo Gemini y procesa, todas, si lo están todas a la vez o Gemini hace el resumen de todo etc? qué pasa con las capturas duplicadas etc**

## 5. Construcción — `5-build`

Estas preguntas se retoman cuando scope, PRD y spec estén aprobados, y después de explicar las opciones.

1. Para los pasos de implementación, ¿preferís que vayamos explicando y verificando cada parte antes de seguir, o avanzar con menos pausas y revisar en puntos acordados?

   **Construir-Red Team-Documentar-Arreglar-Commit-Push-Continuar**

2. Cuando la app esté lista para probar, ¿qué recorrido querés hacer vos para confirmar que cumple con lo que definimos?

   **El mismo que haría un grupo normal entre 2 personas, 4, 12 y hasta 20 con diferentes pruebas de estrés**

## 6. Preparación de entrega — `6-ship`

La skill pide que la descripción y las respuestas públicas de Devpost las escribas vos. Puedo señalar información faltante y corregir ortografía o gramática de un texto tuyo, pero no redactar la presentación en tu lugar.

1. ¿Qué parte del recorrido querés mostrar en el video demo?

   **Ok, soy escritora, puedo escribir, pero no en inglés. Así que tendré que escribir la versión mía y vos la traducción y presentar las dos. No hace falta que me corrijas la ortografía.**

2. Cuando llegue el momento, ¿qué hiciste, para quién es APORIA y qué aprendiste al construirlo? Respondelo con tus palabras para completar el formulario de Devpost.

   **Cuando llegue el momento eso haré**

3. ¿Ya tenés un repo público y un video accesible para quienes evalúan, o habrá que prepararlos al final?

   **Ya lo tengo**

## Registro de estado

- **Estado registrado al 12/10/2026:** las seis skills oficiales están instaladas en `hackathon-sandbox/.agents/skills/`. Se creó `devpost/learner-profile.md` (ignorado por Git), `devpost/scope.md` está aprobado y `devpost/prd.md` quedó aprobado tras las respuestas de producto. La especificación técnica se inicia después de esa aprobación.
- **Código:** no se modificó como parte del flujo de planificación. Hay cambios anteriores sin commit en la app y los README; se deben tratar como estado existente y revisar contra las decisiones futuras.
- **Implementado según el código inspeccionado:** salas, ingreso mediante enlace, captura de texto e imágenes con extracción asistida por Gemini, confirmación de datos, propuestas de planes y evaluación de restricciones. D1 conserva el estado de sala y las propuestas de extracción cuando Gemini termina correctamente; los datos confirmados quedan en el estado y los eventos de sala.
- **Pendiente según el código inspeccionado:** las salas se pueden leer con el UUID sin validar una sesión; las imágenes quedan guardadas dentro de una propuesta solo si Gemini termina correctamente; no se encontró una vista o ruta para volver a listar y consultar esas imágenes, ni controles de borrado o retención. La app no sincroniza las propuestas de extracción entre participantes. Estos puntos se van a verificar y precisar en la especificación antes de decidir cambios.
- **Verificación en esta etapa:** se inspeccionaron archivos e historial de Git. No se ejecutaron pruebas durante este inventario. El `README` técnico contiene resultados históricos, que no equivalen a una verificación hecha ahora.

## Para revisar y aprobar el scope (`devpost/scope.md`)

El scope se presentó como borrador y después fue aprobado con la aclaración que figura abajo. Estas respuestas documentan esa primera revisión; ahora las preguntas abiertas del producto están en la sección de PRD.

1. ¿Qué resultado visible al final haría que para vos el grupo haya coordinado algo útil después de la charla?

   **Que el after se haya realizado, que la gente la pase bien e incluso decidan en esa sala crear OTRA sala para una siguiente reunión**

2. Cuando alguien entra para observar, ¿qué puede hacer o ver sin participar? ¿Cómo pasa, si quiere, a contribuir?

   **Si quiere observar, solo tiene que leer, si quiere contribuir, comenzar a responder las preguntas y aportar ideas, disponibilidad etc**

3. ¿Que las capturas o fotos queden disponibles para el grupo es un requisito de esta demo? Si sí, ¿alcanza con que se vean en la sala después de subirlas, o esperás además que se agrupen o resuman?

   **Sí, es requisito para la demo para que jueces puedan reproducir el flujo end to end sin poner sus propias fotos**

4. Para la primera revisión del plan, ¿preferís leer el Markdown acá o también querés una página HTML visual con diagramas?

   **No necesisto una interfaz gráfica adicional, soy capaz de leer texto.**

## Aclaración de alcance y aprobación — respuesta del 12/10/2026

> Mira, te lo digo rápido, apruebo el plan, lo que quiero construir es esta espacio de "chat" que todos puedan ver y la posibilidad de cerrar el espacio y actualmente no hay como ingresar con el número de reunión solo crear el espacio, y quiero que se pueda cerrar y cómo recuperar una sala borrada sin querer y que tras finalizar la reunión exitosa borren esa sala para crear otra para que no se contamine de evento a evento, eso en mis palabras

Queda registrado como definición del producto y aprobación del scope; los detalles de comportamiento pasan a las preguntas del PRD.

## Para el PRD (`3-prd`)

Respondé estas preguntas para definir el comportamiento antes de redactar `devpost/prd.md`:

1. Cuando alguien ingresa el número de una reunión, ¿qué tendría que ver y poder hacer en el chat? ¿Quién puede leer y quién puede publicar? ¿La gente aparece con un nombre?

   **La participación es voluntaria y progresiva; no se necesita obligar a nadie a elegir un rol antes de entrar. Sí, tiene que aparecer un nombre, pero no los datos hasta del perro, con un nombre o nick alcanza, es una app para coordinar entre gente que se acaba de conocer en un evento y quiere verse de nuevo, no con gente random de internet. Puede ver las opciones disponibles. Si querés podemos protegere la identidad con ZK pero me parece sobreingeniería jaja**

2. ¿Qué significa cerrar una sala para quienes están adentro? Después de cerrarla, ¿se puede volver a abrir? ¿Quién puede cerrarla o borrarla, y cómo debería funcionar la recuperación si se borra por error?

   **Cerrar una sala es el evento finalizó, se agradece, se planifica repetir con el enlace a OTRA sala para que no sea una red social más sino que cumpla su función. La puede borrar el que la creó y se va a poder recuperar por mail, vos sos el llm, sabés mejor cómo crear eso**

3. Para que los jueces prueben las capturas sin traer fotos propias, ¿cómo te gustaría que encuentren una imagen de ejemplo? Después de subir una captura, ¿quién la ve y qué querés que pase con imágenes repetidas?

   **Tener en la página web el flujo a "demo" y ahí lo hacen de manera automática**

## Aclaración sobre cierre, borrado y recuperación — respuesta del 12/10/2026

| Operación | Comportamiento |
|---|---|
| Cerrar | El evento terminó. La sala queda en modo lectura, sin nuevas aportaciones. |
| Eliminar | El creador solicita borrar la sala y sus datos. |
| Recuperar | El creador puede restaurarla durante un período limitado, antes de la eliminación definitiva. |

> Mi propuesta sería una papelera de 7 días, con eliminación definitiva automática al finalizar ese plazo.

La duración de siete días está registrada como propuesta del usuario y todavía falta aprobarla como requisito.

## Entrevista de producto (`3-prd`)

1. ¿El chat necesita actualizarse en tiempo real? ¿Qué se puede publicar ahí: mensajes de texto, capturas, las dos cosas? ¿Quién puede publicar y quién puede leer?

   **No, el chat no cumple nada social, tiene que ser restrictivo, nada de capturas, las capturas van a la sección capturas, la disponibilidad horaria a la disponibilidad horaria, el chat se usa para informar por ejemplo de que hay tráfico, de que uno va a llegar más tarde o no ir. No es una red social Aporia, es la facilidad para coordinar reuniones sociales de gente heterogénea por ejemplo si gente se conoce en eventos tech o "Mundolingo" Puede publicar quien sea y podríamos poner un límite de 5 mensajes por persona así se entiende bien eso**

2. En el botón o sección `Demo`, ¿qué significa que el flujo se haga automáticamente? ¿Qué tendría que ver o poder hacer el juez durante esa demo?

   **El juez toca los botones y simula ser observador y también participante si elige el modo demo, también puede elegir el flujo real. Lo que debería poder ver es cómo gracias a la IA se resuelve la desorganización, se optimiza una salida y se elimina fricción**

3. ¿Querés que se pueda reabrir una sala cerrada? Para recuperar una sala por mail, ¿en qué momento se ingresa el correo del creador y qué puede hacer durante los siete días de papelera?

   **Sí, una sala puede reabrirse pero modo SOLO LECTURA por ejemplo para recordar un lugar propuesto pero descartado por esa función, los nombres de quienes interactuaron deben estar eliminados, solo pueden recuperarse datos que no tengan que ver con el chat, ni con datos personales, solo lugares propuestos o recuperar el código de la siguiente reunión por ejemplo o recordar de cuántos anotados, cuántos fueron, nada más**

## Precisiones del PRD — respuesta del 12/10/2026

Las respuestas anteriores ya definen el uso del chat, el flujo de demo y la reapertura en modo lectura. Quedan estas precisiones:

1. ¿El chat necesita actualizarse en tiempo real? ¿El límite de cinco mensajes es por persona y por sala?

   **Sí, el chat debe actualizarse en tiempo real. El límite es de 5 mensajes por persona y sala sin excepción, tal vez 5 sea mucho, pero a veces pasan cosas y hay que dar oportunidades de comunicación**

2. ¿Quién puede ver las capturas de una sala? ¿Qué debería pasar con capturas repetidas? Como al recuperar una sala solo se restauran datos no personales ni del chat, ¿las imágenes se eliminan definitivamente junto con la sala?

   **Las capturas lo más práctico es que las viera Gemini y extrayera la información, para la gente que le cuesta escribir, las capturas deben ser estilo "soy Marta, puedo el martes o ahora, soy de esta zona, no como carne" Gemini no necesita revelar esa información necesariamente sino actualizar el plan. Mmm debería estar la sección de restricción alimentaria. Agregarla. Sí, las imagenes se eliminan, es más, que se eliminen después de que Gemini las procesa. Si hay imágenes duplicadas de la misma persona espero que llm sepa que es un error y hacer bien el prompt para que no tome como doble un mismo dato y si sube la misma captura otra persona esa esa una coincidencia divertida, pero Gemini vería que igual cambia algo"**

3. ¿En qué momento se pide el mail de quien crea la sala? ¿Aprobás la propuesta de papelera por siete días, con eliminación definitiva automática al terminar ese plazo?

   **El mail se pide después de crear para qué quiere el evento "After post Hackathon" crea Anna por ejemplo y se puede loguear con Google**

   **Pendiente de precisar:** si iniciar sesión con Google es obligatorio u opcional y si esa cuenta se usa como correo de recuperación. Esta respuesta no confirma ni modifica la propuesta de siete días.

**Sí, lo apruebo y agregá las restricciones de comida, pero solo a modo informativo, no para que Gemini limite; tal vez solo quieran ir por un café, pero quiero que exista a modo informativo.**

### Preguntas respondidas para aprobar el PRD (`3-prd`)

Estas son las preguntas que respondí para cerrar el PRD:

1. ¿Iniciar sesión con Google es obligatorio u opcional para quien crea la sala? ¿Esa cuenta también se usa como correo para recuperar la sala?
   **Google es la opción recomendable y más rápida, pero si alguien prefiere registrarse con un mail descartable porque teme que lo busque la Interpol, debería existir esa opción. Sí, esa es la cuenta de recuperación para quien crea la sala.**
2. Después de que Gemini extrae información, ¿actualiza directamente el plan o mantenemos el paso actual de confirmación humana?
   **Se pone bajo aprobación humana**
3. ¿Aprobás una papelera de siete días con eliminación definitiva automática al terminar ese plazo?
   **Sí. Cuidemos el planeta, porque que exista en la nube tiene costo.**
4. Si distintas personas suben la misma imagen, ¿debería contarse como un único dato compartido o como evidencia de cada persona? ¿Qué imagen de ejemplo querés usar en la demo?
   **No quiero usar el caso duplicado para la demo porque es una situación hipotética y poco probable. Quiero que esté implementado en el código porque me gusta pensar en situaciones imposibles, no porque crea que ocurran. Quiero que esto sea un producto y no solo un prototipo; yo misma quiero usarlo en mis próximos encuentros sociales.**

El PRD queda en estado `approved`. El flujo de habilidades todavía no había generado `spec.md` al momento de registrar estas respuestas.

**Actualización posterior, 12/10/2026:** el PRD está aprobado y `devpost/spec.md` se creó como borrador mediante la skill `4-spec`. No se modificó código. Las preguntas técnicas abiertas están abajo; la especificación no queda aprobada hasta resolverlas y revisar el documento.

## Preguntas de especificación técnica (`4-spec`)

1. El código actual manda la imagen a Gemini en la misma solicitud, pero el proyecto usa la cuota gratuita. Los términos vigentes de Google dicen que el contenido de servicios gratuitos puede usarse para mejorar sus productos y puede ser revisado por personas, y piden no enviar información sensible, confidencial o personal. ¿Querés mantener esa cuota para la demo con un aviso y consentimiento antes de subir, o preferís usar una cuota con facturación activa para este flujo? La alternativa paga tiene sus propios costos y también hay que verificarlos.

**Lo que va a suceder es que esa página va a existir para la hackathon porque superado el tier, me cobran, por eso dije, poner instrucciones de cómo cada quien se hace su página gratuita con su Gemini etc y cada quien es responsable de leer los términos y condiciones de un servicio. Es decir, se acaba hackathon = se termina ESA página, puede quedar la demo etc. Luego el usuario al que le haya gustado, clona el repo, deploya usando la apikey gratuita de Gemini o quien quiera y deploya donde quiera**

2. ¿Quién aprueba una extracción antes de que sus datos pasen a ser visibles para todo el grupo: la persona que aportó la captura o cualquier integrante de la sala?

**la persona que aportó la captura, no sea cosa que haya subido otra cosa por error jajaja, por las dudas si no es mucho esfuerzo que tenga que re-confirmar la captura previsualizada de lo que subió, nadie quiere ver fotos que no están relacionadas jaja**

3. Para el registro por mail descartable, mi recomendación técnica es usar un enlace de acceso de un solo uso, sin contraseña. ¿Te sirve ese flujo junto con Google opcional?

**Estás confundiendo. El registro con mail es para quien crea la sala, los integrantes entran con enlace, no con mail**

4. ¿Confirmás que la instancia oficial de APORIA sea la propietaria de un backend central compartido entre todos, mientras las personas puedan alojar su frontend donde quieran? Quien clone el repo podría apuntar a ese backend si la API pública y sus límites lo permiten, o configurar uno propio.

**Es lo que dije desde momento 1 y una gran pista de esto es que el repositorio tiene Licencia Apache 2**

## Capacidad y costos compartidos — parcialmente respondido

Para implementar límites sin bloquear una reunión normal ni dejar abierto el consumo de recursos, ¿cuál es el máximo de participantes por sala y qué cuota de uso de Gemini debería tener cada sala durante el hackathon? La prueba local llegó a 20 participantes y 20 opciones, pero eso no define el máximo del producto. También hace falta saber si preferís un tope estricto de llamadas por sala o un presupuesto máximo de uso/costo.

**Dato técnico para decidir:** el límite actual de cinco llamadas por operación está asociado al ID de participante. El código genera una identidad y una sesión nuevas en cada ingreso a la sala, incluso si vuelve a entrar la misma persona; por eso ese límite se puede renovar al volver a ingresar. Cloudflare además aplica sus contadores de forma aproximada y separada por ubicación. No hay hoy un cupo total por sala o un presupuesto global.

**Sí, está bien, para hackathon la demo 5, para video voy a hacer con 20 o menos, no lo decidí aún, dependerá del guion**

Esto registra tamaños previstos para la demo y el video; no define el máximo general de participantes ni un cupo de Gemini o de gasto. Esos límites no se implementan como si hubieran quedado aprobados.

## Precisión del ciclo de vida — respondido

Si empezás a eliminar una sala y el envío del correo de recuperación sigue pendiente, mientras tanto la reabrís desde otra pestaña, ¿qué debería pasar cuando termine el envío?

- Que se complete el borrado y la sala quede en la papelera.
- Que reabrir cancele el borrado pendiente. ¿Qué debería pasar con el correo que ya se envió?
- Otra cosa.

Estado: pregunta surgida de la ronda red team 20; para este caso, la respuesta indica que el borrado debe completarse aunque el correo ya esté pendiente.

**Me parece una pregunta muy rebuscada para un hackathon. Que se complete el borrado**

## Alcance de los datos de recuperación — respondido para la hackathon

Tu respuesta para el PRD dice que la recuperación debe conservar solo información que no sea personal: lugares propuestos, el código de la próxima reunión y conteos, sin nombres ni chat. El código actual conserva títulos libres de opciones, horarios y precios, conteos y un código opcional de la sala siguiente. No comprueba que un título libre no incluya un nombre o dato personal, y un conteo de un grupo chico podría permitir inferencias. El resumen recuperado solo lo puede leer quien creó la sala, pero no se comprobó que sea anónimo.

¿Querés mantener esos campos aceptando que no se puede prometer anonimato, o preferís reducir alguno para cumplir de forma más estricta con “solo información no personal”? Si querés reducirlos, indicá cuáles.

**Que para hackathon no se promete anonimato**

Para esta presentación se mantiene la descripción actual del resumen y no se promete anonimato. Esta respuesta no afirma que los campos retenidos sean anónimos ni cambia cuáles se guardan; no se quitó ningún campo.

### Demo local y grabación — respuesta del 24/10/2026

**El modo demo no quiero que haga llamadas reales a gemini, el modo de grabación sí. Y ese puede ser local.**

La demo usa un recorrido de muestra sin llamadas reales a Gemini. Para grabar el producto se usa el flujo normal local con Gemini real.
