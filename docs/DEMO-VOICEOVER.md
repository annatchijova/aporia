# APORIA demo voiceover script

Approved script for the Build With AI: Basics demo video narration. English is the
ElevenLabs-ready version; Spanish is the reviewed source kept for reference and for
any future dubbed version.

Estimated runtime: ~2:45–3:05, depending on the voice's pace. If a generated take
runs over 3:00, cut the line marked `[optional cut]` first.

## Pause syntax

`<break time="Xs" />` is SSML and works with ElevenLabs' SSML-enabled models. If the
model in use is Eleven v3 with audio tags instead, replace each break with `[pause]`
(breaks under 0.5s) or `[long pause]` (0.7s and up). Confirm which syntax the chosen
model supports with a short test clip before rendering the full script — tag support
varies by model version.

## English (ElevenLabs)

```
We want to see each other. <break time="0.5s" />
Planning should feel just as good. <break time="1.0s" />

It starts with something simple. <break time="0.3s" />
"We should do something this weekend." <break time="0.8s" />

Then real life joins the conversation. <break time="0.5s" />

Someone can only make it after work. <break time="0.25s" />
Someone has a budget to watch. <break time="0.25s" />
Someone needs a specific food option. <break time="0.25s" />
And someone else is coming from across town. <break time="0.7s" /> [optional cut]

None of these details is a problem on its own. <break time="0.4s" />
The difficulty is keeping all of them together — <break time="0.3s" />
in a group chat where information gets buried the moment the next message arrives. <break time="1.0s" />

This is APORIA — <break time="0.3s" />
a shared room for the moment a conversation needs to become a decision. <break time="1.0s" />

Create a room. <break time="0.2s" />
Invite your group with a link or a meeting number. <break time="0.6s" />
People add what they already have — <break time="0.25s" />
messages, screenshots, a budget mentioned in passing. <break time="0.7s" />

APORIA reads it and proposes a structured interpretation. <break time="0.4s" />
But it doesn't decide anything on its own. <break time="0.3s" />
The person who shared it reviews what the system understood... <break time="0.3s" />
and confirms it. <break time="1.0s" />

AI helps organize information. <break time="0.5s" />
The person stays the authority on what they meant. <break time="1.2s" />

Once the group confirms its details, <break time="0.3s" />
APORIA compares real plan options against them — <break time="0.25s" />
schedules, budgets, locations, preferences. <break time="0.6s" />

That comparison runs on deterministic logic, not a guess. <break time="0.3s" />
The group sees exactly why a plan fits... <break time="0.3s" />
or what would need to change for it to. <break time="1.0s" />

APORIA isn't built to be another feed you keep open. <break time="0.4s" />
Messages are capped on purpose — <break time="0.25s" />
just enough for quick coordination, not an endless thread. <break time="0.6s" />
Once the plan happens, the room closes. <break time="0.3s" />
No lingering group, no history to scroll through later. <break time="0.5s" />
Need to plan again? <break time="0.25s" />
You open a new room. <break time="1.0s" />

Picture a Friday night. <break time="0.4s" />
Alex finishes work late and needs a later start time. <break time="0.3s" />
Sam has a budget to stick to. <break time="0.3s" />
Jordan needs a place with real vegan options. <break time="0.7s" />

They all want the same thing — <break time="0.3s" />
to spend time together. <break time="0.3s" />
They just don't have identical circumstances. <break time="0.7s" />

APORIA gives those differences a shared context, <break time="0.3s" />
so no one has to become the group's unofficial project manager. <break time="1.0s" />

The best plan isn't the one an AI picks for you. <break time="0.5s" />
It's the one your group chooses together. <break time="1.2s" />

APORIA. <break time="0.5s" />
We want to see each other. <break time="0.4s" />
Planning should feel just as good. <break time="0.6s" />
```

## Español (fuente revisada)

```
Queremos vernos las caras.
Planificar debería sentirse igual de bien.

Empieza con algo simple.
"Deberíamos hacer algo este finde."

Y ahí entra la vida real.

Uno solo puede después del trabajo.
Otra tiene un presupuesto que cuidar.
Alguien necesita una opción de comida específica.
Y alguien más viene desde el otro lado de la ciudad. [opcional, recortable]

Ninguno de estos detalles es un problema por sí solo.
Lo difícil es mantenerlos todos juntos —
en un chat grupal donde la información se pierde apenas llega el próximo mensaje.

Esto es APORIA —
una sala compartida para el momento en que una conversación necesita convertirse en una decisión.

Creá una sala. Invitá a tu grupo con un link o un número de reunión.
La gente agrega lo que ya tiene —
mensajes, capturas de pantalla, un presupuesto mencionado al pasar.

APORIA lo lee y propone una interpretación estructurada.
Pero no decide nada por su cuenta.
La persona que lo compartió revisa lo que el sistema entendió...
y lo confirma.

La IA ayuda a organizar la información.
La persona sigue siendo la autoridad sobre lo que quiso decir.

Una vez que el grupo confirma sus detalles,
APORIA compara opciones de plan reales contra ellos —
horarios, presupuestos, ubicaciones, preferencias.

Esa comparación corre sobre lógica determinística, no una adivinanza.
El grupo ve exactamente por qué un plan funciona...
o qué tendría que cambiar para que funcione.

APORIA no está pensada para ser otro feed que dejás abierto.
Los mensajes tienen un tope a propósito —
lo justo para coordinar rápido, no un hilo interminable.
Una vez que el plan ocurre, la sala se cierra.
No queda grupo dando vueltas, ni historial para scrollear después.
¿Necesitás organizar lo próximo?
Abrís una sala nueva.

Imaginate un viernes a la noche.
Alex termina tarde el trabajo y necesita un horario de arranque más tardío.
Sam tiene un presupuesto que respetar.
Jordan necesita un lugar con opciones veganas reales.

Todos quieren lo mismo —
pasar tiempo juntos.
Simplemente no tienen las mismas circunstancias.

APORIA le da a esas diferencias un contexto compartido,
para que nadie tenga que convertirse en el project manager no oficial del grupo.

El mejor plan no es el que una IA elige por vos.
Es el que tu grupo elige junto.

APORIA.
Queremos vernos las caras.
Planificar debería sentirse igual de bien.
```

## Design-claim provenance

The "built for one event, not forever" paragraph is grounded in the live spec, not
invented for the video:

- Chat is capped at five messages per participant per room, enforced server-side
  (`docs/decisions` / `devpost/spec.md:224`, confirmed by induction in
  `docs/red-team/ROUND-1-LOCAL-ENDPOINTS.md:22`).
- The product explicitly rejects an ongoing social feed: "the learner wants APORIA
  to fulfill a specific coordination purpose, not become another social network"
  (`devpost/prd.md:134`).
- Closing/reopening a room strips attendee names, chat, and participant sessions,
  keeping only anonymized candidate options and an aggregate count
  (`devpost/spec.md:226`).
