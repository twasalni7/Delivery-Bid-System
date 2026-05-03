-- System errors table
CREATE TABLE IF NOT EXISTS system_errors (
  id SERIAL PRIMARY KEY,
  error_type TEXT NOT NULL,
  message TEXT NOT NULL,
  stack TEXT,
  page TEXT,
  user_id INTEGER,
  user_role TEXT,
  count INTEGER NOT NULL DEFAULT 1,
  severity TEXT NOT NULL DEFAULT 'error',
  resolved TEXT NOT NULL DEFAULT 'false',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- System alerts table
CREATE TABLE IF NOT EXISTS system_alerts (
  id SERIAL PRIMARY KEY,
  type TEXT NOT NULL,
  message TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'warning',
  is_read TEXT NOT NULL DEFAULT 'false',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Request stops table for multi-stop routing
CREATE TABLE IF NOT EXISTS request_stops (
  id SERIAL PRIMARY KEY,
  request_id INTEGER NOT NULL REFERENCES requests(id) ON DELETE CASCADE,
  stop_order INTEGER NOT NULL,
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  address TEXT NOT NULL,
  stop_type TEXT NOT NULL DEFAULT 'waypoint',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_request_stops_request_id ON request_stops(request_id);
CREATE INDEX IF NOT EXISTS idx_system_errors_created_at ON system_errors(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_system_alerts_created_at ON system_alerts(created_at DESC);
