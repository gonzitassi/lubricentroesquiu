CREATE TABLE IF NOT EXISTS devices (
  endpoint TEXT PRIMARY KEY,
  subscription TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS booking_notices (
  id TEXT PRIMARY KEY,
  expires INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS booking_notices_expiration ON booking_notices(expires);
