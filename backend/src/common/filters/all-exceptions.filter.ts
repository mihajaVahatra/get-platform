import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const message = this.extractMessage(exception);

    const responseBody = {
      success: false,
      message,
      timestamp: new Date().toISOString(),
      path: request.url,
      statusCode: status,
    };

    this.logger.error(
      `${request.method} ${request.url} - ${status} - ${message}`,
    );

    response.status(status).json(responseBody);
  }

  // ValidationPipe (class-validator) renvoie un tableau de messages détaillés
  // par champ dans le corps de l'exception (`getResponse().message`) ;
  // `exception.message` seul ne vaut que le texte générique "Bad Request
  // Exception" et masquait ces détails à l'appelant.
  private extractMessage(exception: unknown): string {
    if (!(exception instanceof HttpException)) return 'Internal server error';
    const response = exception.getResponse();
    if (typeof response === 'object' && response !== null && 'message' in response) {
      const raw = (response as { message: unknown }).message;
      if (Array.isArray(raw)) return raw.join(' ; ');
      if (typeof raw === 'string') return raw;
    }
    return exception.message;
  }
}
