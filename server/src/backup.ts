import 'reflect-metadata';
import { mkdirSync } from 'fs';
import { join } from 'path';
import Database from 'better-sqlite3';
import { applyDefaults, loadEnvFile } from './config';
import { shanghaiStamp } from './database/time';

async function main() {
  loadEnvFile();
  applyDefaults();
  const sourcePath = process.env.DATABASE_PATH!;
  const dir = process.env.BACKUP_DIR || '/data/backups';
  mkdirSync(dir, { recursive: true });
  const destination = join(dir, `familytree-${shanghaiStamp()}.db`);
  const db = new Database(sourcePath, { readonly: true, fileMustExist: true });
  await db.backup(destination);
  db.close();
  process.stdout.write(`${destination}\n`);
}

void main();
