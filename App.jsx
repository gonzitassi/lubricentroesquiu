

import { useState, useEffect } from "react";

const GOOGLE_FONTS = `
@import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Sans:wght@300;400;500;600;700&display=swap');
`;

const SERVICES = [
  { id: "aceite", name: "Cambio de Aceite", duration: "30 min", price: "$8.500" },
  { id: "filtro", name: "Cambio de Filtro", duration: "20 min", price: "$3.200" },
  { id: "aceite_filtro", name: "Aceite + Filtro", duration: "45 min", price: "$11.000" },
  { id: "liquido_frenos", name: "Líquido de Frenos", duration: "20 min", price: "$4.500" },
  { id: "revision", name: "Revisión General", duration: "60 min", price: "$6.000" },
  { id: "neumaticos", name: "Rotación de Neumáticos", duration: "30 min", price: "$2.800" },
];

const HOURS = ["08:00","08:30","09:00","09:30","10:00","10:30","11:00","11:30","12:00","12:30","14:00","14:30","15:00","15:30","16:00","16:30","17:00","17:30"];

const DEMO_CLIENTS = [
  { id: "c1", name: "Carlos Méndez", phone: "1155443322", email: "carlos@mail.com", vehicles: [{ id: "v1", patent: "AB123CD", brand: "Volkswagen", model: "Gol", year: "2019" }] },
  { id: "c2", name: "Laura Torres", phone: "1166778899", email: "laura@mail.com", vehicles: [{ id: "v2", patent: "EF456GH", brand: "Renault", model: "Sandero", year: "2021" }] },
];

const today = new Date();
const fmt = (d) => d.toISOString().split("T")[0];
const DEMO_APPOINTMENTS = [
  { id: "a1", clientId: "c1", vehiclePat: "AB123CD", vehicleDesc: "VW Gol 2019", date: fmt(today), time: "09:00", service: "aceite_filtro", serviceName: "Aceite + Filtro", status: "confirmado", km: "85000", notes: "" },
  { id: "a2", clientId: "c2", vehiclePat: "EF456GH", vehicleDesc: "Renault Sandero 2021", date: fmt(new Date(today.getTime() + 86400000)), time: "10:30", service: "aceite", serviceName: "Cambio de Aceite", status: "pendiente", km: "42000", notes: "Usar 10W40" },
];

// 6 months ago appointments for reminders
const sixMonthsAgo = new Date(today); sixMonthsAgo.setMonth(today.getMonth() - 6);
DEMO_APPOINTMENTS.push(
  { id: "a3", clientId: "c1", vehiclePat: "AB123CD", vehicleDesc: "VW Gol 2019", date: fmt(sixMonthsAgo), time: "09:00", service: "aceite", serviceName: "Cambio de Aceite", status: "completado", km: "78000", notes: "" }
);

