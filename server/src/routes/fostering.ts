import { Router, Response } from 'express';
import { db } from '../db';
import { AuthRequest } from '../middleware/auth';
import { FosteringNeed, FosteringApplication, Review } from '../types';

const router = Router();

// Get all fostering needs
router.get('/', (req: AuthRequest, res: Response) => {
  const { status, page = '1', pageSize = '20' } = req.query;
  const pageNum = parseInt(page as string) || 1;
  const size = parseInt(pageSize as string) || 20;
  const offset = (pageNum - 1) * size;

  let whereClause = '';
  const params: any[] = [];

  if (status) {
    whereClause = 'WHERE fn.status = ?';
    params.push(status);
  }

  const countRow = db.prepare(
    `SELECT COUNT(*) as total FROM fostering_needs fn ${whereClause}`
  ).get(...params) as { total: number };

  const needs = db.prepare(
    `SELECT fn.*, p.name as pet_name, p.breed as pet_breed, p.photo as pet_photo, p.species as pet_species,
            u.nickname as user_nickname
     FROM fostering_needs fn
     LEFT JOIN pets p ON fn.pet_id = p.id
     LEFT JOIN users u ON fn.user_id = u.id
     ${whereClause}
     ORDER BY fn.created_at DESC
     LIMIT ? OFFSET ?`
  ).all(...params, size, offset) as FosteringNeed[];

  res.json({ needs, total: countRow.total, page: pageNum, pageSize: size });
});

// Create fostering need
router.post('/', (req: AuthRequest, res: Response) => {
  const { pet_id, start_date, end_date, requirements } = req.body;

  if (!pet_id || !start_date || !end_date) {
    res.status(400).json({ error: '请选择宠物并填写寄养时间段' });
    return;
  }

  const pet = db.prepare('SELECT * FROM pets WHERE id = ? AND user_id = ?').get(pet_id, req.userId!);
  if (!pet) {
    res.status(400).json({ error: '宠物不存在或不属于您' });
    return;
  }

  const result = db.prepare(
    'INSERT INTO fostering_needs (user_id, pet_id, start_date, end_date, requirements) VALUES (?, ?, ?, ?, ?)'
  ).run(req.userId!, pet_id, start_date, end_date, requirements || '');

  const need = db.prepare('SELECT * FROM fostering_needs WHERE id = ?').get(result.lastInsertRowid) as FosteringNeed;
  res.json({ need });
});

// Get my fostering needs
router.get('/mine', (req: AuthRequest, res: Response) => {
  const needs = db.prepare(
    `SELECT fn.*, p.name as pet_name, p.breed as pet_breed, p.photo as pet_photo
     FROM fostering_needs fn
     LEFT JOIN pets p ON fn.pet_id = p.id
     WHERE fn.user_id = ?
     ORDER BY fn.created_at DESC`
  ).all(req.userId!) as FosteringNeed[];

  res.json({ needs });
});

// Apply for fostering
router.post('/:id/apply', (req: AuthRequest, res: Response) => {
  const { experience, environment } = req.body;
  const needId = req.params.id;

  const need = db.prepare('SELECT * FROM fostering_needs WHERE id = ?').get(needId) as FosteringNeed | undefined;
  if (!need) {
    res.status(404).json({ error: '寄养需求不存在' });
    return;
  }

  if (need.user_id === req.userId!) {
    res.status(400).json({ error: '不能申请自己的寄养需求' });
    return;
  }

  if (need.status !== 'open') {
    res.status(400).json({ error: '该寄养需求已关闭' });
    return;
  }

  const existingApp = db.prepare(
    'SELECT id FROM fostering_applications WHERE fostering_need_id = ? AND applicant_id = ?'
  ).get(needId, req.userId!);

  if (existingApp) {
    res.status(400).json({ error: '您已申请过该寄养需求' });
    return;
  }

  const result = db.prepare(
    'INSERT INTO fostering_applications (fostering_need_id, applicant_id, experience, environment) VALUES (?, ?, ?, ?)'
  ).run(needId, req.userId!, experience || '', environment || '');

  const application = db.prepare('SELECT * FROM fostering_applications WHERE id = ?').get(result.lastInsertRowid) as FosteringApplication;
  res.json({ application });
});

