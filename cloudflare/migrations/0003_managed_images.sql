-- Additive, Preview only. No existing table, user, image or relationship is changed.
CREATE TABLE IF NOT EXISTS managed_images (
 id TEXT PRIMARY KEY,
 category TEXT NOT NULL CHECK(category IN ('what-if','human-mind','unsolved','hidden-worlds','your-future','never-knew')),
 status TEXT NOT NULL CHECK(status IN ('uploading','ready','deleting','cleanup')),
 data TEXT NOT NULL,
 version INTEGER NOT NULL,
 creator_id TEXT NOT NULL REFERENCES admins(id),
 created_at TEXT NOT NULL,
 updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS managed_images_category ON managed_images(category,status,updated_at);
