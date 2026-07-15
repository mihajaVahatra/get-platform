import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum AuditAction {
  LOGIN = 'LOGIN',
  LOGOUT = 'LOGOUT',
  REGISTER = 'REGISTER',
  CREATE = 'CREATE',
  UPDATE = 'UPDATE',
  DELETE = 'DELETE',
  VIEW = 'VIEW',
  PAYMENT = 'PAYMENT',
  EXPORT = 'EXPORT',
  IMPORT = 'IMPORT',
}

export enum AuditResource {
  USER = 'user',
  STUDENT = 'student',
  SCHOOL = 'school',
  OFFER = 'offer',
  APPLICATION = 'application',
  PAYMENT = 'payment',
  REPORT = 'report',
  NOTIFICATION = 'notification',
  SYSTEM = 'system',
}

export class AuditLogDto {
  @ApiProperty()
  id: string;

  @ApiPropertyOptional()
  userId?: string;

  @ApiProperty()
  action: AuditAction;

  @ApiProperty()
  resource: AuditResource;

  @ApiPropertyOptional()
  resourceId?: string;

  @ApiPropertyOptional({ type: Object })
  before?: any;

  @ApiPropertyOptional({ type: Object })
  after?: any;

  @ApiPropertyOptional()
  ip?: string;

  @ApiPropertyOptional()
  userAgent?: string;

  @ApiProperty()
  status: string;

  @ApiPropertyOptional()
  errorMessage?: string;

  @ApiProperty()
  createdAt: Date;
}
