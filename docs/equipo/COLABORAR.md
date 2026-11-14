# Cómo trabajar los dos sin pisarnos

Repositorio: https://github.com/dapxco-beep/astra-fit (privado)

1. **Antes de empezar:** `git pull`.
2. **Trabaja en una rama por tarea:** `git switch -c nombre-corto` (por ejemplo `alertas-compactas`).
3. **Un archivo, una persona a la vez.** Las secciones están separadas (`SeccionX.html`); avísense en el chat cuál van a tocar. `Estilos.html` e `Index.html` son los que más se cruzan.
4. **Al terminar:** `git add -A`, `git commit -m "qué cambió"`, `git push -u origin nombre-corto`, y abrir un Pull Request hacia `main`.
5. **Publicar en Cloudflare** (solo desde `main` y con todo actualizado):
   `node astra-fit/publicar/construir-cloudflare.js` y luego `npx wrangler deploy`.
   `publicar-cloudflare/index.html` y `assets/` no están en Git: se vuelven a generar con ese comando.
6. **Datos locales:** `astra-fit/local/datos-local.json` no se sube; cada quien tiene el suyo. Para volver a los datos de ejemplo, bórrenlo.
7. **Si Git avisa de un conflicto**, no borren lo del otro: abran el archivo, conserven las dos partes y vuelvan a hacer commit.
