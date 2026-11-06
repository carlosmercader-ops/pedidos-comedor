# Comedor · San Vicente de Paúl

Acceso instalable e independiente a **la misma app de Apps Script**. La interfaz, menús, productos, correo, permisos y pedidos no se copian a GitHub.

## Actualizaciones

Edita Código.gs e Index.html en el proyecto de Apps Script y actualiza su implementación conservando la misma URL `/exec`. Los dos accesos recibirán la misma versión. No hay que cambiar este repositorio para actualizar la app.

GitHub aloja únicamente el marco instalable, el icono, el manifiesto y el receptor de avisos. No contiene contraseñas, alumnos, pedidos ni claves privadas. El trabajador de notificaciones no almacena datos: recibe una señal autenticada de Apps Script y entrega avisos cifrados al navegador.

## Avisos del encargado

Entra en **Comedor** con su contraseña y pulsa **Activar avisos en este dispositivo**. La app pedirá permiso al navegador. Puede desactivarse desde el mismo apartado. En iPhone/iPad hay que añadirla primero a la pantalla de inicio y abrirla desde su icono.

Las notificaciones solo indican que hay un pedido nuevo; no muestran nombres de alumnos. Al pulsarlas se abre Comedor, donde sigue siendo necesario identificarse. El envío depende de los permisos del dispositivo, su conexión y el servicio de notificaciones del navegador.

## Infraestructura

- `index.html`, `pwa.js`, `sw.js`, iconos y manifiesto: GitHub Pages.
- App existente: Apps Script del colegio, sin migración de los datos.
- `worker-push.js`: Cloudflare Worker; secretos `PUSH_SECRET`, `VAPID_PRIVATE_JWK` y `VAPID_PUBLIC_KEY` configurados fuera de GitHub.
- Apps Script conserva las suscripciones y una cola de avisos en su hoja privada. Un activador reintenta las entregas pendientes.

El service worker solo guarda los archivos públicos del marco instalable; nunca guarda fichas, pedidos ni sesiones de Google.
