import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  StreamableFile,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

/** Forme de la réponse JSON standardisée renvoyée par l'API après passage dans l'interceptor. */
export interface Response<T> {
  success: boolean;
  data: T;
  message: string;
  timestamp: Date;
  statusCode: number;
}

/**
 * Interceptor global qui enveloppe toute réponse de contrôleur dans le format standard
 * `{ success, data, message, timestamp, statusCode }` (voir `BaseResponseDto`), sauf
 * pour les fichiers (`StreamableFile`) et les réponses déjà enveloppées, qui sont
 * transmis sans modification.
 */
@Injectable()
export class ResponseInterceptor<T> implements NestInterceptor<
  T,
  Response<T> | StreamableFile
> {
  /**
   * Transforme la valeur retournée par le handler de route en réponse enveloppée,
   * en réutilisant le statusCode déjà positionné sur la réponse HTTP.
   */
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

/** Détermine si `value` a déjà la forme d'une réponse enveloppée (champ `success` booléen). */
function isEnvelopedResponse<T>(value: unknown): value is Response<T> {
  return (
    typeof value === 'object' &&
    value !== null &&
    'success' in value &&
    typeof value.success === 'boolean'
  );
}

/** Récupère le message métier porté par `value.message` s'il existe, sinon un message générique. */
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
