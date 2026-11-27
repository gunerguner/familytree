import { BadRequestException, INestApplication, ValidationPipe } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';
import { ApiExceptionFilter } from './api-exception.filter';

function securityHeaders(_req: Request, res: Response, next: NextFunction) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('X-Frame-Options', 'DENY');
  next();
}

export function configureApp(app: INestApplication) {
  app.setGlobalPrefix('api');
  app.use(securityHeaders);
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      exceptionFactory: () => new BadRequestException({ error: '提交的内容无法识别' }),
    }),
  );
  app.useGlobalFilters(new ApiExceptionFilter());
}
