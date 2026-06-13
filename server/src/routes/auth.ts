import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import { db } from '../db';
import { generateToken, AuthRequest } from '../middleware/auth';
import { User } from '../types';

const router = Router();

router.post('/register', (req: AuthRequest, res: Response) => {
  const { username, password, nickname } = req.body;

  if (!username || !password) {
    res.status(400).json({ error: '用户名和密码不能为空' });
    return;
  }

  if (username.length < 2 || username.length > 20) {
    res.status(400).json({ error: '用户名长度应在2-20个字符之间' });
    return;
  }

  if (password.length < 6) {
    res.status(400).json({ error: '密码长度不能少于6位' });
    return;
  }

  const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
  if (existing) {
    res.status(400).json({ error: '用户名已存在' });
    return;
  }

  const hashedPassword = bcrypt.hashSync(password, 10);
  const result = db.prepare(
    'INSERT INTO users (username, password, nickname) VALUES (?, ?, ?)'
  ).run(username, hashedPassword, nickname || username);

  const token = generateToken(result.lastInsertRowid as number);
  res.json({
    token,
    user: { id: result.lastInsertRowid, username, nickname: nickname || username }
  });
});

router.post('/login', (req: AuthRequest, res: Response) => {
  const { username, password } = req.body;

  if (!username || !password) {
    res.status(400).json({ error: '用户名和密码不能为空' });
    return;
  }

  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username) as User | undefined;
  if (!user) {
    res.status(401).json({ error: '用户名或密码错误' });
    return;
  }

  const valid = bcrypt.compareSync(password, user.password);
  if (!valid) {
    res.status(401).json({ error: '用户名或密码错误' });
    return;
  }

  const token = generateToken(user.id);
  res.json({
    token,
    user: { id: user.id, username: user.username, nickname: user.nickname, avatar: user.avatar }
  });
});

router.get('/me', (req: AuthRequest, res: Response) => {
  const user = db.prepare(
    'SELECT id, username, nickname, avatar, phone, bio, created_at FROM users WHERE id = ?'
  ).get(req.userId!) as Omit<User, 'password'> | undefined;

  if (!user) {
    res.status(404).json({ error: '用户不存在' });
    return;
  }

  res.json({ user });
});

export default router;
