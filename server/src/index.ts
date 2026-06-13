import express from 'express';
import cors from 'cors';
import { initTables } from './db';
import { seedData } from './seed';
import { authMiddleware, AuthRequest } from './middleware/auth';
import authRoutes from './routes/auth';
import petRoutes from './routes/pets';
import fosteringRoutes from './routes/fostering';
import messageRoutes from './routes/messages';
import lostFoundRoutes from './routes/lostFound';
import profileRoutes from './routes/profile';
import { db } from './db';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Initialize database
initTables();
seedData();

// Auth routes
app.use('/api/auth', authRoutes);

// Public: pet listing for browsing (before auth middleware on /api/pets)
app.get('/api/pets/list', (req, res) => {
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

// Public: active lost pets for carousel
app.get('/api/lost-found/active', (_req, res) => {
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

// Public: fostering list for browsing
app.get('/api/fostering/list', (_req, res) => {
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

// Protected routes - auth middleware applied
app.use('/api/pets', (req, res, next) => {
  // Only protect write operations on pets
  if (req.method === 'GET') {
    return next();
  }
  return authMiddleware(req as AuthRequest, res, next);
}, petRoutes);

app.use('/api/fostering', fosteringRoutes);
app.use('/api/messages', authMiddleware, messageRoutes);
app.use('/api/lost-found', (req, res, next) => {
  // Active route is handled above as public
  return authMiddleware(req as AuthRequest, res, next);
}, lostFoundRoutes);
app.use('/api/profile', authMiddleware, profileRoutes);

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

export default app;
