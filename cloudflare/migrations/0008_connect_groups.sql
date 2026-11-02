-- Preview CONNECT additive schema. B10 stays OFF; no existing world/image writes.
CREATE TABLE IF NOT EXISTS connect_groups(starter_key TEXT PRIMARY KEY,group_id TEXT NOT NULL UNIQUE,display_name TEXT NOT NULL,starter_image_id TEXT UNIQUE);
CREATE TABLE IF NOT EXISTS create_starter_profiles(owner_id TEXT PRIMARY KEY,owner_kind TEXT NOT NULL CHECK(owner_kind IN ('member','admin')),subject_id TEXT NOT NULL,revision INTEGER NOT NULL CHECK(typeof(revision)='integer' AND revision BETWEEN 1 AND 9007199254740991),updated_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS create_starter_selections(owner_id TEXT NOT NULL REFERENCES create_starter_profiles(owner_id) ON DELETE CASCADE,starter_key TEXT NOT NULL REFERENCES connect_groups(starter_key),starter_image_id TEXT NOT NULL,selected_at TEXT NOT NULL,PRIMARY KEY(owner_id,starter_key));
CREATE TABLE IF NOT EXISTS create_starter_operations(owner_id TEXT NOT NULL REFERENCES create_starter_profiles(owner_id) ON DELETE CASCADE,operation_id TEXT NOT NULL,request_hash TEXT NOT NULL,revision INTEGER NOT NULL,selections TEXT NOT NULL,created_at TEXT NOT NULL,PRIMARY KEY(owner_id,operation_id));
CREATE TABLE IF NOT EXISTS connect_memberships(owner_id TEXT NOT NULL REFERENCES create_starter_profiles(owner_id) ON DELETE CASCADE,group_id TEXT NOT NULL REFERENCES connect_groups(group_id),active INTEGER NOT NULL CHECK(active IN(0,1)),joined_at TEXT NOT NULL,left_at TEXT,PRIMARY KEY(owner_id,group_id));
CREATE INDEX IF NOT EXISTS connect_membership_group ON connect_memberships(group_id,active);
CREATE TRIGGER IF NOT EXISTS create_starter_limit BEFORE INSERT ON create_starter_selections WHEN (SELECT COUNT(*) FROM create_starter_selections WHERE owner_id=NEW.owner_id)>=3 BEGIN SELECT RAISE(ABORT,'create_starter_limit'); END;
CREATE TRIGGER IF NOT EXISTS create_starter_official BEFORE INSERT ON create_starter_selections WHEN NOT EXISTS(SELECT 1 FROM connect_groups g JOIN managed_images i ON i.id=g.starter_image_id WHERE g.starter_key=NEW.starter_key AND g.starter_image_id=NEW.starter_image_id AND i.category='hidden-worlds' AND i.status='ready' AND json_extract(i.data,'$.published')=1 AND json_extract(i.data,'$.natureReviewed')=1 AND json_type(i.data,'$.file')='object') BEGIN SELECT RAISE(ABORT,'official_starter_unavailable'); END;
CREATE TRIGGER IF NOT EXISTS connect_member_cleanup AFTER DELETE ON user_accounts BEGIN DELETE FROM create_starter_profiles WHERE owner_kind='member' AND subject_id=OLD.id; END;
CREATE TRIGGER IF NOT EXISTS connect_admin_cleanup AFTER DELETE ON admins BEGIN DELETE FROM create_starter_profiles WHERE owner_kind='admin' AND subject_id=OLD.id; END;
INSERT OR IGNORE INTO connect_groups VALUES('floating-islands','global:floating-islands','Floating Islands','b07f9334-7ee6-4c3a-9c79-59e0cab97f27');
INSERT OR IGNORE INTO connect_groups VALUES('lost-island','global:lost-island','Lost Island','82158cf5-d5de-4e88-b6b9-c5fd3a8c92b8');
INSERT OR IGNORE INTO connect_groups VALUES('endless-desert','global:endless-desert','Endless Desert','5142ed7e-a1ed-4feb-9c25-77a9ab0104b6');
INSERT OR IGNORE INTO connect_groups VALUES('deep-ocean','global:deep-ocean','Deep Ocean','4845107c-bffa-421c-b857-05d41533c585');
INSERT OR IGNORE INTO connect_groups VALUES('green-valley','global:green-valley','Green Valley','af8ee6f5-1e89-4a00-970a-9a86494a2846');
INSERT OR IGNORE INTO connect_groups VALUES('alien-planet','global:alien-planet','Alien Planet','ff2b1fa4-eefe-46d3-bd88-8fd8842baa4e');
INSERT OR IGNORE INTO connect_groups VALUES('enchanted-forest','global:enchanted-forest','Enchanted Forest',NULL);
INSERT OR IGNORE INTO connect_groups VALUES('outer-space','global:outer-space','Outer Space',NULL);
