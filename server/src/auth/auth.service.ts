import {
  HttpException,
  Inject,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { DataSource, Repository } from 'typeorm';
import { DATA_SOURCE } from '../database/database.module';
import { shanghaiNow } from '../database/time';
import { Account } from './account.entity';
import { hashPassword, verifyPassword } from './password';
import { Session } from './session.entity';
import { issueToken, tokenHash } from './token';

const COOKIE = 'familytree_session';
const WINDOW_MS = 10 * 60 * 1000;
const MAX_FAILS = 8;
const SESSION_MS = 14 * 24 * 60 * 60 * 1000;

type Bucket = { fails: number; resetAt: number };

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly buckets = new Map<string, Bucket>();
  private readonly accounts: Repository<Account>;
  private readonly sessions: Repository<Session>;

  constructor(@Inject(DATA_SOURCE) private readonly dataSource: DataSource) {
    this.accounts = dataSource.getRepository(Account);
    this.sessions = dataSource.getRepository(Session);
  }

  async ensureBootstrapAccount(): Promise<void> {
    const count = await this.accounts.count();
    if (count > 0) return;
    const username = process.env.BOOTSTRAP_USERNAME ?? '';
    const password = process.env.BOOTSTRAP_PASSWORD ?? '';
    if (!username || !password || username.length > 32) {
      this.logger.error('还没有账号，且引导用户名或密码不符合要求');
      process.exit(1);
    }
    await this.accounts.save(
      this.accounts.create({
        username,
        passwordHash: hashPassword(password),
        createdAt: shanghaiNow(),
      }),
    );
  }

  clientIp(req: Request): string {
    const remote = req.socket?.remoteAddress ?? '';
    const normalized = remote.replace(/^::ffff:/, '');
    const trusted = new Set(['127.0.0.1', '::1']);
    const extra = process.env.TRUSTED_PROXY;
    if (extra) {
      for (const item of extra.split(',')) trusted.add(item.trim());
    }
    if (trusted.has(remote) || trusted.has(normalized)) {
      const forwarded = req.header('x-forwarded-for');
      if (forwarded) return forwarded.split(',')[0].trim();
    }
    return normalized || remote || 'unknown';
  }

  async login(username: string, password: string, ip: string, res: Response): Promise<void> {
    if (this.locked(ip)) {
      throw new HttpException({ error: '稍后再试' }, 429);
    }
    const account = await this.accounts.findOne({ where: { username } });
    if (!account || !verifyPassword(password, account.passwordHash)) {
      this.recordFailure(ip);
      this.logger.warn(`登录失败 ip=${ip} username=${username}`);
      throw new UnauthorizedException({ error: '账号或密码不正确' });
    }
    this.buckets.delete(ip);
    await this.sessions.delete({ accountId: account.id });
    const secret = this.secret();
    const issued = issueToken(secret);
    const now = new Date();
    const expires = new Date(now.getTime() + SESSION_MS);
    await this.sessions.save(
      this.sessions.create({
        accountId: account.id,
        tokenHash: issued.hash,
        expiresAt: shanghaiNow(expires),
        createdAt: shanghaiNow(now),
      }),
    );
    this.setCookie(res, issued.cookie, expires);
  }

  async current(req: Request): Promise<Account | null> {
    const raw = this.readCookie(req);
    if (!raw) return null;
    const hash = tokenHash(raw, this.secret());
    if (!hash) return null;
    const session = await this.sessions.findOne({ where: { tokenHash: hash } });
    if (!session) return null;
    if (Date.parse(session.expiresAt) <= Date.now()) {
      await this.sessions.delete({ id: session.id });
      return null;
    }
    return this.accounts.findOne({ where: { id: session.accountId } });
  }

  async logout(req: Request, res: Response): Promise<void> {
    const raw = this.readCookie(req);
    if (raw) {
      const hash = tokenHash(raw, this.secret());
      if (hash) await this.sessions.delete({ tokenHash: hash });
    }
    this.clearCookie(res);
  }

  secret(): string {
    const secret = process.env.SESSION_SECRET ?? '';
    if (secret.length < 32) {
      throw new Error('SESSION_SECRET 至少需要 32 个字符');
    }
    return secret;
  }

  private locked(ip: string): boolean {
    const bucket = this.buckets.get(ip);
    if (!bucket) return false;
    if (bucket.resetAt <= Date.now()) {
      this.buckets.delete(ip);
      return false;
    }
    return bucket.fails >= MAX_FAILS;
  }

  private recordFailure(ip: string): void {
    const now = Date.now();
    const bucket = this.buckets.get(ip);
    if (!bucket || bucket.resetAt <= now) {
      this.buckets.set(ip, { fails: 1, resetAt: now + WINDOW_MS });
      return;
    }
    bucket.fails += 1;
  }

  private readCookie(req: Request): string | undefined {
    const header = req.headers.cookie;
    if (!header) return undefined;
    for (const part of header.split(';')) {
      const trimmed = part.trim();
      const eq = trimmed.indexOf('=');
      if (eq < 0) continue;
      if (trimmed.slice(0, eq) === COOKIE) {
        return decodeURIComponent(trimmed.slice(eq + 1));
      }
    }
    return undefined;
  }

  private setCookie(res: Response, value: string, expires: Date): void {
    const secure = process.env.COOKIE_SECURE === 'true' ? '; Secure' : '';
    res.append(
      'Set-Cookie',
      `${COOKIE}=${encodeURIComponent(value)}; HttpOnly; SameSite=Lax; Path=/; Expires=${expires.toUTCString()}${secure}`,
    );
  }

  private clearCookie(res: Response): void {
    const secure = process.env.COOKIE_SECURE === 'true' ? '; Secure' : '';
    res.append(
      'Set-Cookie',
      `${COOKIE}=; HttpOnly; SameSite=Lax; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT${secure}`,
    );
  }
}
