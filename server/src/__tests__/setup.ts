import Database from 'better-sqlite3';
import type { Database as SqliteDatabase } from 'better-sqlite3';
import bcrypt from 'bcryptjs';
import { initTables, migrateTables, setDb } from '../db';
import { generateToken } from '../middleware/auth';

let testDb: SqliteDatabase;



function createTestUser(db: SqliteDatabase, username: string, password: string, nickname: string): { id: number; token: string } {
  const hash = bcrypt.hashSync(password, 10);
  const result = db.prepare(
    'INSERT INTO users (username, password, nickname, phone) VALUES (?, ?, ?, ?)'
  ).run(username, hash, nickname, `1380000${Math.floor(Math.random() * 10000).toString().padStart(4, '0')}`);
  const id = Number(result.lastInsertRowid);
  return { id, token: generateToken(id) };
}

function createTestLostPet(db: SqliteDatabase, userId: number, name: string): number {
  const result = db.prepare(
    `INSERT INTO lost_pets (user_id, species, breed, name, lost_location, lost_date, contact, description, found)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(userId, '猫', '橘猫', name, '测试小区', '2026-06-01', '13800000000', '测试描述', 0);
  return Number(result.lastInsertRowid);
}

function createTestFosteringNeed(db: SqliteDatabase, userId: number, petId: number): number {
  const result = db.prepare(
    `INSERT INTO fostering_needs (user_id, pet_id, start_date, end_date, requirements, status)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(userId, petId, '2026-07-01', '2026-07-10', '测试要求', 'open');
  return Number(result.lastInsertRowid);
}

function createTestPet(db: SqliteDatabase, userId: number, name: string): number {
  const result = db.prepare(
    `INSERT INTO pets (user_id, name, breed, species, age) VALUES (?, ?, ?, ?, ?)`
  ).run(userId, name, '橘猫', '猫', '2岁');
  return Number(result.lastInsertRowid);
}

beforeAll(() => {
  testDb = new Database(':memory:');
  testDb.pragma('journal_mode = WAL');
  testDb.pragma('foreign_keys = ON');
  (global as any).testDb = testDb;
  (global as any).testHelpers = {
    generateToken,
    createTestUser,
    createTestLostPet,
    createTestFosteringNeed,
    createTestPet,
  };
});

beforeEach(() => {
  testDb.exec(`
    DROP TABLE IF EXISTS lost_pet_clues;
    DROP TABLE IF EXISTS messages;
    DROP TABLE IF EXISTS lost_pets;
    DROP TABLE IF EXISTS reviews;
    DROP TABLE IF EXISTS fostering_applications;
    DROP TABLE IF EXISTS fostering_needs;
    DROP TABLE IF EXISTS pets;
    DROP TABLE IF EXISTS users;
  `);
  setDb(testDb);
  initTables(testDb);
  migrateTables(testDb);
});

afterAll(() => {
  if (testDb) {
    testDb.close();
  }
});