const styles = `
  ${GOOGLE_FONTS}
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  :root {
    --bg: #0e0e0f;
    --bg2: #161618;
    --bg3: #1e1e21;
    --border: #2a2a2e;
    --orange: #f97316;
    --orange2: #ea580c;
    --text: #f0ede8;
    --muted: #7a7878;
    --success: #22c55e;
    --warn: #eab308;
    --danger: #ef4444;
    --card: #18181b;
  }
  html, body { background: var(--bg); color: var(--text); font-family: 'DM Sans', sans-serif; min-height: 100vh; }
  h1,h2,h3,h4 { font-family: 'Bebas Neue', sans-serif; letter-spacing: 1px; }
  
  .app { min-height: 100vh; background: var(--bg); }

  /* LANDING */
  .landing { min-height: 100vh; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 2rem; position: relative; overflow: hidden; }
  .landing::before { content: ''; position: absolute; top: -40%; left: -20%; width: 60%; height: 80%; background: radial-gradient(ellipse, rgba(249,115,22,0.08) 0%, transparent 70%); pointer-events: none; }
  .landing-logo { font-family: 'Bebas Neue', sans-serif; font-size: clamp(3rem, 10vw, 6rem); letter-spacing: 3px; line-height: 1; }
  .landing-logo span { color: var(--orange); }
  .landing-sub { color: var(--muted); margin: 0.5rem 0 3rem; font-size: 1rem; letter-spacing: 2px; text-transform: uppercase; }
  .landing-cards { display: flex; gap: 1.5rem; flex-wrap: wrap; justify-content: center; }
  .landing-card { background: var(--bg3); border: 1px solid var(--border); border-radius: 16px; padding: 2.5rem 2rem; min-width: 220px; cursor: pointer; transition: all 0.2s; text-align: center; }
  .landing-card:hover { border-color: var(--orange); transform: translateY(-4px); box-shadow: 0 8px 40px rgba(249,115,22,0.15); }
  .landing-card-icon { font-size: 2.5rem; margin-bottom: 1rem; }
  .landing-card h3 { font-family: 'Bebas Neue', sans-serif; font-size: 1.6rem; letter-spacing: 1px; margin-bottom: 0.4rem; }
  .landing-card p { color: var(--muted); font-size: 0.85rem; }

  /* TOPBAR */
  .topbar { background: var(--bg2); border-bottom: 1px solid var(--border); padding: 0.9rem 1.5rem; display: flex; align-items: center; justify-content: space-between; position: sticky; top: 0; z-index: 100; }
  .topbar-brand { font-family: 'Bebas Neue', sans-serif; font-size: 1.6rem; letter-spacing: 2px; }
  .topbar-brand span { color: var(--orange); }
  .topbar-right { display: flex; align-items: center; gap: 1rem; }
  .back-btn { background: none; border: 1px solid var(--border); color: var(--muted); padding: 0.4rem 1rem; border-radius: 8px; cursor: pointer; font-family: 'DM Sans', sans-serif; font-size: 0.85rem; transition: all 0.15s; }
  .back-btn:hover { border-color: var(--orange); color: var(--text); }

  /* TABS */
  .tabs { display: flex; gap: 0.25rem; padding: 1rem 1.5rem 0; background: var(--bg2); border-bottom: 1px solid var(--border); overflow-x: auto; }
  .tab { background: none; border: none; padding: 0.7rem 1.2rem; color: var(--muted); font-family: 'DM Sans', sans-serif; font-size: 0.9rem; cursor: pointer; border-bottom: 2px solid transparent; transition: all 0.15s; white-space: nowrap; }
  .tab.active { color: var(--orange); border-bottom-color: var(--orange); }
  .tab:hover:not(.active) { color: var(--text); }

  /* CONTENT */
  .content { padding: 1.5rem; max-width: 1100px; margin: 0 auto; }

  /* CARDS */
  .card { background: var(--card); border: 1px solid var(--border); border-radius: 12px; padding: 1.25rem; }
  .card-title { font-family: 'Bebas Neue', sans-serif; font-size: 1.2rem; letter-spacing: 1px; margin-bottom: 1rem; color: var(--orange); }

  /* STAT CARDS */
  .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 1rem; margin-bottom: 1.5rem; }
  .stat { background: var(--bg3); border: 1px solid var(--border); border-radius: 12px; padding: 1.25rem; }
  .stat-num { font-family: 'Bebas Neue', sans-serif; font-size: 2.5rem; color: var(--orange); line-height: 1; }
  .stat-label { color: var(--muted); font-size: 0.8rem; text-transform: uppercase; letter-spacing: 1px; margin-top: 0.25rem; }

  /* TABLE */
  .table-wrap { overflow-x: auto; }
  table { width: 100%; border-collapse: collapse; font-size: 0.9rem; }
  th { text-align: left; padding: 0.6rem 0.8rem; color: var(--muted); font-size: 0.75rem; text-transform: uppercase; letter-spacing: 1px; border-bottom: 1px solid var(--border); font-weight: 500; }
  td { padding: 0.75rem 0.8rem; border-bottom: 1px solid #1e1e21; vertical-align: middle; }
  tr:last-child td { border-bottom: none; }
  tr:hover td { background: var(--bg3); }

  /* BADGE */
  .badge { display: inline-block; padding: 0.2rem 0.6rem; border-radius: 20px; font-size: 0.75rem; font-weight: 600; }
  .badge-green { background: rgba(34,197,94,0.15); color: var(--success); }
  .badge-yellow { background: rgba(234,179,8,0.15); color: var(--warn); }
  .badge-orange { background: rgba(249,115,22,0.15); color: var(--orange); }
  .badge-red { background: rgba(239,68,68,0.15); color: var(--danger); }

  /* BUTTON */
  .btn { display: inline-flex; align-items: center; gap: 0.4rem; padding: 0.6rem 1.2rem; border-radius: 8px; font-family: 'DM Sans', sans-serif; font-size: 0.9rem; font-weight: 600; cursor: pointer; border: none; transition: all 0.15s; }
  .btn-primary { background: var(--orange); color: #fff; }
  .btn-primary:hover { background: var(--orange2); }
  .btn-ghost { background: transparent; border: 1px solid var(--border); color: var(--text); }
  .btn-ghost:hover { border-color: var(--orange); color: var(--orange); }
  .btn-danger { background: rgba(239,68,68,0.15); color: var(--danger); border: 1px solid rgba(239,68,68,0.3); }
  .btn-success { background: rgba(34,197,94,0.15); color: var(--success); border: 1px solid rgba(34,197,94,0.3); }
  .btn-sm { padding: 0.35rem 0.75rem; font-size: 0.8rem; }

  /* FORM */
  .form-group { margin-bottom: 1rem; }
  .form-label { display: block; font-size: 0.8rem; color: var(--muted); text-transform: uppercase; letter-spacing: 1px; margin-bottom: 0.4rem; }
  .form-input { width: 100%; background: var(--bg3); border: 1px solid var(--border); color: var(--text); padding: 0.65rem 0.9rem; border-radius: 8px; font-family: 'DM Sans', sans-serif; font-size: 0.95rem; transition: border 0.15s; outline: none; }
  .form-input:focus { border-color: var(--orange); }
  .form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
  @media(max-width:500px) { .form-row { grid-template-columns: 1fr; } }

  /* MODAL */
  .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.75); z-index: 200; display: flex; align-items: center; justify-content: center; padding: 1rem; }
  .modal { background: var(--bg2); border: 1px solid var(--border); border-radius: 16px; padding: 1.75rem; width: 100%; max-width: 480px; max-height: 90vh; overflow-y: auto; }
  .modal-title { font-family: 'Bebas Neue', sans-serif; font-size: 1.6rem; letter-spacing: 1px; margin-bottom: 1.5rem; }
  .modal-actions { display: flex; gap: 0.75rem; justify-content: flex-end; margin-top: 1.5rem; }

  /* SERVICE GRID */
  .service-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 0.75rem; }
  .service-card { border: 2px solid var(--border); border-radius: 10px; padding: 1rem; cursor: pointer; transition: all 0.15s; text-align: center; }
  .service-card:hover, .service-card.selected { border-color: var(--orange); background: rgba(249,115,22,0.07); }
  .service-card-name { font-weight: 600; font-size: 0.9rem; margin-bottom: 0.25rem; }
  .service-card-price { color: var(--orange); font-size: 0.85rem; font-weight: 700; }
  .service-card-dur { color: var(--muted); font-size: 0.75rem; }

  /* TIME GRID */
  .time-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(70px, 1fr)); gap: 0.5rem; }
  .time-btn { border: 1px solid var(--border); background: var(--bg3); color: var(--text); padding: 0.5rem; border-radius: 8px; cursor: pointer; font-size: 0.85rem; transition: all 0.15s; text-align: center; }
  .time-btn:hover, .time-btn.selected { border-color: var(--orange); color: var(--orange); background: rgba(249,115,22,0.07); }
  .time-btn.taken { opacity: 0.3; cursor: not-allowed; }

  /* REMINDER CARD */
  .reminder-item { display: flex; align-items: center; justify-content: space-between; padding: 1rem; background: var(--bg3); border: 1px solid rgba(249,115,22,0.2); border-radius: 10px; margin-bottom: 0.75rem; }
  .reminder-left h4 { font-size: 0.95rem; font-weight: 600; }
  .reminder-left p { font-size: 0.8rem; color: var(--muted); margin-top: 0.2rem; }

  /* EMPTY */
  .empty { text-align: center; padding: 3rem 1rem; color: var(--muted); }
  .empty-icon { font-size: 2.5rem; margin-bottom: 0.75rem; }

  /* SECTION HEADER */
  .section-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 1.25rem; }
  .section-title { font-family: 'Bebas Neue', sans-serif; font-size: 1.6rem; letter-spacing: 1px; }

  /* STEP */
  .step-num { display: inline-flex; align-items: center; justify-content: center; width: 28px; height: 28px; border-radius: 50%; background: var(--orange); color: #fff; font-family: 'Bebas Neue', sans-serif; font-size: 1rem; margin-right: 0.5rem; flex-shrink: 0; }
  .step-title { display: flex; align-items: center; font-weight: 600; margin-bottom: 1rem; font-size: 1rem; }

  .divider { border: none; border-top: 1px solid var(--border); margin: 1.5rem 0; }

  .whatsapp-btn { background: #25D366; color: #fff; border: none; border-radius: 8px; padding: 0.6rem 1.2rem; font-family: 'DM Sans'; font-weight: 600; font-size: 0.9rem; cursor: pointer; display: inline-flex; align-items: center; gap: 0.5rem; transition: all 0.15s; }
  .whatsapp-btn:hover { background: #128C7E; }

  .alert { padding: 0.9rem 1rem; border-radius: 8px; margin-bottom: 1rem; font-size: 0.9rem; }
  .alert-orange { background: rgba(249,115,22,0.1); border: 1px solid rgba(249,115,22,0.3); color: var(--orange); }
  .alert-green { background: rgba(34,197,94,0.1); border: 1px solid rgba(34,197,94,0.3); color: var(--success); }

  select.form-input option { background: var(--bg2); }
`;

