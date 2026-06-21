import pg from "pg";

const { Pool } = pg;

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: Number(process.env.PG_POOL_MAX || 5),
});

export async function initDb() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS devices (
      device_token TEXT PRIMARY KEY,
      platform TEXT NOT NULL DEFAULT 'APNS',
      endpoint_arn TEXT,
      is_daily_notifications_asked BOOLEAN NOT NULL DEFAULT TRUE,
      is_subscribed BOOLEAN,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE INDEX IF NOT EXISTS devices_daily_notifications_idx
      ON devices (is_daily_notifications_asked)
      WHERE is_daily_notifications_asked = TRUE;

    CREATE TABLE IF NOT EXISTS inbound_events (
      id BIGSERIAL PRIMARY KEY,
      endpoint TEXT NOT NULL,
      payload JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
}

export async function getDevice(deviceToken) {
  const result = await pool.query(
    `SELECT device_token, platform, endpoint_arn, is_daily_notifications_asked,
            is_subscribed, created_at, updated_at
       FROM devices
      WHERE device_token = $1`,
    [deviceToken],
  );
  return result.rows[0] || null;
}

export async function registerDeviceRecord({
  deviceToken,
  platform,
  endpointArn = null,
  isDailyNotificationsAsked,
}) {
  const existing = await getDevice(deviceToken);
  const dailyFlag =
    typeof isDailyNotificationsAsked === "boolean"
      ? isDailyNotificationsAsked
      : existing?.is_daily_notifications_asked ?? true;

  const result = await pool.query(
    `INSERT INTO devices (
        device_token, platform, endpoint_arn, is_daily_notifications_asked,
        created_at, updated_at
      )
      VALUES ($1, $2, $3, $4, now(), now())
      ON CONFLICT (device_token) DO UPDATE SET
        platform = EXCLUDED.platform,
        endpoint_arn = COALESCE(EXCLUDED.endpoint_arn, devices.endpoint_arn),
        is_daily_notifications_asked = EXCLUDED.is_daily_notifications_asked,
        updated_at = now()
      RETURNING device_token, platform, endpoint_arn,
                is_daily_notifications_asked, created_at, updated_at`,
    [deviceToken, platform, endpointArn, dailyFlag],
  );

  return result.rows[0];
}

export async function unregisterDeviceRecord(deviceToken) {
  const result = await pool.query(
    `INSERT INTO devices (
        device_token, platform, is_daily_notifications_asked, created_at, updated_at
      )
      VALUES ($1, 'APNS', FALSE, now(), now())
      ON CONFLICT (device_token) DO UPDATE SET
        is_daily_notifications_asked = FALSE,
        updated_at = now()
      RETURNING device_token, platform, endpoint_arn,
                is_daily_notifications_asked, created_at, updated_at`,
    [deviceToken],
  );

  return result.rows[0];
}

export async function updateSubscriptionRecord({
  deviceToken,
  platform,
  isSubscribed,
}) {
  const existing = await getDevice(deviceToken);
  if (!existing) {
    return null;
  }

  const normalizedPlatform = platform || existing.platform || "APNS";
  const result = await pool.query(
    `UPDATE devices
        SET is_subscribed = $2,
            platform = $3,
            updated_at = now()
      WHERE device_token = $1
      RETURNING device_token, platform, endpoint_arn,
                is_daily_notifications_asked, is_subscribed, created_at, updated_at`,
    [deviceToken, isSubscribed, normalizedPlatform],
  );

  return result.rows[0];
}

export async function storeInboundEvent(endpoint, payload) {
  await pool.query(
    `INSERT INTO inbound_events (endpoint, payload) VALUES ($1, $2::jsonb)`,
    [endpoint, JSON.stringify(payload || {})],
  );
}

export async function getHealthSummary() {
  const result = await pool.query(`
    SELECT
      count(*)::int AS devices,
      count(*) FILTER (WHERE is_daily_notifications_asked = TRUE)::int AS daily_enabled,
      count(*) FILTER (WHERE endpoint_arn IS NOT NULL)::int AS with_endpoint_arn
    FROM devices
  `);
  return result.rows[0];
}
