import { Module } from '@nestjs/common';
import { CryptoService } from './crypto.service';

@Module({
  providers: [CryptoService],
  // Export pour que SecretsModule puisse injecter CryptoService
  exports: [CryptoService],
})
export class CryptoModule {}
