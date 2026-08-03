import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  StreamableFile,
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
export class ResponseInterceptor<T> implements NestInterceptor<
  T,
  Response<T> | StreamableFile
> {
  intercept(
    context: ExecutionContext,
    next: CallHandler<T>,
  ): Observable<Response<T> | StreamableFile> {
    const response = context
      .switchToHttp()
      .getResponse<{ statusCode?: number }>();

    return next.handle().pipe(
      map((data: T) => {
        // Les réponses binaires doivent parvenir telles quelles à l'adaptateur
        // HTTP : les envelopper dans le format JSON commun empêcherait Nest de
        // détecter le StreamableFile et donc de déclencher le téléchargement.
        if (data instanceof StreamableFile) {
          return data;
        }

        // Si la réponse a déjà une structure personnalisée, on la garde
        if (isEnvelopedResponse<T>(data)) {
          return data;
        }

        return {
          success: true,
          data,
          message: responseMessage(data),
          timestamp: new Date(),
          statusCode: response.statusCode ?? 200,
        };
      }),
    );
  }
}

function isEnvelopedResponse<T>(value: unknown): value is Response<T> {
  return (
    typeof value === 'object' &&
    value !== null &&
    'success' in value &&
    typeof value.success === 'boolean'
  );
}

function responseMessage(value: unknown): string {
  if (
    typeof value === 'object' &&
    value !== null &&
    'message' in value &&
    typeof value.message === 'string'
  ) {
    return value.message;
  }
  return 'Operation successful';
}
