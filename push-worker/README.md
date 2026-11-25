# Avisos de turnos en iPhone

El administrador se instala desde Safari como app web. Cada iPhone se registra por separado desde Configuración. El aviso de pantalla bloqueada no incluye datos de clientes.

## Publicar

1. Usá una cuenta de Cloudflare con Workers Free y creá la base con `npx wrangler d1 create lubricentro-push`.
2. Desde esta carpeta ejecutá `npm install` y copiá `wrangler.example.toml` a `wrangler.toml`. Completá el ID de la base, la clave web de Firebase y el UID del usuario administrador que figura en Firebase Authentication.
3. Generá un par de claves con `npx web-push generate-vapid-keys`. Configurá la pública en el archivo y la privada como secreto con `npx wrangler secret put VAPID_PRIVATE_KEY`. Conservá la pareja de claves para futuras actualizaciones.
4. Aplicá el esquema con `npx wrangler d1 execute lubricentro-push --remote --file=schema.sql` y desplegá con `npx wrangler deploy`.
5. Configurá la URL HTTPS del Worker en `assets/push-config.js` y publicá el sitio. En cada iPhone con iOS 16.4 o posterior, agregá específicamente `admin.html` a la pantalla de inicio si el ícono existente abre Safari o lleva al panel de clientes. Luego abrí el ícono, iniciá sesión y entrá a **Configuración → Activar notificaciones → Permitir**. Probá **Enviar aviso de prueba** en ambos equipos.

El Worker verifica el turno guardado usando las mismas lecturas públicas de Firebase que utiliza el panel de clientes. Validá esas lecturas y un turno nuevo después de publicar. El aviso se solicita después del guardado y una falla del servicio de avisos no interrumpe la reserva. La entrega depende de Apple, la conexión y los ajustes de cada dispositivo. No se requieren Cloud Functions ni cambios en el plan de Firebase.
