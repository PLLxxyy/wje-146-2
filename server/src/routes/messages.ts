import { Router, Response } from 'express';
import { db } from '../db';
import { AuthRequest } from '../middleware/auth';
import { Message } from '../types';

const router = Router();

// Get conversations list
router.get('/conversations', (req: AuthRequest, res: Response) => {
  const userId = req.userId!;

  const fosteringConversations = db.prepare(`
    SELECT DISTINCT
      CASE WHEN m.from_user_id = ? THEN m.to_user_id ELSE m.from_user_id END as other_user_id,
      fn.id as fostering_need_id,
      NULL as lost_pet_id,
      fn.start_date, fn.end_date,
      p.name as pet_name,
      (SELECT content FROM messages WHERE fostering_need_id = fn.id
       AND (from_user_id = ? OR to_user_id = ?)
       ORDER BY created_at DESC LIMIT 1) as last_message,
      (SELECT created_at FROM messages WHERE fostering_need_id = fn.id
       AND (from_user_id = ? OR to_user_id = ?)
       ORDER BY created_at DESC LIMIT 1) as last_time,
      (SELECT COUNT(*) FROM messages WHERE fostering_need_id = fn.id
       AND to_user_id = ? AND read = 0) as unread_count
    FROM messages m
    LEFT JOIN fostering_needs fn ON m.fostering_need_id = fn.id
    LEFT JOIN pets p ON fn.pet_id = p.id
    WHERE m.fostering_need_id IS NOT NULL AND (m.from_user_id = ? OR m.to_user_id = ?)
    GROUP BY fn.id, other_user_id
  `).all(userId, userId, userId, userId, userId, userId, userId, userId) as any[];

  const lostPetConversations = db.prepare(`
    SELECT DISTINCT
      CASE WHEN m.from_user_id = ? THEN m.to_user_id ELSE m.from_user_id END as other_user_id,
      NULL as fostering_need_id,
      lp.id as lost_pet_id,
      NULL as start_date, NULL as end_date,
      lp.name as pet_name,
      (SELECT content FROM messages WHERE lost_pet_id = lp.id
       AND (from_user_id = ? OR to_user_id = ?)
       ORDER BY created_at DESC LIMIT 1) as last_message,
      (SELECT created_at FROM messages WHERE lost_pet_id = lp.id
       AND (from_user_id = ? OR to_user_id = ?)
       ORDER BY created_at DESC LIMIT 1) as last_time,
      (SELECT COUNT(*) FROM messages WHERE lost_pet_id = lp.id
       AND to_user_id = ? AND read = 0) as unread_count
    FROM messages m
    LEFT JOIN lost_pets lp ON m.lost_pet_id = lp.id
    WHERE m.lost_pet_id IS NOT NULL AND (m.from_user_id = ? OR m.to_user_id = ?)
    GROUP BY lp.id, other_user_id
  `).all(userId, userId, userId, userId, userId, userId, userId, userId) as any[];

  const allConversations = [...fosteringConversations, ...lostPetConversations];

  const enriched = allConversations.map((conv: any) => {
    const otherUser = db.prepare('SELECT id, nickname, avatar FROM users WHERE id = ?').get(conv.other_user_id) as any;
    return {
      ...conv,
      other_nickname: otherUser?.nickname || '',
      other_avatar: otherUser?.avatar || '',
    };
  });

  enriched.sort((a: any, b: any) => new Date(b.last_time || 0).getTime() - new Date(a.last_time || 0).getTime());

  res.json({ conversations: enriched });
});

// Get messages for a conversation (backward compatible with fostering needs)
router.get('/:fosteringNeedId', (req: AuthRequest, res: Response) => {
  const userId = req.userId!;
  const needId = req.params.fosteringNeedId;

  db.prepare(
    'UPDATE messages SET read = 1 WHERE fostering_need_id = ? AND to_user_id = ?'
  ).run(needId, userId);

  const messages = db.prepare(
    `SELECT m.*, u.nickname as from_nickname, u.avatar as from_avatar
     FROM messages m
     LEFT JOIN users u ON m.from_user_id = u.id
     WHERE m.fostering_need_id = ?
     ORDER BY m.created_at ASC`
  ).all(needId) as Message[];

  res.json({ messages });
});

// Get messages for a fostering conversation (explicit)
router.get('/fostering/:fosteringNeedId', (req: AuthRequest, res: Response) => {
  const userId = req.userId!;
  const needId = req.params.fosteringNeedId;

  db.prepare(
    'UPDATE messages SET read = 1 WHERE fostering_need_id = ? AND to_user_id = ?'
  ).run(needId, userId);

  const messages = db.prepare(
    `SELECT m.*, u.nickname as from_nickname, u.avatar as from_avatar
     FROM messages m
     LEFT JOIN users u ON m.from_user_id = u.id
     WHERE m.fostering_need_id = ?
     ORDER BY m.created_at ASC`
  ).all(needId) as Message[];

  res.json({ messages });
});

// Get messages for a lost pet conversation
router.get('/lost-pet/:lostPetId', (req: AuthRequest, res: Response) => {
  const userId = req.userId!;
  const lostPetId = req.params.lostPetId;

  db.prepare(
    'UPDATE messages SET read = 1 WHERE lost_pet_id = ? AND to_user_id = ?'
  ).run(lostPetId, userId);

  const messages = db.prepare(
    `SELECT m.*, u.nickname as from_nickname, u.avatar as from_avatar
     FROM messages m
     LEFT JOIN users u ON m.from_user_id = u.id
     WHERE m.lost_pet_id = ?
     ORDER BY m.created_at ASC`
  ).all(lostPetId) as Message[];

  res.json({ messages });
});

// Send a message
router.post('/', (req: AuthRequest, res: Response) => {
  const { to_user_id, fostering_need_id, lost_pet_id, content } = req.body;

  if (!content || !content.trim()) {
    res.status(400).json({ error: '消息内容不能为空' });
    return;
  }

  if (!to_user_id) {
    res.status(400).json({ error: '缺少接收者' });
    return;
  }

  if (fostering_need_id === undefined && lost_pet_id === undefined) {
    res.status(400).json({ error: '缺少必要参数' });
    return;
  }

  const result = db.prepare(
    'INSERT INTO messages (from_user_id, to_user_id, fostering_need_id, lost_pet_id, content) VALUES (?, ?, ?, ?, ?)'
  ).run(req.userId!, to_user_id, fostering_need_id || null, lost_pet_id || null, content.trim());

  const message = db.prepare(
    `SELECT m.*, u.nickname as from_nickname, u.avatar as from_avatar
     FROM messages m
     LEFT JOIN users u ON m.from_user_id = u.id
     WHERE m.id = ?`
  ).get(result.lastInsertRowid) as Message;

  res.json({ message });
});

export default router;
