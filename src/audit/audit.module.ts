import { Module } from '@nestjs/common';
import { AuditService } from './audit.service';

@Module({
  providers: [AuditService],
  // Export pour injection dans SecretsModule
  exports: [AuditService],
})
export class AuditModule {}
