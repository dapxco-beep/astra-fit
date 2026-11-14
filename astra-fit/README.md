# ASTRA-FIT — Sinergia Cósmica

Dashboard de monitoreo neuromuscular para astronautas (NASA Space Apps Challenge 2026).
Se programa en esta carpeta y después se sube a Google Apps Script.

## Ver la página en tu computador

1. Instala Node.js una sola vez: https://nodejs.org (versión LTS).
2. Abre esta carpeta (`NASA/astra-fit`) y haz doble clic en:
   - Mac: `INICIAR-MAC.command`
     (la primera vez macOS puede pedir permiso: clic derecho → Abrir).
   - Windows: `INICIAR-WINDOWS.bat`
3. Se abre el navegador en **http://localhost:3000**.
   - Guía de componentes: **http://localhost:3000/?page=componentes**
4. Para apagarlo: cierra la ventana de la terminal o presiona Ctrl + C.

Después de cambiar un archivo, basta con recargar el navegador.

Los datos de prueba están en `local/datos-ejemplo.json`. Lo que guardes desde la página va a
`local/datos-local.json`. Si borras ese archivo, vuelves a los datos de ejemplo.

## Qué hay en cada archivo

Todo lo que se sube a Apps Script está en `apps-script/`, con los mismos nombres que tendrá allá.

| Archivo | Qué es | Responsable |
| --- | --- | --- |
| `Estilos.html` | El formato tipo Apple: colores, letras, botones, tarjetas. **Único lugar con estilos.** | Avisar al equipo antes de cambiar |
| `Componentes.html` | Muestra de cada pieza del formato, para copiar | — |
| `Index.html` | Esqueleto: pantalla de entrada + panel con sus secciones | Dashboard |
| `SeccionAcceso.html` | Pantalla de entrada: logo, astronautas, registrar nuevo | Dashboard |
| `SeccionInicio.html` | Resumen: datos de registro, IMC, signos vitales y última actualización | Dashboard |
| `SeccionEntorno.html` | Lógica del exterior (órbita, Luna o Marte) que se ve en el encabezado oscuro de SeccionInicio: escena animada, días desde el despegue, gravedad, temperatura y duración del día | Dashboard |
| `FormPerfil.html` | Ventana para registrar o editar un astronauta, con emoji de perfil | Dashboard |
| `JsCalculos.html` | IMC, fechas, peso más reciente y datos de cada entorno | Dashboard |
| `JsAvatares.html` | Avatares de astronauta con casco (en lugar de emojis) | Dashboard |
| `JsErdm.html` | Escala ERDM-A: compara cada músculo con su basal, da de 0 a 10 puntos, nivel de riesgo, alertas y plan sugerido. Lee los cortes de la pestaña `EscalaERDM` | Dashboard |
| `SeccionMonitoreo.html` | Monitoreo neuromuscular: figura de frente y espalda con la banda de cada músculo, una gráfica pequeña por músculo (puntaje ERDM-A por semana) y, al tocar uno, señales EMG e IMU en vivo, medición de 10 s (EMG, IMU y dinamómetro) y tarjeta de la ERDM-A | Dashboard |
| `SeccionBienestar.html` | ¿Cómo estás hoy?: sueño, ánimo, temperatura y glucosa, con semáforo y recomendación | Dashboard |
| `SeccionSensores.html` | Seis bandas: estado de cada sensor, cómo se calculan los indicadores y especificaciones | Dashboard |
| `SeccionCuerpo.html` | Visor del cuerpo 3D, dentro de `#visor-cuerpo` (colorea cuádriceps y pantorrilla con su riesgo ERDM-A) | **Equipo del cuerpo** |
| `SeccionMision.html` | Destinos: el astronauta animado en la Estación, Gateway, tránsito, Luna y Marte | **Equipo 3D** |
| `SeccionEvolucion.html` | Semana a semana: una gráfica por músculo del puntaje ERDM-A o de cada dimensión frente a la basal, con los cortes de la escala y tabla | Dashboard |
| `SeccionAlertas.html` | Lo que requiere atención: alertas abiertas, plan de intervención y fortalecimiento por músculo (sección 6 de la ERDM-A), evaluación prioritaria, protocolo e intervenciones | Dashboard |
| `JsUi.html` | Avisos, controles segmentados, barra superior | — |
| `JsApi.html` | **Única conexión con los datos** (Sheet o servidor local) | Dashboard |
| `Logo.html` | Logo de Sinergia Cósmica incrustado | — |
| `Code.gs` | Servidor en Apps Script: lee y escribe el Sheet | Base de datos |
| `DatosEjemplo.gs` | Datos de ejemplo para llenar un Sheet nuevo (se genera desde `local/datos-ejemplo.json`) | — |

