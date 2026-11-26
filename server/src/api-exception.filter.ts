import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from '@nestjs/common';
import { Response } from 'express';

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse<Response>();
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const body = exception.getResponse();
      if (typeof body === 'string') {
        response.status(status).json({ error: body });
        return;
      }
      const record = body as { error?: string; fields?: Record<string, string>; message?: unknown };
      const error =
        record.error ??
        (Array.isArray(record.message) ? '提交的内容无法识别' : undefined) ??
        (typeof record.message === 'string' ? record.message : '请求没有完成');
      const payload: { error: string; fields?: Record<string, string> } = { error };
      if (record.fields && Object.keys(record.fields).length) payload.fields = record.fields;
      response.status(status).json(payload);
      return;
    }
    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ error: '服务暂时不可用' });
  }
}
