# Guía de estilo de ASTRA-FIT

Formato inspirado en el sitio de Apple: mucho aire, letra grande, pocos colores, cada cosa con un propósito.
La referencia visual completa está en **http://localhost:3000/?page=componentes**.

## Estructura de una sección

```html
<section class="seccion seccion--gris" id="mi-seccion">
  <div class="contenedor">
    <div class="seccion-cabecera">
      <h2 class="titulo">Una frase que dice lo importante.</h2>
      <p class="subtitulo">Una o dos líneas que explican qué se ve aquí.</p>
    </div>
    <!-- contenido: .tarjeta, .rejilla rejilla-2 / rejilla-3, .lista ... -->
  </div>
</section>
```

Fondos en orden: entrada blanca → inicio blanco → **cuerpo negro** → gris → blanco → gris.
Una sección negra se reserva para lo visual (el cuerpo). No se ponen dos negras seguidas.

## Color

| Uso | Clase o variable |
| --- | --- |
| Acciones y enlaces | `.boton`, `.enlace` (azul) |
| Estable | `.estado .estado--verde` |
| Precaución | `.estado .estado--amarillo` |
| Alerta | `.estado .estado--rojo` |
| Marca (logo, avatares) | `--marca-azul`, `--marca-morado`, `--marca-turquesa` |

- Verde, amarillo y rojo **solo** significan estado del semáforo. Nunca decoran.
- No se escriben colores en hexadecimal fuera de `Estilos.html`.

## Tipografía

| Clase | Para qué |
| --- | --- |
| `.hero-titulo` | Un solo título grande por pantalla |
| `.titulo` | Título de sección |
| `.subtitulo` | Explicación debajo del título |
| `.titulo-tarjeta` | Título dentro de una tarjeta |
| `.cifra` | Un número protagonista (ej. −12,9 %) |
| `.texto`, `.pequeno`, `.nota` | Texto normal, secundario y aclaraciones |

## Botones y controles

- Una acción principal por bloque: `.boton`. Las demás: `.boton--secundario` o `.enlace`.
- Elegir una opción entre pocas: `.segmentado` con `data-segmentado`.
- Avisos al usuario: `UI.aviso('Evaluación guardada.', 'completado')`.
  Tipos: `estado`, `completado`, `advertencia`, `error`.

## Textos

- En español, frases cortas, verbos claros. Los títulos terminan en punto.
- El botón dice lo que hace: "Guardar evaluación", no "Enviar". El aviso usa el mismo verbo: "Evaluación guardada."
- Los errores dicen qué pasó y cómo arreglarlo: "Debe estar entre 0 y 10."
- Números con coma decimal y espacio antes de %: `−12,9 %`. Unidades en la etiqueta: "Peso (kg)".
- Nada de MAYÚSCULAS SOSTENIDAS, emojis ni signos de exclamación.

## Accesibilidad (ya resuelta en Estilos.html, no la rompas)

- Todo control es un `<button>` o un `<a>`, no un `<div>` con clic.
- Cada campo tiene su `<label for>`.
- Respeta las preferencias del sistema: menos movimiento, sin transparencias, más contraste.
