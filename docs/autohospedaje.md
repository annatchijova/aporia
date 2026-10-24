# Autohospedar APORIA

Esta guía explica cómo crear una instalación independiente de APORIA desde este repo. Se basa en el código actual y en `wrangler.json`; **no** significa que se haya completado o validado un despliegue en una cuenta nueva. El entorno `staging` del repo apunta a la base D1 de Cloudflare de quien mantiene el proyecto. No despliegues ese entorno ni reutilices su ID de base de datos.

## Opción recomendada: un Worker de Cloudflare para la app y la API

La configuración actual del Worker sirve la app Vite compilada desde `dist` y expone la API en el mismo origen. Así evitás configurar un origen separado y CORS.

1. Hacé un fork o cloná el repo e instalá las dependencias fijadas en el lockfile:

   ```sh
   git clone https://github.com/<tu-cuenta>/aporia.git
   cd aporia
   npm ci
   npx wrangler login
   ```

2. Creá una base D1 en tu propia cuenta de Cloudflare:

   ```sh
   npx wrangler d1 create aporia-<tu-nombre>
   ```

   Copiá el nombre y el ID de base que te devuelve el comando en la entrada `d1_databases` de **nivel superior** en `wrangler.json`. Conservá el binding `DB` y `migrations_dir: "migrations"`. Cambiá el `name` del Worker por uno disponible en tu cuenta. No copies el ID de la base `staging` de quien mantiene el proyecto.

3. Asigná un `namespace_id` entero positivo y único dentro de tu cuenta de Cloudflare a cada uno de los seis límites de ráfaga de nivel superior. Los ID de este repo son ejemplos de la cuenta de quien lo mantiene; Cloudflare comparte contadores entre bindings que reutilizan un mismo ID. Conservá los `name` y los límites actuales de cada binding. Revisá el [alcance y funcionamiento de los límites de Cloudflare](https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/).

4. Aplicá el esquema a tu base remota:

   ```sh
   npx wrangler d1 migrations apply aporia-<tu-nombre> --remote
   ```

   Revisá la salida y confirmá que el comando apunta a tu base. La [guía de inicio de D1](https://developers.cloudflare.com/d1/get-started/) y los [comandos de Wrangler](https://developers.cloudflare.com/d1/wrangler-commands/) documentan la creación de bases y la aplicación de migraciones.

5. Guardá tu clave de Gemini como secreto del Worker; no la pongas en variables `VITE_*` del cliente ni la subas al repo:

   ```sh
   npx wrangler secret put GEMINI_API_KEY
   ```

   El proyecto de Google, modelo, cuota, nivel, precio y condiciones de uso de datos quedan bajo tu responsabilidad. Los límites de ráfaga por participante de APORIA no son una cuota global ni un tope de gasto. Revisá la información vigente de Google sobre [claves de Gemini API](https://ai.google.dev/gemini-api/docs/api-key), [precios](https://ai.google.dev/gemini-api/docs/pricing) y [condiciones](https://ai.google.dev/gemini-api/terms). Que exista un nivel gratuito no garantiza costo cero ni un tratamiento de datos adecuado para tu caso.

6. Si querés habilitar el inicio y la recuperación de acceso del creador por correo, configurá estos valores del Worker en Cloudflare: `RESEND_API_KEY` como secreto, y `CREATOR_EMAIL_FROM` y `APORIA_APP_ORIGIN` como variables. El origen debe ser el origen público donde se sirve esta instalación. Sin esos valores, las operaciones del creador que dependen del correo no están disponibles. Revisá las condiciones, precios, requisitos de remitente verificado y tratamiento de datos vigentes de Resend.

7. Después de revisar la configuración y los secretos, compilá y desplegá el entorno predeterminado:

   ```sh
   npm run build
   npx wrangler deploy
   ```

   Wrangler publica el Worker y los assets configurados en una misma operación; consultá [Workers Static Assets](https://developers.cloudflare.com/workers/static-assets/). `dist` es el frontend generado. El origen `workers.dev` o dominio propio que obtengas corresponde a tu instalación independiente. Antes de hacerla pública, revisá el plan, el uso actual y la facturación de Cloudflare.

## Opción adicional: frontend en Vercel y API en tu Worker

Usá esta opción solo si querés alojar el frontend por separado. Primero desplegá tu propio Worker y tu propia base siguiendo los pasos anteriores. Después importá el repo como proyecto Vite en Vercel y configurá esta variable de compilación:

```text
VITE_APORIA_API_ORIGIN=https://<origen-de-tu-worker>
```

En el Worker, configurá `APORIA_ALLOWED_ORIGINS` con el origen exacto de producción de Vercel; por ejemplo, `https://<tu-proyecto>.vercel.app` (sin ruta ni barra final). No habilites comodines amplios para previews salvo que hayas revisado deliberadamente qué acceso permiten. CORS controla el acceso desde navegadores; no autentica las llamadas a la API. Guardá las credenciales de Gemini y correo únicamente en el Worker. Consultá la guía oficial de Vercel para [desplegar Vite](https://vercel.com/docs/frameworks/frontend/vite) y sus [variables de entorno](https://vercel.com/docs/environment-variables).

## Antes de compartir tu instalación

- Probá el ciclo de vida de las salas y el envío de correo con datos sintéticos en tu propio despliegue; esta guía todavía no se validó con una cuenta recién configurada.
- Leé el [mapa de datos y condiciones de proveedores de APORIA](PRIVACY-DATA-FLOW.md). Los links y números de sala son formas de acceso público; no prometas anonimato.
- Confirmá por tu cuenta el nivel y las condiciones de Gemini, la configuración del remitente de correo, los límites de Cloudflare y las alertas de facturación. La app no impone un presupuesto compartido del proveedor.
- Tu instalación tiene sus propias salas, base de datos, credenciales, retención y operador. Clonar el repo no te da acceso a la instancia oficial de APORIA, su base de datos ni sus claves de proveedor.

Las referencias oficiales se revisaron el 24 de octubre de 2026. Los planes, precios, cuotas, el comportamiento de los servicios y sus condiciones pueden cambiar; volvé a revisarlos cuando despliegues.
