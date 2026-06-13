import { Router, Response } from 'express';
import { db } from '../db';
import { AuthRequest } from '../middleware/auth';
import { Message } from '../types';

const router = Router();

// Get conversations list
router.get('/conversations', (req: AuthRequest, res: Response) => {
  const userId = req.userId!;

  const conversations = db.prepare(`
    SELECT DISTINCT
      CASE WHEN m.from_user_id = ? THEN m.to_user_id ELSE m.from_user_id END as other_user_id,
      fn.id as fostering_need_id,
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
    WHERE m.from_user_id = ? OR m.to_user_id = ?
    GROUP BY fn.id, other_user_id
    ORDER BY last_time DESC
  `).all(userId, userId, userId, userId, userId, userId, userId, userId) as any[];

  // Enrich with user info
  const enriched = conversations.map((conv: any) => {
    const otherUser = db.prepare('SELECT id, nickname, avatar FROM users WHERE id = ?').get(conv.other_user_id) as any;
    return {
      ...conv,
      other_nickname: otherUser?.nickname || '',
      other_avatar: otherUser?.avatar || '',
    };
  });

  res.json({ conversations: enriched });
});

// Get messages for a conversation
router.get('/:fosteringNeedId', (req: AuthRequest, res: Response) => {
  const userId = req.userId!;
  const needId = req.params.fosteringNeedId;

  // Mark messages as read
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

// Send a message
router.post('/', (req: AuthRequest, res: Response) => {
  const { to_user_id, fostering_need_id, content } = req.body;

  if (!content || !content.trim()) {
    res.status(400).json({ error: '消息内容不能为空' });
    return;
  }

  if (!to_user_id || !fostering_need_id) {
    res.status(400).json({ error: '缺少必要参数' });
    return;
  }

  const result = db.prepare(
    'INSERT INTO messages (from_user_id, to_user_id, fostering_need_id, content) VALUES (?, ?, ?, ?)'
  ).run(req.userId!, to_user_id, fostering_need_id, content.trim());

  const message = db.prepare(
    `SELECT m.*, u.nickname as from_nickname, u.avatar as from_avatar
     FROM messages m
     LEFT JOIN users u ON m.from_user_id = u.id
     WHERE m.id = ?`
  ).get(result.lastInsertRowid) as Message;

  res.json({ message });
});

export default router;
