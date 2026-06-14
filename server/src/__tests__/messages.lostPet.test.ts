import request from 'supertest';
import { createApp } from '../app';
import type { Database } from 'better-sqlite3';
import type { Application } from 'express';

declare global {
  var testDb: Database;
  var testHelpers: {
    generateToken: (userId: number) => string;
    createTestUser: (db: Database, username: string, password: string, nickname: string) => { id: number; token: string };
    createTestLostPet: (db: Database, userId: number, name: string) => number;
    createTestFosteringNeed: (db: Database, userId: number, petId: number) => number;
    createTestPet: (db: Database, userId: number, name: string) => number;
  };
}

describe('Lost Pet Clue Messages', () => {
  let app: Application;
  let owner: { id: number; token: string };
  let witness: { id: number; token: string };
  let anotherUser: { id: number; token: string };
  let lostPetId: number;
  let witnessUserId: number;

  beforeEach(() => {
    app = createApp(global.testDb);
    const db = global.testDb;

    owner = global.testHelpers.createTestUser(db, 'owner', '123456', '宠物主人');
    witness = global.testHelpers.createTestUser(db, 'witness', '123456', '目击者');
    anotherUser = global.testHelpers.createTestUser(db, 'other', '123456', '其他用户');
    witnessUserId = witness.id;

    lostPetId = global.testHelpers.createTestLostPet(db, owner.id, '胖橘');
  });

  describe('发送线索消息', () => {
    test('成功发送带 lost_pet_id 的线索消息', async () => {
      const res = await request(app)
        .post('/api/messages')
        .set('Authorization', `Bearer ${owner.token}`)
        .send({
          to_user_id: witnessUserId,
          lost_pet_id: lostPetId,
          content: '关于我走失的宠物，想了解更多线索',
        });

      expect(res.statusCode).toBe(200);
      expect(res.body.message).toBeDefined();
      expect(res.body.message.lost_pet_id).toBe(lostPetId);
      expect(res.body.message.fostering_need_id).toBeNull();
      expect(res.body.message.content).toBe('关于我走失的宠物，想了解更多线索');
      expect(res.body.message.from_user_id).toBe(owner.id);
      expect(res.body.message.to_user_id).toBe(witnessUserId);
    });

    test('目击者也可以给发布者发送线索相关消息', async () => {
      const res = await request(app)
        .post('/api/messages')
        .set('Authorization', `Bearer ${witness.token}`)
        .send({
          to_user_id: owner.id,
          lost_pet_id: lostPetId,
          content: '我昨天在公园附近看到过类似的猫',
        });

      expect(res.statusCode).toBe(200);
      expect(res.body.message.lost_pet_id).toBe(lostPetId);
      expect(res.body.message.content).toBe('我昨天在公园附近看到过类似的猫');
    });

    test('缺少 lost_pet_id 和 fostering_need_id 时返回错误', async () => {
      const res = await request(app)
        .post('/api/messages')
        .set('Authorization', `Bearer ${owner.token}`)
        .send({
          to_user_id: witnessUserId,
          content: '没有上下文的消息',
        });

      expect(res.statusCode).toBe(400);
      expect(res.body.error).toBe('缺少必要参数');
    });
  });

  describe('获取走失宠物消息', () => {
    beforeEach(async () => {
      await request(app)
        .post('/api/messages')
        .set('Authorization', `Bearer ${owner.token}`)
        .send({
          to_user_id: witnessUserId,
          lost_pet_id: lostPetId,
          content: '消息1',
        });

      await request(app)
        .post('/api/messages')
        .set('Authorization', `Bearer ${witness.token}`)
        .send({
          to_user_id: owner.id,
          lost_pet_id: lostPetId,
          content: '消息2',
        });
    });

    test('可以通过 /messages/lost-pet/:id 获取走失宠物相关消息', async () => {
      const res = await request(app)
        .get(`/api/messages/lost-pet/${lostPetId}`)
        .set('Authorization', `Bearer ${owner.token}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.messages.length).toBe(2);
      expect(res.body.messages[0].content).toBe('消息1');
      expect(res.body.messages[1].content).toBe('消息2');
      expect(res.body.messages[0].lost_pet_id).toBe(lostPetId);
    });

    test('获取消息后标记为已读', async () => {
      const res = await request(app)
        .get(`/api/messages/lost-pet/${lostPetId}`)
        .set('Authorization', `Bearer ${witness.token}`);

      expect(res.statusCode).toBe(200);

      const unreadCount = global.testDb.prepare(
        'SELECT COUNT(*) as cnt FROM messages WHERE lost_pet_id = ? AND to_user_id = ? AND read = 0'
      ).get(lostPetId, witness.id) as { cnt: number };

      expect(unreadCount.cnt).toBe(0);
    });
  });

  describe('会话列表', () => {
    beforeEach(async () => {
      await request(app)
        .post('/api/messages')
        .set('Authorization', `Bearer ${owner.token}`)
        .send({
          to_user_id: witnessUserId,
          lost_pet_id: lostPetId,
          content: '线索沟通消息',
        });
    });

    test('会话列表包含走失宠物线索会话', async () => {
      const res = await request(app)
        .get('/api/messages/conversations')
        .set('Authorization', `Bearer ${owner.token}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.conversations.length).toBeGreaterThan(0);

      const lostPetConv = res.body.conversations.find(
        (c: any) => c.lost_pet_id === lostPetId && c.other_user_id === witnessUserId
      );

      expect(lostPetConv).toBeDefined();
      expect(lostPetConv.pet_name).toBe('胖橘');
      expect(lostPetConv.last_message).toBe('线索沟通消息');
    });
  });
});
