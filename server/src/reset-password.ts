import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { applyDefaults, loadEnvFile } from './config';
import { openDataSource } from './database/data-source';
import { hashPassword } from './auth/password';

async function main() {
  loadEnvFile();
  applyDefaults();
  const username = process.env.RESET_USERNAME ?? '';
  const password = process.env.RESET_PASSWORD ?? '';
  if (!username || password.length < 8) {
    console.error('RESET_USERNAME 与至少 8 位的 RESET_PASSWORD 都要提供');
    process.exit(1);
  }
  const dataSource: DataSource = await openDataSource();
  try {
    const rows = await dataSource.query('SELECT id FROM accounts WHERE username = ?', [username]);
    if (!rows.length) {
      console.error('账号不存在');
      process.exit(1);
    }
    await dataSource.query('UPDATE accounts SET password_hash = ? WHERE id = ?', [
      hashPassword(password),
      rows[0].id,
    ]);
    await dataSource.query('DELETE FROM sessions WHERE account_id = ?', [rows[0].id]);
    process.stdout.write(`已更新 ${username} 的密码\n`);
  } finally {
    await dataSource.destroy();
  }
}

void main();
