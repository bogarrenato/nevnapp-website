import fs from "node:fs/promises";
import { pool, initDb } from "../src/database.mjs";

function fromDynamoValue(value) {
  if (!value || typeof value !== "object") return undefined;
  if ("S" in value) return value.S;
  if ("BOOL" in value) return value.BOOL;
  if ("N" in value) return Number(value.N);
  if ("NULL" in value) return null;
  if ("M" in value) {
    return Object.fromEntries(
      Object.entries(value.M).map(([key, nested]) => [key, fromDynamoValue(nested)]),
    );
  }
  if ("L" in value) return value.L.map(fromDynamoValue);
  return undefined;
}

function fromDynamoItem(item) {
  return Object.fromEntries(
    Object.entries(item || {}).map(([key, value]) => [key, fromDynamoValue(value)]),
  );
}

function toTimestamp(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

const inputPath = process.argv[2];
if (!inputPath) {
  console.error("Usage: node scripts/import-dynamodb.mjs /path/to/NevnapTarXDevices.scan.json");
  process.exit(2);
}

const raw = await fs.readFile(inputPath, "utf8");
const parsed = JSON.parse(raw);
const items = Array.isArray(parsed.Items) ? parsed.Items.map(fromDynamoItem) : [];

await initDb();

let imported = 0;
for (const item of items) {
  if (!item.deviceToken) continue;
  const platform = item.platform || (/^[0-9a-fA-F]{64}$/.test(item.deviceToken) ? "APNS" : "FCM");
  const createdAt = toTimestamp(item.createdAt);
  const updatedAt = toTimestamp(item.updatedAt) || createdAt;

  await pool.query(
    `INSERT INTO devices (
        device_token, platform, endpoint_arn, is_daily_notifications_asked,
        created_at, updated_at
      )
      VALUES (
        $1, $2, $3, $4,
        COALESCE($5::timestamptz, now()),
        COALESCE($6::timestamptz, COALESCE($5::timestamptz, now()))
      )
      ON CONFLICT (device_token) DO UPDATE SET
        platform = EXCLUDED.platform,
        endpoint_arn = EXCLUDED.endpoint_arn,
        is_daily_notifications_asked = EXCLUDED.is_daily_notifications_asked,
        created_at = LEAST(devices.created_at, EXCLUDED.created_at),
        updated_at = GREATEST(devices.updated_at, EXCLUDED.updated_at)`,
    [
      item.deviceToken,
      platform,
      item.endpointArn || null,
      typeof item.isDailyNotificationsAsked === "boolean"
        ? item.isDailyNotificationsAsked
        : false,
      createdAt,
      updatedAt,
    ],
  );
  imported += 1;
}

const summary = await pool.query(
  `SELECT count(*)::int AS devices,
          count(*) FILTER (WHERE is_daily_notifications_asked = TRUE)::int AS daily_enabled,
          count(*) FILTER (WHERE endpoint_arn IS NOT NULL)::int AS with_endpoint_arn
     FROM devices`,
);

console.log(
  JSON.stringify(
    {
      imported,
      ...summary.rows[0],
    },
    null,
    2,
  ),
);

await pool.end();
