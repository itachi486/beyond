-- Personal sky is cumulative, private, and independent of message deletion/history pagination.
CREATE TABLE IF NOT EXISTS connect_constellations(
 owner_id TEXT PRIMARY KEY REFERENCES create_starter_profiles(owner_id) ON DELETE CASCADE,
 star_count INTEGER NOT NULL DEFAULT 1 CHECK(typeof(star_count)='integer' AND star_count BETWEEN 1 AND 64),
 last_growth_at TEXT NOT NULL
);
-- Only committed NEW sends can grow a sky. Retried operations, edits, idle time,
-- solo spam, and a backlog of historical messages cannot award extra stars.
CREATE TRIGGER IF NOT EXISTS connect_constellation_growth AFTER INSERT ON connect_messages WHEN NEW.user_id IS NOT NULL
BEGIN
 INSERT INTO connect_constellations(owner_id,star_count,last_growth_at) VALUES(NEW.user_id,1,NEW.created_at)
 ON CONFLICT(owner_id) DO UPDATE SET
 star_count=star_count+1,last_growth_at=NEW.created_at
 WHERE star_count<64 AND unixepoch(NEW.created_at)-unixepoch(last_growth_at)>=120
 AND EXISTS(SELECT 1 FROM connect_messages peer WHERE peer.group_id=NEW.group_id AND peer.user_id IS NOT NULL AND peer.user_id<>NEW.user_id AND peer.deleted_at IS NULL AND peer.created_at>last_growth_at AND unixepoch(peer.created_at)>=unixepoch(NEW.created_at)-300);
END;
