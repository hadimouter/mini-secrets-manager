import { Controller, Get, Header, Res, UseGuards } from '@nestjs/common';
import { ApiExcludeEndpoint } from '@nestjs/swagger';
import type { Response } from 'express';
import { MetricsAuthGuard } from './metrics-auth.guard';
import { MetricsService } from './metrics.service';

@Controller('metrics')
export class MetricsController {
  constructor(private readonly metricsService: MetricsService) {}

  @Get()
  @UseGuards(MetricsAuthGuard)
  @Header('Cache-Control', 'no-store')
  @ApiExcludeEndpoint()
  async getMetrics(@Res() res: Response): Promise<void> {
    res.set('Content-Type', this.metricsService.getContentType());
    res.end(await this.metricsService.getMetrics());
  }
}
