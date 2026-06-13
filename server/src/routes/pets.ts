import { Router, Response } from 'express';
import { db } from '../db';
import { AuthRequest } from '../middleware/auth';
import { Pet } from '../types';

const router = Router();

router.get('/', (req: AuthRequest, res: Response) => {
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
  ).all(...params, size, offset) as Pet[];

  res.json({ pets, total: countRow.total, page: pageNum, pageSize: size });
});

router.get('/:id', (req: AuthRequest, res: Response) => {
  const pet = db.prepare(
    `SELECT p.*, u.nickname as owner_name, u.avatar as owner_avatar
     FROM pets p LEFT JOIN users u ON p.user_id = u.id
     WHERE p.id = ?`
  ).get(req.params.id) as Pet | undefined;

  if (!pet) {
    res.status(404).json({ error: '宠物不存在' });
    return;
  }

  res.json({ pet });
});

router.post('/', (req: AuthRequest, res: Response) => {
  const { name, breed, species, age, photo, vaccine, notes } = req.body;

  if (!name || !breed || !species) {
    res.status(400).json({ error: '宠物名字、品种和类型不能为空' });
    return;
  }

  const result = db.prepare(
    'INSERT INTO pets (user_id, name, breed, species, age, photo, vaccine, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
  ).run(req.userId!, name, breed, species, age || '', photo || '', vaccine || '', notes || '');

  const pet = db.prepare('SELECT * FROM pets WHERE id = ?').get(result.lastInsertRowid) as Pet;
  res.json({ pet });
});

router.put('/:id', (req: AuthRequest, res: Response) => {
  const existing = db.prepare('SELECT * FROM pets WHERE id = ? AND user_id = ?').get(req.params.id, req.userId!) as Pet | undefined;
  if (!existing) {
    res.status(404).json({ error: '宠物不存在或无权编辑' });
    return;
  }

  const { name, breed, species, age, photo, vaccine, notes } = req.body;

  db.prepare(
    'UPDATE pets SET name=?, breed=?, species=?, age=?, photo=?, vaccine=?, notes=? WHERE id=? AND user_id=?'
  ).run(
    name || existing.name,
    breed || existing.breed,
    species || existing.species,
    age ?? existing.age,
    photo ?? existing.photo,
    vaccine ?? existing.vaccine,
    notes ?? existing.notes,
    req.params.id,
    req.userId!
  );

  const pet = db.prepare('SELECT * FROM pets WHERE id = ?').get(req.params.id) as Pet;
  res.json({ pet });
});

router.delete('/:id', (req: AuthRequest, res: Response) => {
  const existing = db.prepare('SELECT * FROM pets WHERE id = ? AND user_id = ?').get(req.params.id, req.userId!) as Pet | undefined;
  if (!existing) {
    res.status(404).json({ error: '宠物不存在或无权删除' });
    return;
  }

  db.prepare('DELETE FROM pets WHERE id = ? AND user_id = ?').run(req.params.id, req.userId!);
  res.json({ message: '删除成功' });
});

router.get('/user/mine', (req: AuthRequest, res: Response) => {
  const pets = db.prepare(
    'SELECT * FROM pets WHERE user_id = ? ORDER BY created_at DESC'
  ).all(req.userId!) as Pet[];

  res.json({ pets });
});

export default router;
