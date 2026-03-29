import { Module } from '@nestjs/common';
import { HttpMetricsInterceptor } from './http-metrics.interceptor';
import { MetricsAuthGuard } from './metrics-auth.guard';
import { MetricsController } from './metrics.controller';
import { MetricsService } from './metrics.service';

@Module({
  controllers: [MetricsController],
  providers: [MetricsService, HttpMetricsInterceptor, MetricsAuthGuard],
  exports: [MetricsService, HttpMetricsInterceptor],
})
export class MonitoringModule {}
