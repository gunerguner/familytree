import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

export function loadEnvFile(): void {
  const candidates = [join(process.cwd(), '.env'), join(process.cwd(), 'server/.env')];
  for (const path of candidates) {
    if (!existsSync(path)) continue;
    for (const line of readFileSync(path, 'utf8').split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
      if (eq < 0) continue;
      const key = trimmed.slice(0, eq).trim();
      let value = trimmed.slice(eq + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      if (process.env[key] === undefined) process.env[key] = value;
    }
  }
}

export function applyDefaults(): void {
  if (!process.env.DATABASE_PATH) {
    if (process.env.NODE_ENV === 'production') {
      console.error('缺少 DATABASE_PATH');
      process.exit(1);
    }
    process.env.DATABASE_PATH = join(process.cwd(), 'data/dev.sqlite');
  }
  const secret = process.env.SESSION_SECRET ?? '';
  if (secret.length < 32) {
    console.error('SESSION_SECRET 至少需要 32 个字符');
    process.exit(1);
  }
}
