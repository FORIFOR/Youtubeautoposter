CREATE TABLE IF NOT EXISTS learning_settings (
  owner_id TEXT NOT NULL,
  experiment_id TEXT NOT NULL REFERENCES experiments(id) ON DELETE CASCADE,
  payload TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  PRIMARY KEY(owner_id, experiment_id)
);
CREATE TABLE IF NOT EXISTS learning_decisions (
  owner_id TEXT NOT NULL,
  experiment_id TEXT NOT NULL REFERENCES experiments(id) ON DELETE CASCADE,
  evidence_hash TEXT NOT NULL,
  draft_id TEXT NOT NULL REFERENCES drafts(id),
  created_at TEXT NOT NULL,
  PRIMARY KEY(owner_id, experiment_id, evidence_hash)
);
CREATE INDEX IF NOT EXISTS learning_decisions_time ON learning_decisions(owner_id,experiment_id,created_at);
CREATE TABLE IF NOT EXISTS learning_runtime (
  owner_id TEXT PRIMARY KEY,
  payload TEXT NOT NULL
);
