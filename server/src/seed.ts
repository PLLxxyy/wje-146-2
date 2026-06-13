import bcrypt from 'bcryptjs';
import { db } from './db';

export function seedData() {
  const userCount = db.prepare('SELECT COUNT(*) as cnt FROM users').get() as { cnt: number };
  if (userCount.cnt > 0) return;

  console.log('Seeding database...');

  const hash1 = bcrypt.hashSync('123456', 10);
  const hash2 = bcrypt.hashSync('123456', 10);

  const insertUser = db.prepare(
    'INSERT INTO users (username, password, nickname, phone, bio) VALUES (?, ?, ?, ?, ?)'
  );

  insertUser.run('user1', hash1, '猫咪爱好者', '13800001111', '家有三只猫，喜欢猫咪的一切');
  insertUser.run('user2', hash2, '遛狗达人', '13800002222', '专业遛狗五年，柯基重度粉丝');

  const insertPet = db.prepare(
    'INSERT INTO pets (user_id, name, breed, species, age, photo, vaccine, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
  );

  insertPet.run(1, '橘子', '中华田园猫', '猫', '3岁', '', '已完成全部疫苗接种', '性格温顺，喜欢晒太阳');
  insertPet.run(1, '布丁', '布偶猫', '猫', '1岁', '', '已完成基础疫苗', '胆子小，需要安静环境');
  insertPet.run(1, '小绿', '虎皮鹦鹉', '异宠', '6个月', '', '无需接种', '会说你好，需要每天放风');
  insertPet.run(2, '大福', '柯基', '狗', '2岁', '', '已完成狂犬疫苗', '精力旺盛，喜欢散步');
  insertPet.run(2, '豆豆', '柴犬', '狗', '4岁', '', '已完成全部疫苗', '很乖，会握手坐下');

  const insertNeed = db.prepare(
    'INSERT INTO fostering_needs (user_id, pet_id, start_date, end_date, requirements, status) VALUES (?, ?, ?, ?, ?, ?)'
  );

  insertNeed.run(1, 1, '2026-07-01', '2026-07-15', '需要每天晒太阳，喂两次猫粮，不要换猫砂品牌', 'open');
  insertNeed.run(2, 4, '2026-08-01', '2026-08-10', '每天早晚各遛一次，每次至少30分钟', 'open');

  const insertLost = db.prepare(
    'INSERT INTO lost_pets (user_id, species, breed, name, lost_location, lost_date, contact, description, found) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
  );

  insertLost.run(1, '猫', '橘猫', '胖橘', 'XX小区3号楼附近', '2026-06-10', '13800001111', '走失时穿蓝色项圈，体型偏胖，不怕人', 0);

  console.log('Seed data inserted.');
}
