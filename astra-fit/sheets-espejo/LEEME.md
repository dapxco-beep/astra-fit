# Copia de los datos en Google Sheets

La página de Cloudflare guarda en KV. Este script deja una copia en el Sheet **DATOS** que se va llenando mientras
se usa la página: cada medición, evaluación, alerta, perfil y seguimiento aparece como fila apenas se guarda.
La pestaña **En vivo** muestra las últimas 30 mediciones del sensor, con la más reciente arriba.

El Sheet es solo para mirar: lo que se cambie a mano ahí **no vuelve a la página**, y cada 5 minutos se reescribe con
lo que tenga la página.

## Instalar (una vez, quien sea dueño del Sheet)

1. Abre el Sheet DATOS → **Extensiones → Apps Script**.
2. Borra lo que haya en `Código.gs` y pega todo `Espejo.gs`.
3. En la línea `const CLAVE = 'PEGAR-AQUI-LA-CLAVE';` pon la clave que acordó el equipo (no la subas a GitHub).
4. Guarda. En la lista de funciones elige **activarSincronizacion** y dale **Ejecutar**. Autoriza los permisos.
   Esto crea las pestañas con todo lo que hay en la página y deja la actualización cada 5 minutos.
5. **Implementar → Nueva implementación → Aplicación web.** Ejecutar como: yo. Usuarios con acceso: **Cualquier persona**
   (no "Cualquier persona que tenga una Cuenta de Google": con esa, Cloudflare recibe la pantalla de inicio de sesión).
   Copia la URL que termina en `/exec`. Para comprobarla, ábrela en una ventana de incógnito: debe mostrar
   `{"ok":true,"servicio":"Espejo ASTRA-FIT"}`.

## Conectar el Worker (quien despliega)

Desde la raíz de NASA:

```
npx wrangler secret put SHEETS_URL      (pega la URL /exec)
npx wrangler secret put SHEETS_CLAVE    (pega la misma clave del paso 3)
```

Los secretos se aplican al Worker que ya está publicado, no hace falta redesplegar para eso. El código que los usa sí
tiene que estar desplegado (`node scripts/desplegar.js`).

## Si algo no llega

- Menú **ASTRA-FIT → Traer todo de la página ahora** pone el Sheet al día.
- Errores del envío: `npx wrangler tail` y buscar líneas que empiecen con `Sheet:`.
- Si cambias `Espejo.gs`, hay que hacer **Implementar → Gestionar implementaciones → editar → Nueva versión**; si no,
  la URL `/exec` sigue usando el código viejo.
