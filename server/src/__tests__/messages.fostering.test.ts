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

describe('Fostering Messages (No Regression)', () => {
  let app: Application;
  let user1: { id: number; token: string };
  let user2: { id: number; token: string };
  let petId: number;
  let fosteringNeedId: number;

  beforeEach(() => {
    app = createApp(global.testDb);
    const db = global.testDb;

    user1 = global.testHelpers.createTestUser(db, 'user1', '123456', '用户一');
    user2 = global.testHelpers.createTestUser(db, 'user2', '123456', '用户二');

    petId = global.testHelpers.createTestPet(db, user1.id, '大橘');
    fosteringNeedId = global.testHelpers.createTestFosteringNeed(db, user1.id, petId);
  });

  test('发送寄养消息成功（向后兼容）', async () => {
    const res = await request(app)
      .post('/api/messages')
      .set('Authorization', `Bearer ${user1.token}`)
      .send({
        to_user_id: user2.id,
        fostering_need_id: fosteringNeedId,
        content: '请问你能帮忙照顾我的猫吗？',
      });

    expect(res.statusCode).toBe(200);
    expect(res.body.message).toBeDefined();
    expect(res.body.message.fostering_need_id).toBe(fosteringNeedId);
    expect(res.body.message.lost_pet_id).toBeNull();
    expect(res.body.message.content).toBe('请问你能帮忙照顾我的猫吗？');
  });

  test('通过旧路由 /messages/:fosteringNeedId 获取寄养消息', async () => {
    await request(app)
      .post('/api/messages')
      .set('Authorization', `Bearer ${user1.token}`)
      .send({
        to_user_id: user2.id,
        fostering_need_id: fosteringNeedId,
        content: '消息1',
      });

    await request(app)
      .post('/api/messages')
      .set('Authorization', `Bearer ${user2.token}`)
      .send({
        to_user_id: user1.id,
        fostering_need_id: fosteringNeedId,
        content: '消息2',
      });

    const res = await request(app)
      .get(`/api/messages/${fosteringNeedId}`)
      .set('Authorization', `Bearer ${user1.token}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.messages.length).toBe(2);
    expect(res.body.messages[0].content).toBe('消息1');
    expect(res.body.messages[1].content).toBe('消息2');
  });

  test('通过新路由 /messages/fostering/:fosteringNeedId 获取寄养消息', async () => {
    await request(app)
      .post('/api/messages')
      .set('Authorization', `Bearer ${user1.token}`)
      .send({
        to_user_id: user2.id,
        fostering_need_id: fosteringNeedId,
        content: '消息A',
      });

    const res = await request(app)
      .get(`/api/messages/fostering/${fosteringNeedId}`)
      .set('Authorization', `Bearer ${user2.token}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.messages.length).toBe(1);
    expect(res.body.messages[0].content).toBe('消息A');
  });

  test('寄养消息在会话列表中正确显示', async () => {
    await request(app)
      .post('/api/messages')
      .set('Authorization', `Bearer ${user1.token}`)
      .send({
        to_user_id: user2.id,
        fostering_need_id: fosteringNeedId,
        content: '寄养沟通消息',
      });

    const res = await request(app)
      .get('/api/messages/conversations')
      .set('Authorization', `Bearer ${user1.token}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.conversations.length).toBe(1);

    const conv = res.body.conversations[0];
    expect(conv.fostering_need_id).toBe(fosteringNeedId);
    expect(conv.lost_pet_id).toBeNull();
    expect(conv.pet_name).toBe('大橘');
    expect(conv.last_message).toBe('寄养沟通消息');
    expect(conv.other_user_id).toBe(user2.id);
  });

  test('寄养消息和线索消息可以共存于会话列表', async () => {
    const lostPetId = global.testHelpers.createTestLostPet(global.testDb, user1.id, '走失的猫');

    await request(app)
      .post('/api/messages')
      .set('Authorization', `Bearer ${user1.token}`)
      .send({
        to_user_id: user2.id,
        fostering_need_id: fosteringNeedId,
        content: '寄养消息',
      });

    await request(app)
      .post('/api/messages')
      .set('Authorization', `Bearer ${user1.token}`)
      .send({
        to_user_id: user2.id,
        lost_pet_id: lostPetId,
        content: '线索消息',
      });

    const res = await request(app)
      .get('/api/messages/conversations')
      .set('Authorization', `Bearer ${user1.token}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.conversations.length).toBe(2);

    const fosteringConv = res.body.conversations.find((c: any) => c.fostering_need_id === fosteringNeedId);
    const lostPetConv = res.body.conversations.find((c: any) => c.lost_pet_id === lostPetId);

    expect(fosteringConv).toBeDefined();
    expect(lostPetConv).toBeDefined();
    expect(fosteringConv.fostering_need_id).toBe(fosteringNeedId);
    expect(lostPetConv.lost_pet_id).toBe(lostPetId);
    expect(fosteringConv.lost_pet_id).toBeNull();
    expect(lostPetConv.fostering_need_id).toBeNull();
  });

  test('获取寄养消息后正确标记已读', async () => {
    await request(app)
      .post('/api/messages')
      .set('Authorization', `Bearer ${user2.token}`)
      .send({
        to_user_id: user1.id,
        fostering_need_id: fosteringNeedId,
        content: '未读消息',
      });

    const unreadBefore = global.testDb.prepare(
      'SELECT COUNT(*) as cnt FROM messages WHERE fostering_need_id = ? AND to_user_id = ? AND read = 0'
    ).get(fosteringNeedId, user1.id) as { cnt: number };
    expect(unreadBefore.cnt).toBe(1);

    await request(app)
      .get(`/api/messages/${fosteringNeedId}`)
      .set('Authorization', `Bearer ${user1.token}`);

    const unreadAfter = global.testDb.prepare(
      'SELECT COUNT(*) as cnt FROM messages WHERE fostering_need_id = ? AND to_user_id = ? AND read = 0'
    ).get(fosteringNeedId, user1.id) as { cnt: number };
    expect(unreadAfter.cnt).toBe(0);
  });
});
