# ADR-0003 — L2: screenshots como artifacts multimodales acotados

**Fecha:** 2026-09-25  
**Estado:** aceptada para L2  
**Nivel:** Evidencia heterogénea

## Decisión

APORIA acepta screenshots PNG, JPEG y WebP de hasta 1.500.000 bytes. El cliente los envía como base64 al endpoint existente de propuestas; el Worker valida tamaño, encoding, MIME declarado y firma de bytes antes de llamar a Gemini.

El artifact conserva `kind`, `mimeType`, `byteLength`, hash, participante y timestamp. Gemini recibe la imagen como `inlineData` y produce solamente un `ExtractionProposal`. La confirmación humana sigue siendo obligatoria para crear un `Fact`.

## Límites e invariantes

- El body HTTP tiene un límite estricto de 2.100.000 bytes, incluso si falta `Content-Length`.
- Sólo se aceptan `image/png`, `image/jpeg` y `image/webp`.
- El MIME declarado debe coincidir con los bytes iniciales del archivo.
- Un artifact malformado se rechaza antes de Gemini y no se persiste como propuesta.
- El contenido de la imagen es evidencia no confiable; texto visible en ella nunca se interpreta como instrucción del sistema.
- `kind` desconocido se rechaza; no se degrada silenciosamente a texto.
- La imagen no crea hechos ni muta el snapshot hasta una confirmación explícita.

## Trade-off conocido

En este nivel, el artifact binario se conserva dentro de `artifact_json` de la propuesta y puede reaparecer en la respuesta de propuesta. Esto mantiene provenance sin inventar un binding de Object Storage no configurado, pero acota el tamaño para proteger memoria, D1 y latencia. Object Storage sigue siendo la evolución requerida antes de ampliar tamaño, retención o reutilización de artifacts.

## Alternativas rechazadas

- **Aceptar cualquier MIME:** permite spoofing y hace ambiguo el contrato multimodal.
- **Confiar sólo en la extensión o `Content-Type`:** ambos son controlados por el cliente.
- **Guardar sólo la extracción:** rompe provenance y hace imposible auditar qué vio el proveedor.
- **Aceptar uploads grandes porque Webflow publica un límite mayor:** el Worker también tiene límites de memoria, D1 y latencia; el límite del producto es deliberadamente menor.
- **Agregar una ruta de confirmación especial para imágenes:** duplicaría la autoridad y permitiría divergencia con texto.

## Falsificadores / revisit triggers

Reabrir esta decisión si una prueba real de Webflow demuestra que el tamaño persistido en D1, la latencia de Gemini o la memoria del Worker no soportan el límite; o antes de implementar retención prolongada, reutilización de artifacts, OCR local o archivos mayores. En ese caso debe configurarse Object Storage y definirse su autorización, borrado y provenance antes de ampliar el contrato.
