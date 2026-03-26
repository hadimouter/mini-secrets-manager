import { Module } from '@nestjs/common';
import { AuditController } from './audit.controller';
import { AuditService } from './audit.service';

@Module({
  controllers: [AuditController],
  providers: [AuditService],
  // Export pour injection dans SecretsModule
  exports: [AuditService],
})
export class AuditModule {}
