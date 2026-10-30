CREATE TABLE IF NOT EXISTS schema_versions(version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS admins(id TEXT PRIMARY KEY,email TEXT NOT NULL UNIQUE,password_hash TEXT NOT NULL,created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS sessions(token_hash TEXT PRIMARY KEY,admin_id TEXT NOT NULL REFERENCES admins(id),csrf TEXT NOT NULL,expires_at INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS sessions_expiry ON sessions(expires_at);
CREATE TABLE IF NOT EXISTS login_limits(key_hash TEXT PRIMARY KEY,attempts INTEGER NOT NULL,reset_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS worlds(id TEXT PRIMARY KEY,slug TEXT NOT NULL UNIQUE,status TEXT NOT NULL CHECK(status IN ('draft','review','published','archived')),data TEXT NOT NULL,version INTEGER NOT NULL DEFAULT 1,created_at TEXT NOT NULL,updated_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS discoveries(id TEXT PRIMARY KEY,slug TEXT NOT NULL UNIQUE,world_id TEXT NOT NULL REFERENCES worlds(id),status TEXT NOT NULL CHECK(status IN ('draft','review','published','archived')),data TEXT NOT NULL,version INTEGER NOT NULL DEFAULT 1,created_at TEXT NOT NULL,updated_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS connections(id TEXT PRIMARY KEY,from_id TEXT NOT NULL REFERENCES discoveries(id),to_id TEXT NOT NULL REFERENCES discoveries(id),explanation TEXT NOT NULL,CHECK(from_id<>to_id),UNIQUE(from_id,to_id));
CREATE TABLE IF NOT EXISTS revisions(id INTEGER PRIMARY KEY AUTOINCREMENT,kind TEXT NOT NULL,record_id TEXT NOT NULL,actor TEXT NOT NULL REFERENCES admins(id),snapshot TEXT NOT NULL,created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS settings(id INTEGER PRIMARY KEY CHECK(id=1),data TEXT NOT NULL);

-- Preserve legacy central-library data during the SQLite-to-D1 migration.
CREATE TABLE IF NOT EXISTS central_activity(id TEXT PRIMARY KEY,action TEXT NOT NULL,record_id TEXT NOT NULL,name TEXT NOT NULL,actor_id TEXT,created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS central_characters(id TEXT PRIMARY KEY,name TEXT NOT NULL,description TEXT NOT NULL,type TEXT NOT NULL,tags TEXT NOT NULL,source TEXT NOT NULL,active INTEGER NOT NULL,deleted INTEGER NOT NULL,version INTEGER NOT NULL,kind TEXT NOT NULL,format TEXT NOT NULL,bytes INTEGER NOT NULL,file_key TEXT NOT NULL,preview_key TEXT NOT NULL,creator_id TEXT,created_at TEXT NOT NULL,updated_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS permanent_deletion_jobs(id TEXT PRIMARY KEY,kind TEXT NOT NULL,target_id TEXT NOT NULL,version INTEGER NOT NULL,paths TEXT NOT NULL,created_at TEXT NOT NULL);
