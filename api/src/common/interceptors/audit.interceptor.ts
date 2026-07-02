import { Injectable, NestInterceptor, ExecutionContext, CallHandler, Logger } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { DataSource } from 'typeorm';
import { DataAuditLogEntity, DataAuditAction } from '../../modules/audit/entities/data-audit-log.entity';

const AUDITABLE_METHODS = new Set(['POST', 'PATCH', 'PUT', 'DELETE']);

const SKIP_PATHS = [
  '/auth/login', '/auth/logout', '/auth/refresh',
  '/auth/forgot-password', '/auth/reset-password', '/health',
];

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  private readonly logger = new Logger(AuditInterceptor.name);

  constructor(private readonly dataSource: DataSource) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const req = context.switchToHttp().getRequest();
    const method: string = req.method?.toUpperCase();

    if (!AUDITABLE_METHODS.has(method)) return next.handle();

    const path: string = req.path || '';
    if (SKIP_PATHS.some(skip => path.includes(skip))) return next.handle();

    const userId: string | null = req.user?.id ?? null;
    const ipAddress: string = req.ip || req.connection?.remoteAddress || null;
    const resource = this.extractResource(path);
    const action = this.methodToAction(method);
    const requestBody = this.sanitizeBody(req.body);

    return next.handle().pipe(
      tap({
        next: (response) => {
          const entityId = this.extractEntityId(response);
          this.saveAuditLog({
            userId, resource, action, entityId,
            requestBody,
            responseSnapshot: this.truncateSnapshot(response),
            ipAddress, statusCode: '200',
          }).catch(err => this.logger.error('Audit log write failed:', err));
        },
        error: (err) => {
          if (err?.status && err.status >= 500) {
            this.saveAuditLog({
              userId, resource, action, entityId: null,
              requestBody, responseSnapshot: null, ipAddress,
              statusCode: String(err.status || 500),
            }).catch(() => {});
          }
        },
      }),
    );
  }

  private extractResource(path: string): string {
    const parts = path.replace(/^\/api\/v\d+\//, '').split('/');
    return parts[0] || 'unknown';
  }

  private methodToAction(method: string): DataAuditAction {
    if (method === 'POST') return 'CREATE';
    if (method === 'DELETE') return 'DELETE';
    return 'UPDATE';
  }

  private extractEntityId(response: any): string | null {
    if (!response) return null;
    return response?.id ?? response?.data?.id ?? null;
  }

  private sanitizeBody(body: any): Record<string, any> | null {
    if (!body || typeof body !== 'object') return null;
    const clean = { ...body };
    delete clean.password;
    delete clean.refreshToken;
    delete clean.token;
    delete clean.currentPassword;
    delete clean.newPassword;
    return clean;
  }

  private truncateSnapshot(data: any): Record<string, any> | null {
    if (!data) return null;
    try {
      const str = JSON.stringify(data);
      if (str.length > 10240) return { _truncated: true, _length: str.length };
      return typeof data === 'object' ? data : { value: data };
    } catch { return null; }
  }

  private async saveAuditLog(data: {
    userId: string | null;
    resource: string;
    action: DataAuditAction;
    entityId: string | null;
    requestBody: Record<string, any> | null;
    responseSnapshot: Record<string, any> | null;
    ipAddress: string | null;
    statusCode: string;
  }): Promise<void> {
    try {
      const repo = this.dataSource.getRepository(DataAuditLogEntity);
      const log = repo.create(data);
      await repo.save(log);
    } catch (err) {
      this.logger.error('Failed to persist audit log:', err);
    }
  }
}
