-- Preview only. Preserve account IDs, credentials, sessions, world ownership and media.
CREATE TABLE IF NOT EXISTS member_profiles(user_id TEXT PRIMARY KEY REFERENCES user_accounts(id),username TEXT NOT NULL COLLATE NOCASE UNIQUE,status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','suspended','deletion_pending')),last_login TEXT,last_active TEXT,deletion_requested_at TEXT,delete_after TEXT,version INTEGER NOT NULL DEFAULT 1);
INSERT OR IGNORE INTO member_profiles(user_id,username) SELECT id,'member_'||replace(id,'-','') FROM user_accounts;
CREATE INDEX IF NOT EXISTS member_profile_status ON member_profiles(status,delete_after);
CREATE TABLE IF NOT EXISTS member_audit(id TEXT PRIMARY KEY,actor_id TEXT,subject_id TEXT NOT NULL,action TEXT NOT NULL,created_at TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS member_audit_subject ON member_audit(subject_id,created_at);
CREATE TABLE IF NOT EXISTS member_deletions(user_id TEXT PRIMARY KEY,phase TEXT NOT NULL CHECK(phase IN ('pending','cleaning','retry','done','cancelled')),delete_after TEXT NOT NULL,paths TEXT NOT NULL DEFAULT '[]',error_code TEXT,updated_at TEXT NOT NULL);
