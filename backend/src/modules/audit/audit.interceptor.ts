import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Inject,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { AuditService } from './audit.service';
import { AuditAction, AuditResource } from './dto/audit-log.dto';

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(private auditService: AuditService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();

    const user = request.user;
    const method = request.method;
    const url = request.url;
    const ip = request.ip || request.connection?.remoteAddress;
    const userAgent = request.headers['user-agent'];

    // Déterminer l'action et la ressource en fonction de la route
    const { action, resource, resourceId } = this.parseRoute(
      method,
      url,
      request.params,
    );

    const startTime = Date.now();

    return next.handle().pipe(
      tap((data) => {
        const duration = Date.now() - startTime;
        // Enregistrer l'action en succès
        this.auditService
          .log({
            userId: user?.id,
            action,
            resource,
            resourceId,
            after: data,
            ip,
            userAgent,
            status: 'SUCCESS',
          })
          .catch((err) => console.error('Audit log error:', err));
      }),
      catchError((error) => {
        // Enregistrer l'action en échec
        this.auditService
          .log({
            userId: user?.id,
            action,
            resource,
            resourceId,
            ip,
            userAgent,
            status: 'FAILED',
            errorMessage: error.message,
          })
          .catch((err) => console.error('Audit log error:', err));

        // Relancer l'erreur pour qu'elle soit traitée normalement
        throw error;
      }),
    );
  }

  private parseRoute(
    method: string,
    url: string,
    params: any,
  ): {
    action: AuditAction;
    resource: AuditResource;
    resourceId?: string;
  } {
    // Déterminer l'action
    let action: AuditAction;
    switch (method) {
      case 'GET':
        action = AuditAction.VIEW;
        break;
      case 'POST':
        action = AuditAction.CREATE;
        break;
      case 'PUT':
      case 'PATCH':
        action = AuditAction.UPDATE;
        break;
      case 'DELETE':
        action = AuditAction.DELETE;
        break;
      default:
        action = AuditAction.VIEW;
    }

    // Déterminer la ressource
    let resource: AuditResource = AuditResource.SYSTEM;
    let resourceId: string | undefined;

    if (url.includes('/auth/login')) {
      action = AuditAction.LOGIN;
      resource = AuditResource.USER;
    } else if (url.includes('/auth/register')) {
      action = AuditAction.REGISTER;
      resource = AuditResource.USER;
    } else if (url.includes('/auth/logout')) {
      action = AuditAction.LOGOUT;
      resource = AuditResource.USER;
    } else if (url.includes('/students') || url.includes('/student')) {
      resource = AuditResource.STUDENT;
      resourceId = params?.id;
    } else if (url.includes('/schools')) {
      resource = AuditResource.SCHOOL;
      resourceId = params?.id;
    } else if (url.includes('/offers')) {
      resource = AuditResource.OFFER;
      resourceId = params?.id;
    } else if (url.includes('/applications')) {
      resource = AuditResource.APPLICATION;
      resourceId = params?.id;
    } else if (url.includes('/payments')) {
      resource = AuditResource.PAYMENT;
      resourceId = params?.id;
      if (method === 'POST' && url.includes('/payments/initiate')) {
        action = AuditAction.PAYMENT;
      }
    } else if (url.includes('/reports')) {
      resource = AuditResource.REPORT;
    } else if (url.includes('/notifications')) {
      resource = AuditResource.NOTIFICATION;
    }

    return { action, resource, resourceId };
  }
}
