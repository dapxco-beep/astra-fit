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
| `SeccionInicio.html` | Resumen del astronauta elegido | Dashboard |
| `SeccionCuerpo.html` | Visor del cuerpo, dentro de `#visor-cuerpo` | **Equipo del cuerpo** |
| `SeccionEvolucion.html` | Gráfica semana a semana | Dashboard |
| `SeccionAlertas.html` | Alertas y recomendaciones | Dashboard |
| `SeccionRegistro.html` | Formularios de registro | Dashboard |
| `JsUi.html` | Avisos, controles segmentados, barra superior | — |
| `JsAlertas.html` | Motor de alertas: compara cada evaluación con la basal usando la pestaña Umbrales | Dashboard |
| `JsApi.html` | **Única conexión con los datos** (Sheet o servidor local) | Dashboard |
| `Logo.html` | Logo de Sinergia Cósmica incrustado | — |
| `Code.gs` | Servidor en Apps Script: lee y escribe el Sheet | Base de datos |

`local/` solo sirve para trabajar en el computador: **no se sube a Apps Script**.

## Reglas para trabajar juntos

1. **Cada quien edita solo sus archivos** (tabla de arriba). Si dos personas guardan el mismo archivo, se pierde el trabajo de una.
2. **Nadie escribe estilos fuera de `Estilos.html`.** Usa las clases que ya existen (mira `?page=componentes`). Si falta algo, se agrega allí y se avisa.
3. **Nadie llama a `google.script.run` ni a `fetch` directamente**: siempre `API.algo()` de `JsApi.html`.
4. **El JavaScript de una sección va dentro de su propio archivo `Seccion*.html`**, al final, en un `<script>`.
5. **Para saber qué astronauta está activo**: `Sesion.astronauta`, o escuchar el evento:
   ```js
   document.addEventListener('astronauta-elegido', (e) => { const astronauta = e.detail; /* ... */ });
   ```
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
