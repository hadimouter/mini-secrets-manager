import { Injectable, OnModuleInit } from '@nestjs/common';
import * as promClient from 'prom-client';

@Injectable()
export class MetricsService implements OnModuleInit {
  private readonly registry: promClient.Registry;

  readonly secretsCreated: promClient.Counter;
  readonly secretsRead: promClient.Counter;
  readonly secretsDeleted: promClient.Counter;
  readonly authFailures: promClient.Counter;
  readonly httpRequestDuration: promClient.Histogram;

  constructor() {
    // Registre dédié — évite les conflits avec le registre global en cas de hot-reload
    this.registry = new promClient.Registry();

    this.secretsCreated = new promClient.Counter({
      name: 'secrets_created_total',
      help: 'Total number of secrets created',
      registers: [this.registry],
    });

    this.secretsRead = new promClient.Counter({
      name: 'secrets_read_total',
      help: 'Total number of secrets read',
      registers: [this.registry],
    });

    this.secretsDeleted = new promClient.Counter({
      name: 'secrets_deleted_total',
      help: 'Total number of secrets deleted',
      registers: [this.registry],
    });

    this.authFailures = new promClient.Counter({
      name: 'auth_failures_total',
      help: 'Total number of failed authentication attempts',
      registers: [this.registry],
    });

    this.httpRequestDuration = new promClient.Histogram({
      name: 'http_request_duration_seconds',
      help: 'HTTP request duration in seconds',
      labelNames: ['method', 'route', 'status_code'],
      buckets: [0.05, 0.1, 0.3, 0.5, 1, 2, 5],
      registers: [this.registry],
    });
  }

  onModuleInit(): void {
    // Métriques Node.js standard (event loop, heap, GC…)
    promClient.collectDefaultMetrics({ register: this.registry });
  }

  async getMetrics(): Promise<string> {
    return this.registry.metrics();
  }

  getContentType(): string {
    return this.registry.contentType;
  }
}
