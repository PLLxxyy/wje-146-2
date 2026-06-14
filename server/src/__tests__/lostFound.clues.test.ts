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

describe('Lost Pet Clues Permission', () => {
  let app: Application;
  let owner: { id: number; token: string };
  let witness: { id: number; token: string };
  let anotherUser: { id: number; token: string };
  let lostPetId: number;

  beforeEach(() => {
    app = createApp(global.testDb);
    const db = global.testDb;

    owner = global.testHelpers.createTestUser(db, 'owner2', '123456', '宠物主人2');
    witness = global.testHelpers.createTestUser(db, 'witness2', '123456', '目击者2');
    anotherUser = global.testHelpers.createTestUser(db, 'other2', '123456', '其他用户2');

    lostPetId = global.testHelpers.createTestLostPet(db, owner.id, '胖橘2');
  });

  describe('提交线索', () => {
    test('非发布者可以提交线索', async () => {
      const res = await request(app)
        .post(`/api/lost-found/${lostPetId}/clues`)
        .set('Authorization', `Bearer ${witness.token}`)
        .send({
          sighting_time: '2026-06-12T14:30:00',
          sighting_location: '公园东门',
          photo: '',
          description: '看到一只橘猫在垃圾桶附近',
        });

      expect(res.statusCode).toBe(200);
      expect(res.body.clue).toBeDefined();
      expect(res.body.clue.sighting_location).toBe('公园东门');
      expect(res.body.clue.witness_id).toBe(witness.id);
    });

    test('发布者不能给自己的寻宠启事提交线索', async () => {
      const res = await request(app)
        .post(`/api/lost-found/${lostPetId}/clues`)
        .set('Authorization', `Bearer ${owner.token}`)
        .send({
          sighting_time: '2026-06-12T14:30:00',
          sighting_location: '公园东门',
          description: '测试',
        });

      expect(res.statusCode).toBe(400);
      expect(res.body.error).toBe('不能给自己的寻宠启事提供线索');
    });

    test('提交线索时缺少必要字段返回错误', async () => {
      const res = await request(app)
        .post(`/api/lost-found/${lostPetId}/clues`)
        .set('Authorization', `Bearer ${witness.token}`)
        .send({
          description: '缺少时间和地点',
        });

      expect(res.statusCode).toBe(400);
      expect(res.body.error).toBe('目击时间和地点不能为空');
    });
  });

  describe('查看线索权限', () => {
    beforeEach(async () => {
      await request(app)
        .post(`/api/lost-found/${lostPetId}/clues`)
        .set('Authorization', `Bearer ${witness.token}`)
        .send({
          sighting_time: '2026-06-12T14:30:00',
          sighting_location: '公园东门',
          description: '目击者提供的线索',
        });
    });

    test('发布者可以查看自己寻宠启事的线索', async () => {
      const res = await request(app)
        .get(`/api/lost-found/${lostPetId}/clues`)
        .set('Authorization', `Bearer ${owner.token}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.clues).toBeDefined();
      expect(res.body.clues.length).toBe(1);
      expect(res.body.clues[0].description).toBe('目击者提供的线索');
      expect(res.body.clues[0].witness_nickname).toBe('目击者2');
    });

    test('非发布者（目击者本人）不能查看线索', async () => {
      const res = await request(app)
        .get(`/api/lost-found/${lostPetId}/clues`)
        .set('Authorization', `Bearer ${witness.token}`);

      expect(res.statusCode).toBe(403);
      expect(res.body.error).toBe('只有发布者可以查看线索');
    });

    test('完全无关的其他用户不能查看线索', async () => {
      const res = await request(app)
        .get(`/api/lost-found/${lostPetId}/clues`)
        .set('Authorization', `Bearer ${anotherUser.token}`);

      expect(res.statusCode).toBe(403);
      expect(res.body.error).toBe('只有发布者可以查看线索');
    });

    test('未登录用户不能查看线索', async () => {
      const res = await request(app)
        .get(`/api/lost-found/${lostPetId}/clues`);

      expect(res.statusCode).toBe(401);
    });
  });

  describe('标记找回权限', () => {
    test('发布者可以标记已找回', async () => {
      const res = await request(app)
        .put(`/api/lost-found/${lostPetId}/found`)
        .set('Authorization', `Bearer ${owner.token}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.message).toBe('已标记为找回');

      const updatedPet = global.testDb.prepare(
        'SELECT found FROM lost_pets WHERE id = ?'
      ).get(lostPetId) as { found: number };
      expect(updatedPet.found).toBe(1);
    });

    test('非发布者不能标记已找回', async () => {
      const res = await request(app)
        .put(`/api/lost-found/${lostPetId}/found`)
        .set('Authorization', `Bearer ${anotherUser.token}`);

      expect(res.statusCode).toBe(404);
      expect(res.body.error).toBe('记录不存在或无权操作');

      const updatedPet = global.testDb.prepare(
        'SELECT found FROM lost_pets WHERE id = ?'
      ).get(lostPetId) as { found: number };
      expect(updatedPet.found).toBe(0);
    });
  });

  describe('多个线索', () => {
    beforeEach(async () => {
      await request(app)
        .post(`/api/lost-found/${lostPetId}/clues`)
        .set('Authorization', `Bearer ${witness.token}`)
        .send({
          sighting_time: '2026-06-12T10:00:00',
          sighting_location: '地点A',
          description: '线索1',
        });

      global.testDb.prepare(
        `UPDATE lost_pet_clues SET created_at = datetime('now', '-1 minute') WHERE description = '线索1'`
      ).run();

      await request(app)
        .post(`/api/lost-found/${lostPetId}/clues`)
        .set('Authorization', `Bearer ${anotherUser.token}`)
        .send({
          sighting_time: '2026-06-12T15:00:00',
          sighting_location: '地点B',
          description: '线索2',
        });
    });

    test('发布者可以看到所有线索并按时间倒序排列', async () => {
      const res = await request(app)
        .get(`/api/lost-found/${lostPetId}/clues`)
        .set('Authorization', `Bearer ${owner.token}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.clues.length).toBe(2);
      expect(res.body.clues[0].description).toBe('线索2');
      expect(res.body.clues[1].description).toBe('线索1');
      expect(res.body.clues[0].witness_nickname).toBe('其他用户2');
      expect(res.body.clues[1].witness_nickname).toBe('目击者2');
    });
  });

  describe('我提供的线索', () => {
    beforeEach(async () => {
      const otherLostPetId = global.testHelpers.createTestLostPet(global.testDb, anotherUser.id, '其他宠物');

      await request(app)
        .post(`/api/lost-found/${lostPetId}/clues`)
        .set('Authorization', `Bearer ${witness.token}`)
        .send({
          sighting_time: '2026-06-12T10:00:00',
          sighting_location: '地点A',
          description: '给胖橘2的线索',
        });

      global.testDb.prepare(
        `UPDATE lost_pet_clues SET created_at = datetime('now', '-1 minute') WHERE description = '给胖橘2的线索'`
      ).run();

      await request(app)
        .post(`/api/lost-found/${otherLostPetId}/clues`)
        .set('Authorization', `Bearer ${witness.token}`)
        .send({
          sighting_time: '2026-06-13T10:00:00',
          sighting_location: '地点B',
          description: '给其他宠物的线索',
        });
    });

    test('目击者可以查看自己提供的所有线索', async () => {
      const res = await request(app)
        .get('/api/lost-found/clues/mine')
        .set('Authorization', `Bearer ${witness.token}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.clues.length).toBe(2);
      expect(res.body.clues[0].pet_name).toBe('其他宠物');
      expect(res.body.clues[1].pet_name).toBe('胖橘2');
    });

    test('未提供过线索的用户返回空列表', async () => {
      const res = await request(app)
        .get('/api/lost-found/clues/mine')
        .set('Authorization', `Bearer ${owner.token}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.clues.length).toBe(0);
    });
  });
});
