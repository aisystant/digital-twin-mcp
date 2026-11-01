-- Digital twin storage: one JSONB document per user (user_id = Ory identity subject).
-- Applied by an operator before the first deploy, never by the Worker at request time.
-- The table is created in the current search_path schema (production: public, database "indicators").
-- Writers that share this table: the HTTP Worker (compare-and-swap on the whole document),
-- the synchronizer (roles/synchronizer/scripts/dt-collect-neon.py in FMT-exocortex-template)
-- and the bot collectors (2_collected); the same definition is used there.
CREATE TABLE IF NOT EXISTS digital_twins (
  user_id TEXT PRIMARY KEY,
  data JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
