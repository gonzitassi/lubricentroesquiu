/* Shared data operations. No write is based on the UI's cached arrays. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.Lubri = api;
})(typeof globalThis === 'object' ? globalThis : this, function () {
  'use strict';
  const clone = value => JSON.parse(JSON.stringify(value));
  function same(a, b) {
    if (a === b) return true;
    if (!a || !b || typeof a !== 'object' || typeof b !== 'object') return false;
    if (Array.isArray(a) !== Array.isArray(b)) return false;
    const keys = Object.keys(a);
    return keys.length === Object.keys(b).length && keys.every(key => Object.prototype.hasOwnProperty.call(b,key) && same(a[key],b[key]));
  }
  const fail = code => { throw new Error(code); };
  const idOK = id => typeof id === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(id);
  const textOK = (s, max = 200) => typeof s === 'string' && s.trim().length > 0 && s.length <= max;
  const patent = value => String(value || '').toUpperCase().replace(/[\s-]/g, '');
  const dateOK = value => /^\d{4}-\d{2}-\d{2}$/.test(value || '') &&
    !isNaN(Date.parse(value + 'T12:00:00Z')) && new Date(value + 'T12:00:00Z').toISOString().slice(0, 10) === value;
  function nowParts(now = new Date()) {
    const parts = Object.fromEntries(new Intl.DateTimeFormat('en-GB', {
      timeZone: 'America/Argentina/Buenos_Aires', year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
    }).formatToParts(now).map(p => [p.type, p.value]));
    return {date: `${parts.year}-${parts.month}-${parts.day}`, time: `${parts.hour}:${parts.minute}`};
  }
  const today = now => nowParts(now).date;
  function phone(value) {
    const raw = String(value || '').trim();
    if (!/^[+\d\s().-]+$/.test(raw)) return '';
    let digits = raw.replace(/\D/g, '').replace(/^00/, '');
    if (digits.startsWith('549') && digits.length === 13) return digits;
    if (digits.startsWith('54') && digits.length === 12) return '549' + digits.slice(2);
    digits = digits.replace(/^0/, '');
    return /^\d{10}$/.test(digits) ? '549' + digits : '';
  }
  const morning = ['08:00','08:30','09:00','09:30','10:00','10:30','11:00','11:30','12:00','12:30'];
  const afternoon = ['15:30','16:00','16:30','17:00','17:30','18:00','18:30'];
  function hours(date) {
    if (!dateOK(date)) return [];
    const day = new Date(date + 'T12:00:00Z').getUTCDay();
    return day === 0 ? [] : day === 6 ? [...morning] : [...morning, ...afternoon];
  }
  function slots(time, duration, date) {
    if (!Number.isInteger(duration) || duration < 1 || duration > 300) return null;
    const day = hours(date), index = day.indexOf(time), n = Math.ceil(duration / 30);
    if (index < 0 || index + n > day.length) return null;
    const result = day.slice(index, index + n);
    const mins = t => Number(t.slice(0, 2)) * 60 + Number(t.slice(3));
    return result.some((t, i) => i > 0 && mins(t) - mins(result[i - 1]) !== 30) ? null : result;
  }
  function future(date, time, now) {
    const current = nowParts(now);
    return dateOK(date) && /^\d{2}:\d{2}$/.test(time || '') &&
      (date > current.date || (date === current.date && time > current.time));
  }
  function kilometres(value, required = false) {
    if (value === '' || value == null) return !required;
    return /^\d{1,8}$/.test(String(value)) && Number.isSafeInteger(Number(value));
  }
  function validateClient(c) {
    if (!c || !idOK(c.id) || !textOK(c.name) || !/^[A-Z0-9]{5,10}$/.test(c.patent || '') ||
      !phone(c.whatsapp) || !['auto','camion'].includes(c.vehicleType) ||
      !textOK(c.brand) || !textOK(c.model) || !textOK(c.motor) ||
      !/^\d{4}$/.test(String(c.year)) || Number(c.year) < 1900 || Number(c.year) > Number(today().slice(0,4)) + 1) fail('INVALID_CLIENT');
  }
  function validateService(s) {
    if (!s || !idOK(s.id) || !textOK(s.name) || !textOK(s.price, 50) ||
      ![30,60,90,120].includes(s.duration) || !['auto','camion'].includes(s.type || 'auto')) fail('INVALID_SERVICE');
  }
  function validateAppointment(a) {
    if (!a || !idOK(a.id) || !idOK(a.clientId) || !idOK(a.service) || !dateOK(a.date) ||
      !/^([01]\d|2[0-3]):[0-5]\d$/.test(a.time || '') || !textOK(a.serviceName) ||
      !['pendiente','confirmado','completado','cancelado'].includes(a.status) || !kilometres(a.km) ||
      (a.pit != null && !['auto','camion'].includes(a.pit)) ||
      (a.blockedSlots != null && (!Array.isArray(a.blockedSlots) || !a.blockedSlots.length ||
        a.blockedSlots.some(t => !hours(a.date).includes(t)))) ||
      (a.nextDate && !dateOK(a.nextDate)) || (a.nextKm != null && !kilometres(a.nextKm)) ||
      (a.notes != null && (typeof a.notes !== 'string' || a.notes.length > 10000)) ||
      (a.checklist != null && (typeof a.checklist !== 'object' || Array.isArray(a.checklist) ||
        Object.values(a.checklist).some(s => ![null,'done','skip'].includes(s))))) fail('INVALID_APPOINTMENT');
  }
  function validateBackup(backup) {
    if (!backup || backup.format !== 'lubricentro-esquiu-backup' || backup.version !== 1 ||
      backup.project !== 'lubricentroesquiu-1759a' || !dateOK(String(backup.exportedAt).slice(0,10))) fail('INVALID_BACKUP');
    const data = backup.data;
    if (!data || !['clients','appointments','services'].every(k => Array.isArray(data[k]))) fail('INVALID_BACKUP');
    for (const [key, validate] of [['clients',validateClient],['appointments',validateAppointment],['services',validateService]]) {
      data[key].forEach(validate);
      if (new Set(data[key].map(x => x.id)).size !== data[key].length) fail('INVALID_BACKUP');
    }
    if (new Set(data.clients.map(c => c.patent)).size !== data.clients.length ||
      data.appointments.some(a => !data.clients.some(c => c.id === a.clientId))) fail('INVALID_BACKUP');
    if (!data.notified || typeof data.notified !== 'object' || Array.isArray(data.notified) ||
      Object.entries(data.notified).some(([key, v]) => !/^[A-Za-z0-9_-]{1,160}$/.test(key) ||
        !v || !Number.isFinite(v.ts) || v.ts < 0)) fail('INVALID_BACKUP');
    return clone(data);
  }
  const messages = {
    SLOT_TAKEN: 'Ese horario ya fue reservado. Elegí otro.',
    PAST_DATE: 'Elegí una fecha y un horario futuros.',
    INVALID_CLIENT: 'Revisá patente, WhatsApp, año y los datos del vehículo.',
    DUPLICATE_PATENT: 'Ya existe otro cliente con esa patente.',
    INVALID_SERVICE: 'Revisá el nombre, precio y duración del servicio.',
    INVALID_APPOINTMENT: 'Revisá los datos del turno y el kilometraje.',
    NOT_FOUND: 'El registro ya no existe. Actualizá la pantalla.',
    CONFLICT: 'El registro cambió en otra sesión. Actualizá y volvé a intentarlo.',
    INVALID_BACKUP: 'El backup tiene datos inválidos o no pertenece a este lubricentro.',
    TOO_LARGE: 'La operación supera el tamaño seguro. No se modificó ningún dato; requiere una restauración asistida.',
    TOO_BUSY: 'Hay otros cambios en curso. Intentá nuevamente.',
    OFFLINE: 'No se pudieron obtener datos actualizados. Revisá tu conexión.',
    LEGACY_CHANGED: 'La base cambió durante la operación. Intentá nuevamente.'
  };
  const message = error => messages[error?.message] || 'No se pudo guardar o cargar. Revisá tu conexión y tus permisos.';

  function createStore(db, defaults = [], options = {}) {
    const ref = key => db.collection('lubricentro').doc(key);
    const guardRef = options.coordinated ? db.collection('systemLocks').doc('writes') : null;
    const serverGet = async r => {
      const snap = await r.get({source:'server'});
      if (snap.metadata?.fromCache) fail('OFFLINE');
      return snap;
    };
    const docValue = snap => snap.exists ? snap.data() : null;
    const dataValue = (raw, fallback) => raw?.data == null ? clone(fallback) : clone(raw.data);
    const recordList = snap => snap.docs.map(d => ({...d.data(), id:d.id}));
    async function snapshot() {
      for (let attempt = 0; attempt < 6; attempt++) {
        // All updated clients coordinate through one version document. Reading the
        // guard before the queries prevents a query/transaction race in the web SDK.
        const before = options.coordinated ? docValue(await serverGet(guardRef)) : null;
        const schemaRaw = docValue(await serverGet(ref('schema')));
        const schema = dataValue(schemaRaw, {});
        const keys = ['schema','services', ...(!options.public ? ['notified'] : []),
          ...(!schema.clientsV2 ? ['clients'] : []), ...(!schema.appointmentsV2 ? ['appointments'] : [])];
        const entries = await Promise.all(keys.map(async k => [k,docValue(await serverGet(ref(k)))]));
        const raw = Object.fromEntries(entries);
        if (!same(raw.schema,schemaRaw)) continue;
        const [clients, appointments] = await Promise.all([
          schema.clientsV2 ? serverGet(db.collection('clientRecords')).then(recordList) : dataValue(raw.clients, []),
          schema.appointmentsV2 ? serverGet(db.collection('appointmentRecords')).then(recordList) : dataValue(raw.appointments, [])
        ]);
        const after = options.coordinated ? docValue(await serverGet(guardRef)) : null;
        if (!same(before, after)) continue;
        const data = {clients, appointments, services:dataValue(raw.services, defaults), notified:dataValue(raw.notified, {})};
        // Some historical versions stored an empty array for notification marks.
        if (Array.isArray(data.notified) && data.notified.length === 0) data.notified = {};
        if (!['clients','appointments','services'].every(k => Array.isArray(data[k])) ||
          !data.notified || typeof data.notified !== 'object' || Array.isArray(data.notified)) fail('INVALID_BACKUP');
        return {data, raw, schema, guard:after, keys};
      }
      fail('TOO_BUSY');
    }
    function diffCollection(collection, before, after) {
      const old = new Map(before.map(x => [x.id, x])), next = new Map(after.map(x => [x.id, x]));
      const ops = [];
      for (const item of after) {
        if (!idOK(item.id)) fail('INVALID_BACKUP');
        if (!same(old.get(item.id), item)) ops.push({ref:db.collection(collection).doc(item.id), value:item});
      }
      for (const item of before) if (!next.has(item.id)) ops.push({ref:db.collection(collection).doc(item.id), remove:true});
      return ops;
    }
    async function mutate(change, expected = null) {
      for (let attempt = 0; attempt < 6; attempt++) {
        const base = await snapshot();
        if (expected && !same(base.data, expected)) fail('CONFLICT');
        const next = clone(base.data);
        change(next);
        const ops = [];
        for (const key of ['clients','appointments','services','notified']) {
          if (same(base.data[key],next[key])) continue;
          if (key === 'clients' && base.schema.clientsV2) ops.push(...diffCollection('clientRecords',base.data[key],next[key]));
          else if (key === 'appointments' && base.schema.appointmentsV2) ops.push(...diffCollection('appointmentRecords',base.data[key],next[key]));
          else ops.push({ref:ref(key),value:{...base.raw[key],data:next[key]}});
        }
        if (!ops.length && same(base.data,next)) return next;
        if (ops.length + (options.coordinated ? 1 : 0) > 450) fail('TOO_LARGE');
        try {
          await db.runTransaction(async tx => {
            const guard = options.coordinated ? docValue(await tx.get(guardRef)) : null;
            const current = await Promise.all(base.keys.map(k => tx.get(ref(k))));
            if (!same(guard,base.guard) || current.some((s,i) => !same(docValue(s),base.raw[base.keys[i]]))) fail('LEGACY_CHANGED');
            // In compatibility mode existing rules still protect writes. Verify
            // touched documents as well as referenced clients before committing.
            // This preserves concurrent edits, but cannot lock unseen new records;
            // fully serializable reservations require coordinated mode and its rule.
            const watched = new Map();
            for (const op of ops) {
              const key = op.ref.path?.startsWith('clientRecords/') ? 'clients' :
                op.ref.path?.startsWith('appointmentRecords/') ? 'appointments' : null;
              if (key) watched.set(op.ref.path,{ref:op.ref,expected:base.data[key].find(x => x.id === op.ref.id)});
            }
            if (base.schema.clientsV2) {
              for (const appt of next.appointments) {
                if (base.data.appointments.some(a => a.id === appt.id)) continue;
                const clientRef = db.collection('clientRecords').doc(appt.clientId);
                watched.set(clientRef.path,{ref:clientRef,expected:base.data.clients.find(c => c.id === appt.clientId)});
              }
            }
            for (const {ref:record,expected} of watched.values()) {
              const snap = await tx.get(record);
              const actual = snap.exists ? {...snap.data(),id:snap.id} : undefined;
              if (!same(actual,expected)) fail('LEGACY_CHANGED');
            }
            for (const op of ops) op.remove ? tx.delete(op.ref) : tx.set(op.ref,op.value);
            if (options.coordinated) tx.set(guardRef, {revision:(base.guard?.revision || 0) + 1});
          });
          return next;
        } catch (error) {
          if (error.message !== 'LEGACY_CHANGED') throw error;
        }
      }
      fail('TOO_BUSY');
    }
    const checkExpected = (current, expected) => { if (!current) fail('NOT_FOUND'); if (expected && !same(current,expected)) fail('CONFLICT'); };
    return {
      snapshot,
      read: async () => (await snapshot()).data,
      async saveClient(client, expected = null) {
        validateClient(client);
        return mutate(data => {
          if (data.clients.some(c => c.patent === client.patent && c.id !== client.id)) fail('DUPLICATE_PATENT');
          const current = data.clients.find(c => c.id === client.id);
          if (expected) checkExpected(current,expected);
          else if (current) fail('CONFLICT');
          data.clients = current ? data.clients.map(c => c.id === client.id ? clone(client) : c) : [...data.clients,clone(client)];
        });
      },
      async reserve(appt) {
        validateAppointment(appt);
        return mutate(data => {
          if (!future(appt.date,appt.time)) fail('PAST_DATE');
          const client = data.clients.find(c => c.id === appt.clientId), svc = data.services.find(s => s.id === appt.service);
          if (!client || !svc) fail('NOT_FOUND');
          if ((svc.type || 'auto') !== (client.vehicleType || 'auto')) fail('INVALID_APPOINTMENT');
          const required = slots(appt.time,svc.duration || 30,appt.date), pit = svc.type || 'auto';
          if (!required) fail('INVALID_APPOINTMENT');
          if (data.appointments.some(a => a.id === appt.id)) fail('CONFLICT');
          const taken = data.appointments.filter(a => a.date === appt.date && a.status !== 'cancelado' && (a.pit || 'auto') === pit)
            .flatMap(a => a.blockedSlots || slots(a.time,data.services.find(s => s.id === a.service)?.duration || 30,a.date) || [a.time]);
          if (required.some(t => taken.includes(t))) fail('SLOT_TAKEN');
          data.appointments.push({...clone(appt),serviceName:svc.name,pit,blockedSlots:required});
        });
      },
      updateAppointment(id, patch, expected) {
        return mutate(data => {
          const appt = data.appointments.find(a => a.id === id);
          checkExpected(appt,expected);
          const next = {...appt,...patch};
          validateAppointment(next);
          data.appointments = data.appointments.map(a => a.id === id ? next : a);
        });
      },
      deleteAppointment(id, expected) {
        return mutate(data => { checkExpected(data.appointments.find(a => a.id === id),expected); data.appointments = data.appointments.filter(a => a.id !== id); });
      },
      deleteClient(id, expected) {
        return mutate(data => { checkExpected(data.clients.find(c => c.id === id),expected); data.clients = data.clients.filter(c => c.id !== id); data.appointments = data.appointments.filter(a => a.clientId !== id); });
      },
      saveService(service, expected) {
        validateService(service);
        return mutate(data => {
          const current = data.services.find(s => s.id === service.id);
          if (expected) checkExpected(current,expected); else if (current) fail('CONFLICT');
          data.services = current ? data.services.map(s => s.id === service.id ? clone(service) : s) : [...data.services,clone(service)];
        });
      },
      deleteService(id, expected) {
        return mutate(data => { checkExpected(data.services.find(s => s.id === id),expected); data.services = data.services.filter(s => s.id !== id); });
      },
      markNotified(key) {
        if (!/^[A-Za-z0-9_-]{1,160}$/.test(key)) fail('INVALID_BACKUP');
        return mutate(data => { data.notified[key] = {ts:Date.now()}; });
      },
      restore(backup, expected) {
        const verified = validateBackup(backup);
        return mutate(data => Object.assign(data,verified), expected);
      },
      async migrate(expected) {
        const base = await snapshot();
        if (expected && !same(base.data,expected)) fail('CONFLICT');
        if (base.schema.clientsV2 && base.schema.appointmentsV2) return base.data;
        const ops = [];
        for (const [key,col,flag] of [['clients','clientRecords','clientsV2'],['appointments','appointmentRecords','appointmentsV2']]) {
          if (base.schema[flag]) continue;
          const target = await serverGet(db.collection(col));
          // Never delete or silently overwrite a previous partial migration.
          const existing = recordList(target);
          if (existing.some(item => !base.data[key].some(x => x.id === item.id && same(x,item)))) fail('CONFLICT');
          ops.push(...diffCollection(col,existing,base.data[key]));
        }
        if (ops.length + 2 > 450) fail('TOO_LARGE');
        await db.runTransaction(async tx => {
          const guard = options.coordinated ? docValue(await tx.get(guardRef)) : null;
          const current = await Promise.all(base.keys.map(k => tx.get(ref(k))));
          if (!same(guard,base.guard) || current.some((s,i) => !same(docValue(s),base.raw[base.keys[i]]))) fail('CONFLICT');
          // Verify destination documents too; their contents were read before this transaction.
          const targets = await Promise.all(ops.map(op => tx.get(op.ref)));
          if (targets.some(s => s.exists)) fail('CONFLICT');
          ops.forEach(op => tx.set(op.ref,op.value));
          tx.set(ref('schema'), {data:{...base.schema,clientsV2:true,appointmentsV2:true,migratedAt:new Date().toISOString()}});
          if (options.coordinated) tx.set(guardRef, {revision:(base.guard?.revision || 0)+1});
        });
        return base.data;
      }
    };
  }
  return {clone, same, idOK, dateOK, today, nowParts, phone, patent, hours, slots, future, kilometres,
    validateClient,validateAppointment,validateBackup,createStore,message};
});
