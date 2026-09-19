CREATE TABLE IF NOT EXISTS production_jobs (
  id TEXT PRIMARY KEY NOT NULL,
  owner_id TEXT NOT NULL,
  source_hash TEXT NOT NULL,
  created_at TEXT NOT NULL,
  payload TEXT NOT NULL,
  UNIQUE(owner_id, source_hash)
);
CREATE INDEX IF NOT EXISTS production_jobs_owner_time ON production_jobs(owner_id,created_at);
CREATE TABLE IF NOT EXISTS production_worker_state (
  owner_id TEXT PRIMARY KEY NOT NULL,
  payload TEXT NOT NULL
);
