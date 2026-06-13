import { Router, Response } from 'express';
import { db } from '../db';
import { AuthRequest } from '../middleware/auth';
import { LostPet, LostPetClue } from '../types';

const router = Router();

// Get all lost pets (for carousel)
router.get('/', (req: AuthRequest, res: Response) => {
  const { found, page = '1', pageSize = '20' } = req.query;
  const pageNum = parseInt(page as string) || 1;
  const size = parseInt(pageSize as string) || 20;
  const offset = (pageNum - 1) * size;

  let whereClause = '';
  const params: any[] = [];

  if (found !== undefined) {
    whereClause = 'WHERE lp.found = ?';
    params.push(parseInt(found as string));
  }

  const countRow = db.prepare(
    `SELECT COUNT(*) as total FROM lost_pets lp ${whereClause}`
  ).get(...params) as { total: number };

  const lostPets = db.prepare(
    `SELECT lp.*, u.nickname as user_nickname, u.phone as user_phone
     FROM lost_pets lp
     LEFT JOIN users u ON lp.user_id = u.id
     ${whereClause}
     ORDER BY lp.found ASC, lp.created_at DESC
     LIMIT ? OFFSET ?`
  ).all(...params, size, offset) as LostPet[];

  res.json({ lostPets, total: countRow.total, page: pageNum, pageSize: size });
});

// Get active (unfound) lost pets for carousel
router.get('/active', (req: AuthRequest, res: Response) => {
  const lostPets = db.prepare(
    `SELECT lp.*, u.nickname as user_nickname
     FROM lost_pets lp
     LEFT JOIN users u ON lp.user_id = u.id
     WHERE lp.found = 0
     ORDER BY lp.created_at DESC
     LIMIT 10`
  ).all() as LostPet[];

  res.json({ lostPets });
});

// Get my lost pet reports
router.get('/mine', (req: AuthRequest, res: Response) => {
  const lostPets = db.prepare(
    'SELECT * FROM lost_pets WHERE user_id = ? ORDER BY created_at DESC'
  ).all(req.userId!) as LostPet[];

  res.json({ lostPets });
});

// Create lost pet report
router.post('/', (req: AuthRequest, res: Response) => {
  const { photo, species, breed, name, lost_location, lost_date, contact, description } = req.body;

  if (!lost_location || !lost_date || !contact) {
    res.status(400).json({ error: '走失地点、时间和联系方式不能为空' });
    return;
  }

  const result = db.prepare(
    `INSERT INTO lost_pets (user_id, photo, species, breed, name, lost_location, lost_date, contact, description)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(req.userId!, photo || '', species || '', breed || '', name || '', lost_location, lost_date, contact, description || '');

  const lostPet = db.prepare('SELECT * FROM lost_pets WHERE id = ?').get(result.lastInsertRowid) as LostPet;
  res.json({ lostPet });
});

// Mark as found
router.put('/:id/found', (req: AuthRequest, res: Response) => {
  const existing = db.prepare('SELECT * FROM lost_pets WHERE id = ? AND user_id = ?').get(req.params.id, req.userId!) as LostPet | undefined;
  if (!existing) {
    res.status(404).json({ error: '记录不存在或无权操作' });
    return;
  }

  db.prepare('UPDATE lost_pets SET found = 1 WHERE id = ?').run(req.params.id);
  res.json({ message: '已标记为找回' });
});

// Delete lost pet report
router.delete('/:id', (req: AuthRequest, res: Response) => {
  const existing = db.prepare('SELECT * FROM lost_pets WHERE id = ? AND user_id = ?').get(req.params.id, req.userId!) as LostPet | undefined;
  if (!existing) {
    res.status(404).json({ error: '记录不存在或无权删除' });
    return;
  }

  db.prepare('DELETE FROM lost_pets WHERE id = ?').run(req.params.id);
  res.json({ message: '删除成功' });
});

// Submit a clue for a lost pet
router.post('/:id/clues', (req: AuthRequest, res: Response) => {
  const lostPetId = parseInt(req.params.id);
  const { sighting_time, sighting_location, photo, description } = req.body;

  if (!sighting_time || !sighting_location) {
    res.status(400).json({ error: '目击时间和地点不能为空' });
    return;
  }

  const lostPet = db.prepare('SELECT * FROM lost_pets WHERE id = ?').get(lostPetId) as LostPet | undefined;
  if (!lostPet) {
    res.status(404).json({ error: '寻宠启事不存在' });
    return;
  }

  if (lostPet.user_id === req.userId) {
    res.status(400).json({ error: '不能给自己的寻宠启事提供线索' });
    return;
  }

  const result = db.prepare(
    `INSERT INTO lost_pet_clues (lost_pet_id, witness_id, sighting_time, sighting_location, photo, description)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(lostPetId, req.userId!, sighting_time, sighting_location, photo || '', description || '');

  const clue = db.prepare(
    `SELECT lpc.*, u.nickname as witness_nickname, u.avatar as witness_avatar
     FROM lost_pet_clues lpc
     LEFT JOIN users u ON lpc.witness_id = u.id
     WHERE lpc.id = ?`
  ).get(result.lastInsertRowid) as LostPetClue;

  res.json({ clue });
});

// Get clues for a lost pet (only owner can see)
router.get('/:id/clues', (req: AuthRequest, res: Response) => {
  const lostPetId = parseInt(req.params.id);

  const lostPet = db.prepare('SELECT * FROM lost_pets WHERE id = ?').get(lostPetId) as LostPet | undefined;
  if (!lostPet) {
    res.status(404).json({ error: '寻宠启事不存在' });
    return;
  }

  if (lostPet.user_id !== req.userId) {
    res.status(403).json({ error: '只有发布者可以查看线索' });
    return;
  }

  const clues = db.prepare(
    `SELECT lpc.*, u.nickname as witness_nickname, u.avatar as witness_avatar
     FROM lost_pet_clues lpc
     LEFT JOIN users u ON lpc.witness_id = u.id
     WHERE lpc.lost_pet_id = ?
     ORDER BY lpc.created_at DESC`
  ).all(lostPetId) as LostPetClue[];

  res.json({ clues });
});

// Get clues I submitted
router.get('/clues/mine', (req: AuthRequest, res: Response) => {
  const clues = db.prepare(
    `SELECT lpc.*, lp.name as pet_name, lp.photo as pet_photo
     FROM lost_pet_clues lpc
     LEFT JOIN lost_pets lp ON lpc.lost_pet_id = lp.id
     WHERE lpc.witness_id = ?
     ORDER BY lpc.created_at DESC`
  ).all(req.userId!) as LostPetClue[];

  res.json({ clues });
});

export default router;
