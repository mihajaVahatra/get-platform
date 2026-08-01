import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export interface Response<T> {
  success: boolean;
  data: T;
  message: string;
  timestamp: Date;
  statusCode: number;
}

@Injectable()
export class ResponseInterceptor<T> implements NestInterceptor<T, Response<T>> {
  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<Response<T>> {
    const ctx = context.switchToHttp();
    const response = ctx.getResponse();

    return next.handle().pipe(
      map((data) => {
        // Si la réponse a déjà une structure personnalisée, on la garde
        if (data && typeof data === 'object' && 'success' in data) {
          return data;
        }

        return {
          success: true,
          data,
          message: data?.message || 'Operation successful',
          timestamp: new Date(),
          statusCode: response.statusCode,
        };
      }),
    );
  }
}
