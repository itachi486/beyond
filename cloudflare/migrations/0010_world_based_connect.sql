-- Membership comes from saved worlds. Preserve legacy worlds and all image data.
DROP TRIGGER IF EXISTS create_starter_limit;
DROP TRIGGER IF EXISTS create_starter_official;
CREATE TRIGGER IF NOT EXISTS create_starter_world_source BEFORE INSERT ON create_starter_selections
WHEN NOT EXISTS(SELECT 1 FROM connect_groups g WHERE g.starter_key=NEW.starter_key AND g.starter_image_id=NEW.starter_image_id AND (EXISTS(SELECT 1 FROM user_worlds w WHERE w.owner_id=NEW.owner_id AND json_extract(w.data,'$.world.starter.imageId')=g.starter_image_id) OR EXISTS(SELECT 1 FROM admin_personal_worlds w WHERE w.owner_id=NEW.owner_id AND json_extract(w.data,'$.world.starter.imageId')=g.starter_image_id)))
BEGIN SELECT RAISE(ABORT,'saved_world_required'); END;
CREATE TRIGGER IF NOT EXISTS user_world_count_limit BEFORE INSERT ON user_worlds
WHEN NOT EXISTS(SELECT 1 FROM user_worlds WHERE owner_id=NEW.owner_id AND id=NEW.id) AND (SELECT COUNT(*) FROM user_worlds WHERE owner_id=NEW.owner_id)>=3
BEGIN SELECT RAISE(ABORT,'world_limit_reached'); END;
CREATE TRIGGER IF NOT EXISTS admin_world_count_limit BEFORE INSERT ON admin_personal_worlds
WHEN NOT EXISTS(SELECT 1 FROM admin_personal_worlds WHERE owner_id=NEW.owner_id AND id=NEW.id) AND (SELECT COUNT(*) FROM admin_personal_worlds WHERE owner_id=NEW.owner_id)>=3
BEGIN SELECT RAISE(ABORT,'world_limit_reached'); END;
