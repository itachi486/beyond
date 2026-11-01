-- Additive Preview member identity and private world storage; administrator tables unchanged.
CREATE TABLE IF NOT EXISTS user_accounts(id TEXT PRIMARY KEY,email TEXT UNIQUE NOT NULL,password_hash TEXT NOT NULL,verified_at TEXT,credential_version INTEGER NOT NULL DEFAULT 1,settings TEXT NOT NULL DEFAULT '{}',created_at TEXT NOT NULL,updated_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS user_sessions(token_hash TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES user_accounts(id),csrf TEXT NOT NULL,credential_version INTEGER NOT NULL,expires_at INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS user_sessions_expiry ON user_sessions(expires_at);
CREATE TABLE IF NOT EXISTS user_tokens(token_hash TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES user_accounts(id),purpose TEXT NOT NULL CHECK(purpose IN ('verify','reset')),credential_version INTEGER NOT NULL,expires_at INTEGER NOT NULL,used_at INTEGER);
CREATE INDEX IF NOT EXISTS user_tokens_account ON user_tokens(user_id,purpose,expires_at);
CREATE TABLE IF NOT EXISTS user_limits(key_hash TEXT PRIMARY KEY,attempts INTEGER NOT NULL,reset_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS user_world_assets(user_id TEXT NOT NULL REFERENCES user_accounts(id),id TEXT NOT NULL,status TEXT NOT NULL CHECK(status IN ('pending','ready')),file_key TEXT NOT NULL,hash TEXT NOT NULL,metadata TEXT NOT NULL,created_at TEXT NOT NULL,PRIMARY KEY(user_id,id));
CREATE TABLE IF NOT EXISTS user_worlds(owner_id TEXT NOT NULL REFERENCES user_accounts(id),id TEXT NOT NULL,data TEXT NOT NULL,version INTEGER NOT NULL,last_op_id TEXT NOT NULL,last_op_hash TEXT NOT NULL,created_at TEXT NOT NULL,updated_at TEXT NOT NULL,PRIMARY KEY(owner_id,id));
CREATE TABLE IF NOT EXISTS user_world_revisions(id TEXT PRIMARY KEY,owner_id TEXT NOT NULL,world_id TEXT NOT NULL,version INTEGER NOT NULL,data TEXT NOT NULL,created_at TEXT NOT NULL,FOREIGN KEY(owner_id,world_id) REFERENCES user_worlds(owner_id,id));
CREATE INDEX IF NOT EXISTS user_worlds_owner_date ON user_worlds(owner_id,updated_at);
