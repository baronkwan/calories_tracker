-- Calorie Dashboard D1 Schema v2 (multi-user)
-- Run: wrangler d1 execute calorielog --remote --file=schema.sql
-- NOTE: destructive — drops old single-user tables. BK's data is re-pushed from the wiki.

DROP TABLE IF EXISTS daily_logs;
DROP TABLE IF EXISTS profile;
DROP TABLE IF EXISTS weight_log;
DROP TABLE IF EXISTS users;

CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  display_name TEXT DEFAULT '',
  password_hash TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now'))
);

-- BK (user_id = 1) syncs with the LLM wiki; other users are D1-only.
CREATE TABLE daily_logs (
  user_id INTEGER NOT NULL REFERENCES users(id),
  date TEXT NOT NULL,                 -- '2026-08-05'
  total INTEGER NOT NULL DEFAULT 0,
  meals_json TEXT NOT NULL DEFAULT '[]',
  updated_at TEXT DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, date)
);

CREATE TABLE profile (
  user_id INTEGER PRIMARY KEY REFERENCES users(id),
  profile_json TEXT NOT NULL DEFAULT '{}',
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE weight_log (
  user_id INTEGER NOT NULL REFERENCES users(id),
  date TEXT NOT NULL,
  kg REAL NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, date)
);

CREATE INDEX idx_daily_logs_user_date ON daily_logs (user_id, date);
CREATE INDEX idx_weight_log_user_date ON weight_log (user_id, date);

-- Shared food catalog (from BK's wiki reference table; all users read it)
CREATE TABLE IF NOT EXISTS foods (
  name TEXT PRIMARY KEY,
  portion TEXT DEFAULT '',
  kcal REAL NOT NULL DEFAULT 0,
  p REAL NOT NULL DEFAULT 0,
  c REAL NOT NULL DEFAULT 0,
  f REAL NOT NULL DEFAULT 0
);

-- Exercise log (added 2026-08-12): kcal computed server-side via MET × weight × hours.
-- source: 'manual' | 'apple_health'. start_iso dedupes Shortcut re-imports.
CREATE TABLE IF NOT EXISTS exercise_log (
  user_id INTEGER NOT NULL REFERENCES users(id),
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL,                 -- '2026-08-12'
  type TEXT NOT NULL DEFAULT 'other', -- exercise type id (see worker MET table)
  name TEXT NOT NULL DEFAULT '運動',
  duration_min REAL NOT NULL DEFAULT 0,
  kcal INTEGER NOT NULL DEFAULT 0,
  source TEXT NOT NULL DEFAULT 'manual',
  start_iso TEXT DEFAULT '',          -- Apple Health workout start, for dedup
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_exercise_user_date ON exercise_log (user_id, date);
