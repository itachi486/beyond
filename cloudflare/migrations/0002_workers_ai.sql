-- Additive Preview AI budget ledger. No original rows or schema are changed.
CREATE TABLE IF NOT EXISTS workers_ai_requests (
 id TEXT PRIMARY KEY, actor TEXT NOT NULL, kind TEXT NOT NULL CHECK(kind IN ('text','image')),
 request_hash TEXT NOT NULL, day TEXT NOT NULL, reserved_neurons INTEGER NOT NULL CHECK(reserved_neurons>=0),
 status TEXT NOT NULL CHECK(status IN ('pending','success','error')),response TEXT,created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS workers_ai_daily ON workers_ai_requests(day,actor,kind);
