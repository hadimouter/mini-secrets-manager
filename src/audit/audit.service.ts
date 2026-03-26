import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export type AuditAction = 'CREATE' | 'READ' | 'DELETE' | 'ACCESS_DENIED';

export interface LogAuditData {
  userId: string | null;
  secretId: string | null;
  action: AuditAction;
  ipAddress: string | null;
}

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  // RÈGLE : ne jamais inclure la valeur du secret dans les données loguées
  async log(data: LogAuditData): Promise<void> {
    await this.prisma.auditLog.create({
      data: {
        userId: data.userId,
        secretId: data.secretId,
        action: data.action,
        ipAddress: data.ipAddress,
      },
    });
  }
}
