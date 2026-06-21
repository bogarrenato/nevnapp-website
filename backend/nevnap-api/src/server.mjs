import http from "node:http";
import { URL } from "node:url";
import {
  getHealthSummary,
  initDb,
  registerDeviceRecord,
  storeInboundEvent,
  unregisterDeviceRecord,
  updateSubscriptionRecord,
} from "./database.mjs";

const port = Number(process.env.PORT || 5201);
const maxBodyBytes = Number(process.env.MAX_BODY_BYTES || 1024 * 1024);
const upstreamApiBaseUrl = (process.env.UPSTREAM_API_BASE_URL || "").replace(/\/+$/, "");

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type,Authorization",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  };
}

function sendJson(res, statusCode, body) {
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    ...corsHeaders(),
  });
  res.end(JSON.stringify(body));
}

function normalizePlatform(platform, token = "") {
  const value = String(platform || "").trim().toUpperCase();
  if (["APNS", "IOS", "APNS_SANDBOX"].includes(value)) return "APNS";
  if (["FCM", "GCM", "ANDROID"].includes(value)) return "FCM";
  if (/^[0-9a-fA-F]{64}$/.test(token)) return "APNS";
  return "FCM";
}

function validateDeviceToken(deviceToken, platform) {
  if (!deviceToken || typeof deviceToken !== "string") {
    return "Hiányzó deviceToken paraméter";
  }

  if (platform === "APNS" && !/^[0-9a-fA-F]{64}$/.test(deviceToken)) {
    return "Invalid parameter: Token Reason: APNS token hossza 64 hex karakter kell legyen";
  }

  if (platform === "FCM" && deviceToken.length < 20) {
    return `Invalid parameter: Token Reason: FCM token túl rövid: ${deviceToken.length} karakter`;
  }

  return null;
}

function routeName(pathname) {
  const parts = pathname.split("/").filter(Boolean);
  return parts[parts.length - 1] || "";
}

