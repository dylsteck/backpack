-- Remove browser_history and browser_sessions tables
-- Browser history will now be stored in the items table instead

DROP TABLE IF EXISTS "browser_history";
DROP TABLE IF EXISTS "browser_sessions";
