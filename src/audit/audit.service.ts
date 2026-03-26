import { Injectable } from '@nestjs/common';
import { AuditLog } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export type AuditAction = 'CREATE' | 'READ' | 'DELETE' | 'ACCESS_DENIED';

export interface LogAuditData {
  userId: string | null;
  secretId: string | null;
  action: AuditAction;
  ipAddress: string | null;
}

export interface PaginatedAuditLogs {
  data: Pick<
    AuditLog,
    'id' | 'userId' | 'secretId' | 'action' | 'ipAddress' | 'createdAt'
  >[];
  total: number;
  page: number;
  limit: number;
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

  async findAll(page: number, limit: number): Promise<PaginatedAuditLogs> {
    const [data, total] = await this.prisma.$transaction([
      this.prisma.auditLog.findMany({
        select: {
          id: true,
          userId: true,
          secretId: true,
          action: true,
          ipAddress: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.auditLog.count(),
    ]);

    return { data, total, page, limit };
  }
}
