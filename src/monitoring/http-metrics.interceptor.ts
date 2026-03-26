import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { MetricsService } from './metrics.service';

@Injectable()
export class HttpMetricsInterceptor implements NestInterceptor {
  constructor(private readonly metrics: MetricsService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest<Request>();
    const res = context.switchToHttp().getResponse<Response>();
    const end = this.metrics.httpRequestDuration.startTimer();

    const route =
      typeof (req.route as { path?: string } | undefined)?.path === 'string'
        ? (req.route as { path: string }).path
        : req.path;

    return next.handle().pipe(
      tap(() => {
        end({ method: req.method, route, status_code: String(res.statusCode) });
      }),
    );
  }
}
