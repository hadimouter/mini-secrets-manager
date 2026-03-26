import { Controller, Get, Header, Res } from '@nestjs/common';
import { ApiExcludeEndpoint } from '@nestjs/swagger';
import type { Response } from 'express';
import { MetricsService } from './metrics.service';

@Controller('metrics')
export class MetricsController {
  constructor(private readonly metricsService: MetricsService) {}

  // Endpoint réservé au scraping Prometheus — pas de JWT, accès restreint par réseau
  @Get()
  @Header('Cache-Control', 'no-store')
  @ApiExcludeEndpoint()
  async getMetrics(@Res() res: Response): Promise<void> {
    res.set('Content-Type', this.metricsService.getContentType());
    res.end(await this.metricsService.getMetrics());
  }
}