`local/` solo sirve para trabajar en el computador: **no se sube a Apps Script**.

## Pestañas del Sheet `BD_ASTRA-FIT`

| Pestaña | Una fila por | Quién la llena |
| --- | --- | --- |
| `Astronautas` | astronauta | Formulario de perfil |
| `Catalogos` | opción de una lista (músculos, tareas, fases, entornos…) | El equipo, a mano |
| `Evaluaciones` | astronauta × fecha × músculo (6 músculos de la ERDM-A) | La banda del sensor (EMG, coordinación y fuerza). Circunferencia y VO₂pico vienen de los datos de ejemplo. La primera es la **basal** |
| `Monitoreo` | medición de 10 s con el sensor | Sección Monitoreo |
| `EscalaERDM` | dimensión de la escala, con sus cortes de moderado y alto | El equipo (documento ASTRA-FIT) |
| `PlanFortalecimiento` | músculo × nivel de riesgo | El equipo (documento ASTRA-FIT) |
| `Seguimiento` | día (agarre, circunferencias, masa, dolor, sueño, ánimo, temperatura, glucosa) | Sección Bienestar |
| `Umbrales` | indicador del seguimiento diario | El equipo |
| `Alertas` | alerta generada | La página, al guardar |
| `Intervenciones` | intervención aplicada | El equipo |

Para regenerar los datos de ejemplo: `python3 local/generar_datos.py` (escribe `local/datos-ejemplo.json` y los CSV de `publicar/hojas-csv/`).
Después, regenerar `DatosEjemplo.gs` para Apps Script.

En Cloudflare los datos viven en KV (`worker/index.js`). Al cambiar la estructura se sube `VERSION` en el Worker y el
documento guardado se migra solo la primera vez que se abre (se conservan Astronautas y Seguimiento).

## Reglas para trabajar juntos

1. **Cada quien edita solo sus archivos** (tabla de arriba). Si dos personas guardan el mismo archivo, se pierde el trabajo de una.
2. **Nadie escribe estilos fuera de `Estilos.html`.** Usa las clases que ya existen (mira `?page=componentes`). Si falta algo, se agrega allí y se avisa.
3. **Nadie llama a `google.script.run` ni a `fetch` directamente**: siempre `API.algo()` de `JsApi.html`.
4. **El JavaScript de una sección va dentro de su propio archivo `Seccion*.html`**, al final, en un `<script>`.
5. **Para saber qué astronauta está activo**: `Sesion.astronauta`, o escuchar los eventos:
   ```js
   document.addEventListener('astronauta-elegido', (e) => { const astronauta = e.detail; /* se eligió en la entrada */ });
   document.addEventListener('astronauta-actualizado', (e) => { /* se editó su perfil (ej. cambió sexo, peso o emoji) */ });
   document.addEventListener('astronauta-guardado', (e) => { /* se registró uno nuevo */ });
   ```
   Para abrir el formulario de perfil desde cualquier sección: `Perfil.abrir('editar', Sesion.astronauta)`.
6. **Textos en español**, frases cortas, sin mayúsculas sostenidas. Ver `GUIA_ESTILO.md`.

## Para el equipo del cuerpo (3D)

- Tu archivo es `apps-script/SeccionCuerpo.html`. Monta el visor dentro de `<div id="visor-cuerpo">` y
  reemplaza el recuadro punteado.
- En local, los modelos de `NASA/assets/` se cargan como `/assets/archivo.glb`.
- **Apps Script no puede alojar los `.glb`** (el proyecto tiene un límite cercano a 10 MB). Para la versión
  final hay que publicarlos fuera (por ejemplo, un repositorio de GitHub servido con jsDelivr) y cargarlos
  desde esa dirección.
- Prueba cuanto antes una versión mínima del visor dentro de Apps Script, para confirmar que Three.js funciona allí.

## Subir a Apps Script

1. En el Sheet `BD_ASTRA-FIT`: Extensiones → Apps Script.
2. Crea un archivo por cada uno de `apps-script/` con **el mismo nombre** (sin `.html`; Apps Script lo agrega)
   y pega su contenido. `Code.gs` va como archivo de secuencia de comandos.
3. Implementar → Nueva implementación → Aplicación web.
   - Ejecutar como: yo. Quién tiene acceso: cualquier usuario.
4. Copia la URL que termina en `/exec`: esa es la página para el equipo y los jueces.
