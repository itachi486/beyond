-- Add legacy BEYOND central-library tables that exist in the local SQLite DB.
-- Keep this migration idempotent because the initial D1 schema may have been
-- created manually in the Cloudflare dashboard before Wrangler migrations.
CREATE TABLE IF NOT EXISTS central_activity(id TEXT PRIMARY KEY,action TEXT NOT NULL,record_id TEXT NOT NULL,name TEXT NOT NULL,actor_id TEXT,created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS central_characters(id TEXT PRIMARY KEY,name TEXT NOT NULL,description TEXT NOT NULL,type TEXT NOT NULL,tags TEXT NOT NULL,source TEXT NOT NULL,active INTEGER NOT NULL,deleted INTEGER NOT NULL,version INTEGER NOT NULL,kind TEXT NOT NULL,format TEXT NOT NULL,bytes INTEGER NOT NULL,file_key TEXT NOT NULL,preview_key TEXT NOT NULL,creator_id TEXT,created_at TEXT NOT NULL,updated_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS permanent_deletion_jobs(id TEXT PRIMARY KEY,kind TEXT NOT NULL,target_id TEXT NOT NULL,version INTEGER NOT NULL,paths TEXT NOT NULL,created_at TEXT NOT NULL);
