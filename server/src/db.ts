import Database, { type Database as SqliteDatabase } from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

let db: SqliteDatabase;

function createDatabase(dbPath?: string): SqliteDatabase {
  if (dbPath) {
    const dataDir = path.dirname(dbPath);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
  }
  const database = new Database(dbPath || ':memory:');
  database.pragma('journal_mode = WAL');
  database.pragma('foreign_keys = ON');
  return database;
}

function initDb(dbPath?: string): SqliteDatabase {
  db = createDatabase(dbPath);
  return db;
}

function getDb(): SqliteDatabase {
  if (!db) {
    const dataDir = path.join(__dirname, '..', 'data');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    const dbPath = path.join(dataDir, 'pet.db');
    db = createDatabase(dbPath);
  }
  return db;
}

function setDb(database: SqliteDatabase): void {
  db = database;
}

function columnExists(database: SqliteDatabase, tableName: string, columnName: string): boolean {
  const columns = database.prepare(`PRAGMA table_info(${tableName})`).all() as { name: string }[];
  return columns.some(col => col.name === columnName);
}

function initTables(database?: SqliteDatabase): void {
  const d = database || getDb();
  d.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      nickname TEXT DEFAULT '',
      avatar TEXT DEFAULT '',
      phone TEXT DEFAULT '',
      bio TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now','localtime'))
    );

    CREATE TABLE IF NOT EXISTS pets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      breed TEXT NOT NULL,
      species TEXT NOT NULL,
      age TEXT DEFAULT '',
      photo TEXT DEFAULT '',
      vaccine TEXT DEFAULT '',
      notes TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now','localtime')),
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS fostering_needs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      pet_id INTEGER NOT NULL,
      start_date TEXT NOT NULL,
      end_date TEXT NOT NULL,
      requirements TEXT DEFAULT '',
      status TEXT DEFAULT 'open',
      created_at TEXT DEFAULT (datetime('now','localtime')),
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (pet_id) REFERENCES pets(id)
    );

    CREATE TABLE IF NOT EXISTS fostering_applications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      fostering_need_id INTEGER NOT NULL,
      applicant_id INTEGER NOT NULL,
      experience TEXT DEFAULT '',
      environment TEXT DEFAULT '',
      status TEXT DEFAULT 'pending',
      created_at TEXT DEFAULT (datetime('now','localtime')),
      FOREIGN KEY (fostering_need_id) REFERENCES fostering_needs(id),
      FOREIGN KEY (applicant_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      from_user_id INTEGER NOT NULL,
      to_user_id INTEGER NOT NULL,
      fostering_need_id INTEGER,
      lost_pet_id INTEGER,
      content TEXT NOT NULL,
      read INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now','localtime')),
      FOREIGN KEY (from_user_id) REFERENCES users(id),
      FOREIGN KEY (to_user_id) REFERENCES users(id),
      FOREIGN KEY (fostering_need_id) REFERENCES fostering_needs(id),
      FOREIGN KEY (lost_pet_id) REFERENCES lost_pets(id)
    );

    CREATE TABLE IF NOT EXISTS reviews (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      fostering_need_id INTEGER NOT NULL,
      reviewer_id INTEGER NOT NULL,
      reviewee_id INTEGER NOT NULL,
      rating INTEGER NOT NULL,
      comment TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now','localtime')),
      FOREIGN KEY (fostering_need_id) REFERENCES fostering_needs(id),
      FOREIGN KEY (reviewer_id) REFERENCES users(id),
      FOREIGN KEY (reviewee_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS lost_pets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      photo TEXT DEFAULT '',
      species TEXT DEFAULT '',
      breed TEXT DEFAULT '',
      name TEXT DEFAULT '',
      lost_location TEXT NOT NULL,
      lost_date TEXT NOT NULL,
      contact TEXT NOT NULL,
      description TEXT DEFAULT '',
      found INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now','localtime')),
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS lost_pet_clues (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      lost_pet_id INTEGER NOT NULL,
      witness_id INTEGER NOT NULL,
      sighting_time TEXT NOT NULL,
      sighting_location TEXT NOT NULL,
      photo TEXT DEFAULT '',
      description TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now','localtime')),
      FOREIGN KEY (lost_pet_id) REFERENCES lost_pets(id),
      FOREIGN KEY (witness_id) REFERENCES users(id)
    );
  `);
}

function tableExists(database: SqliteDatabase, tableName: string): boolean {
  const table = database.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name=?`).get(tableName);
  return !!table;
}

function migrateTables(database?: SqliteDatabase): void {
  const d = database || getDb();
  const transaction = d.transaction(() => {
    if (tableExists(d, 'messages')) {
      if (!columnExists(d, 'messages', 'lost_pet_id')) {
        d.prepare(`ALTER TABLE messages ADD COLUMN lost_pet_id INTEGER REFERENCES lost_pets(id)`).run();
      }

      if (!columnExists(d, 'messages', 'fostering_need_id')) {
        d.prepare(`ALTER TABLE messages ADD COLUMN fostering_need_id INTEGER REFERENCES fostering_needs(id)`).run();
      }
    }

    const tables = d.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name='lost_pet_clues'`).get();
    if (!tables) {
      d.exec(`
        CREATE TABLE lost_pet_clues (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          lost_pet_id INTEGER NOT NULL,
          witness_id INTEGER NOT NULL,
          sighting_time TEXT NOT NULL,
          sighting_location TEXT NOT NULL,
          photo TEXT DEFAULT '',
          description TEXT DEFAULT '',
          created_at TEXT DEFAULT (datetime('now','localtime')),
          FOREIGN KEY (lost_pet_id) REFERENCES lost_pets(id),
          FOREIGN KEY (witness_id) REFERENCES users(id)
        );
      `);
    }

    if (tableExists(d, 'lost_pet_clues') && !columnExists(d, 'lost_pet_clues', 'lost_pet_id')) {
      d.prepare(`ALTER TABLE lost_pet_clues ADD COLUMN lost_pet_id INTEGER NOT NULL REFERENCES lost_pets(id)`).run();
    }
  });

  try {
    transaction();
  } catch (err) {
    console.error('Database migration failed:', err);
    throw err;
  }
}

export { getDb, setDb, initDb, initTables, migrateTables, columnExists, createDatabase };
