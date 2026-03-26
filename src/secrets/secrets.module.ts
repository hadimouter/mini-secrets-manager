import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { CryptoModule } from '../crypto/crypto.module';
import { SecretsController } from './secrets.controller';
import { SecretsRepository } from './secrets.repository';
import { SecretsService } from './secrets.service';

@Module({
  imports: [CryptoModule, AuditModule],
  controllers: [SecretsController],
  providers: [SecretsService, SecretsRepository],
})
export class SecretsModule {}
