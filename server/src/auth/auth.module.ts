import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { AuthService } from './auth.service';
import { SessionController } from './session.controller';
import { SessionGuard } from './session.guard';

@Module({
  controllers: [SessionController],
  providers: [
    AuthService,
    { provide: APP_GUARD, useClass: SessionGuard },
  ],
  exports: [AuthService],
})
export class AuthModule {}
