import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

// Global — disponible dans tous les modules sans réimporter
@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
