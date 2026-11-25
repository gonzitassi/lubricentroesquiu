(() => {
  if (!globalThis.LUBRI_PUSH_URL) return;

  let registrationReady;
  let configReady;
  const supported = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;

  async function api(path, auth, payload) {
    const token = auth ? await auth.currentUser.getIdToken() : null;
    const response = await fetch(new URL(path, globalThis.LUBRI_PUSH_URL), token ? {
      method: "POST",
      headers: {Authorization: `Bearer ${token}`, "Content-Type": "application/json"},
      body: JSON.stringify(payload)
    } : {});
    if (!response.ok) throw new Error("PUSH_SERVICE");
    return response.json();
  }

  async function prepare() {
    registrationReady ??= navigator.serviceWorker.register("./admin-sw.js").then(() => navigator.serviceWorker.ready)
      .catch(error => { registrationReady = null; throw error; });
    configReady ??= api("/config").catch(error => { configReady = null; throw error; });
    return Promise.all([registrationReady, configReady]);
  }

  function render(container, auth) {
    if (!container) return;
    container.className = "card";
    container.style.marginBottom = "1rem";
    container.innerHTML = `
      <div class="card-title">🔔 Avisos de turnos nuevos</div>
      <p role="status" style="margin:.4rem 0 .8rem"></p>
      <div style="display:flex;flex-wrap:wrap;gap:.5rem">
        <button class="btn btn-p" type="button" hidden>Activar notificaciones</button>
        <button class="btn btn-g" type="button" hidden>Enviar aviso de prueba</button>
        <button class="btn btn-g" type="button" hidden>Desactivar en este dispositivo</button>
      </div>`;
    const status = container.querySelector("p");
    const [enable, test, disable] = container.querySelectorAll("button");
    const standalone = matchMedia("(display-mode: standalone)").matches || navigator.standalone;
    if (/iPhone|iPad|iPod/i.test(navigator.userAgent) && !standalone) {
      status.textContent = "Abrí el administrador desde el ícono de la pantalla de inicio para activar los avisos.";
      return;
    }
    if (!supported) {
      status.textContent = "Este navegador no admite avisos. En iPhone se necesita iOS 16.4 o posterior.";
      return;
    }

    status.textContent = "Preparando notificaciones…";
    prepare().then(async ([registration, config]) => {
      const encodedKey = config.publicKey.replace(/-/g, "+").replace(/_/g, "/");
      const applicationServerKey = Uint8Array.from(atob(encodedKey), char => char.charCodeAt(0));
      let device = await registration.pushManager.getSubscription();
      let subscription = null;
      const setButtons = active => {
        enable.hidden = active;
        test.hidden = disable.hidden = !active;
      };
      const describe = () => {
        status.textContent = subscription ? "Avisos activados en este dispositivo." : "Recibí un aviso cuando un cliente saque un turno.";
        setButtons(Boolean(subscription));
      };
      const run = async action => {
        for (const button of [enable, test, disable]) button.disabled = true;
        try { await action(); }
        catch (_) {
          status.textContent = Notification.permission === "denied"
            ? "Para recibir avisos, permití las notificaciones en los ajustes del dispositivo."
            : "No se pudo completar la operación. Volvé a intentarlo.";
        }
        finally { for (const button of [enable, test, disable]) button.disabled = false; }
      };
      if (device) {
        // Reconcile an interrupted activation when the settings are reopened.
        await api("/subscribe", auth, device.toJSON()).then(() => { subscription = device; }).catch(() => {});
      }
      describe();
      enable.onclick = () => run(async () => {
        device ??= await registration.pushManager.subscribe({
          userVisibleOnly: true, applicationServerKey
        });
        await api("/subscribe", auth, device.toJSON());
        subscription = device;
        describe();
      });
      test.onclick = () => run(async () => {
        await api("/test", auth, {endpoint: subscription.endpoint});
        status.textContent = "Enviamos un aviso de prueba a este dispositivo.";
      });
      disable.onclick = () => run(async () => {
        await api("/unsubscribe", auth, {endpoint: subscription.endpoint});
        device = null;
        const previous = subscription;
        subscription = null;
        describe();
        await previous.unsubscribe();
      });
    }).catch(() => { status.textContent = "No se pudo conectar con el servicio de avisos. Volvé a abrir Configuración."; });
  }

  globalThis.LubriAdminPush = {render};
})();
