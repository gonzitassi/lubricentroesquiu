self.addEventListener("push", event => {
  let notification = {};
  try { notification = event.data?.json() || {}; } catch (_) {}
  const test = notification.kind === "test";
  event.waitUntil(self.registration.showNotification(
    test ? "Aviso de prueba" : "Nuevo turno solicitado",
    {
      body: test ? "Este iPhone ya recibe avisos de Lubricentro Esquiú." : "Entrá al administrador para revisar el turno.",
      icon: new URL("assets/lubricentro-logo.jpg", self.registration.scope).href,
      tag: typeof notification.tag === "string" ? notification.tag : undefined
    }
  ));
});

self.addEventListener("notificationclick", event => {
  event.notification.close();
  const adminUrl = new URL("admin.html", self.registration.scope).href;
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({type: "window", includeUncontrolled: true});
    const admin = windows.find(client => client.url.split(/[?#]/)[0] === adminUrl);
    if (admin) await admin.focus();
    else await self.clients.openWindow(adminUrl);
  })());
});
