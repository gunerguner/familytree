import { mkdtempSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

const dir = mkdtempSync(join(tmpdir(), 'familytree-'));
process.env.DATABASE_PATH = join(dir, 'test.sqlite');
process.env.SESSION_SECRET = 'test-session-secret-must-be-32b-long';
process.env.BOOTSTRAP_USERNAME = 'zhang';
process.env.BOOTSTRAP_PASSWORD = 'password1';
process.env.NODE_ENV = 'test';
process.env.COOKIE_SECURE = 'false';
delete process.env.STATIC_DIR;
