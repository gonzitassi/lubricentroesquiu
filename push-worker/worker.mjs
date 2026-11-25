import webpush from "web-push";

const recentMs = 10 * 60 * 1000;
const maxDevices = 10;
const idPattern = /^[\w-]{1,128}$/;

function appleEndpoint(value) {
  if (typeof value !== "string" || value.length > 2048) return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname.endsWith(".push.apple.com") &&
      !url.username && !url.password && !url.port && !url.hash && url.href === value;
  } catch (_) { return false; }
}

async function isAdmin(request, env) {
  const token = request.headers.get("Authorization")?.match(/^Bearer ([\w.-]{1,8192})$/)?.[1];
  if (!token || !env.ADMIN_UID) return false;
  try {
    const claims = JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString());
    if (claims.aud !== env.FIREBASE_PROJECT || claims.iss !== "https://securetoken.google.com/" + env.FIREBASE_PROJECT ||
        claims.sub !== env.ADMIN_UID || claims.exp <= Date.now() / 1000) return false;
  } catch (_) { return false; }
  const url = new URL("https://identitytoolkit.googleapis.com/v1/accounts:lookup");
  url.searchParams.set("key", env.FIREBASE_API_KEY);
  const result = await fetch(url, {
    method: "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify({idToken: token})
  });
  if (!result.ok) return false;
  const user = (await result.json()).users?.[0];
  return user?.localId === env.ADMIN_UID && !user.disabled;
}

async function firestoreDoc(env, path) {
  const url = "https://firestore.googleapis.com/v1/projects/" + env.FIREBASE_PROJECT +
    "/databases/(default)/documents/" + path;
  const result = await fetch(url, {cache: "no-store"});
  if (result.status === 404 || result.status === 403) return null;
  if (!result.ok) throw new Error("FIRESTORE_UNAVAILABLE");
  return result.json();
}

function recent(value, now) {
  const ms = Date.parse(value);
  return ms >= now - recentMs && ms <= now + 60_000;
}

export async function verifyBooking(env, id, now = Date.now()) {
  if (!idPattern.test(id)) return false;
  const schema = await firestoreDoc(env, "lubricentro/schema");
  if (schema?.fields?.data?.mapValue?.fields?.appointmentsV2?.booleanValue) {
    const record = await firestoreDoc(env, "appointmentRecords/" + id);
    return record?.fields?.status?.stringValue === "pendiente" &&
      recent(record.fields.requestedAt?.stringValue, now) && recent(record.createTime, now);
  }
  const legacy = await firestoreDoc(env, "lubricentro/appointments");
  return Boolean(recent(legacy?.updateTime, now) && legacy.fields?.data?.arrayValue?.values?.some(value => {
    const fields = value.mapValue?.fields;
    return fields?.id?.stringValue === id && fields.status?.stringValue === "pendiente" &&
      recent(fields.requestedAt?.stringValue, now);
  }));
}

async function deliver(env, subscription, kind, tag) {
  const details = webpush.generateRequestDetails(subscription, JSON.stringify({kind, tag}), {
    vapidDetails: {
      subject: env.VAPID_SUBJECT, publicKey: env.VAPID_PUBLIC_KEY, privateKey: env.VAPID_PRIVATE_KEY
    },
    TTL: 600, urgency: "high"
  });
  const headers = new Headers(details.headers);
  headers.delete("Content-Length");
  // Workers supports manual redirects. A redirect is a failed delivery.
  const result = await fetch(details.endpoint, {
    method: "POST", headers, body: details.body, redirect: "manual"
  });
  if (result.status === 404 || result.status === 410) {
    await env.DB.prepare("DELETE FROM devices WHERE endpoint = ?").bind(subscription.endpoint).run();
  }
  return result.ok;
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin");
    const headers = {"Cache-Control": "no-store"};
    const json = (data, status = 200) => Response.json(data, {status, headers});
    if (origin !== env.SITE_ORIGIN) return json({}, 403);
    Object.assign(headers, {
      "Access-Control-Allow-Origin": origin,
      "Vary": "Origin",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Authorization, Content-Type"
    });
    if (request.method === "OPTIONS") return new Response(null, {status: 204, headers});
    const {pathname} = new URL(request.url);
    if (request.method === "GET" && pathname === "/config") {
      return env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY && env.ADMIN_UID
        ? json({publicKey: env.VAPID_PUBLIC_KEY}) : json({}, 503);
    }
    if (request.method !== "POST") return json({}, 405);

    try {
      if (pathname === "/booking") {
        // The browser only supplies an ID. Check the stored booking before sending.
        const id = await request.text();
        if (!idPattern.test(id)) return json({}, 400);
        const devices = await env.DB.prepare("SELECT subscription FROM devices LIMIT ?").bind(maxDevices).all();
        if (!devices.results.length || !await verifyBooking(env, id)) return json({});
        const now = Date.now();
        await env.DB.prepare("DELETE FROM booking_notices WHERE expires < ?").bind(now).run();
        const claim = await env.DB.prepare("INSERT OR IGNORE INTO booking_notices (id, expires) VALUES (?, ?)").bind(id, now + 2 * recentMs).run();
        if (claim.meta.changes === 0) return json({});
        const result = await Promise.allSettled(devices.results.map(({subscription}) =>
          deliver(env, JSON.parse(subscription), "booking", "booking-" + id)));
        if (!result.some(item => item.status === "fulfilled" && item.value)) {
          await env.DB.prepare("DELETE FROM booking_notices WHERE id = ?").bind(id).run();
          return json({}, 502);
        }
        return json({});
      }

      if (!["/subscribe", "/unsubscribe", "/test"].includes(pathname)) return json({}, 404);
      if (!await isAdmin(request, env)) return json({}, 403);
      const {endpoint, keys} = await request.json();
      if (!appleEndpoint(endpoint)) return json({}, 400);
      if (pathname === "/subscribe") {
        if (typeof keys?.p256dh !== "string" || !/^[\w-]{87}$/.test(keys.p256dh) ||
            typeof keys?.auth !== "string" || !/^[\w-]{22}$/.test(keys.auth)) return json({}, 400);
        const subscription = JSON.stringify({endpoint, keys: {p256dh: keys.p256dh, auth: keys.auth}});
        const result = await env.DB.prepare(`
          INSERT INTO devices (endpoint, subscription)
          SELECT ?, ? WHERE EXISTS (SELECT 1 FROM devices WHERE endpoint = ?)
            OR (SELECT COUNT(*) FROM devices) < ?
          ON CONFLICT(endpoint) DO UPDATE SET subscription=excluded.subscription
        `).bind(endpoint, subscription, endpoint, maxDevices).run();
        return json({}, result.meta.changes ? 200 : 409);
      }
      if (pathname === "/unsubscribe") {
        await env.DB.prepare("DELETE FROM devices WHERE endpoint = ?").bind(endpoint).run();
        return json({});
      }
      const device = await env.DB.prepare("SELECT subscription FROM devices WHERE endpoint = ?").bind(endpoint).first();
      if (!device) return json({}, 404);
      return json({}, await deliver(env, JSON.parse(device.subscription), "test") ? 200 : 502);
    } catch (_) {
      return json({}, 503);
    }
  }
};
