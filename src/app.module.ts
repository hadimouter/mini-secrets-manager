import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { AppController } from './app.controller';
import { AuditModule } from './audit/audit.module';
import { AuthModule } from './auth/auth.module';
import { CryptoModule } from './crypto/crypto.module';
import { MonitoringModule } from './monitoring/monitoring.module';
import { PrismaModule } from './prisma/prisma.module';
import { SecretsModule } from './secrets/secrets.module';

@Module({
  imports: [
    // Validation fail-fast des variables d'environnement au démarrage
    ConfigModule.forRoot({
      isGlobal: true,
      validate: (config: Record<string, unknown>) => {
        const required = ['DATABASE_URL', 'JWT_SECRET', 'ENCRYPTION_KEY'];
        for (const key of required) {
          if (!config[key]) {
            throw new Error(`Missing required environment variable: ${key}`);
          }
        }
        return config;
      },
    }),
    // Rate limiting global — les routes auth ajoutent leur propre limite plus stricte
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 100 }]),
    PrismaModule,
    AuthModule,
    SecretsModule,
    CryptoModule,
    AuditModule,
    MonitoringModule,
  ],
  controllers: [AppController],
})
export class AppModule {}