// Get applications for a fostering need
router.get('/:id/applications', (req: AuthRequest, res: Response) => {
  const need = db.prepare('SELECT * FROM fostering_needs WHERE id = ?').get(req.params.id) as FosteringNeed | undefined;
  if (!need) {
    res.status(404).json({ error: '寄养需求不存在' });
    return;
  }

  const applications = db.prepare(
    `SELECT fa.*, u.nickname as applicant_nickname, u.avatar as applicant_avatar
     FROM fostering_applications fa
     LEFT JOIN users u ON fa.applicant_id = u.id
     WHERE fa.fostering_need_id = ?
     ORDER BY fa.created_at DESC`
  ).all(req.params.id) as FosteringApplication[];

  res.json({ applications, need });
});

// Accept an application
router.post('/applications/:id/accept', (req: AuthRequest, res: Response) => {
  const app = db.prepare(
    `SELECT fa.*, fn.user_id as need_owner_id, fn.status as need_status
     FROM fostering_applications fa
     LEFT JOIN fostering_needs fn ON fa.fostering_need_id = fn.id
     WHERE fa.id = ?`
  ).get(req.params.id) as (FosteringApplication & { need_owner_id: number; need_status: string }) | undefined;

  if (!app) {
    res.status(404).json({ error: '申请不存在' });
    return;
  }

  if (app.need_owner_id !== req.userId!) {
    res.status(403).json({ error: '无权操作' });
    return;
  }

  db.prepare('UPDATE fostering_applications SET status = ? WHERE id = ?').run('accepted', req.params.id);
  db.prepare('UPDATE fostering_applications SET status = ? WHERE fostering_need_id = ? AND id != ?').run('rejected', app.fostering_need_id, req.params.id);
  db.prepare('UPDATE fostering_needs SET status = ? WHERE id = ?').run('matched', app.fostering_need_id);

  res.json({ message: '已确认寄养人' });
});

// Get my applications (as applicant)
router.get('/my-applications', (req: AuthRequest, res: Response) => {
  const applications = db.prepare(
    `SELECT fa.*, fn.start_date, fn.end_date, fn.requirements, fn.status as need_status,
            p.name as pet_name, p.breed as pet_breed, p.photo as pet_photo,
            u.nickname as owner_nickname
     FROM fostering_applications fa
     LEFT JOIN fostering_needs fn ON fa.fostering_need_id = fn.id
     LEFT JOIN pets p ON fn.pet_id = p.id
     LEFT JOIN users u ON fn.user_id = u.id
     WHERE fa.applicant_id = ?
     ORDER BY fa.created_at DESC`
  ).all(req.userId!) as (FosteringApplication & { pet_name?: string; owner_nickname?: string })[];

  res.json({ applications });
});

// Complete fostering
router.post('/:id/complete', (req: AuthRequest, res: Response) => {
  const need = db.prepare('SELECT * FROM fostering_needs WHERE id = ?').get(req.params.id) as FosteringNeed | undefined;
  if (!need) {
    res.status(404).json({ error: '寄养需求不存在' });
    return;
  }

  if (need.user_id !== req.userId!) {
    res.status(403).json({ error: '无权操作' });
    return;
  }

  db.prepare('UPDATE fostering_needs SET status = ? WHERE id = ?').run('completed', req.params.id);
  res.json({ message: '寄养已完成' });
});

// Submit review
router.post('/:id/review', (req: AuthRequest, res: Response) => {
  const { rating, comment, reviewee_id } = req.body;
  const needId = req.params.id;

  if (!rating || rating < 1 || rating > 5) {
    res.status(400).json({ error: '评分应在1-5之间' });
    return;
  }

  const need = db.prepare('SELECT * FROM fostering_needs WHERE id = ?').get(needId) as FosteringNeed | undefined;
  if (!need) {
    res.status(404).json({ error: '寄养需求不存在' });
    return;
  }

  const existingReview = db.prepare(
    'SELECT id FROM reviews WHERE fostering_need_id = ? AND reviewer_id = ?'
  ).get(needId, req.userId!);

  if (existingReview) {
    res.status(400).json({ error: '您已评价过' });
    return;
  }

  db.prepare(
    'INSERT INTO reviews (fostering_need_id, reviewer_id, reviewee_id, rating, comment) VALUES (?, ?, ?, ?, ?)'
  ).run(needId, req.userId!, reviewee_id, rating, comment || '');

  res.json({ message: '评价成功' });
});

// Get reviews for a user
router.get('/user/:userId/reviews', (req: AuthRequest, res: Response) => {
  const reviews = db.prepare(
    `SELECT r.*, u.nickname as reviewer_nickname
     FROM reviews r
     LEFT JOIN users u ON r.reviewer_id = u.id
     WHERE r.reviewee_id = ?
     ORDER BY r.created_at DESC`
  ).all(req.params.userId) as Review[];

  res.json({ reviews });
});

export default router;
