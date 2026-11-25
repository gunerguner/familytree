import { Body, Controller, Delete, Get, HttpCode, Post, Req, Res } from '@nestjs/common';
import { IsString } from 'class-validator';
import { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { Public } from './session.guard';

class LoginDto {
  @IsString()
  username!: string;

  @IsString()
  password!: string;
}

@Controller('session')
export class SessionController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Post()
  @HttpCode(204)
  async login(@Body() body: LoginDto, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    await this.auth.login(body.username, body.password, this.auth.clientIp(req), res);
  }

  @Get()
  me(@Req() req: Request & { user: { username: string } }) {
    return { username: req.user.username };
  }

  @Public()
  @Delete()
  @HttpCode(204)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    await this.auth.logout(req, res);
  }
}
