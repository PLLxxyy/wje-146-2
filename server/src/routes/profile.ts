import { Router, Response } from 'express';
import { db } from '../db';
import { AuthRequest } from '../middleware/auth';
import { User } from '../types';

const router = Router();

router.get('/', (req: AuthRequest, res: Response) => {
  const user = db.prepare(
    'SELECT id, username, nickname, avatar, phone, bio, created_at FROM users WHERE id = ?'
  ).get(req.userId!) as Omit<User, 'password'> | undefined;

  if (!user) {
    res.status(404).json({ error: '用户不存在' });
    return;
  }

  res.json({ user });
});

router.put('/', (req: AuthRequest, res: Response) => {
  const { nickname, avatar, phone, bio } = req.body;

  db.prepare(
    'UPDATE users SET nickname = COALESCE(?, nickname), avatar = COALESCE(?, avatar), phone = COALESCE(?, phone), bio = COALESCE(?, bio) WHERE id = ?'
  ).run(nickname, avatar, phone, bio, req.userId!);

  const user = db.prepare(
    'SELECT id, username, nickname, avatar, phone, bio, created_at FROM users WHERE id = ?'
  ).get(req.userId!) as Omit<User, 'password'>;

  res.json({ user });
});

export default router;