async function forwardUpstream(endpoint, body) {
  if (!upstreamApiBaseUrl) {
    return { skipped: true, ok: true, statusCode: 200, body: {} };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);

  try {
    const response = await fetch(`${upstreamApiBaseUrl}/${endpoint}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body || {}),
      signal: controller.signal,
    });
    const text = await response.text();
    let parsed = {};

    if (text) {
      try {
        parsed = JSON.parse(text);
      } catch {
        parsed = { message: text };
      }
    }

    return {
      skipped: false,
      ok: response.ok,
      statusCode: response.status,
      body: parsed,
    };
  } catch (error) {
    return {
      skipped: false,
      ok: false,
      statusCode: error.name === "AbortError" ? 504 : 502,
      body: {
        error: "UPSTREAM_HIBA",
        message: error.message,
      },
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function readJsonBody(req) {
  const chunks = [];
  let size = 0;

  for await (const chunk of req) {
    size += chunk.length;
    if (size > maxBodyBytes) {
      throw Object.assign(new Error("Request body túl nagy"), { statusCode: 413 });
    }
    chunks.push(chunk);
  }

  if (!chunks.length) return {};
  const raw = Buffer.concat(chunks).toString("utf8");
  if (!raw.trim()) return {};

  try {
    return JSON.parse(raw);
  } catch (error) {
    throw Object.assign(new Error(`Érvénytelen JSON a kérésben: ${error.message}`), {
      statusCode: 400,
    });
  }
}

async function handleRegister(req, res) {
  const body = await readJsonBody(req);
  const deviceToken = body.deviceToken;
  const platform = normalizePlatform(body.platform, deviceToken);
  const validationError = validateDeviceToken(deviceToken, platform);

  if (validationError) {
    return sendJson(res, 400, {
      error: "Hiba az eszköz regisztrálása során",
      message: validationError,
    });
  }

  const upstream = await forwardUpstream("register-device", body);
  if (!upstream.ok) {
    return sendJson(res, upstream.statusCode, upstream.body);
  }

  const record = await registerDeviceRecord({
    deviceToken,
    platform,
    endpointArn: upstream.body?.endpointArn || body.endpointArn || null,
    isDailyNotificationsAsked: body.isDailyNotificationsAsked,
  });

  return sendJson(res, 200, {
    ...(upstream.body || {}),
    message: upstream.body?.message || "Eszköz sikeresen regisztrálva",
    deviceToken: record.device_token,
    platform: record.platform,
    endpointArn: record.endpoint_arn || undefined,
    isDailyNotificationsAsked: record.is_daily_notifications_asked,
  });
}

async function handleUnregister(req, res) {
  const body = await readJsonBody(req);
  if (!body.deviceToken) {
    return sendJson(res, 400, { error: "Hiányzó deviceToken paraméter" });
  }

  const upstream = await forwardUpstream("unregister-device", body);
  if (!upstream.ok) {
    return sendJson(res, upstream.statusCode, upstream.body);
  }

  const record = await unregisterDeviceRecord(body.deviceToken);
  return sendJson(res, 200, {
    ...(upstream.body || {}),
    message:
      upstream.body?.message || "Eszköz napi értesítései sikeresen kikapcsolva",
    deviceToken: record.device_token,
    isDailyNotificationsAsked: record.is_daily_notifications_asked,
  });
}

async function handleSubscription(req, res, isSubscribed) {
  const body = await readJsonBody(req);
  const deviceToken = body.deviceToken;

  if (!deviceToken) {
    return sendJson(res, 400, { error: "Hiányzó deviceToken paraméter" });
  }

  const platform = body.platform ? normalizePlatform(body.platform, deviceToken) : undefined;
  const upstreamEndpoint = isSubscribed ? "subscribe" : "unsubscribe";
  const upstream = await forwardUpstream(upstreamEndpoint, body);
  if (!upstream.ok) {
    return sendJson(res, upstream.statusCode, upstream.body);
  }

  let record = await updateSubscriptionRecord({
    deviceToken,
    platform,
    isSubscribed,
  });

  if (!record) {
    await registerDeviceRecord({
      deviceToken,
      platform: normalizePlatform(platform, deviceToken),
      isDailyNotificationsAsked: true,
    });
    record = await updateSubscriptionRecord({
      deviceToken,
      platform,
      isSubscribed,
    });
  }

  return sendJson(res, 200, {
    ...(upstream.body || {}),
    message:
      upstream.body?.message ||
      (isSubscribed ? "Előfizetés aktiválva" : "Előfizetés lemondva"),
    deviceToken: record.device_token,
    isSubscribed: record.is_subscribed,
  });
}

async function handleStoredEvent(req, res, endpoint) {
  const body = await readJsonBody(req);
  const upstream = await forwardUpstream(endpoint, body);
  if (!upstream.ok) {
    return sendJson(res, upstream.statusCode, upstream.body);
  }

  await storeInboundEvent(endpoint, body);
  return sendJson(res, 200, {
    ...(upstream.body || {}),
    message: upstream.body?.message || "OK",
  });
}

async function handleRequest(req, res) {
  if (req.method === "OPTIONS") {
    res.writeHead(204, corsHeaders());
    res.end();
    return;
  }

  const requestUrl = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
  const endpoint = routeName(requestUrl.pathname);

  if (req.method === "GET" && (endpoint === "health" || requestUrl.pathname === "/")) {
    const summary = await getHealthSummary();
    return sendJson(res, 200, {
      status: "ok",
      service: "nevnap-api",
      ...summary,
    });
  }

  if (req.method !== "POST") {
    return sendJson(res, 405, { error: "Nem támogatott HTTP metódus" });
  }

  if (endpoint === "register-device") return handleRegister(req, res);
  if (endpoint === "unregister-device") return handleUnregister(req, res);
  if (endpoint === "subscribe") return handleSubscription(req, res, true);
  if (endpoint === "unsubscribe") return handleSubscription(req, res, false);
  if (endpoint === "receipt") return handleStoredEvent(req, res, "receipt");
  if (endpoint === "store-notifications") {
    return handleStoredEvent(req, res, "store-notifications");
  }

  return sendJson(res, 404, { error: "Nem létező végpont vagy művelet" });
}

await initDb();

const server = http.createServer((req, res) => {
  handleRequest(req, res).catch((error) => {
    console.error("Unhandled request error", error);
    sendJson(res, error.statusCode || 500, {
      error: "Belső szerverhiba",
      message: error.message,
    });
  });
});

server.listen(port, "0.0.0.0", () => {
  console.log(`nevnap-api listening on ${port}`);
});
