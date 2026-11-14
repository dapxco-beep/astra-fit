# Publicar ASTRA-FIT en Apps Script

Base: la versión que está en esta carpeta. Desde el 14-nov (rama erdm-a-monitoreo) la base de datos usa la escala ERDM-A
con 6 músculos: ya no hay pestañas Sesiones ni EMG, ni sección Registro.

## 1. Llenar el Sheet `BD_ASTRA-FIT`

**El Sheet `BD_ASTRA-FIT` de Drive ya viene cargado** con las 10 pestañas de esta versión. Un Sheet nuevo y vacío se
llena solo la primera vez (`prepararBase_` en Code.gs con `DatosEjemplo.gs`); los CSV de `hojas-csv/` son la alternativa manual.

1. Abre el Sheet y ve a **Archivo → Configuración → Configuración regional** y elige **Estados Unidos**.
   Si queda en Colombia, los decimales con punto (0.7, 1462.5) se importan como texto y las alertas fallan.
2. Importa cada archivo de `publicar/hojas-csv/`: **Archivo → Importar → Subir**, y elige **Insertar hojas nuevas**.
   Deben quedar 10 pestañas con estos nombres exactos: Astronautas, Catalogos, Evaluaciones, Monitoreo, EscalaERDM,
   PlanFortalecimiento, Seguimiento, Umbrales, Alertas, Intervenciones.
3. Borra la pestaña vacía "Hoja 1".
4. Comprueba que los números queden alineados a la derecha (si están a la izquierda, son texto).

## 2. Subir el código

1. En el Sheet: **Extensiones → Apps Script**. Tiene que abrirse desde el Sheet, porque `Code.gs` usa
   `SpreadsheetApp.getActive()`.
2. Crea un archivo por cada uno de `apps-script/`, con el mismo nombre y sin `.html`, y pega su contenido:
   `Estilos`, `Index`, `JsUi`, `JsApi`, `JsCalculos`, `JsAlertas`, `JsAvatares`, `Logo`, `Componentes`, `FormPerfil`,
   `SeccionAcceso`, `SeccionInicio`, `SeccionEntorno`, `SeccionBienestar`, `SeccionMonitoreo`, `SeccionSensores`,
   `SeccionCuerpo`, `SeccionEvolucion`, `SeccionMision`, `SeccionAlertas`, `JsErdm`. `Code.gs` y `DatosEjemplo.gs` van como
   archivos de script. Si existen `SeccionRegistro` y `SeccionErdm` de una versión anterior, bórralos.
   `Logo.html` pesa 123 KB: pégalo completo.
3. **Implementar → Nueva implementación → Aplicación web.** Ejecutar como: yo. Quién tiene acceso: cualquier usuario.
   Cualquiera con el enlace puede leer y escribir en el Sheet. Sirve para la demo, no para datos reales.
4. Autoriza los permisos cuando los pida y abre la URL que termina en `/exec`.

## 3. Modelos 3D en Cloudflare

**Ya está en https://astra-fit-modelos.dapxco.workers.dev** y `SeccionCuerpo` y `SeccionMision` apuntan ahí.
Falta redesplegar: `publicar-cloudflare/assets/` ya trae también `astronaut.glb` y `escenarios/` (incluye
`rover.glb`, de 21 MB), pero el sitio publicado los devuelve 404 hasta correr `npx wrangler deploy` desde la raíz de NASA.
Los pasos de abajo son los originales, por si hay que repetirlos.

1. Sube la carpeta `publicar-cloudflare/` (en la raíz de NASA) a Cloudflare Pages. Trae los `.glb` y el
   archivo `_headers` que permite descargarlos desde Apps Script.
2. En `SeccionCuerpo.html`, busca `BASE_MODELOS` y cambia la dirección de `jsdelivr.net/gh/USUARIO/REPO...`
   por `https://TU-PROYECTO.pages.dev/assets/` (con la barra final).
3. Vuelve a pegar `SeccionCuerpo` en Apps Script y crea una **nueva versión** de la implementación.

## 4. Comprobar que funciona

- [ ] Se ve la pantalla de entrada con los 3 astronautas.
- [ ] Elegir a Rogelio/AST-002 muestra alertas abiertas en la sección Alertas.
- [ ] El visor del cuerpo carga los modelos. Si queda en "Cargando…" o sale un error, abre la consola (F12).
      Es el punto de mayor riesgo: Apps Script sirve la página dentro de un iframe aislado y el visor usa
      `importmap` y `import()` desde jsDelivr. Si el navegador lo bloquea, hay que cargar three.js con
      `<script>` clásico.
- [ ] Guardar una evaluación con valores bajos genera alertas y la fila aparece en el Sheet.
- [ ] Cerrar una alerta cambia su estado en la pestaña Alertas.

## Pendientes antes de presentar

- Texto oficial del reto en `docs/reto/reto.md` (no se pudo descargar).
- Fuente de cada umbral (hoy todos dicen "Por validar").
- Formulario para registrar intervenciones (la pestaña existe, la pantalla no).
- Sección Evolución (gráfica semana a semana) y resumen de Inicio.

## Ejercicios del documento (actualización, ya no aplica)

El 14-nov se agregaron **Press de pecho** y **Carrera en cinta con arnés** como sesiones de ejercicio (Sesiones y EMG).
Con la rama `erdm-a-monitoreo` esas pestañas y la sección Registro se reemplazaron por la escala ERDM-A: cada uno de los
6 músculos tiene su tarea estandarizada (pestaña Catalogos, lista `tarea`) y la medición la hace la banda del sensor en
Monitoreo. Si hace falta registrar el entrenamiento de press de pecho o de la cinta, se puede agregar como intervención.
