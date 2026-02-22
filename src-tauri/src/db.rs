use parking_lot::Mutex;
use rusqlite::Connection;

/// Single SQLite connection behind a mutex.
/// Desktop app with one user — no pool needed.
pub struct Db(pub Mutex<Connection>);

/// Open the database and run migrations. Called once at app startup.
pub fn init() -> Result<Db, String> {
    let path = crate::paths::db_path();
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to create db directory: {e}"))?;
    }

    let conn = Connection::open(&path).map_err(|e| format!("Failed to open database: {e}"))?;

    conn.execute_batch("PRAGMA journal_mode = WAL;")
        .map_err(|e| format!("Failed to set WAL mode: {e}"))?;
    conn.execute_batch("PRAGMA foreign_keys = ON;")
        .map_err(|e| format!("Failed to enable foreign keys: {e}"))?;

    migrate(&conn)?;

    Ok(Db(Mutex::new(conn)))
}

fn migrate(conn: &Connection) -> Result<(), String> {
    conn.execute_batch(
        "
        CREATE TABLE IF NOT EXISTS course (
            id          TEXT PRIMARY KEY,
            source_url  TEXT NOT NULL UNIQUE,
            local_path  TEXT NOT NULL,
            title       TEXT NOT NULL,
            description TEXT NOT NULL,
            step_count  INTEGER NOT NULL,
            added_at    INTEGER NOT NULL,
            CHECK (length(id) > 0),
            CHECK (length(source_url) > 0),
            CHECK (step_count > 0)
        ) STRICT;

        CREATE TABLE IF NOT EXISTS tag (
            course_id  TEXT NOT NULL REFERENCES course(id) ON DELETE CASCADE,
            name       TEXT NOT NULL,
            PRIMARY KEY (course_id, name),
            CHECK (length(name) > 0)
        ) STRICT, WITHOUT ROWID;

        CREATE TABLE IF NOT EXISTS step_completion (
            course_id    TEXT NOT NULL REFERENCES course(id) ON DELETE CASCADE,
            step_index   INTEGER NOT NULL,
            completed_at INTEGER NOT NULL,
            PRIMARY KEY (course_id, step_index),
            CHECK (step_index >= 0)
        ) STRICT, WITHOUT ROWID;

        CREATE TABLE IF NOT EXISTS step_position (
            course_id   TEXT NOT NULL REFERENCES course(id) ON DELETE CASCADE,
            step_index  INTEGER NOT NULL,
            slide_index INTEGER NOT NULL,
            slide_count INTEGER,
            PRIMARY KEY (course_id, step_index),
            CHECK (slide_index >= 0),
            CHECK (step_index >= 0)
        ) STRICT, WITHOUT ROWID;

        CREATE TABLE IF NOT EXISTS app_route (
            id    INTEGER PRIMARY KEY CHECK (id = 1),
            kind  TEXT NOT NULL,
            course_id  TEXT,
            step_index INTEGER
        ) STRICT;

        INSERT OR IGNORE INTO app_route (id, kind) VALUES (1, 'browser');

        CREATE TABLE IF NOT EXISTS slide_completion (
            course_id  TEXT NOT NULL REFERENCES course(id) ON DELETE CASCADE,
            step_index INTEGER NOT NULL,
            slide_id   TEXT NOT NULL,
            PRIMARY KEY (course_id, step_index, slide_id),
            CHECK (step_index >= 0),
            CHECK (length(slide_id) > 0)
        ) STRICT, WITHOUT ROWID;

        CREATE TABLE IF NOT EXISTS lab_provision (
            workspace_path TEXT PRIMARY KEY,
            provisioned_at INTEGER NOT NULL
        ) STRICT, WITHOUT ROWID;
        ",
    )
    .map_err(|e| format!("Migration failed: {e}"))?;

    // Existing installs: rename the column. Fresh installs get the new name from DDL.
    let needs_rename: bool = conn
        .prepare("SELECT github_url FROM course LIMIT 0")
        .is_ok();
    if needs_rename {
        conn.execute_batch("ALTER TABLE course RENAME COLUMN github_url TO source_url;")
            .map_err(|e| format!("Column rename migration failed: {e}"))?;
    }

    // FTS5 — CREATE VIRTUAL TABLE doesn't support IF NOT EXISTS,
    // so check manually
    let fts_exists: bool = conn
        .query_row(
            "SELECT count(*) > 0 FROM sqlite_master WHERE type='table' AND name='course_search'",
            [],
            |row| row.get(0),
        )
        .map_err(|e| format!("Failed to check FTS table: {e}"))?;

    if !fts_exists {
        conn.execute_batch(
            "
            CREATE VIRTUAL TABLE course_search USING fts5(
                title, description,
                content='course',
                content_rowid='rowid'
            );

            CREATE TRIGGER course_ins AFTER INSERT ON course BEGIN
                INSERT INTO course_search(rowid, title, description)
                VALUES (new.rowid, new.title, new.description);
            END;

            CREATE TRIGGER course_del AFTER DELETE ON course BEGIN
                INSERT INTO course_search(course_search, rowid, title, description)
                VALUES ('delete', old.rowid, old.title, old.description);
            END;

            CREATE TRIGGER course_upd AFTER UPDATE ON course BEGIN
                INSERT INTO course_search(course_search, rowid, title, description)
                VALUES ('delete', old.rowid, old.title, old.description);
                INSERT INTO course_search(rowid, title, description)
                VALUES (new.rowid, new.title, new.description);
            END;
            ",
        )
        .map_err(|e| format!("FTS migration failed: {e}"))?;
    }

    Ok(())
}
