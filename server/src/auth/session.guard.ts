import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  SetMetadata,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { AuthService } from './auth.service';

export const IS_PUBLIC = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC, true);

@Injectable()
export class SessionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly auth: AuthService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<Request & { user?: { username: string } }>();
    const method = req.method.toUpperCase();
    if (method === 'POST' || method === 'PATCH' || method === 'DELETE') {
      if (req.header('x-familytree') !== '1') {
        throw new ForbiddenException({ error: '缺少请求头' });
      }
    }
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;
    const account = await this.auth.current(req);
    if (!account) {
      throw new UnauthorizedException({ error: '请先登录' });
    }
    req.user = { username: account.username };
    return true;
  }
}
