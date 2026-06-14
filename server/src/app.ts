import express, { type Application } from 'express';
import cors from 'cors';
import type { Database as SqliteDatabase } from 'better-sqlite3';
import { initTables, migrateTables, setDb } from './db';
import { seedData } from './seed';
import { authMiddleware, AuthRequest } from './middleware/auth';
import authRoutes from './routes/auth';
import petRoutes from './routes/pets';
import fosteringRoutes from './routes/fostering';
import messageRoutes from './routes/messages';
import lostFoundRoutes from './routes/lostFound';
import profileRoutes from './routes/profile';
import { getDb } from './db';

export function createApp(testDb?: SqliteDatabase) {
  const app = express();

  app.use(cors());
  app.use(express.json({ limit: '10mb' }));

  if (testDb) {
    setDb(testDb);
    initTables(testDb);
    migrateTables(testDb);
  } else {
    initTables();
    migrateTables();
    seedData();
  }

  app.use('/api/auth', authRoutes);

  app.get('/api/pets/list', (req, res) => {
    const db = getDb();
    const { species, search, page = '1', pageSize = '20' } = req.query;
    const pageNum = parseInt(page as string) || 1;
    const size = parseInt(pageSize as string) || 20;
    const offset = (pageNum - 1) * size;

    let whereClauses: string[] = [];
    let params: any[] = [];

    if (species && species !== '全部') {
      whereClauses.push('p.species = ?');
      params.push(species);
    }

    if (search) {
      whereClauses.push('(p.name LIKE ? OR p.breed LIKE ?)');
      params.push(`%${search}%`, `%${search}%`);
    }

    const whereStr = whereClauses.length > 0 ? 'WHERE ' + whereClauses.join(' AND ') : '';

    const countRow = db.prepare(
      `SELECT COUNT(*) as total FROM pets p ${whereStr}`
    ).get(...params) as { total: number };

    const pets = db.prepare(
      `SELECT p.*, u.nickname as owner_name, u.avatar as owner_avatar
       FROM pets p
       LEFT JOIN users u ON p.user_id = u.id
       ${whereStr}
       ORDER BY p.created_at DESC
       LIMIT ? OFFSET ?`
    ).all(...params, size, offset);

    res.json({ pets, total: countRow.total, page: pageNum, pageSize: size });
  });

  app.get('/api/lost-found/active', (_req, res) => {
    const db = getDb();
    const lostPets = db.prepare(
      `SELECT lp.*, u.nickname as user_nickname
       FROM lost_pets lp
       LEFT JOIN users u ON lp.user_id = u.id
       WHERE lp.found = 0
       ORDER BY lp.created_at DESC
       LIMIT 10`
    ).all();
    res.json({ lostPets });
  });

  app.get('/api/fostering/list', (_req, res) => {
    const db = getDb();
    const needs = db.prepare(
      `SELECT fn.*, p.name as pet_name, p.breed as pet_breed, p.photo as pet_photo, p.species as pet_species,
              u.nickname as user_nickname
       FROM fostering_needs fn
       LEFT JOIN pets p ON fn.pet_id = p.id
       LEFT JOIN users u ON fn.user_id = u.id
       WHERE fn.status = 'open'
       ORDER BY fn.created_at DESC`
    ).all();
    res.json({ needs });
  });

  app.use('/api/pets', (req, res, next) => {
    if (req.method === 'GET') {
      return next();
    }
    return authMiddleware(req as AuthRequest, res, next);
  }, petRoutes);

  app.use('/api/fostering', fosteringRoutes);
  app.use('/api/messages', authMiddleware, messageRoutes);
  app.use('/api/lost-found', (req, res, next) => {
    return authMiddleware(req as AuthRequest, res, next);
  }, lostFoundRoutes);
  app.use('/api/profile', authMiddleware, profileRoutes);

  return app;
}