// STORAGE HELPERS
const load = async (key, fallback) => {
  try {
    const r = await window.storage.get(key);
    return r ? JSON.parse(r.value) : fallback;
  } catch { return fallback; }
};
const save = async (key, val) => {
  try { await window.storage.set(key, JSON.stringify(val)); } catch {}
};

const genId = () => Math.random().toString(36).substr(2, 9);

// ===================== ADMIN APP =====================
function AdminApp({ onBack }) {
  const [tab, setTab] = useState("dashboard");
  const [clients, setClients] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [modal, setModal] = useState(null); // 'newAppt' | 'newClient' | 'viewClient'
  const [selected, setSelected] = useState(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    (async () => {
      const c = await load("lubi_clients", DEMO_CLIENTS);
      const a = await load("lubi_appointments", DEMO_APPOINTMENTS);
      setClients(c);
      setAppointments(a);
      setLoaded(true);
    })();
  }, []);

  const persistClients = async (c) => { setClients(c); await save("lubi_clients", c); };
  const persistAppts = async (a) => { setAppointments(a); await save("lubi_appointments", a); };

  const todayStr = fmt(today);
  const todayAppts = appointments.filter(a => a.date === todayStr);
  const pendingAppts = appointments.filter(a => a.status === "pendiente");
  
  // Oil change reminders: completed oil service > 5.5 months ago
  const reminders = (() => {
    const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - 165);
    const oilServices = appointments.filter(a =>
      (a.service === "aceite" || a.service === "aceite_filtro") &&
      a.status === "completado" &&
      new Date(a.date) <= cutoff
    );
    const seen = new Set();
    return oilServices.filter(a => {
      if (seen.has(a.clientId)) return false;
      seen.add(a.clientId); return true;
    }).map(a => ({ ...a, client: clients.find(c => c.id === a.clientId) }));
  })();

  const updateStatus = async (id, status) => {
    const updated = appointments.map(a => a.id === id ? { ...a, status } : a);
    await persistAppts(updated);
  };

  const deleteAppt = async (id) => {
    await persistAppts(appointments.filter(a => a.id !== id));
  };

  const sendWhatsApp = (client, msg) => {
    if (!client) return;
    const url = `https://wa.me/54${client.phone}?text=${encodeURIComponent(msg)}`;
    window.open(url, "_blank");
  };

  if (!loaded) return <div className="content" style={{paddingTop:"3rem",textAlign:"center",color:"var(--muted)"}}>Cargando...</div>;

  return (
    <div className="app">
      <div className="topbar">
        <div className="topbar-brand">LUBI<span>CENTRO</span> <span style={{fontSize:"0.85rem",color:"var(--muted)",fontFamily:"DM Sans",letterSpacing:0}}>ADMIN</span></div>
        <button className="back-btn" onClick={onBack}>← Salir</button>
      </div>
      <div className="tabs">
        {[["dashboard","📊 Panel"],["turnos","📅 Turnos"],["clientes","👥 Clientes"],["recordatorios","🔔 Recordatorios"]].map(([k,l]) => (
          <button key={k} className={`tab${tab===k?" active":""}`} onClick={() => setTab(k)}>{l}</button>
        ))}
      </div>
      <div className="content">
        {tab === "dashboard" && (
          <>
            <div className="stats">
              <div className="stat"><div className="stat-num">{todayAppts.length}</div><div className="stat-label">Turnos hoy</div></div>
              <div className="stat"><div className="stat-num">{pendingAppts.length}</div><div className="stat-label">Pendientes</div></div>
              <div className="stat"><div className="stat-num">{clients.length}</div><div className="stat-label">Clientes</div></div>
              <div className="stat"><div className="stat-num" style={{color:"var(--warn)"}}>{reminders.length}</div><div className="stat-label">Recordatorios</div></div>
            </div>
            <div className="card">
              <div className="card-title">TURNOS DE HOY</div>
              {todayAppts.length === 0 ? <div className="empty"><div className="empty-icon">🎉</div><p>Sin turnos para hoy</p></div> : (
                <div className="table-wrap">
                  <table>
                    <thead><tr><th>Hora</th><th>Cliente</th><th>Vehículo</th><th>Servicio</th><th>Estado</th><th></th></tr></thead>
                    <tbody>
                      {todayAppts.sort((a,b)=>a.time.localeCompare(b.time)).map(a => {
                        const cl = clients.find(c => c.id === a.clientId);
                        return (
                          <tr key={a.id}>
                            <td><strong>{a.time}</strong></td>
                            <td>{cl?.name || "—"}</td>
                            <td>{a.vehicleDesc}</td>
                            <td>{a.serviceName}</td>
                            <td><StatusBadge s={a.status} /></td>
                            <td>
                              {a.status === "pendiente" && <button className="btn btn-success btn-sm" onClick={() => updateStatus(a.id, "confirmado")}>✓ Confirmar</button>}
                              {a.status === "confirmado" && <button className="btn btn-ghost btn-sm" onClick={() => updateStatus(a.id, "completado")}>✓ Completar</button>}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}

        {tab === "turnos" && (
          <>
            <div className="section-header">
              <div className="section-title">TODOS LOS TURNOS</div>
              <button className="btn btn-primary" onClick={() => setModal("newAppt")}>+ Nuevo Turno</button>
            </div>
            <div className="card">
              <div className="table-wrap">
                {appointments.length === 0 ? <div className="empty"><div className="empty-icon">📅</div><p>No hay turnos aún</p></div> : (
                  <table>
                    <thead><tr><th>Fecha</th><th>Hora</th><th>Cliente</th><th>Vehículo</th><th>Servicio</th><th>KM</th><th>Estado</th><th></th></tr></thead>
                    <tbody>
                      {[...appointments].sort((a,b)=>a.date.localeCompare(b.date)||a.time.localeCompare(b.time)).map(a => {
                        const cl = clients.find(c => c.id === a.clientId);
                        return (
                          <tr key={a.id}>
                            <td>{fmtDate(a.date)}</td>
                            <td>{a.time}</td>
                            <td>{cl?.name || "—"}</td>
                            <td>{a.vehiclePat}</td>
                            <td>{a.serviceName}</td>
                            <td>{a.km ? `${a.km}km` : "—"}</td>
                            <td><StatusBadge s={a.status} /></td>
                            <td style={{display:"flex",gap:"0.35rem"}}>
                              {a.status === "pendiente" && <button className="btn btn-success btn-sm" onClick={() => updateStatus(a.id, "confirmado")}>✓</button>}
                              {a.status === "confirmado" && <button className="btn btn-ghost btn-sm" onClick={() => updateStatus(a.id, "completado")}>✓</button>}
                              <button className="btn btn-danger btn-sm" onClick={() => deleteAppt(a.id)}>✕</button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </>
        )}

        {tab === "clientes" && (
          <>
            <div className="section-header">
              <div className="section-title">CLIENTES</div>
              <button className="btn btn-primary" onClick={() => setModal("newClient")}>+ Nuevo Cliente</button>
            </div>
            <div className="card">
              <div className="table-wrap">
                {clients.length === 0 ? <div className="empty"><div className="empty-icon">👥</div><p>No hay clientes aún</p></div> : (
                  <table>
                    <thead><tr><th>Nombre</th><th>Teléfono</th><th>Vehículos</th><th>Turnos</th><th></th></tr></thead>
                    <tbody>
                      {clients.map(c => (
                        <tr key={c.id}>
                          <td><strong>{c.name}</strong></td>
                          <td>{c.phone}</td>
                          <td>{c.vehicles.map(v => v.patent).join(", ")}</td>
                          <td>{appointments.filter(a => a.clientId === c.id).length}</td>
                          <td style={{display:"flex",gap:"0.35rem"}}>
                            <button className="btn btn-ghost btn-sm" onClick={() => { setSelected(c); setModal("viewClient"); }}>Ver</button>
                            <button className="whatsapp-btn" style={{padding:"0.35rem 0.75rem",fontSize:"0.8rem"}} onClick={() => sendWhatsApp(c, `Hola ${c.name.split(" ")[0]}! Te escribimos del Lubricentro. ¿Cómo podemos ayudarte?`)}>
                              💬 WA
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </>
        )}

        {tab === "recordatorios" && (
          <>
            <div className="section-title" style={{marginBottom:"1rem"}}>RECORDATORIOS DE ACEITE</div>
            {reminders.length === 0 ? (
              <div className="alert alert-green">✅ No hay clientes pendientes de recordatorio de aceite.</div>
            ) : (
              <div className="alert alert-orange">⚠️ {reminders.length} cliente{reminders.length>1?"s":""} hace más de 6 meses que no cambia el aceite.</div>
            )}
            {reminders.map(r => {
              const cl = r.client;
              const msg = `Hola ${cl?.name?.split(" ")[0] || ""}! 👋 Te recordamos desde el Lubricentro que tu ${r.vehicleDesc} ya cumplió 6 meses desde el último cambio de aceite (${fmtDate(r.date)}). ¡Te esperamos para mantener tu motor en perfectas condiciones! 🔧`;
              return (
                <div key={r.id} className="reminder-item">
                  <div className="reminder-left">
                    <h4>🚗 {cl?.name || "—"} — {r.vehicleDesc}</h4>
                    <p>Último aceite: {fmtDate(r.date)} · Patente: {r.vehiclePat}</p>
                  </div>
                  <button className="whatsapp-btn" onClick={() => sendWhatsApp(cl, msg)}>
                    💬 Enviar WhatsApp
                  </button>
                </div>
              );
            })}
          </>
        )}
      </div>

      {modal === "newAppt" && (
        <NewApptModal
          clients={clients}
          appointments={appointments}
          onSave={async (appt) => { await persistAppts([...appointments, appt]); setModal(null); }}
          onClose={() => setModal(null)}
        />
      )}
      {modal === "newClient" && (
        <NewClientModal
          onSave={async (cl) => { await persistClients([...clients, cl]); setModal(null); }}
          onClose={() => setModal(null)}
        />
      )}
      {modal === "viewClient" && selected && (
        <ViewClientModal
          client={selected}
          appointments={appointments.filter(a => a.clientId === selected.id)}
          onClose={() => { setModal(null); setSelected(null); }}
        />
      )}
    </div>
  );
}

// ===================== CLIENT APP =====================
function ClientApp({ onBack }) {
  const [step, setStep] = useState("identify"); // identify | home | book | myAppts
  const [client, setClient] = useState(null);
  const [clients, setClients] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    (async () => {
      const c = await load("lubi_clients", DEMO_CLIENTS);
      const a = await load("lubi_appointments", DEMO_APPOINTMENTS);
      setClients(c);
      setAppointments(a);
      setLoaded(true);
    })();
  }, []);

  const identify = () => {
    if (!phone.trim()) { setError("Ingresá tu número de teléfono"); return; }
    const found = clients.find(c => c.phone === phone.trim());
    if (found) {
      setClient(found);
      setStep("home");
      setError("");
    } else {
      if (!name.trim()) { setError("No encontramos tu número. Ingresá tu nombre para registrarte."); return; }
      const newClient = { id: genId(), name: name.trim(), phone: phone.trim(), email: "", vehicles: [] };
      const updated = [...clients, newClient];
      save("lubi_clients", updated);
      setClients(updated);
      setClient(newClient);
      setStep("home");
      setError("");
    }
  };

  const myAppts = appointments.filter(a => a.clientId === client?.id);

  if (!loaded) return <div className="content" style={{paddingTop:"3rem",textAlign:"center",color:"var(--muted)"}}>Cargando...</div>;

  return (
    <div className="app">
      <div className="topbar">
        <div className="topbar-brand">LUBI<span>CENTRO</span></div>
        <div className="topbar-right">
          {client && <span style={{color:"var(--muted)",fontSize:"0.85rem"}}>👤 {client.name.split(" ")[0]}</span>}
          <button className="back-btn" onClick={onBack}>← Inicio</button>
        </div>
      </div>

      {step === "identify" && (
        <div className="content" style={{maxWidth:420,paddingTop:"2.5rem"}}>
          <h2 style={{fontFamily:"Bebas Neue",fontSize:"2rem",letterSpacing:"1px",marginBottom:"0.5rem"}}>BIENVENIDO</h2>
          <p style={{color:"var(--muted)",marginBottom:"1.5rem",fontSize:"0.9rem"}}>Ingresá tu número para ver tus turnos o sacar uno nuevo.</p>
          {error && <div className="alert alert-orange">⚠️ {error}</div>}
          <div className="form-group">
            <label className="form-label">Teléfono (sin 0 ni 15)</label>
            <input className="form-input" placeholder="Ej: 1155443322" value={phone} onChange={e=>setPhone(e.target.value)} onKeyDown={e=>e.key==="Enter"&&identify()} />
          </div>
          <div className="form-group">
            <label className="form-label">Nombre (si es tu primera vez)</label>
            <input className="form-input" placeholder="Tu nombre completo" value={name} onChange={e=>setName(e.target.value)} onKeyDown={e=>e.key==="Enter"&&identify()} />
          </div>
          <button className="btn btn-primary" style={{width:"100%",justifyContent:"center",marginTop:"0.5rem"}} onClick={identify}>Ingresar →</button>
        </div>
      )}

      {step === "home" && (
        <div className="content" style={{paddingTop:"2rem"}}>
          <h2 style={{fontFamily:"Bebas Neue",fontSize:"2rem",marginBottom:"0.5rem"}}>HOLA, {client.name.split(" ")[0].toUpperCase()} 👋</h2>
          <p style={{color:"var(--muted)",marginBottom:"2rem"}}>¿Qué querés hacer hoy?</p>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(200px,1fr))",gap:"1rem",maxWidth:600}}>
            <div className="landing-card" onClick={() => setStep("book")}>
              <div className="landing-card-icon">📅</div>
              <h3>SACAR TURNO</h3>
              <p>Elegí servicio, día y horario</p>
            </div>
            <div className="landing-card" onClick={() => setStep("myAppts")}>
              <div className="landing-card-icon">🔧</div>
              <h3>MIS TURNOS</h3>
              <p>Ver historial y próximos turnos</p>
            </div>
          </div>
        </div>
      )}

      {step === "book" && (
        <BookingFlow
          client={client}
          clients={clients}
          appointments={appointments}
          onSave={async (appt, updatedClients) => {
            const updated = [...appointments, appt];
            await save("lubi_appointments", updated);
            setAppointments(updated);
            if (updatedClients) { await save("lubi_clients", updatedClients); setClients(updatedClients); }
            setSuccess("¡Turno reservado!");
            setStep("myAppts");
          }}
          onBack={() => setStep("home")}
        />
      )}

      {step === "myAppts" && (
        <div className="content">
          {success && <div className="alert alert-green">✅ {success}</div>}
          <div className="section-header">
            <div className="section-title">MIS TURNOS</div>
            <button className="btn btn-primary" onClick={() => { setSuccess(""); setStep("book"); }}>+ Nuevo Turno</button>
          </div>
          {myAppts.length === 0 ? (
            <div className="empty"><div className="empty-icon">📋</div><p>No tenés turnos aún. ¡Sacá tu primer turno!</p></div>
          ) : (
            <div style={{display:"flex",flexDirection:"column",gap:"0.75rem"}}>
              {[...myAppts].sort((a,b)=>b.date.localeCompare(a.date)).map(a => (
                <div key={a.id} className="card" style={{display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:"0.75rem"}}>
                  <div>
                    <div style={{fontWeight:600,marginBottom:"0.25rem"}}>{a.serviceName}</div>
                    <div style={{color:"var(--muted)",fontSize:"0.85rem"}}>📅 {fmtDate(a.date)} a las {a.time} · 🚗 {a.vehicleDesc}</div>
                    {a.km && <div style={{color:"var(--muted)",fontSize:"0.8rem"}}>KM: {a.km}</div>}
                  </div>
                  <StatusBadge s={a.status} />
                </div>
              ))}
            </div>
          )}
          <button className="btn btn-ghost" style={{marginTop:"1.5rem"}} onClick={() => setStep("home")}>← Volver</button>
        </div>
      )}
    </div>
  );
}

// ===================== BOOKING FLOW =====================
function BookingFlow({ client, clients, appointments, onSave, onBack }) {
  const [bStep, setBStep] = useState(1);
  const [service, setService] = useState(null);
  const [date, setDate] = useState(fmt(today));
  const [time, setTime] = useState("");
  const [patent, setPatent] = useState(client.vehicles[0]?.patent || "");
  const [brand, setBrand] = useState(client.vehicles[0]?.brand || "");
  const [model, setModel] = useState(client.vehicles[0]?.model || "");
  const [year, setYear] = useState(client.vehicles[0]?.year || "");
  const [km, setKm] = useState("");

  const takenTimes = appointments.filter(a => a.date === date).map(a => a.time);

  const book = async () => {
    if (!patent || !brand || !model) return;
    const svc = SERVICES.find(s => s.id === service);
    const appt = { id: genId(), clientId: client.id, vehiclePat: patent, vehicleDesc: `${brand} ${model} ${year}`, date, time, service, serviceName: svc.name, status: "pendiente", km, notes: "" };
    let updatedClients = null;
    if (!client.vehicles.find(v => v.patent === patent)) {
      const updatedVehicles = [...client.vehicles, { id: genId(), patent, brand, model, year }];
      updatedClients = clients.map(c => c.id === client.id ? { ...c, vehicles: updatedVehicles } : c);
    }
    await onSave(appt, updatedClients);
  };

  return (
    <div className="content" style={{maxWidth:560}}>
      <div style={{display:"flex",alignItems:"center",gap:"0.75rem",marginBottom:"1.5rem"}}>
        <button className="back-btn" onClick={onBack}>← Volver</button>
        <h2 style={{fontFamily:"Bebas Neue",fontSize:"1.8rem",letterSpacing:"1px"}}>SACAR TURNO</h2>
      </div>

      {/* STEP 1: SERVICE */}
      <div className="card" style={{marginBottom:"1rem",opacity:bStep>=1?1:0.4}}>
        <div className="step-title"><span className="step-num">1</span> Elegí el servicio</div>
        <div className="service-grid">
          {SERVICES.map(s => (
            <div key={s.id} className={`service-card${service===s.id?" selected":""}`} onClick={() => { setService(s.id); if(bStep<2) setBStep(2); }}>
              <div className="service-card-name">{s.name}</div>
              <div className="service-card-price">{s.price}</div>
              <div className="service-card-dur">{s.duration}</div>
            </div>
          ))}
        </div>
      </div>

      {/* STEP 2: DATE & TIME */}
      {bStep >= 2 && (
        <div className="card" style={{marginBottom:"1rem"}}>
          <div className="step-title"><span className="step-num">2</span> Elegí el día y horario</div>
          <div className="form-group">
            <label className="form-label">Fecha</label>
            <input type="date" className="form-input" value={date} min={fmt(today)} onChange={e=>{setDate(e.target.value);setTime("");}} />
          </div>
          <div className="form-group">
            <label className="form-label">Horario disponible</label>
            <div className="time-grid">
              {HOURS.map(h => {
                const taken = takenTimes.includes(h);
                return <button key={h} className={`time-btn${time===h?" selected":""}${taken?" taken":""}`} disabled={taken} onClick={() => { setTime(h); setBStep(3); }}>{h}</button>;
              })}
            </div>
          </div>
        </div>
      )}

      {/* STEP 3: VEHICLE */}
      {bStep >= 3 && (
        <div className="card" style={{marginBottom:"1rem"}}>
          <div className="step-title"><span className="step-num">3</span> Tu vehículo</div>
          {client.vehicles.length > 0 && (
            <div className="form-group">
              <label className="form-label">Vehículos guardados</label>
              <select className="form-input" value={patent} onChange={e => {
                const v = client.vehicles.find(v => v.patent === e.target.value);
                if (v) { setPatent(v.patent); setBrand(v.brand); setModel(v.model); setYear(v.year); }
                else { setPatent(""); setBrand(""); setModel(""); setYear(""); }
              }}>
                {client.vehicles.map(v => <option key={v.id} value={v.patent}>{v.brand} {v.model} — {v.patent}</option>)}
                <option value="">+ Agregar vehículo nuevo</option>
              </select>
            </div>
          )}
          <div className="form-row">
            <div className="form-group"><label className="form-label">Patente</label><input className="form-input" value={patent} onChange={e=>setPatent(e.target.value.toUpperCase())} placeholder="AB123CD" /></div>
            <div className="form-group"><label className="form-label">Año</label><input className="form-input" value={year} onChange={e=>setYear(e.target.value)} placeholder="2020" /></div>
          </div>
          <div className="form-row">
            <div className="form-group"><label className="form-label">Marca</label><input className="form-input" value={brand} onChange={e=>setBrand(e.target.value)} placeholder="Volkswagen" /></div>
            <div className="form-group"><label className="form-label">Modelo</label><input className="form-input" value={model} onChange={e=>setModel(e.target.value)} placeholder="Gol" /></div>
          </div>
          <div className="form-group"><label className="form-label">Kilómetros actuales</label><input className="form-input" value={km} onChange={e=>setKm(e.target.value)} placeholder="Ej: 85000" /></div>
        </div>
      )}

      {/* CONFIRM */}
      {bStep >= 3 && service && time && patent && brand && model && (
        <div className="card" style={{marginBottom:"1rem",background:"rgba(249,115,22,0.05)",border:"1px solid rgba(249,115,22,0.3)"}}>
          <div className="card-title">RESUMEN</div>
          <div style={{display:"grid",gap:"0.4rem",fontSize:"0.9rem"}}>
            <div>🔧 <strong>{SERVICES.find(s=>s.id===service)?.name}</strong></div>
            <div>📅 <strong>{fmtDate(date)}</strong> a las <strong>{time}</strong></div>
            <div>🚗 <strong>{brand} {model} {year}</strong> — {patent}</div>
            {km && <div>📏 {km} km</div>}
          </div>
          <button className="btn btn-primary" style={{marginTop:"1rem",width:"100%",justifyContent:"center"}} onClick={book}>
            ✅ Confirmar Turno
          </button>
        </div>
      )}
    </div>
  );
}

// ===================== MODALS =====================
function NewApptModal({ clients, appointments, onSave, onClose }) {
  const [clientId, setClientId] = useState(clients[0]?.id || "");
  const [service, setService] = useState("aceite");
  const [date, setDate] = useState(fmt(today));
  const [time, setTime] = useState("09:00");
  const [patent, setPatent] = useState("");
  const [vehicleDesc, setVehicleDesc] = useState("");
  const [km, setKm] = useState("");

  useEffect(() => {
    const cl = clients.find(c => c.id === clientId);
    if (cl?.vehicles[0]) {
      const v = cl.vehicles[0];
      setPatent(v.patent);
      setVehicleDesc(`${v.brand} ${v.model} ${v.year}`);
    }
  }, [clientId]);

  const save = () => {
    const svc = SERVICES.find(s => s.id === service);
    onSave({ id: genId(), clientId, vehiclePat: patent, vehicleDesc, date, time, service, serviceName: svc.name, status: "pendiente", km, notes: "" });
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-title">NUEVO TURNO</div>
        <div className="form-group">
          <label className="form-label">Cliente</label>
          <select className="form-input" value={clientId} onChange={e => setClientId(e.target.value)}>
            {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">Servicio</label>
          <select className="form-input" value={service} onChange={e => setService(e.target.value)}>
            {SERVICES.map(s => <option key={s.id} value={s.id}>{s.name} — {s.price}</option>)}
          </select>
        </div>
        <div className="form-row">
          <div className="form-group"><label className="form-label">Fecha</label><input type="date" className="form-input" value={date} onChange={e=>setDate(e.target.value)} /></div>
          <div className="form-group">
            <label className="form-label">Horario</label>
            <select className="form-input" value={time} onChange={e=>setTime(e.target.value)}>
              {HOURS.map(h => <option key={h} value={h}>{h}</option>)}
            </select>
          </div>
        </div>
        <div className="form-row">
          <div className="form-group"><label className="form-label">Patente</label><input className="form-input" value={patent} onChange={e=>setPatent(e.target.value.toUpperCase())} placeholder="AB123CD" /></div>
          <div className="form-group"><label className="form-label">KM</label><input className="form-input" value={km} onChange={e=>setKm(e.target.value)} placeholder="85000" /></div>
        </div>
        <div className="form-group"><label className="form-label">Descripción Vehículo</label><input className="form-input" value={vehicleDesc} onChange={e=>setVehicleDesc(e.target.value)} placeholder="VW Gol 2019" /></div>
        <div className="modal-actions">
          <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" onClick={save}>Guardar Turno</button>
        </div>
      </div>
    </div>
  );
}

function NewClientModal({ onSave, onClose }) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [patent, setPatent] = useState("");
  const [brand, setBrand] = useState("");
  const [model, setModel] = useState("");
  const [year, setYear] = useState("");

  const save = () => {
    if (!name || !phone) return;
    const cl = { id: genId(), name, phone, email: "", vehicles: patent ? [{ id: genId(), patent, brand, model, year }] : [] };
    onSave(cl);
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-title">NUEVO CLIENTE</div>
        <div className="form-row">
          <div className="form-group"><label className="form-label">Nombre</label><input className="form-input" value={name} onChange={e=>setName(e.target.value)} placeholder="Juan García" /></div>
          <div className="form-group"><label className="form-label">Teléfono</label><input className="form-input" value={phone} onChange={e=>setPhone(e.target.value)} placeholder="1155443322" /></div>
        </div>
        <hr className="divider" />
        <div style={{color:"var(--muted)",fontSize:"0.85rem",marginBottom:"0.75rem"}}>Vehículo (opcional)</div>
        <div className="form-row">
          <div className="form-group"><label className="form-label">Patente</label><input className="form-input" value={patent} onChange={e=>setPatent(e.target.value.toUpperCase())} placeholder="AB123CD" /></div>
          <div className="form-group"><label className="form-label">Año</label><input className="form-input" value={year} onChange={e=>setYear(e.target.value)} placeholder="2020" /></div>
        </div>
        <div className="form-row">
          <div className="form-group"><label className="form-label">Marca</label><input className="form-input" value={brand} onChange={e=>setBrand(e.target.value)} placeholder="Volkswagen" /></div>
          <div className="form-group"><label className="form-label">Modelo</label><input className="form-input" value={model} onChange={e=>setModel(e.target.value)} placeholder="Gol" /></div>
        </div>
        <div className="modal-actions">
          <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" onClick={save}>Guardar Cliente</button>
        </div>
      </div>
    </div>
  );
}

function ViewClientModal({ client, appointments, onClose }) {
  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-title">{client.name}</div>
        <div style={{color:"var(--muted)",marginBottom:"0.5rem",fontSize:"0.9rem"}}>📱 {client.phone}</div>
        <div style={{marginBottom:"1.25rem"}}>
          {client.vehicles.map(v => (
            <div key={v.id} style={{background:"var(--bg3)",border:"1px solid var(--border)",borderRadius:8,padding:"0.6rem 0.9rem",marginBottom:"0.5rem",fontSize:"0.9rem"}}>
              🚗 {v.brand} {v.model} {v.year} — <strong>{v.patent}</strong>
            </div>
          ))}
        </div>
        <div className="card-title" style={{marginBottom:"0.75rem"}}>HISTORIAL DE SERVICIOS</div>
        {appointments.length === 0 ? <div style={{color:"var(--muted)",fontSize:"0.9rem"}}>Sin turnos aún.</div> :
          appointments.sort((a,b)=>b.date.localeCompare(a.date)).map(a => (
            <div key={a.id} style={{borderBottom:"1px solid var(--border)",paddingBottom:"0.6rem",marginBottom:"0.6rem",fontSize:"0.9rem"}}>
              <div><strong>{a.serviceName}</strong> <StatusBadge s={a.status} /></div>
              <div style={{color:"var(--muted)",fontSize:"0.8rem"}}>📅 {fmtDate(a.date)} {a.time} · {a.vehicleDesc} {a.km?`· ${a.km}km`:""}</div>
            </div>
          ))
        }
        <div className="modal-actions"><button className="btn btn-ghost" onClick={onClose}>Cerrar</button></div>
      </div>
    </div>
  );
}

// ===================== HELPERS =====================
function StatusBadge({ s }) {
  const map = { pendiente: ["badge-yellow","⏳ Pendiente"], confirmado: ["badge-orange","✅ Confirmado"], completado: ["badge-green","🔧 Completado"], cancelado: ["badge-red","❌ Cancelado"] };
  const [cls, label] = map[s] || ["badge-yellow", s];
  return <span className={`badge ${cls}`}>{label}</span>;
}

function fmtDate(str) {
  if (!str) return "";
  const [y, m, d] = str.split("-");
  return `${d}/${m}/${y}`;
}

// ===================== MAIN =====================
export default function App() {
  const [view, setView] = useState("landing"); // landing | admin | client

  return (
    <>
      <style>{styles}</style>
      {view === "landing" && (
        <div className="landing">
          <div className="landing-logo">LUBI<span>CENTRO</span></div>
          <div className="landing-sub">Sistema de gestión de lubricentro</div>
          <div className="landing-cards">
            <div className="landing-card" onClick={() => setView("admin")}>
              <div className="landing-card-icon">⚙️</div>
              <h3>ADMINISTRAR</h3>
              <p>Panel del lubricentro</p>
            </div>
            <div className="landing-card" onClick={() => setView("client")}>
              <div className="landing-card-icon">🚗</div>
              <h3>SOY CLIENTE</h3>
              <p>Sacá un turno o revisá el tuyo</p>
            </div>
          </div>
          <p style={{marginTop:"2.5rem",color:"var(--muted)",fontSize:"0.8rem"}}>
            Clientes: compartí el link a "Soy Cliente" con tus clientes
          </p>
        </div>
      )}
      {view === "admin" && <AdminApp onBack={() => setView("landing")} />}
      {view === "client" && <ClientApp onBack={() => setView("landing")} />}
    </>
  );
}
