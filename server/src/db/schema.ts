import Database from 'better-sqlite3';

export function initializeDatabase(db: Database.Database): void {
  // Enable foreign keys and WAL mode for high concurrency
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  // Create tables in transaction
  db.transaction(() => {
    // 1. Users table
    db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        username TEXT UNIQUE NOT NULL COLLATE NOCASE,
        password_hash TEXT NOT NULL,
        is_admin INTEGER NOT NULL DEFAULT 0,
        last_login_at TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
    `);

    // Ensure columns exist in existing databases (migration)
    const userCols = (db.prepare("PRAGMA table_info(users)").all() as { name: string }[]).map(c => c.name);
    if (!userCols.includes('last_login_at')) {
      db.exec("ALTER TABLE users ADD COLUMN last_login_at TEXT;");
    }

    // 2. Instances table
    db.exec(`
      CREATE TABLE IF NOT EXISTS instances (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        directory_path TEXT NOT NULL,
        start_command TEXT NOT NULL,
        cached_port INTEGER DEFAULT 25565,
        auto_restart INTEGER NOT NULL DEFAULT 0,
        start_on_boot INTEGER NOT NULL DEFAULT 0,
        cached_version TEXT,
        last_started_at TEXT,
        last_started_by TEXT,
        last_stopped_at TEXT,
        last_stopped_by TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
    `);

    // Ensure columns exist in existing databases (migration)
    const instanceCols = (db.prepare("PRAGMA table_info(instances)").all() as { name: string }[]).map(c => c.name);
    if (!instanceCols.includes('start_on_boot')) {
      db.exec("ALTER TABLE instances ADD COLUMN start_on_boot INTEGER NOT NULL DEFAULT 0;");
    }
    if (!instanceCols.includes('cached_version')) {
      db.exec("ALTER TABLE instances ADD COLUMN cached_version TEXT;");
    }
    if (!instanceCols.includes('last_started_at')) {
      db.exec("ALTER TABLE instances ADD COLUMN last_started_at TEXT;");
    }
    if (!instanceCols.includes('last_started_by')) {
      db.exec("ALTER TABLE instances ADD COLUMN last_started_by TEXT;");
    }
    if (!instanceCols.includes('last_stopped_at')) {
      db.exec("ALTER TABLE instances ADD COLUMN last_stopped_at TEXT;");
    }
    if (!instanceCols.includes('last_stopped_by')) {
      db.exec("ALTER TABLE instances ADD COLUMN last_stopped_by TEXT;");
    }

    // 3. Granular permissions table
    db.exec(`
      CREATE TABLE IF NOT EXISTS permissions (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        instance_id TEXT NOT NULL,
        can_view_console INTEGER NOT NULL DEFAULT 1,
        can_send_commands INTEGER NOT NULL DEFAULT 0,
        can_start INTEGER NOT NULL DEFAULT 0,
        can_stop INTEGER NOT NULL DEFAULT 0,
        can_restart INTEGER NOT NULL DEFAULT 0,
        can_kill INTEGER NOT NULL DEFAULT 0,
        can_edit_config INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (instance_id) REFERENCES instances(id) ON DELETE CASCADE,
        UNIQUE (user_id, instance_id)
      );
    `);

    // 4. System settings table
    db.exec(`
      CREATE TABLE IF NOT EXISTS system_settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
    `);
  })();
}
