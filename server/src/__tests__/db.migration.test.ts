import Database from 'better-sqlite3';
import { initTables, migrateTables, columnExists } from '../db';

describe('Database Migration', () => {
  let db: Database.Database;

  beforeEach(() => {
    db = new Database(':memory:');
    db.pragma('foreign_keys = ON');
  });

  afterEach(() => {
    db.close();
  });

  test('fresh init creates messages table with lost_pet_id', () => {
    initTables(db);
    migrateTables(db);

    const columns = db.prepare(`PRAGMA table_info(messages)`).all() as { name: string }[];
    const columnNames = columns.map(c => c.name);

    expect(columnNames).toContain('lost_pet_id');
    expect(columnNames).toContain('fostering_need_id');
  });

  test('migrate adds lost_pet_id to existing messages table without it', () => {
    db.exec(`
      CREATE TABLE messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        from_user_id INTEGER NOT NULL,
        to_user_id INTEGER NOT NULL,
        content TEXT NOT NULL,
        read INTEGER DEFAULT 0,
        created_at TEXT DEFAULT (datetime('now','localtime'))
      );
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        nickname TEXT DEFAULT ''
      );
      CREATE TABLE IF NOT EXISTS lost_pets (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        lost_location TEXT NOT NULL,
        lost_date TEXT NOT NULL,
        contact TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS fostering_needs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        pet_id INTEGER NOT NULL,
        start_date TEXT NOT NULL,
        end_date TEXT NOT NULL
      );
    `);

    expect(columnExists(db, 'messages', 'lost_pet_id')).toBe(false);
    expect(columnExists(db, 'messages', 'fostering_need_id')).toBe(false);

    migrateTables(db);

    expect(columnExists(db, 'messages', 'lost_pet_id')).toBe(true);
    expect(columnExists(db, 'messages', 'fostering_need_id')).toBe(true);
  });

  test('migrate preserves existing messages data', () => {
    db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        nickname TEXT DEFAULT ''
      );
      CREATE TABLE IF NOT EXISTS lost_pets (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        lost_location TEXT NOT NULL,
        lost_date TEXT NOT NULL,
        contact TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS fostering_needs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        pet_id INTEGER NOT NULL,
        start_date TEXT NOT NULL,
        end_date TEXT NOT NULL
      );
      CREATE TABLE messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        from_user_id INTEGER NOT NULL,
        to_user_id INTEGER NOT NULL,
        fostering_need_id INTEGER,
        content TEXT NOT NULL,
        read INTEGER DEFAULT 0,
        created_at TEXT DEFAULT (datetime('now','localtime'))
      );
      INSERT INTO users (username, password) VALUES ('user1', 'pass1'), ('user2', 'pass2');
      INSERT INTO fostering_needs (user_id, pet_id, start_date, end_date) VALUES (1, 1, '2026-07-01', '2026-07-10');
      INSERT INTO messages (from_user_id, to_user_id, fostering_need_id, content)
      VALUES (1, 2, 1, 'existing message');
    `);

    migrateTables(db);

    const messages = db.prepare('SELECT * FROM messages').all() as any[];
    expect(messages.length).toBe(1);
    expect(messages[0].content).toBe('existing message');
    expect(messages[0].fostering_need_id).toBe(1);
    expect(messages[0].lost_pet_id).toBeNull();
  });

  test('migrate creates lost_pet_clues table if missing', () => {
    db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        nickname TEXT DEFAULT ''
      );
      CREATE TABLE IF NOT EXISTS lost_pets (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        lost_location TEXT NOT NULL,
        lost_date TEXT NOT NULL,
        contact TEXT NOT NULL
      );
    `);

    const tableExists = db.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name='lost_pet_clues'`).get();
    expect(tableExists).toBeFalsy();

    migrateTables(db);

    const tableExistsAfter = db.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name='lost_pet_clues'`).get();
    expect(tableExistsAfter).toBeTruthy();
  });

  test('migrate is idempotent - running twice does not error', () => {
    initTables(db);
    migrateTables(db);

    expect(() => migrateTables(db)).not.toThrow();

    const columns = db.prepare(`PRAGMA table_info(messages)`).all() as { name: string }[];
    const columnNames = columns.map(c => c.name);
    expect(columnNames).toContain('lost_pet_id');
    expect(columnNames.filter(c => c === 'lost_pet_id').length).toBe(1);
  });
});
